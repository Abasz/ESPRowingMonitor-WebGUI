import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BluetoothCore } from "@manekinekko/angular-web-bluetooth";
import {
    BehaviorSubject,
    catchError,
    concat,
    endWith,
    filter,
    finalize,
    map,
    Observable,
    of,
    retry,
    startWith,
    switchMap,
    timer,
    withLatestFrom,
} from "rxjs";

import {
    BATTERY_LEVEL_CHARACTERISTIC,
    BATTERY_LEVEL_SERVICE,
    HEART_RATE_CHARACTERISTIC,
    HEART_RATE_SERVICE,
} from "../ble.interfaces";
import { IHeartRate, IHeartRateService, IHRConnectionStatus } from "../common.interfaces";
import { withDelay } from "../utils/utility.functions";

import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class BLEHeartRateService implements IHeartRateService {
    private batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);
    private bluetoothDevice: BluetoothDevice | undefined;
    private cancellationToken: AbortController = new AbortController();

    private connectionStatusSubject: BehaviorSubject<IHRConnectionStatus> =
        new BehaviorSubject<IHRConnectionStatus>({ status: "disconnected" });

    private heartRateCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    constructor(
        private configManager: ConfigManagerService,
        private snackBar: MatSnackBar,
        private ble: BluetoothCore,
    ) {}

    connectionStatus$(): Observable<IHRConnectionStatus> {
        return this.connectionStatusSubject.asObservable();
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
        this.heartRateCharacteristic.next(undefined);
        this.connectionStatusSubject.next({ status: "disconnected" });
    }

    // TODO: Reconnect feature:
    // 1) this has been only tested in chrome
    // 2) need to enable the chrome://flags/#enable-web-bluetooth-new-permissions-backend in chrome

    async discover(): Promise<void> {
        this.disconnectDevice();

        const device = await this.ble.discover({
            acceptAllDevices: false,
            filters: [{ services: [HEART_RATE_SERVICE] }],
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
            (device: BluetoothDevice): boolean => device.id === this.configManager.getItem("heartRateBleId"),
        )?.[0];
        if (device === undefined) {
            return;
        }

        device.onadvertisementreceived = this.reconnectHandler;
        this.cancellationToken = new AbortController();
        await device.watchAdvertisements({ signal: this.cancellationToken.signal });
        this.connectionStatusSubject.next({ status: "searching" });
    }

    streamHRMonitorBatteryLevel$(): Observable<number | undefined> {
        return this.batteryCharacteristic.pipe(
            filter(
                (
                    batteryCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): batteryCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    batteryCharacteristic !== undefined,
            ),
            switchMap(
                (batteryCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<number | undefined> =>
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
            catchError((error: string): Observable<undefined> => {
                console.error(error);
                this.snackBar.open("Error while connecting to battery service", "Dismiss");

                return of(undefined);
            }),
            startWith(undefined as number | undefined),
        );
    }

    streamHeartRate$(): Observable<IHeartRate | undefined> {
        return this.heartRateCharacteristic.pipe(
            filter(
                (
                    heartRateCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): heartRateCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    heartRateCharacteristic !== undefined,
            ),
            switchMap(
                (
                    heartRateCharacteristic: BluetoothRemoteGATTCharacteristic,
                ): Observable<IHeartRate | undefined> => this.observeHeartRate(heartRateCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: string, count: number): Observable<0> => {
                    if (
                        this.heartRateCharacteristic.value?.service.device.gatt &&
                        error.includes("unknown")
                    ) {
                        console.warn(
                            `Heart rate measurement characteristic error: ${error}; retrying: ${count}`,
                        );

                        this.connectToHearRate(this.heartRateCharacteristic.value.service.device.gatt);
                    }

                    return timer(2000);
                },
            }),
            startWith(undefined as IHeartRate | undefined),
        );
    }

    private async connect(device: BluetoothDevice): Promise<void> {
        this.connectionStatusSubject.next({ status: "searching" });

        try {
            this.bluetoothDevice = device;
            const gatt = await this.ble.connectDevice(device);

            if (this.bluetoothDevice === undefined) {
                this.snackBar.open("BLE Connection to HR Monitor failed", "Dismiss");
                this.connectionStatusSubject.next({ status: "disconnected" });

                return;
            }

            await withDelay(1000);
            this.connectToHearRate(gatt);
            this.connectToBattery(gatt);

            this.configManager.setItem("heartRateBleId", device.id);
            device.ongattserverdisconnected = this.disconnectHandler;
        } catch (error) {
            this.connectionStatusSubject.next({ status: "disconnected" });
            this.snackBar.open(`${error}`, "Dismiss");
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
                this.snackBar.open("HR Monitor battery service is unavailable", "Dismiss");
                console.warn(error);
            }
        }

        return;
    }

    private async connectToHearRate(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            const primaryService = await withDelay(
                1000,
                this.ble.getPrimaryService(gatt, HEART_RATE_SERVICE),
            );
            const characteristic = await this.ble.getCharacteristic(
                primaryService,
                HEART_RATE_CHARACTERISTIC,
            );
            this.heartRateCharacteristic.next(characteristic ?? undefined);
            this.connectionStatusSubject.next({
                deviceName:
                    this.bluetoothDevice?.gatt?.connected === true && this.bluetoothDevice.name
                        ? this.bluetoothDevice.name
                        : undefined,
                status: this.bluetoothDevice?.gatt?.connected ? "connected" : "disconnected",
            });

            return characteristic ?? undefined;
        } catch (error) {
            if (this.bluetoothDevice) {
                this.snackBar.open("Error connecting Heart Rate monitor", "Dismiss");
                console.error(error);
            }
        }

        return;
    }

    private disconnectHandler = async (event: Event): Promise<void> => {
        const device: BluetoothDevice = event.target as BluetoothDevice;
        device.onadvertisementreceived = this.reconnectHandler;
        this.connectionStatusSubject.next({ status: "searching" });

        if (!device.watchingAdvertisements) {
            this.cancellationToken = new AbortController();
            await device.watchAdvertisements({ signal: this.cancellationToken.signal });
        }
        this.snackBar.open("Heart Rate Monitor disconnected", "Dismiss");
    };

    private observeBattery(
        batteryCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<number | undefined> {
        return concat(
            this.ble.readValue$(batteryCharacteristic),
            this.ble.observeValue$(batteryCharacteristic),
        ).pipe(
            map((value: DataView): number => value.getInt8(0)),
            finalize((): void => {
                this.batteryCharacteristic.next(undefined);
            }),
            endWith(undefined),
        );
    }

    private observeHeartRate(
        heartRateCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<IHeartRate | undefined> {
        return this.ble
            .observeValue$(heartRateCharacteristic)
            .pipe(
                withLatestFrom(this.streamHRMonitorBatteryLevel$()),
                map(
                    ([heartRateData, batteryLevel]: [DataView, number | undefined]): IHeartRate => ({
                        ...this.parseHeartRate(heartRateData),
                        batteryLevel,
                    }),
                ),
            )
            .pipe(
                finalize((): void => {
                    this.heartRateCharacteristic.next(undefined);
                    this.connectionStatusSubject.next({
                        status: "disconnected",
                    });
                }),
                endWith(undefined),
            );
    }

    private parseHeartRate(value: DataView): Omit<IHeartRate, "batteryLevel"> {
        const flags = value.getUint8(0);
        const rate16Bits = flags & 0x1;
        const result: IHeartRate = { heartRate: 0, contactDetected: true };
        let index = 1;
        if (rate16Bits) {
            result.heartRate = value.getUint16(index, true);
            index += 2;
        } else {
            result.heartRate = value.getUint8(index);
            index += 1;
        }
        const contactDetected = flags & 0x2;
        const contactSensorPresent = flags & 0x4;
        if (contactSensorPresent) {
            result.contactDetected = !!contactDetected;
        }
        const energyPresent = flags & 0x8;
        if (energyPresent) {
            result.energyExpended = value.getUint16(index, true);
            index += 2;
        }
        const rrIntervalPresent = flags & 0x10;
        if (rrIntervalPresent) {
            const rrIntervals = [];
            for (; index + 1 < value.byteLength; index += 2) {
                rrIntervals.push(value.getUint16(index, true));
            }
            result.rrIntervals = rrIntervals;
        }

        return result;
    }

    private reconnectHandler: (event: BluetoothAdvertisingEvent) => Promise<void> = async (
        event: BluetoothAdvertisingEvent,
    ): Promise<void> => {
        this.cancellationToken.abort();

        this.connect(event.device);
    };
}
