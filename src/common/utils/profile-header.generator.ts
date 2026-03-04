import { IRowingProfileSettings, StrokeDetectionType } from "../common.interfaces";

const STROKE_DETECTION_TYPE_MAP: Record<StrokeDetectionType, string> = {
    [StrokeDetectionType.Torque]: "STROKE_DETECTION_TORQUE",
    [StrokeDetectionType.Slope]: "STROKE_DETECTION_SLOPE",
    [StrokeDetectionType.Both]: "STROKE_DETECTION_BOTH",
};

/**
 * Format a number with C++ digit separators (e.g. 10000 → "10'000").
 * Only applies separators to the integer part when >= 1000.
 */
export function formatCppNumber(value: number): string {
    if (Number.isInteger(value) && Math.abs(value) >= 1000) {
        const sign = value < 0 ? "-" : "";

        return (
            sign +
            Math.abs(value)
                .toString()
                .replace(/\B(?=(\d{3})+$)/g, "'")
        );
    }

    return String(value);
}

/**
 * Returns true if the MODEL_NUMBER value needs a clang-format guard.
 * This is required when the value contains characters like `/` that
 * clang-format may reformat (e.g. interpret as division).
 */
export function needsClangFormatGuard(modelNumber: string): boolean {
    return /[/\\+\-*&|^%]/.test(modelNumber);
}

/**
 * Generate a C++ rower profile header file from rowing settings.
 *
 * The output follows the format of ESPRowingMonitor's .rower-profile.h files.
 * ADD_BLE_SERVICE_TO_DEVICE_NAME is set conditionally based on device name length:
 * - If deviceName length <= 11: true (service flag "(FTMS)" can fit in the 18-char limit)
 * - If deviceName length > 11: false (service flag would exceed the 18-char limit)
 *
 * Other fields with firmware-provided macro defaults (ENABLE_RUNTIME_SETTINGS,
 * ADD_SERIAL_TO_DEVICE_NAME, MIN_BLE_UPDATE_INTERVAL) are intentionally omitted.
 */
export function generateProfileHeader(
    settings: IRowingProfileSettings,
    deviceName: string,
    modelNumber: string,
): string {
    const {
        machineSettings,
        sensorSignalSettings,
        dragFactorSettings,
        strokeDetectionSettings,
    }: IRowingProfileSettings = settings;

    const strokeDetectionCppValue = STROKE_DETECTION_TYPE_MAP[strokeDetectionSettings.strokeDetectionType];

    const rowingStoppedMs = sensorSignalSettings.rowingStoppedThreshold * 1000;
    const maxDragFactorRecoveryMs = dragFactorSettings.maxDragFactorRecoveryPeriod * 1000;

    const modelNumberDefine = needsClangFormatGuard(modelNumber)
        ? [
              "// clang-format off",
              "// NOLINTNEXTLINE(bugprone-macro-parentheses)",
              `#define MODEL_NUMBER ${modelNumber}`,
              "// clang-format on",
          ].join("\n")
        : `#define MODEL_NUMBER ${modelNumber}`;

    const lines = [
        "#pragma once",
        "",
        '#include "../utils/enums.h"',
        "",
        "// NOLINTBEGIN(cppcoreguidelines-macro-usage,cppcoreguidelines-macro-to-enum)",
        "",
        `#define DEVICE_NAME ${deviceName}`,
        modelNumberDefine,
        "",
        `#define ADD_BLE_SERVICE_TO_DEVICE_NAME ${deviceName.length <= 11 ? "true" : "false"}`,
        "",
        "// Hardware settings",
        `#define IMPULSES_PER_REVOLUTION ${machineSettings.impulsePerRevolution}`,
        `#define FLYWHEEL_INERTIA ${machineSettings.flywheelInertia}`,
        `#define SPROCKET_RADIUS ${machineSettings.sprocketRadius}`,
        `#define CONCEPT_2_MAGIC_NUMBER ${machineSettings.magicConstant}`,
        "",
        "// Sensor signal filter settings",
        `#define ROTATION_DEBOUNCE_TIME_MIN ${sensorSignalSettings.rotationDebounceTime}`,
        `#define ROWING_STOPPED_THRESHOLD_PERIOD ${formatCppNumber(rowingStoppedMs)}`,
        "",
        "// Drag factor filter settings",
        `#define GOODNESS_OF_FIT_THRESHOLD ${dragFactorSettings.goodnessOfFitThreshold}`,
        `#define MAX_DRAG_FACTOR_RECOVERY_PERIOD ${formatCppNumber(maxDragFactorRecoveryMs)}`,
        `#define LOWER_DRAG_FACTOR_THRESHOLD ${dragFactorSettings.dragFactorLowerThreshold}`,
        `#define UPPER_DRAG_FACTOR_THRESHOLD ${dragFactorSettings.dragFactorUpperThreshold}`,
        `#define DRAG_COEFFICIENTS_ARRAY_LENGTH ${dragFactorSettings.dragCoefficientsArrayLength}`,
        "",
        "// Stroke phase detection filter settings",
        `#define MINIMUM_POWERED_TORQUE ${strokeDetectionSettings.minimumPoweredTorque}`,
        `#define MINIMUM_DRAG_TORQUE ${strokeDetectionSettings.minimumDragTorque}`,
        `#define STROKE_DETECTION_TYPE ${strokeDetectionCppValue}`,
        `#define MINIMUM_RECOVERY_SLOPE ${strokeDetectionSettings.minimumRecoverySlope}`,
        `#define MINIMUM_RECOVERY_TIME ${strokeDetectionSettings.minimumRecoveryTime}`,
        `#define MINIMUM_DRIVE_TIME ${strokeDetectionSettings.minimumDriveTime}`,
        `#define IMPULSE_DATA_ARRAY_LENGTH ${strokeDetectionSettings.impulseDataArrayLength}`,
        `#define DRIVE_HANDLE_FORCES_MAX_CAPACITY ${strokeDetectionSettings.driveHandleForcesMaxCapacity}`,
        "",
        "// NOLINTEND(cppcoreguidelines-macro-usage,cppcoreguidelines-macro-to-enum)",
        "",
    ];

    return lines.join("\n");
}
