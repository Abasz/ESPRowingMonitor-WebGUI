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
import {
    IDragFactorSettings,
    IMachineSettings,
    IRowerSettings,
    ISensorSignalSettings,
    IStrokeDetectionSettings,
} from "../../common.interfaces";
import { observeValue$ } from "../ble.utilities";

import { ErgConnectionService } from "./erg-connection.service";
import { calculateBleServiceFlag } from "./erg.utilities";

@Injectable({
    providedIn: "root",
})
export class ErgSettingsService {
    readonly rowerSettings: Signal<IRowerSettings>;
    readonly strokeDetectionSettings: Signal<IStrokeDetectionSettings>;

    constructor(
        private snackBar: MatSnackBar,
        private ergConnectionService: ErgConnectionService,
    ) {
        this.rowerSettings = toSignal(this.streamRowerSettings$(), {
            initialValue: {
                logDeltaTimes: undefined,
                logToSdCard: undefined,
                logLevel: 0,
                bleServiceFlag: BleServiceFlag.CpsService,
                isRuntimeSettingsEnabled: false,
                machineSettings: {
                    flywheelInertia: 0,
                    magicConstant: 0,
                    sprocketRadius: 0,
                    impulsePerRevolution: 0,
                },
                sensorSignalSettings: {
                    rotationDebounceTime: 0,
                    rowingStoppedThreshold: 0,
                },
                dragFactorSettings: {
                    goodnessOfFitThreshold: 0,
                    maxDragFactorRecoveryPeriod: 0,
                    dragFactorLowerThreshold: 0,
                    dragFactorUpperThreshold: 0,
                    dragCoefficientsArrayLength: 0,
                },
            },
        });

        this.strokeDetectionSettings = toSignal(this.streamStrokeDetectionSettings$(), {
            initialValue: {
                strokeDetectionType: 0,
                impulseDataArrayLength: 0,
                minimumPoweredTorque: 0,
                minimumDragTorque: 0,
                minimumRecoverySlopeMargin: 0,
                minimumRecoverySlope: 0,
                minimumRecoveryTime: 0,
                minimumDriveTime: 0,
                driveHandleForcesMaxCapacity: 0,
                isCompiledWithDouble: true,
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
                const logLevel = (value.getUint8(0) >> 4) & 6;
                const isRuntimeSettingsEnabled = Boolean(value.getUint8(0) >> 7);

                const flywheelInertia = value.getFloat32(1, true);
                const magicConstant = value.getUint8(5) / 35;
                const impulsePerRevolution = value.getUint8(6);
                const sprocketRadius = value.getUint16(7, true) / 1000;

                const rotationDebounceTime = value.getUint8(9);
                const rowingStoppedThreshold = value.getUint8(10);

                const goodnessOfFitThreshold = value.getUint8(11) / 255;
                const maxDragFactorRecoveryPeriod = value.getUint8(12);
                const dragFactorLowerThreshold = value.getUint16(13, true);
                const dragFactorUpperThreshold = value.getUint16(15, true);
                const dragCoefficientsArrayLength = value.getUint8(17);

                return {
                    logDeltaTimes: logToWs === 0 ? undefined : logToWs === 1 ? false : true,
                    logToSdCard: logToSd === 0 ? undefined : logToSd === 1 ? false : true,
                    logLevel: logLevel,
                    bleServiceFlag: calculateBleServiceFlag(
                        this.ergConnectionService.readMeasurementCharacteristic()?.uuid,
                    ),
                    isRuntimeSettingsEnabled,
                    machineSettings: {
                        flywheelInertia,
                        magicConstant,
                        sprocketRadius,
                        impulsePerRevolution,
                    },
                    sensorSignalSettings: {
                        rotationDebounceTime,
                        rowingStoppedThreshold,
                    },
                    dragFactorSettings: {
                        goodnessOfFitThreshold,
                        maxDragFactorRecoveryPeriod,
                        dragFactorLowerThreshold,
                        dragFactorUpperThreshold,
                        dragCoefficientsArrayLength,
                    },
                };
            }),
            finalize((): void => {
                this.ergConnectionService.resetSettingsCharacteristic();
            }),
        );
    }

    private observeStrokeSettings$(
        strokeDetectionSettingsCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<IStrokeDetectionSettings> {
        return observeValue$(strokeDetectionSettingsCharacteristic).pipe(
            mergeWith(from(strokeDetectionSettingsCharacteristic.readValue())),
            map((value: DataView): IStrokeDetectionSettings => {
                const strokeDetectionType = value.getUint8(0) & 0x03;
                const impulseDataArrayLength = (value.getUint8(0) >> 2) & 0x1f;
                const isCompiledWithDouble = Boolean((value.getUint8(0) >> 7) & 0x01);
                const minimumPoweredTorque = value.getUint16(1, true) / 10000;
                const minimumDragTorque = value.getUint16(3, true) / 10000;
                const minimumRecoverySlopeMargin = value.getFloat32(5, true);
                const minimumRecoverySlope = value.getUint16(9, true) / 1000;
                const timingValue =
                    value.getUint8(11) | (value.getUint8(12) << 8) | (value.getUint8(13) << 16);
                const minimumRecoveryTime = timingValue & 0x0fff;
                const minimumDriveTime = (timingValue >> 12) & 0x0fff;
                const driveHandleForcesMaxCapacity = value.getUint8(14);

                return {
                    strokeDetectionType,
                    impulseDataArrayLength,
                    minimumPoweredTorque,
                    minimumDragTorque,
                    minimumRecoverySlopeMargin,
                    minimumRecoverySlope,
                    minimumRecoveryTime,
                    minimumDriveTime,
                    driveHandleForcesMaxCapacity,
                    isCompiledWithDouble,
                };
            }),
            finalize((): void => {
                this.ergConnectionService.resetStrokeSettingsCharacteristic();
            }),
        );
    }

    private streamRowerSettings$(): Observable<IRowerSettings> {
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

    private streamStrokeDetectionSettings$(): Observable<IStrokeDetectionSettings> {
        return this.ergConnectionService.strokeSettingsCharacteristic$.pipe(
            filter(
                (
                    strokeDetectionSettingsCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): strokeDetectionSettingsCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    strokeDetectionSettingsCharacteristic !== undefined,
            ),
            switchMap(
                (
                    strokeDetectionSettingsCharacteristic: BluetoothRemoteGATTCharacteristic,
                ): Observable<IStrokeDetectionSettings> =>
                    this.observeStrokeSettings$(strokeDetectionSettingsCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: Error, count: number): Observable<0> => {
                    const gatt =
                        this.ergConnectionService.readStrokeSettingsCharacteristic()?.service.device.gatt;
                    if (gatt && error.message.includes("unknown")) {
                        console.warn(
                            `Stroke detection settings characteristic error: ${error}; retrying: ${count}`,
                        );

                        this.ergConnectionService.connectToStrokeSettings(gatt);
                    }

                    return timer(2000);
                },
            }),
        );
    }
}
