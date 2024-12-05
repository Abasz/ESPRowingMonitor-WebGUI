import { Injectable, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatSnackBar } from "@angular/material/snack-bar";
import {
    EmptyError,
    filter,
    finalize,
    firstValueFrom,
    from,
    map,
    mergeWith,
    Observable,
    retry,
    switchMap,
    timeout,
    timer,
} from "rxjs";

import {
    BleOpCodes,
    BleResponseOpCodes,
    BleServiceFlag,
    LogLevel,
    SETTINGS_CONTROL_POINT,
} from "../../ble.interfaces";
import { IRowerSettings } from "../../common.interfaces";
import { observeValue$ } from "../ble.utilities";

import { ErgConnectionService } from "./erg-connection.service";
import { calculateBleServiceFlag } from "./erg.utilities";

@Injectable({
    providedIn: "root",
})
export class ErgSettingsService {
    readonly settings: Signal<IRowerSettings>;

    constructor(
        private snackBar: MatSnackBar,
        private ergConnectionService: ErgConnectionService,
    ) {
        this.settings = toSignal(this.streamSettings$(), {
            initialValue: {
                logDeltaTimes: undefined,
                logToSdCard: undefined,
                logLevel: 0,
                bleServiceFlag: BleServiceFlag.CpsService,
            },
        });
    }

    async changeBleServiceType(bleService: BleServiceFlag): Promise<void> {
        const service = this.ergConnectionService.readSettingsCharacteristic()?.service;
        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined || service === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await service.getCharacteristic(SETTINGS_CONTROL_POINT);

            const responseTask = firstValueFrom(observeValue$(characteristic).pipe(timeout(1000)));

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(
                new Uint8Array([BleOpCodes.ChangeBleService, bleService]),
            );

            const response = await responseTask;

            if (response.getUint8(2) === BleResponseOpCodes.Successful) {
                this.ergConnectionService.discover();
            }
            this.snackBar.open(
                response.getUint8(2) === BleResponseOpCodes.Successful
                    ? "BLE service changed, device is restarting"
                    : "An error occurred while changing BLE service",
                "Dismiss",
            );

            await characteristic.stopNotifications();
        } catch (error) {
            const errorMessage = `Failed to change BLE service${error instanceof EmptyError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("changeBleServiceType:", error);
        }
    }

    async changeDeltaTimeLogging(shouldEnable: boolean): Promise<void> {
        const service = this.ergConnectionService.readSettingsCharacteristic()?.service;
        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined || service === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await service.getCharacteristic(SETTINGS_CONTROL_POINT);

            const responseTask = firstValueFrom(observeValue$(characteristic).pipe(timeout(1000)));

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(
                new Uint8Array([BleOpCodes.SetDeltaTimeLogging, shouldEnable ? 1 : 0]),
            );

            this.snackBar.open(
                (await responseTask).getUint8(2) === BleResponseOpCodes.Successful
                    ? `Delta time logging ${shouldEnable ? "enabled" : "disabled"}`
                    : "An error occurred while changing delta time logging",
                "Dismiss",
            );

            await characteristic.stopNotifications();
        } catch (error) {
            const errorMessage = `Failed to ${shouldEnable ? "enabled" : "disabled"} delta time logging ${error instanceof EmptyError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("changeDeltaTimeLogging:", error);
        }
    }

    async changeLogLevel(logLevel: LogLevel): Promise<void> {
        const service = this.ergConnectionService.readSettingsCharacteristic()?.service;
        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined || service === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await service.getCharacteristic(SETTINGS_CONTROL_POINT);

            const responseTask = firstValueFrom(observeValue$(characteristic).pipe(timeout(1000)));

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(
                new Uint8Array([BleOpCodes.SetLogLevel, logLevel]),
            );

            this.snackBar.open(
                (await responseTask).getUint8(2) === BleResponseOpCodes.Successful
                    ? "Log level changed"
                    : "An error occurred while changing Log level",
                "Dismiss",
            );

            await characteristic.stopNotifications();
        } catch (error) {
            const errorMessage = `Failed to set Log Level${error instanceof EmptyError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("changeLogLevel:", error);
        }
    }

    async changeLogToSdCard(shouldEnable: boolean): Promise<void> {
        const service = this.ergConnectionService.readSettingsCharacteristic()?.service;
        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined || service === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await service.getCharacteristic(SETTINGS_CONTROL_POINT);

            const responseTask = firstValueFrom(observeValue$(characteristic).pipe(timeout(1000)));

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(
                new Uint8Array([BleOpCodes.SetSdCardLogging, shouldEnable ? 1 : 0]),
            );

            this.snackBar.open(
                (await responseTask).getUint8(2) === BleResponseOpCodes.Successful
                    ? `Sd Card logging ${shouldEnable ? "enabled" : "disabled"}`
                    : "An error occurred while changing Sd Card logging",
                "Dismiss",
            );

            await characteristic.stopNotifications();
        } catch (error) {
            const errorMessage = `Failed to ${shouldEnable ? "enabled" : "disabled"} Sd Card logging${error instanceof EmptyError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("changeLogToSdCard:", error);
        }
    }

    private observeSettings$(
        settingsCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<IRowerSettings> {
        return observeValue$(settingsCharacteristic).pipe(
            mergeWith(from(settingsCharacteristic.readValue())),
            map((value: DataView): IRowerSettings => {
                const logToWs = value.getUint8(0) & 3;
                const logToSd = (value.getUint8(0) >> 2) & 3;
                const logLevel = (value.getUint8(0) >> 4) & 7;

                return {
                    logDeltaTimes: logToWs === 0 ? undefined : logToWs === 1 ? false : true,
                    logToSdCard: logToSd === 0 ? undefined : logToSd === 1 ? false : true,
                    logLevel: logLevel,
                    bleServiceFlag: calculateBleServiceFlag(
                        this.ergConnectionService.readMeasurementCharacteristic()?.uuid,
                    ),
                };
            }),
            finalize((): void => {
                this.ergConnectionService.resetSettingsCharacteristic();
            }),
        );
    }

    private streamSettings$(): Observable<IRowerSettings> {
        return this.ergConnectionService.settingsCharacteristic$.pipe(
            filter(
                (
                    settingsCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): settingsCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    settingsCharacteristic !== undefined,
            ),
            switchMap(
                (settingsCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<IRowerSettings> =>
                    this.observeSettings$(settingsCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: Error, count: number): Observable<0> => {
                    const gatt = this.ergConnectionService.readSettingsCharacteristic()?.service.device.gatt;
                    if (gatt && error.message.includes("unknown")) {
                        console.warn(`Settings metrics characteristic error: ${error}; retrying: ${count}`);

                        this.ergConnectionService.connectToSettings(gatt);
                    }

                    return timer(2000);
                },
            }),
        );
    }
}
