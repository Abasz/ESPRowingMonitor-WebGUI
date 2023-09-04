import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BluetoothCore } from "@manekinekko/angular-web-bluetooth";
import {
    BehaviorSubject,
    concat,
    filter,
    map,
    Observable,
    of,
    startWith,
    switchMap,
    take,
    takeUntil,
    tap,
    withLatestFrom,
} from "rxjs";

import {
    BATTERY_LEVEL_CHARACTERISTIC,
    BATTERY_LEVEL_SERVICE,
    HEART_RATE_CHARACTERISTIC,
    HEART_RATE_SERVICE,
    IHeartRate,
    IHeartRateService,
} from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class BLEHeartRateService implements IHeartRateService {
    private batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);
    private bluetoothDevice: BluetoothDevice | undefined;
    private cancellationToken: AbortController = new AbortController();
    private heartRateCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    constructor(
        private configManager: ConfigManagerService,
        private snackBar: MatSnackBar,
        private ble: BluetoothCore,
    ) {}

    disconnectDevice(): void {
        if (this.bluetoothDevice !== undefined) {
            this.bluetoothDevice.ongattserverdisconnected = (): void => {
                return;
            };
            this.bluetoothDevice = undefined;
        }
        this.ble.disconnectDevice();
        this.cancellationToken.abort();
        this.batteryCharacteristic.next(undefined);
        this.heartRateCharacteristic.next(undefined);
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
            (device: BluetoothDevice): boolean => device.id === this.configManager.getItem("bleDeviceId"),
        )?.[0];
        if (device === undefined) {
            return;
        }

        device.onadvertisementreceived = this.reconnectHandler;
        this.cancellationToken = new AbortController();
        await device.watchAdvertisements({ signal: this.cancellationToken.signal });
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
            startWith(undefined as IHeartRate | undefined),
        );
    }

    private async connect(device: BluetoothDevice): Promise<void> {
        try {
            this.bluetoothDevice = device;
            const gatt = await this.ble.connectDevice(device);

            if (this.bluetoothDevice === undefined) {
                return;
            }

            await Promise.all([this.connectToBattery(gatt), this.connectToHearRate(gatt)]);
            this.configManager.setItem("bleDeviceId", device.id);
            device.ongattserverdisconnected = this.disconnectHandler;
        } catch (error) {
            this.snackBar.open(`${error}`, "Dismiss");
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

            return characteristic;
        } catch (error) {
            if (this.bluetoothDevice) {
                this.snackBar.open("Battery service is unavailable", "Dismiss");
                console.warn(error);
            }
        }

        return;
    }

    private async connectToHearRate(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            const primaryService = await this.ble.getPrimaryService(gatt, HEART_RATE_SERVICE);
            const characteristic = await this.ble.getCharacteristic(
                primaryService,
                HEART_RATE_CHARACTERISTIC,
            );
            this.heartRateCharacteristic.next(characteristic ?? undefined);

            return characteristic;
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
            concat(
                this.ble.readValue$(batteryCharacteristic),
                this.ble.observeValue$(batteryCharacteristic),
            ).pipe(
                map((value: DataView): number => value.getInt8(0)),
                takeUntil(
                    this.ble.getDevice$().pipe(
                        filter((device: BluetoothDevice): boolean => !device),
                        tap((): void => {
                            this.heartRateCharacteristic.next(undefined);
                            this.batteryCharacteristic.next(undefined);
                        }),
                        take(1),
                    ),
                ),
            ),
            of(undefined),
        );
    }

    private observeHeartRate(
        heartRateCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<IHeartRate | undefined> {
        return concat(
            this.ble
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
                    takeUntil(
                        this.ble.getDevice$().pipe(
                            filter((device: BluetoothDevice): boolean => !device),
                            tap((): void => {
                                this.heartRateCharacteristic.next(undefined);
                                this.batteryCharacteristic.next(undefined);
                            }),
                            take(1),
                        ),
                    ),
                ),
            of(undefined),
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
