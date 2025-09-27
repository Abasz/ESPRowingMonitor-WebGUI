import { computed, Injectable, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatSnackBar } from "@angular/material/snack-bar";
import {
    concatWith,
    defer,
    filter,
    finalize,
    firstValueFrom,
    from,
    map,
    Observable,
    retry,
    switchMap,
    timeout,
    TimeoutError,
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
import { withDelay } from "../../utils/utility.functions";

interface IBleRowerSettingsDTO {
    logDeltaTimes: boolean | undefined;
    logToSdCard: boolean | undefined;
    logLevel: number;
    bleServiceFlag: BleServiceFlag;
    isRuntimeSettingsEnabled: boolean | undefined;
    machineSettings: IMachineSettings;
    sensorSignalSettings: ISensorSignalSettings;
    dragFactorSettings: IDragFactorSettings;
}

interface IBleStrokeDetectionSettingsDTO {
    strokeDetectionType: number;
    impulseDataArrayLength: number;
    minimumPoweredTorque: number;
    minimumDragTorque: number;
    minimumRecoverySlopeMargin: number;
    minimumRecoverySlope: number;
    minimumRecoveryTime: number;
    minimumDriveTime: number;
    driveHandleForcesMaxCapacity: number;
    isCompiledWithDouble?: boolean;
}

const DEFAULT_GENERAL_SETTINGS_DTO = {
    logDeltaTimes: undefined,
    logToSdCard: undefined,
    logLevel: 0,
    bleServiceFlag: BleServiceFlag.CpsService,
};

const DEFAULT_ROWING_SETTINGS_DTO = {
    isRuntimeSettingsEnabled: undefined,
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
};

@Injectable({
    providedIn: "root",
})
export class ErgSettingsService {
    readonly rowerSettings: Signal<IRowerSettings>;

    private readonly bleRowerSettingsDTO: Signal<IBleRowerSettingsDTO>;
    private readonly bleStrokeDetectionSettingsDTO: Signal<IBleStrokeDetectionSettingsDTO>;

    constructor(
        private snackBar: MatSnackBar,
        private ergConnectionService: ErgConnectionService,
    ) {
        this.bleRowerSettingsDTO = toSignal(this.streamRowerSettings$(), {
            initialValue: {
                ...DEFAULT_GENERAL_SETTINGS_DTO,
                ...DEFAULT_ROWING_SETTINGS_DTO,
            },
        });

        this.bleStrokeDetectionSettingsDTO = toSignal(this.streamStrokeDetectionSettings$(), {
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
            },
        });

        this.rowerSettings = computed((): IRowerSettings => {
            const bleSettings = this.bleRowerSettingsDTO();
            const strokeSettings = this.bleStrokeDetectionSettingsDTO();

            return {
                generalSettings: {
                    logDeltaTimes: bleSettings.logDeltaTimes,
                    logToSdCard: bleSettings.logToSdCard,
                    logLevel: bleSettings.logLevel,
                    bleServiceFlag: bleSettings.bleServiceFlag,
                    isRuntimeSettingsEnabled: bleSettings.isRuntimeSettingsEnabled,
                    isCompiledWithDouble: strokeSettings.isCompiledWithDouble,
                },
                rowingSettings: {
                    machineSettings: bleSettings.machineSettings,
                    sensorSignalSettings: bleSettings.sensorSignalSettings,
                    dragFactorSettings: bleSettings.dragFactorSettings,
                    strokeDetectionSettings: {
                        strokeDetectionType: strokeSettings.strokeDetectionType,
                        impulseDataArrayLength: strokeSettings.impulseDataArrayLength,
                        minimumPoweredTorque: strokeSettings.minimumPoweredTorque,
                        minimumDragTorque: strokeSettings.minimumDragTorque,
                        minimumRecoverySlopeMargin: strokeSettings.minimumRecoverySlopeMargin,
                        minimumRecoverySlope: strokeSettings.minimumRecoverySlope,
                        minimumRecoveryTime: strokeSettings.minimumRecoveryTime,
                        minimumDriveTime: strokeSettings.minimumDriveTime,
                        driveHandleForcesMaxCapacity: strokeSettings.driveHandleForcesMaxCapacity,
                    },
                },
            };
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
            const errorMessage = `Failed to change BLE service${error instanceof TimeoutError ? ", request timed out" : ""}`;

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
            const errorMessage = `Failed to ${shouldEnable ? "enabled" : "disabled"} delta time logging${error instanceof TimeoutError ? ", request timed out" : ""}`;

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
            const errorMessage = `Failed to set Log Level${error instanceof TimeoutError ? ", request timed out" : ""}`;

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
            const errorMessage = `Failed to ${shouldEnable ? "enabled" : "disabled"} Sd Card logging${error instanceof TimeoutError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("changeLogToSdCard:", error);
        }
    }

    async changeMachineSettings(machineSettings: IMachineSettings): Promise<void> {
        const service = this.ergConnectionService.readSettingsCharacteristic()?.service;
        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined || service === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await service.getCharacteristic(SETTINGS_CONTROL_POINT);

            const responseTask = firstValueFrom(observeValue$(characteristic).pipe(timeout(1000)));

            const payload = new DataView(new ArrayBuffer(9));
            payload.setUint8(0, BleOpCodes.SetMachineSettings);
            payload.setFloat32(1, machineSettings.flywheelInertia, true);
            payload.setUint8(5, Math.round(machineSettings.magicConstant * 35) & 0xff);
            payload.setUint8(6, machineSettings.impulsePerRevolution & 0xff);
            payload.setUint16(7, Math.round(machineSettings.sprocketRadius * 1000), true);

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(payload);

            this.snackBar.open(
                (await responseTask).getUint8(2) === BleResponseOpCodes.Successful
                    ? "Machine settings changed"
                    : `An error occurred while changing machine settings (${BleResponseOpCodes[(await responseTask).getUint8(2)]})`,
                "Dismiss",
            );

            await characteristic.stopNotifications();
        } catch (error) {
            const errorMessage = `Failed to set machine settings${error instanceof TimeoutError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("changeMachineSettings:", error);
        }
    }

    async changeSensorSignalSettings(sensorSignalSettings: ISensorSignalSettings): Promise<void> {
        const service = this.ergConnectionService.readSettingsCharacteristic()?.service;
        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined || service === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await service.getCharacteristic(SETTINGS_CONTROL_POINT);

            const responseTask = firstValueFrom(observeValue$(characteristic).pipe(timeout(1000)));

            const payload = new DataView(new ArrayBuffer(3));
            payload.setUint8(0, BleOpCodes.SetSensorSignalSettings);
            payload.setUint8(1, sensorSignalSettings.rotationDebounceTime);
            payload.setUint8(2, sensorSignalSettings.rowingStoppedThreshold);

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(payload);

            this.snackBar.open(
                (await responseTask).getUint8(2) === BleResponseOpCodes.Successful
                    ? "Sensor signal settings changed"
                    : `An error occurred while changing sensor signal settings (${BleResponseOpCodes[(await responseTask).getUint8(2)]})`,
                "Dismiss",
            );

            await characteristic.stopNotifications();
        } catch (error) {
            const errorMessage = `Failed to set sensor signal settings${error instanceof TimeoutError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("changeSensorSignalSettings:", error);
        }
    }

    async changeDragFactorSettings(dragFactorSettings: IDragFactorSettings): Promise<void> {
        const service = this.ergConnectionService.readSettingsCharacteristic()?.service;
        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined || service === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await service.getCharacteristic(SETTINGS_CONTROL_POINT);

            const responseTask = firstValueFrom(observeValue$(characteristic).pipe(timeout(1000)));

            const payload = new DataView(new ArrayBuffer(8));
            payload.setUint8(0, BleOpCodes.SetDragFactorSettings);
            payload.setUint8(1, Math.round(dragFactorSettings.goodnessOfFitThreshold * 255) & 0xff);
            payload.setUint8(2, dragFactorSettings.maxDragFactorRecoveryPeriod & 0xff);
            payload.setUint16(3, dragFactorSettings.dragFactorLowerThreshold, true);
            payload.setUint16(5, dragFactorSettings.dragFactorUpperThreshold, true);
            payload.setUint8(7, dragFactorSettings.dragCoefficientsArrayLength & 0xff);

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(payload);

            this.snackBar.open(
                (await responseTask).getUint8(2) === BleResponseOpCodes.Successful
                    ? "Drag factor settings changed"
                    : `An error occurred while changing machine settings (${BleResponseOpCodes[(await responseTask).getUint8(2)]})`,
                "Dismiss",
            );

            await characteristic.stopNotifications();
        } catch (error) {
            const errorMessage = `Failed to set machine settings${error instanceof TimeoutError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("changeDragFactorSettings:", error);

            throw error;
        }
    }

    async changeStrokeSettings(
        strokeDetectionSettings: Omit<IStrokeDetectionSettings, "isCompiledWithDouble">,
    ): Promise<void> {
        const service = this.ergConnectionService.readSettingsCharacteristic()?.service;
        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined || service === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await service.getCharacteristic(SETTINGS_CONTROL_POINT);

            const responseTask = firstValueFrom(observeValue$(characteristic).pipe(timeout(1000)));

            const payload = new DataView(new ArrayBuffer(16));
            payload.setUint8(0, BleOpCodes.SetStrokeDetectionSettings);

            const strokeDetectionTypeBits = strokeDetectionSettings.strokeDetectionType & 0x03;
            const impulseDataArrayLengthBits = (strokeDetectionSettings.impulseDataArrayLength & 0x3f) << 2;
            payload.setUint8(1, strokeDetectionTypeBits | impulseDataArrayLengthBits);

            payload.setInt16(2, Math.round(strokeDetectionSettings.minimumPoweredTorque * 10000), true);
            payload.setInt16(4, Math.round(strokeDetectionSettings.minimumDragTorque * 10000), true);
            payload.setFloat32(6, strokeDetectionSettings.minimumRecoverySlopeMargin, true);
            payload.setInt16(10, Math.round(strokeDetectionSettings.minimumRecoverySlope * 1000), true);

            const recoveryTimeBits = strokeDetectionSettings.minimumRecoveryTime & 0x0fff;
            const driveTimeBits = (strokeDetectionSettings.minimumDriveTime & 0x0fff) << 12;
            const strokeTimingValue = recoveryTimeBits | driveTimeBits;
            payload.setUint8(12, strokeTimingValue & 0xff);
            payload.setUint8(13, (strokeTimingValue >> 8) & 0xff);
            payload.setUint8(14, (strokeTimingValue >> 16) & 0xff);
            payload.setUint8(15, strokeDetectionSettings.driveHandleForcesMaxCapacity);

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(payload);

            this.snackBar.open(
                (await responseTask).getUint8(2) === BleResponseOpCodes.Successful
                    ? "Stroke detection settings changed"
                    : `An error occurred while changing stroke detection settings (${BleResponseOpCodes[(await responseTask).getUint8(2)]}`,
                "Dismiss",
            );

            await characteristic.stopNotifications();
        } catch (error) {
            const errorMessage = `Failed to set stroke detection settings${error instanceof TimeoutError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("changeStrokeDetectionSettings:", error);
        }
    }

    async restartDevice(): Promise<void> {
        const service = this.ergConnectionService.readSettingsCharacteristic()?.service;
        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined || service === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return;
        }

        try {
            const characteristic = await service.getCharacteristic(SETTINGS_CONTROL_POINT);

            const responseTask = firstValueFrom(observeValue$(characteristic).pipe(timeout(1000)));

            await characteristic.startNotifications();
            await characteristic.writeValueWithoutResponse(new Uint8Array([BleOpCodes.RestartDevice]));

            const response = (await responseTask).getUint8(2);
            if (response === BleResponseOpCodes.Successful) {
                await this.ergConnectionService.disconnectDevice();
                await withDelay(1000);
            }

            this.snackBar.open(
                response === BleResponseOpCodes.Successful
                    ? "Restarting device"
                    : "An error occurred while restarting device",
                "Dismiss",
            );
        } catch (error) {
            const errorMessage = `Failed to set restart device${error instanceof TimeoutError ? ", request timed out" : ""}`;

            this.snackBar.open(errorMessage, "Dismiss");
            console.error("restartDevice:", error);
        }
    }

    private observeSettings$(
        settingsCharacteristic: BluetoothRemoteGATTCharacteristic,
    ): Observable<IBleRowerSettingsDTO> {
        return from(settingsCharacteristic.readValue()).pipe(
            concatWith(
                defer((): Observable<DataView<ArrayBufferLike>> => observeValue$(settingsCharacteristic)),
            ),
            map((value: DataView): IBleRowerSettingsDTO => {
                const logToWs = value.getUint8(0) & 3;
                const logToSd = (value.getUint8(0) >> 2) & 3;
                const logLevel = (value.getUint8(0) >> 4) & 7;

                const generalSettings = {
                    logDeltaTimes: logToWs === 0 ? undefined : logToWs === 1 ? false : true,
                    logToSdCard: logToSd === 0 ? undefined : logToSd === 1 ? false : true,
                    logLevel: logLevel,
                    bleServiceFlag: calculateBleServiceFlag(
                        this.ergConnectionService.readMeasurementCharacteristic()?.uuid,
                    ),
                };

                // added for backward compatibility with old firmware that do not support broadcasting settings at all
                if (value.byteLength === 1) {
                    return {
                        ...generalSettings,
                        ...DEFAULT_ROWING_SETTINGS_DTO,
                    };
                }

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
                    ...generalSettings,
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
    ): Observable<IBleStrokeDetectionSettingsDTO> {
        return from(strokeDetectionSettingsCharacteristic.readValue()).pipe(
            concatWith(
                defer(
                    (): Observable<DataView<ArrayBufferLike>> =>
                        observeValue$(strokeDetectionSettingsCharacteristic),
                ),
            ),
            map((value: DataView): IBleStrokeDetectionSettingsDTO => {
                const strokeDetectionType = value.getUint8(0) & 0x03;
                const impulseDataArrayLength = (value.getUint8(0) >> 2) & 0x1f;
                const isCompiledWithDouble = Boolean((value.getUint8(0) >> 7) & 0x01);
                const minimumPoweredTorque = value.getUint16(1, true) / 10000;
                const minimumDragTorque = value.getUint16(3, true) / 10000;
                const minimumRecoverySlopeMargin = value.getFloat32(5, true);
                const minimumRecoverySlope = value.getInt16(9, true) / 1000;
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

    private streamRowerSettings$(): Observable<IBleRowerSettingsDTO> {
        return this.ergConnectionService.settingsCharacteristic$.pipe(
            filter(
                (
                    settingsCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): settingsCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    settingsCharacteristic !== undefined,
            ),
            switchMap(
                (
                    settingsCharacteristic: BluetoothRemoteGATTCharacteristic,
                ): Observable<IBleRowerSettingsDTO> => this.observeSettings$(settingsCharacteristic),
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

    private streamStrokeDetectionSettings$(): Observable<IBleStrokeDetectionSettingsDTO> {
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
                ): Observable<IBleStrokeDetectionSettingsDTO> =>
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
