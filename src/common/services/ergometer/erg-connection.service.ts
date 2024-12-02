import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { filter, fromEvent, Observable, skip, startWith, takeUntil } from "rxjs";

import {
    BATTERY_LEVEL_CHARACTERISTIC,
    BATTERY_LEVEL_SERVICE,
    CYCLING_POWER_SERVICE,
    CYCLING_SPEED_AND_CADENCE_SERVICE,
    DELTA_TIMES_CHARACTERISTIC,
    DEVICE_INFO_SERVICE,
    EXTENDED_CHARACTERISTIC,
    EXTENDED_METRICS_SERVICE,
    FITNESS_MACHINE_SERVICE,
    HANDLE_FORCES_CHARACTERISTIC,
    OTA_SERVICE,
    SETTINGS_CHARACTERISTIC,
    SETTINGS_SERVICE,
} from "../../ble.interfaces";
import { IErgConnectionStatus } from "../../common.interfaces";
import { withDelay } from "../../utils/utility.functions";
import { connectToCharacteristic } from "../ble.utilities";
import { ConfigManagerService } from "../config-manager.service";

import { ErgConnections } from "./erg-connection";
import { getBaseMetricCharacteristic } from "./erg.utilities";

@Injectable({
    providedIn: "root",
})
export class ErgConnectionService extends ErgConnections {
    get bluetoothDevice(): BluetoothDevice | undefined {
        return this._bluetoothDevice;
    }

    private _bluetoothDevice: BluetoothDevice | undefined;

    private cancellationToken: AbortController = new AbortController();

    constructor(
        private configManager: ConfigManagerService,
        private snackBar: MatSnackBar,
    ) {
        super();
    }

