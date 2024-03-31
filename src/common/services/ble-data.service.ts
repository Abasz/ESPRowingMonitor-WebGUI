import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BluetoothCore } from "@manekinekko/angular-web-bluetooth";
import {
    BehaviorSubject,
    bufferWhen,
    catchError,
    combineLatest,
    concat,
    filter,
    finalize,
    map,
    merge,
    Observable,
    of,
    retry,
    shareReplay,
    startWith,
    Subject,
    switchMap,
    take,
    tap,
    timer,
} from "rxjs";

import {
    BATTERY_LEVEL_CHARACTERISTIC,
    BATTERY_LEVEL_SERVICE,
    BleOpCodes,
    BleResponseOpCodes,
    CYCLING_POWER_CHARACTERISTIC,
    CYCLING_POWER_CONTROL_CHARACTERISTIC,
    CYCLING_POWER_SERVICE,
    CYCLING_SPEED_AND_CADENCE_CONTROL_CHARACTERISTIC,
    CYCLING_SPEED_AND_CADENCE_SERVICE,
    EXTENDED_CHARACTERISTIC,
    ExtendedMetricsDto,
    HANDLE_FORCES_CHARACTERISTIC,
} from "../common.interfaces";
import { withDelay } from "../utils/utility.functions";

import {
    BleServiceFlag,
    CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC,
    IRowerDataDto,
    IRowerSettings,
    LogLevel,
} from "./../common.interfaces";
import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class BluetoothMetricsService {
    private batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);
    private bluetoothDevice: BluetoothDevice | undefined;
    private cancellationToken: AbortController = new AbortController();

    private data$: Observable<IRowerDataDto | IRowerSettings>;

    private extendedCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);
    private handleForceCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    private isConnectedSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    private lastBroadcast: number = 0;
    private lastDistance: number = 0;

    private measurementCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    constructor(
        private configManager: ConfigManagerService,
        private snackBar: MatSnackBar,
        private ble: BluetoothCore,
    ) {
        this.data$ = merge(
            combineLatest([
                this.streamMeasurement$(),
                this.streamExtended$().pipe(
                    map(
                        (extendedData: ExtendedMetricsDto): Omit<ExtendedMetricsDto, "settings"> => ({
                            data: extendedData.data,
                        }),
                    ),
                ),
                this.streamHandleForces$(),
            ]),
            combineLatest([
                this.streamExtended$().pipe(
                    map(
                        (extendedData: ExtendedMetricsDto): Omit<ExtendedMetricsDto, "data"> => ({
                            settings: { ...extendedData.settings },
                        }),
                    ),
                ),
                this.streamMonitorBatteryLevel$(),
            ]),
        ).pipe(
            map(
                (
                    data:
                        | [
                              [number, number, number, number],
                              Omit<ExtendedMetricsDto, "settings">,
                              Array<number>,
                          ]
                        | [Omit<ExtendedMetricsDto, "data">, number],
                ): IRowerDataDto | IRowerSettings => {
                    if (data.length === 3) {
                        const [cyclingPowerData, extendedData, handleForces]: [
                            [number, number, number, number],
                            Omit<ExtendedMetricsDto, "settings">,
                            Array<number>,
                        ] = data;

                        return {
                            timeStamp: new Date(),
                            data: [...cyclingPowerData, ...extendedData.data, handleForces, []],
                        };
                    }
                    const [{ settings }, batteryLevel]: [Omit<ExtendedMetricsDto, "data">, number] = data;

                    return {
                        timeStamp: new Date(),
                        logToWebSocket: settings.logToWebSocket,
                        logToSdCard: settings.logToSdCard,
                        bleServiceFlag:
                            this.measurementCharacteristic.value?.uuid !==
                            BluetoothUUID.getCharacteristic(CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC)
                                ? BleServiceFlag.CpsService
                                : BleServiceFlag.CscService,
                        logLevel: settings.logLevel,
                        batteryLevel: batteryLevel,
                    };
                },
            ),
            filter((data: IRowerDataDto | IRowerSettings): boolean => {
                const minimumBroadcastTime = 4000;
                if (
                    "data" in data &&
                    (data.data[1] !== this.lastDistance ||
                        Date.now() - this.lastBroadcast > minimumBroadcastTime)
                ) {
                    this.lastDistance = data.data[1];
                    this.lastBroadcast = Date.now();

                    return true;
                }

                if ("bleServiceFlag" in data) {
                    return true;
                }

                return false;
            }),
            tap({ unsubscribe: (): void => this.disconnectDevice() }),
            shareReplay({ refCount: true }),
        );
    }

    async changeBleServiceType(bleService: BleServiceFlag): Promise<void> {
        if (
            this.bluetoothDevice?.gatt === undefined ||
            this.measurementCharacteristic.value?.service === undefined
        ) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }
        const characteristic = await this.ble.getCharacteristic(
            this.measurementCharacteristic.value?.service,
            this.measurementCharacteristic.value?.uuid !==
                BluetoothUUID.getCharacteristic(CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC)
                ? CYCLING_POWER_CONTROL_CHARACTERISTIC
                : CYCLING_SPEED_AND_CADENCE_CONTROL_CHARACTERISTIC,
        );

        // eslint-disable-next-line no-null/no-null
        if (characteristic === null) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        this.ble
            .observeValue$(characteristic)
            .pipe(take(1))
            .subscribe((response: DataView): void => {
                if (response.getUint8(2) === BleResponseOpCodes.Successful) {
                    this.disconnectDevice();
                }
                this.snackBar.open(
                    response.getUint8(2) === BleResponseOpCodes.Successful
                        ? "BLE service changed, device is restarting"
                        : "An error occurred while changing BLE service",
                    "Dismiss",
                );
            });

        await characteristic.writeValue(new Uint8Array([BleOpCodes.ChangeBleService, bleService]));
    }

    async changeLogLevel(logLevel: LogLevel): Promise<void> {
        if (
            this.bluetoothDevice?.gatt === undefined ||
            this.measurementCharacteristic.value?.service === undefined
        ) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }
        const characteristic = await this.ble.getCharacteristic(
            this.measurementCharacteristic.value?.service,
            this.measurementCharacteristic.value?.uuid !==
                BluetoothUUID.getCharacteristic(CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC)
                ? CYCLING_POWER_CONTROL_CHARACTERISTIC
                : CYCLING_SPEED_AND_CADENCE_CONTROL_CHARACTERISTIC,
        );

        // eslint-disable-next-line no-null/no-null
        if (characteristic === null) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        this.ble
            .observeValue$(characteristic)
            .pipe(take(1))
            .subscribe((response: DataView): void => {
                this.snackBar.open(
                    response.getUint8(2) === BleResponseOpCodes.Successful
                        ? "Log level changed"
                        : "An error occurred while changing Log level",
                    "Dismiss",
                );
            });

        await characteristic.writeValue(new Uint8Array([BleOpCodes.SetLogLevel, logLevel]));
    }

    // changeLogToSdCard(shouldEnable: boolean): void {
    //     if (this.webSocketSubject?.closed === false) {
    //         this.webSocketSubject?.next([
    //             PSCOpCodes.SetSdCardLogging,
    //             shouldEnable ? 1 : 0,
    //         ] as unknown as IRowerDataDto);
    //     }
    // }

    // changeLogToWebSocket(shouldEnable: boolean): void {
    //     if (this.webSocketSubject?.closed === false) {
    //         this.webSocketSubject?.next([
    //             PSCOpCodes.SetWebSocketDeltaTimeLogging,
    //             shouldEnable ? 1 : 0,
    //         ] as unknown as IRowerDataDto);
    //     }
    // }

    connectionStatus(): Observable<boolean> {
        return this.isConnectedSubject.asObservable();
    }

    data(): Observable<IRowerDataDto | IRowerSettings> {
        this.reconnect();

        return this.data$;
    }

    disconnectDevice(): void {
        if (this.bluetoothDevice !== undefined) {
            this.bluetoothDevice.ongattserverdisconnected = (): void => {
                return;
            };

            this.bluetoothDevice.gatt?.disconnect();
            this.bluetoothDevice = undefined;
        }

        this.cancellationToken.abort();
        this.batteryCharacteristic.next(undefined);
        this.extendedCharacteristic.next(undefined);
        this.handleForceCharacteristic.next(undefined);
        this.measurementCharacteristic.next(undefined);
        this.isConnectedSubject.next(false);
    }

    // TODO: Reconnect feature:
    // 1) this has been only tested in chrome
    // 2) need to enable the chrome://flags/#enable-web-bluetooth-new-permissions-backend in chrome

    async discover(): Promise<void> {
        this.disconnectDevice();

        const device = await this.ble.discover({
            acceptAllDevices: false,
            filters: [
                { services: [CYCLING_POWER_SERVICE] },
                { services: [CYCLING_SPEED_AND_CADENCE_SERVICE] },
            ],
            optionalServices: [BATTERY_LEVEL_SERVICE],
        });
        if (device?.gatt === undefined) {
            await this.reconnect();

            return;
        }
        await this.connect(device);
    }

    async reconnect(): Promise<void> {
        this.disconnectDevice();
        const device = (await navigator.bluetooth.getDevices()).filter(
            (device: BluetoothDevice): boolean =>
                device.id === this.configManager.getItem("ergoMonitorBleId"),
        )?.[0];
        if (device === undefined) {
            return;
        }

        device.onadvertisementreceived = this.reconnectHandler;
        this.cancellationToken = new AbortController();
        await device.watchAdvertisements({ signal: this.cancellationToken.signal });
    }

    streamExtended$(): Observable<ExtendedMetricsDto> {
        return this.extendedCharacteristic.pipe(
            filter(
                (
                    extendedCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): extendedCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    extendedCharacteristic !== undefined,
            ),
            switchMap(
                (extendedCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<ExtendedMetricsDto> =>
                    this.observeExtended(extendedCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: string, count: number): Observable<0> => {
                    if (this.batteryCharacteristic.value?.service.device.gatt && error.includes("unknown")) {
                        console.warn(`Extended metrics characteristic error: ${error}; retrying: ${count}`);

                        this.connectToBattery(this.batteryCharacteristic.value.service.device.gatt);
                    }

                    return timer(2000);
                },
            }),
            startWith({
                settings: {
                    logToWebSocket: undefined,
                    logToSdCard: undefined,
                    logLevel: LogLevel.Silent,
                },
                data: [0, 0, 0, 0],
            } as ExtendedMetricsDto),
        );
    }

    streamHandleForces$(): Observable<Array<number>> {
        return this.handleForceCharacteristic.pipe(
            filter(
                (
                    handleForceCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): handleForceCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    handleForceCharacteristic !== undefined,
            ),
            switchMap(
                (handleForceCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<Array<number>> =>
                    this.observeHandleForces(handleForceCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: string, count: number): Observable<0> => {
                    if (this.batteryCharacteristic.value?.service.device.gatt && error.includes("unknown")) {
                        console.warn(`Handle characteristic error: ${error}; retrying: ${count}`);

                        this.connectToBattery(this.batteryCharacteristic.value.service.device.gatt);
                    }

                    return timer(2000);
                },
            }),
            startWith([]),
        );
    }

    streamMeasurement$(): Observable<[number, number, number, number]> {
        return this.measurementCharacteristic.pipe(
            filter(
                (
                    cyclingPowerCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): cyclingPowerCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    cyclingPowerCharacteristic !== undefined,
            ),
            switchMap(
                (
                    cyclingPowerCharacteristic: BluetoothRemoteGATTCharacteristic,
                ): Observable<[number, number, number, number]> =>
                    this.observeCyclingPower(cyclingPowerCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: string, count: number): Observable<0> => {
                    if (this.batteryCharacteristic.value?.service.device.gatt && error.includes("unknown")) {
                        console.warn(`Measurement characteristic error: ${error}; retrying: ${count}`);

                        this.connectToBattery(this.batteryCharacteristic.value.service.device.gatt);
                    }

                    return timer(2000);
                },
            }),
            startWith([0, 0, 0, 0] as [number, number, number, number]),
        );
    }

    streamMonitorBatteryLevel$(): Observable<number> {
        return this.batteryCharacteristic.pipe(
            filter(
                (
                    batteryCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): batteryCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    batteryCharacteristic !== undefined,
            ),
            switchMap(
                (batteryCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<number> =>
                    this.observeBattery(batteryCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: string, count: number): Observable<0> => {
                    if (this.batteryCharacteristic.value?.service.device.gatt && error.includes("unknown")) {
                        console.warn(`Battery characteristic error: ${error}; retrying: ${count}`);

                        this.connectToBattery(this.batteryCharacteristic.value.service.device.gatt);
                    }

                    return timer(2000);
                },
            }),
            catchError((error: string): Observable<number> => {
                console.error(error);
                this.snackBar.open("Error while connecting to battery service", "Dismiss");

                return of(0);
            }),
            startWith(0),
        );
    }

    private async connect(device: BluetoothDevice): Promise<void> {
        try {
            this.bluetoothDevice = device;
            const gatt = await this.ble.connectDevice(device);

            if (this.bluetoothDevice === undefined) {
                return;
            }

            await withDelay(1000, this.connectToMeasurement(gatt));
            await withDelay(1000, this.connectToExtended(gatt));
            await withDelay(1000, this.connectToHandleForces(gatt));
            await withDelay(1000, this.connectToBattery(gatt));

            this.isConnectedSubject.next(this.bluetoothDevice.gatt?.connected === true);

            this.configManager.setItem("ergoMonitorBleId", device.id);
            device.ongattserverdisconnected = this.disconnectHandler;
        } catch (error) {
            this.snackBar.open(`${error}`, "Dismiss");
            this.isConnectedSubject.next(false);
        }
    }

    private async connectToBattery(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            const primaryService = await this.ble.getPrimaryService(gatt, BATTERY_LEVEL_SERVICE);
            const characteristic = await this.ble.getCharacteristic(
                primaryService,
                BATTERY_LEVEL_CHARACTERISTIC,
            );
            this.batteryCharacteristic.next(characteristic ?? undefined);

            return characteristic ?? undefined;
        } catch (error) {
            if (this.bluetoothDevice) {
                this.snackBar.open("Ergo battery service is unavailable", "Dismiss");
                console.warn(error);
            }
        }

        return;
    }

    private async connectToExtended(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            const primaryService = await this.getService(gatt);
            const characteristic = await this.ble.getCharacteristic(primaryService, EXTENDED_CHARACTERISTIC);

            this.extendedCharacteristic.next(characteristic ?? undefined);

            return characteristic ?? undefined;
        } catch (error) {
            if (this.bluetoothDevice) {
                this.snackBar.open("Error connecting to Extended Metrics", "Dismiss");
                console.error(error);
            }
        }

        return;
    }

    private async connectToHandleForces(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            const primaryService = await this.getService(gatt);
            const characteristic = await this.ble.getCharacteristic(
                primaryService,
                HANDLE_FORCES_CHARACTERISTIC,
            );
            this.handleForceCharacteristic.next(characteristic ?? undefined);

            return characteristic ?? undefined;
        } catch (error) {
            if (this.bluetoothDevice) {
                this.snackBar.open("Error connecting to Handles Forces", "Dismiss");
                console.error(error);
            }
        }

        return;
    }

    private async connectToMeasurement(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            const primaryService = await this.getService(gatt);

            const characteristic = await this.ble.getCharacteristic(
                primaryService,
                primaryService.uuid === BluetoothUUID.getService(CYCLING_SPEED_AND_CADENCE_SERVICE)
                    ? CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC
                    : CYCLING_POWER_CHARACTERISTIC,
            );
            this.measurementCharacteristic.next(characteristic ?? undefined);

            return characteristic ?? undefined;
        } catch (error) {
            if (this.bluetoothDevice) {
                this.snackBar.open("Error connecting to Measurement Characteristic", "Dismiss");
                console.error(error);
            }
        }

        return;
    }

    private disconnectHandler = async (event: Event): Promise<void> => {
        const device: BluetoothDevice = event.target as BluetoothDevice;
        device.onadvertisementreceived = this.reconnectHandler;

        if (!device.watchingAdvertisements) {
            this.cancellationToken = new AbortController();
            await device.watchAdvertisements({ signal: this.cancellationToken.signal });
        }
        this.snackBar.open("Ergometer Monitor disconnected", "Dismiss");
        this.isConnectedSubject.next(false);
    };

    private async getService(gatt: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTService> {
        let primaryService: BluetoothRemoteGATTService | undefined = undefined;
        const errorMessages: Array<unknown> = [];
        try {
            primaryService = await this.ble.getPrimaryService(gatt, CYCLING_POWER_SERVICE);
        } catch (error) {
            errorMessages?.push(error);
        }

        try {
            primaryService = await this.ble.getPrimaryService(gatt, CYCLING_SPEED_AND_CADENCE_SERVICE);
        } catch (error) {
            errorMessages?.push(error);
        }

        if (primaryService === undefined) {
            throw errorMessages;
        }

        return primaryService;
    }

    private observeBattery(batteryCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<number> {
        return concat(
            this.ble.readValue$(batteryCharacteristic),
            this.ble.observeValue$(batteryCharacteristic),
        ).pipe(
            map((value: DataView): number => value.getInt8(0)),
            finalize((): void => {
                this.batteryCharacteristic.next(undefined);
            }),
        );
    }

    private observeCyclingPower(
        cyclingPowerCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<[number, number, number, number]> {
        let lastRevTime = 0;
        let revTime = 0;

        let lastStrokeTime = 0;
        let strokeTime = 0;

        return this.ble.observeValue$(cyclingPowerCharacteristic).pipe(
            map((value: DataView): [number, number, number, number] => {
                if (
                    cyclingPowerCharacteristic.uuid ===
                    BluetoothUUID.getCharacteristic(CYCLING_POWER_CHARACTERISTIC)
                ) {
                    const revTimeDelta: number =
                        value.getUint16(2 + 2 + 4, true) >= lastRevTime
                            ? value.getUint16(2 + 2 + 4, true) - lastRevTime
                            : 65535 - lastRevTime + value.getUint16(2 + 2 + 4, true);

                    revTime += Math.round((revTimeDelta / 2048) * 1e6);

                    const strokeTimeDelta =
                        value.getUint16(2 + 2 + 4 + 2 + 2, true) >= lastStrokeTime
                            ? value.getUint16(2 + 2 + 4 + 2 + 2, true) - lastStrokeTime
                            : 65535 - lastStrokeTime + value.getUint16(2 + 2 + 4 + 2 + 2, true);

                    strokeTime += Math.round((strokeTimeDelta / 1024) * 1e6);

                    lastRevTime = value.getUint16(2 + 2 + 4, true);
                    lastStrokeTime = value.getUint16(2 + 2 + 4 + 2 + 2, true);

                    return [
                        revTime,
                        value.getUint32(2 + 2, true),
                        strokeTime,
                        value.getUint16(2 + 2 + 4 + 2, true),
                    ];
                }
                const revTimeDelta =
                    value.getUint16(1 + 4, true) >= lastRevTime
                        ? value.getUint16(1 + 4, true) - lastRevTime
                        : 65535 - lastRevTime + value.getUint16(1 + 4, true);
                revTime += Math.round((revTimeDelta / 1024) * 1e6);

                const strokeTimeDelta =
                    value.getUint16(1 + 4 + 2 + 2, true) >= lastStrokeTime
                        ? value.getUint16(1 + 4 + 2 + 2, true) - lastStrokeTime
                        : 65535 - lastStrokeTime + value.getUint16(1 + 4 + 2 + 2, true);

                strokeTime += Math.round((strokeTimeDelta / 1024) * 1e6);

                lastRevTime = value.getUint16(1 + 4, true);
                lastStrokeTime = value.getUint16(1 + 4 + 2 + 2, true);

                return [revTime, value.getUint32(1, true), strokeTime, value.getUint16(1 + 4 + 2, true)];
            }),
            finalize((): void => {
                this.measurementCharacteristic.next(undefined);
            }),
        );
    }

    private observeExtended(
        extendedCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<ExtendedMetricsDto> {
        return this.ble.observeValue$(extendedCharacteristic).pipe(
            map((value: DataView): ExtendedMetricsDto => {
                const logToWs = value.getUint8(0) & 3;
                const logToSd = (value.getUint8(0) >> 2) & 3;
                const logLevel = (value.getUint8(0) >> 4) & 7;

                return {
                    settings: {
                        logToWebSocket: logToWs === 0 ? undefined : logToWs === 1 ? false : true,
                        logToSdCard: logToSd === 0 ? undefined : logToWs === 1 ? false : true,
                        logLevel: logLevel,
                    },
                    data: [
                        value.getUint16(1, true),
                        value.getUint32(1 + 2, true),
                        value.getUint32(1 + 2 + 4, true),
                        value.getUint8(1 + 2 + 4 + 4),
                    ],
                };
            }),
            finalize((): void => {
                this.extendedCharacteristic.next(undefined);
            }),
        );
    }

    private observeHandleForces(
        handleForcesCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<Array<number>> {
        const complete: Subject<void> = new Subject();

        return this.ble.observeValue$(handleForcesCharacteristic).pipe(
            tap((value: DataView): void => {
                if (value.getUint8(0) === value.getUint8(1)) {
                    complete.next();
                }
            }),
            bufferWhen((): Subject<void> => complete),
            map(
                (values: Array<DataView>): Array<number> =>
                    values.reduce((accumulator: Array<number>, value: DataView): Array<number> => {
                        for (let index = 2; index < value.byteLength; index += 4) {
                            accumulator.push(value.getFloat32(index, true));
                        }

                        return accumulator;
                    }, []),
            ),
            finalize((): void => {
                this.handleForceCharacteristic.next(undefined);
            }),
        );
    }

    private reconnectHandler: (event: BluetoothAdvertisingEvent) => void = (
        event: BluetoothAdvertisingEvent,
    ): void => {
        this.cancellationToken.abort();

        this.connect(event.device);
    };
}
