import { IMachineSettings, IRowerSettings } from "../../common.interfaces";

/**
 * Creates a mock IRowerSettings object with zeroed defaults.
 * Use `machineSettingsOverrides` to override just machineSettings properties.
 */
export const createMockRowerSettings = (
    machineSettingsOverrides?: Partial<IMachineSettings>,
): IRowerSettings => ({
    generalSettings: {
        logDeltaTimes: undefined,
        logToSdCard: undefined,
        bleServiceFlag: 0,
        logLevel: 0,
        isRuntimeSettingsEnabled: undefined,
        isCompiledWithDouble: undefined,
    },
    rowingSettings: {
        machineSettings: {
            flywheelInertia: 0,
            magicConstant: 0,
            sprocketRadius: 0,
            impulsePerRevolution: 0,
            ...machineSettingsOverrides,
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
        strokeDetectionSettings: {
            strokeDetectionType: 0,
            impulseDataArrayLength: 0,
            minimumPoweredTorque: 0,
            minimumDragTorque: 0,
            minimumRecoverySlope: 0,
            minimumRecoveryTime: 0,
            minimumDriveTime: 0,
            driveHandleForcesMaxCapacity: 0,
        },
    },
});
