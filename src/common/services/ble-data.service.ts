import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BluetoothCore } from "@manekinekko/angular-web-bluetooth";
import {
    BehaviorSubject,
    buffer,
    catchError,
    combineLatest,
    concat,
    distinctUntilChanged,
    filter,
    finalize,
    interval,
    map,
    merge,
    Observable,
    of,
    retry,
    shareReplay,
    startWith,
    switchMap,
    take,
    tap,
    timer,
} from "rxjs";

import {
    BaseMetricsDto,
    BATTERY_LEVEL_CHARACTERISTIC,
    BATTERY_LEVEL_SERVICE,
    BleOpCodes,
    BleResponseOpCodes,
    CYCLING_POWER_CHARACTERISTIC,
    CYCLING_POWER_SERVICE,
    CYCLING_SPEED_AND_CADENCE_SERVICE,
    EXTENDED_CHARACTERISTIC,
    EXTENDED_METRICS_SERVICE,
    ExtendedMetricsDto,
    HANDLE_FORCES_CHARACTERISTIC,
    MetricsStream,
    SETTINGS_CHARACTERISTIC,
    SETTINGS_CONTROL_POINT,
    SETTINGS_SERVICE,
    SettingsStream,
    SettingsWithBatteryStream,
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

    private measurementCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    private settingsCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    constructor(
        private configManager: ConfigManagerService,
        private snackBar: MatSnackBar,
        private ble: BluetoothCore,
    ) {
        const allMetrics$ = combineLatest([
            this.streamMeasurement$(),
            this.streamExtended$(),
            this.streamHandleForces$(),
        ]).pipe(
            distinctUntilChanged(
                (current: MetricsStream, previous: MetricsStream): boolean =>
                    current[0][1] === previous[0][1],
            ),
        );
        this.data$ = merge(
            combineLatest([
                allMetrics$,
                allMetrics$.pipe(switchMap((): Observable<number> => interval(4500))),
            ]).pipe(map(([metrics]: [MetricsStream, number]): MetricsStream => metrics)),
            combineLatest([this.streamSettings$(), this.streamMonitorBatteryLevel$()]),
        ).pipe(
            map((data: MetricsStream | SettingsWithBatteryStream): IRowerDataDto | IRowerSettings => {
                if (data.length === 2) {
                    const [settings, batteryLevel]: SettingsWithBatteryStream = data;

                    return {
                        ...settings,
                        batteryLevel,
                        timeStamp: new Date(),
                    };
                }
                const [cyclingPowerData, extendedData, handleForces]: MetricsStream = data;

                return {
                    timeStamp: new Date(),
                    data: [...cyclingPowerData, ...extendedData, handleForces, []],
                };
            }),
            tap({ unsubscribe: (): void => this.disconnectDevice() }),
            shareReplay({ refCount: true }),
        );
    }

    async changeBleServiceType(bleService: BleServiceFlag): Promise<void> {
        if (
            this.bluetoothDevice?.gatt === undefined ||
            this.settingsCharacteristic.value?.service === undefined
        ) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await this.ble.getCharacteristic(
                this.settingsCharacteristic.value?.service,
                SETTINGS_CONTROL_POINT,
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

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(
                new Uint8Array([BleOpCodes.ChangeBleService, bleService]),
            );
        } catch (error) {
            console.error(error);
            this.snackBar.open("Failed to change BLE service", "Dismiss");
        }
    }

    async changeLogLevel(logLevel: LogLevel): Promise<void> {
        if (
            this.bluetoothDevice?.gatt === undefined ||
            this.settingsCharacteristic.value?.service === undefined
        ) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }
        try {
            const characteristic = await this.ble.getCharacteristic(
                this.settingsCharacteristic.value?.service,
                SETTINGS_CONTROL_POINT,
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

            await characteristic.startNotifications();
            await characteristic.writeValueWithResponse(new Uint8Array([BleOpCodes.SetLogLevel, logLevel]));
        } catch (error) {
            console.error(error);
            this.snackBar.open("Failed to set Log Level", "Dismiss");
        }
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
        this.settingsCharacteristic.next(undefined);
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
            optionalServices: [BATTERY_LEVEL_SERVICE, SETTINGS_SERVICE, EXTENDED_METRICS_SERVICE],
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
                    if (this.extendedCharacteristic.value?.service.device.gatt && error.includes("unknown")) {
                        console.warn(`Extended metrics characteristic error: ${error}; retrying: ${count}`);

                        this.connectToExtended(this.extendedCharacteristic.value.service.device.gatt);
                    }

                    return timer(2000);
                },
            }),
            startWith([0, 0, 0, 0] as ExtendedMetricsDto),
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
                    if (
                        this.handleForceCharacteristic.value?.service.device.gatt &&
                        error.includes("unknown")
                    ) {
                        console.warn(`Handle characteristic error: ${error}; retrying: ${count}`);

                        this.connectToHandleForces(this.handleForceCharacteristic.value.service.device.gatt);
                    }

                    return timer(2000);
                },
            }),
            startWith([]),
        );
    }

    streamMeasurement$(): Observable<BaseMetricsDto> {
        return this.measurementCharacteristic.pipe(
            filter(
                (
                    measurementCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): measurementCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    measurementCharacteristic !== undefined,
            ),
            switchMap(
                (measurementCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<BaseMetricsDto> =>
                    this.observeMeasurement(measurementCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: string, count: number): Observable<0> => {
                    if (
                        this.measurementCharacteristic.value?.service.device.gatt &&
                        error.includes("unknown")
                    ) {
                        console.warn(`Measurement characteristic error: ${error}; retrying: ${count}`);

                        this.connectToMeasurement(this.measurementCharacteristic.value.service.device.gatt);
                    }

                    return timer(2000);
                },
            }),
            startWith([0, 0, 0, 0] as BaseMetricsDto),
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

                    return timer(5000);
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

    streamSettings$(): Observable<SettingsStream> {
        return this.settingsCharacteristic.pipe(
            filter(
                (
                    settingsCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): settingsCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    settingsCharacteristic !== undefined,
            ),
            switchMap(
                (settingsCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<SettingsStream> =>
                    this.observeSettings(settingsCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: string, count: number): Observable<0> => {
                    if (this.settingsCharacteristic.value?.service.device.gatt && error.includes("unknown")) {
                        console.warn(`Extended metrics characteristic error: ${error}; retrying: ${count}`);

                        this.connectToSettings(this.settingsCharacteristic.value.service.device.gatt);
                    }

                    return timer(2000);
                },
            }),
            startWith({
                logToWebSocket: undefined,
                logToSdCard: undefined,
                logLevel: 0,
                bleServiceFlag: BleServiceFlag.CpsService,
            }),
        );
    }

    private async connect(device: BluetoothDevice): Promise<void> {
        try {
            this.bluetoothDevice = device;
            const gatt = await this.ble.connectDevice(device);

            if (this.bluetoothDevice === undefined || !gatt) {
                this.snackBar.open("BLE Connection failed", "Dismiss");

                return;
            }

            await this.connectToMeasurement(gatt);
            await this.connectToExtended(gatt);
            await this.connectToHandleForces(gatt);
            await this.connectToSettings(gatt);
            await this.connectToBattery(gatt);

            this.isConnectedSubject.next(this.bluetoothDevice.gatt?.connected === true);

            this.configManager.setItem("ergoMonitorBleId", device.id);
            device.ongattserverdisconnected = this.disconnectHandler;
            this.snackBar.open("Ergo monitor connected", "Dismiss");
        } catch (error) {
            this.snackBar.open(`${error}`, "Dismiss");
            this.isConnectedSubject.next(false);
        }
    }

    private async connectToBattery(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            const primaryService = await withDelay(
                1000,
                this.ble.getPrimaryService(gatt, BATTERY_LEVEL_SERVICE),
            );
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
            const primaryService = await withDelay(
                1000,
                this.ble.getPrimaryService(gatt, EXTENDED_METRICS_SERVICE),
            );
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
            const primaryService = await withDelay(
                1000,
                this.ble.getPrimaryService(gatt, EXTENDED_METRICS_SERVICE),
            );
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
            const primaryService = await withDelay(1000, this.getService(gatt));
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

    private async connectToSettings(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            const primaryService = await withDelay(1000, this.ble.getPrimaryService(gatt, SETTINGS_SERVICE));
            const characteristic = await this.ble.getCharacteristic(primaryService, SETTINGS_CHARACTERISTIC);

            this.settingsCharacteristic.next(characteristic ?? undefined);

            return characteristic ?? undefined;
        } catch (error) {
            if (this.bluetoothDevice) {
                this.snackBar.open("Error connecting to Settings", "Dismiss");
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

    private observeExtended(
        extendedCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<ExtendedMetricsDto> {
        return this.ble.observeValue$(extendedCharacteristic).pipe(
            map(
                (value: DataView): ExtendedMetricsDto => [
                    value.getUint16(0, true),
                    Math.round((value.getUint16(2, true) / 4096) * 1e6),
                    Math.round((value.getUint16(2 + 2, true) / 4096) * 1e6),
                    value.getUint8(2 + 2 + 2),
                ],
            ),
            finalize((): void => {
                this.extendedCharacteristic.next(undefined);
            }),
        );
    }

    private observeHandleForces(
        handleForcesCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<Array<number>> {
        return this.ble.observeValue$(handleForcesCharacteristic).pipe(
            buffer(
                this.ble
                    .observeValue$(handleForcesCharacteristic)
                    .pipe(filter((value: DataView): boolean => value.getUint8(0) === value.getUint8(1))),
            ),
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

    private observeMeasurement(
        measurementCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<BaseMetricsDto> {
        let lastRevTime = 0;
        let revTime = 0;

        let lastStrokeTime = 0;
        let strokeTime = 0;

        return this.ble.observeValue$(measurementCharacteristic).pipe(
            map((value: DataView): BaseMetricsDto => {
                if (
                    measurementCharacteristic.uuid ===
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

    private observeSettings(
        settingsCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<SettingsStream> {
        return concat(
            this.ble.readValue$(settingsCharacteristic),
            this.ble.observeValue$(settingsCharacteristic),
        ).pipe(
            map((value: DataView): SettingsStream => {
                const logToWs = value.getUint8(0) & 3;
                const logToSd = (value.getUint8(0) >> 2) & 3;
                const logLevel = (value.getUint8(0) >> 4) & 7;

                return {
                    logToWebSocket: logToWs === 0 ? undefined : logToWs === 1 ? false : true,
                    logToSdCard: logToSd === 0 ? undefined : logToSd === 1 ? false : true,
                    logLevel: logLevel,
                    bleServiceFlag:
                        this.measurementCharacteristic.value?.uuid !==
                        BluetoothUUID.getCharacteristic(CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC)
                            ? BleServiceFlag.CpsService
                            : BleServiceFlag.CscService,
                };
            }),
            finalize((): void => {
                this.extendedCharacteristic.next(undefined);
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