    async connectToBattery(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            this.batteryCharacteristic.next(
                await connectToCharacteristic(gatt, BATTERY_LEVEL_SERVICE, BATTERY_LEVEL_CHARACTERISTIC),
            );

            return this.batteryCharacteristic.value;
        } catch (error) {
            if (this._bluetoothDevice?.gatt?.connected) {
                this.snackBar.open("Ergo battery service is unavailable", "Dismiss");
                console.warn("Ergo battery service:", error);

                return;
            }

            throw error;
        }
    }

    async connectToDeltaTimes(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            this.deltaTimesCharacteristic.next(
                await connectToCharacteristic(gatt, EXTENDED_METRICS_SERVICE, DELTA_TIMES_CHARACTERISTIC),
            );

            return this.deltaTimesCharacteristic.value;
        } catch (error) {
            if (this._bluetoothDevice?.gatt?.connected) {
                this.snackBar.open("Error connecting to Delta Times", "Dismiss");
                console.error("deltaTimesCharacteristics:", error);

                return;
            }
            throw error;
        }
    }

    async connectToExtended(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            this.extendedCharacteristic.next(
                await connectToCharacteristic(gatt, EXTENDED_METRICS_SERVICE, EXTENDED_CHARACTERISTIC),
            );

            return this.extendedCharacteristic.value;
        } catch (error) {
            if (this._bluetoothDevice?.gatt?.connected) {
                this.snackBar.open("Error connecting to Extended Metrics", "Dismiss");
                console.error("extendedMetricsCharacteristics:", error);

                return;
            }
            throw error;
        }
    }

    async connectToHandleForces(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            this.handleForceCharacteristic.next(
                await connectToCharacteristic(gatt, EXTENDED_METRICS_SERVICE, HANDLE_FORCES_CHARACTERISTIC),
            );

            return this.handleForceCharacteristic.value;
        } catch (error) {
            if (this._bluetoothDevice?.gatt?.connected) {
                this.snackBar.open("Error connecting to Handles Forces", "Dismiss");
                console.error("handleForcesCharacteristics:", error);

                return;
            }
            throw error;
        }
    }

    async connectToMeasurement(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            this.measurementCharacteristic.next(await withDelay(1000, getBaseMetricCharacteristic(gatt)));

            return this.measurementCharacteristic.value;
        } catch (error) {
            if (this._bluetoothDevice?.gatt?.connected) {
                this.snackBar.open("Error connecting to Measurement Characteristic", "Dismiss");
                console.error("basicMeasurementCharacteristics:", error);

                return;
            }
            throw error;
        }
    }

    async connectToSettings(
        gatt: BluetoothRemoteGATTServer,
    ): Promise<void | BluetoothRemoteGATTCharacteristic> {
        try {
            this.settingsCharacteristic.next(
                await connectToCharacteristic(gatt, SETTINGS_SERVICE, SETTINGS_CHARACTERISTIC),
            );

            return this.settingsCharacteristic.value;
        } catch (error) {
            if (this._bluetoothDevice?.gatt?.connected) {
                this.snackBar.open("Error connecting to Settings", "Dismiss");
                console.error("settingsCharacteristics:", error);

                return;
            }
            throw error;
        }
    }

    connectionStatus$(): Observable<IErgConnectionStatus> {
        return this.connectionStatusSubject.asObservable();
    }

    async disconnectDevice(): Promise<void> {
        await new Promise<void>((resolve: () => void): void => {
            if (this._bluetoothDevice !== undefined && this._bluetoothDevice.gatt?.connected) {
                this._bluetoothDevice.ongattserverdisconnected = (): void => {
                    resolve();
                };
                this._bluetoothDevice.gatt?.disconnect();

                return;
            }

            resolve();
        });

        this._bluetoothDevice = undefined;

        this.cancellationToken.abort();
        this.batteryCharacteristic.next(undefined);
        this.settingsCharacteristic.next(undefined);
        this.extendedCharacteristic.next(undefined);
        this.handleForceCharacteristic.next(undefined);
        this.measurementCharacteristic.next(undefined);
        this.connectionStatusSubject.next({ status: "disconnected" });
    }

    // TODO: Reconnect feature:
    // 1) this has been only tested in chrome
    // 2) need to enable the chrome://flags/#enable-web-bluetooth-new-permissions-backend in chrome

    async discover(): Promise<void> {
        await this.disconnectDevice();

        try {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: false,
                filters: [
                    { services: [CYCLING_POWER_SERVICE] },
                    { services: [CYCLING_SPEED_AND_CADENCE_SERVICE] },
                    { services: [FITNESS_MACHINE_SERVICE] },
                ],
                optionalServices: [
                    OTA_SERVICE,
                    DEVICE_INFO_SERVICE,
                    BATTERY_LEVEL_SERVICE,
                    SETTINGS_SERVICE,
                    EXTENDED_METRICS_SERVICE,
                ],
            });

            await this.connect(device);
        } catch {
            await this.reconnect();
        }
    }

    async reconnect(): Promise<void> {
        await this.disconnectDevice();

        const device = (await navigator.bluetooth.getDevices()).filter(
            (device: BluetoothDevice): boolean =>
                device.id === this.configManager.getItem("ergoMonitorBleId"),
        )?.[0];

        if (device === undefined) {
            return;
        }

        fromEvent(document, "visibilitychange")
            .pipe(
                startWith(document.visibilityState),
                filter((): boolean => document.visibilityState === "visible"),
            )
            .pipe(
                takeUntil(
                    this.connectionStatusSubject.pipe(
                        skip(1),
                        filter(
                            (connectionStatus: IErgConnectionStatus): boolean =>
                                connectionStatus.status !== "searching",
                        ),
                    ),
                ),
            )
            .subscribe(async (): Promise<void> => {
                this.cancellationToken.abort();
                this.cancellationToken = new AbortController();
                device.onadvertisementreceived = this.reconnectHandler;
                try {
                    await device.watchAdvertisements({ signal: this.cancellationToken.signal });
                    this.connectionStatusSubject.next({ status: "searching" });
                } catch {
                    this.reconnect();
                }
            });
    }

    private async connect(device: BluetoothDevice): Promise<void> {
        this.connectionStatusSubject.next({ status: "connecting" });

        try {
            this._bluetoothDevice = device;
            const gatt = await this._bluetoothDevice.gatt?.connect();

            if (this._bluetoothDevice === undefined || !gatt) {
                this.snackBar.open("BLE Connection to EPRM failed", "Dismiss");

                this.connectionStatusSubject.next({ status: "disconnected" });

                return;
            }

            await this.connectToMeasurement(gatt);
            await this.connectToExtended(gatt);
            await this.connectToHandleForces(gatt);
            await this.connectToDeltaTimes(gatt);
            await this.connectToSettings(gatt);
            await this.connectToBattery(gatt);

            this.connectionStatusSubject.next({
                deviceName:
                    this._bluetoothDevice.gatt?.connected === true && this._bluetoothDevice.name
                        ? this._bluetoothDevice.name
                        : undefined,
                status: this._bluetoothDevice.gatt?.connected ? "connected" : "disconnected",
            });

            this.configManager.setItem("ergoMonitorBleId", device.id);
            device.ongattserverdisconnected = this.disconnectHandler;
            this.snackBar.open("Ergo monitor connected", "Dismiss");
        } catch (error) {
            this.connectionStatusSubject.next({ status: "disconnected" });
            if (this._bluetoothDevice?.gatt?.connected) {
                this.snackBar.open(`${error}`, "Dismiss");
            }
            if (this._bluetoothDevice?.gatt?.connected === false) {
                this.reconnect();
            }
        }
    }

    private disconnectHandler = async (event: Event): Promise<void> => {
        const device: BluetoothDevice = event.target as BluetoothDevice;
        this._bluetoothDevice = device;

        this.reconnect();

        this.snackBar.open("Ergometer Monitor disconnected", "Dismiss");
    };

    private reconnectHandler: (event: BluetoothAdvertisingEvent) => void = (
        event: BluetoothAdvertisingEvent,
    ): void => {
        this.cancellationToken.abort();

        this.connect(event.device);
    };
}
