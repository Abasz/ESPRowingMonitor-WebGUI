import { describe, expect, it } from "vitest";

import { IRowingProfileSettings, StrokeDetectionType } from "../common.interfaces";

import { formatCppNumber, generateProfileHeader, needsClangFormatGuard } from "./profile-header.generator";

describe("profile-header.generator", (): void => {
    const baseSettings: IRowingProfileSettings = {
        machineSettings: {
            flywheelInertia: 0.0899,
            magicConstant: 2.57,
            sprocketRadius: 3.2,
            impulsePerRevolution: 6,
        },
        sensorSignalSettings: {
            rotationDebounceTime: 4,
            rowingStoppedThreshold: 10,
        },
        dragFactorSettings: {
            goodnessOfFitThreshold: 0.67,
            maxDragFactorRecoveryPeriod: 4,
            dragFactorLowerThreshold: 10,
            dragFactorUpperThreshold: 200,
            dragCoefficientsArrayLength: 5,
        },
        strokeDetectionSettings: {
            strokeDetectionType: StrokeDetectionType.Torque,
            impulseDataArrayLength: 9,
            minimumPoweredTorque: 0,
            minimumDragTorque: 0.08,
            minimumRecoverySlope: 0,
            minimumRecoveryTime: 145,
            minimumDriveTime: 160,
            driveHandleForcesMaxCapacity: 59,
        },
    };

    describe("formatCppNumber function", (): void => {
        it("should add digit separators for integers >= 1000", (): void => {
            expect(formatCppNumber(10000)).toBe("10'000");
            expect(formatCppNumber(4000)).toBe("4'000");
            expect(formatCppNumber(1500)).toBe("1'500");
            expect(formatCppNumber(1000000)).toBe("1'000'000");
        });

        it("should not add separators for integers < 1000", (): void => {
            expect(formatCppNumber(999)).toBe("999");
            expect(formatCppNumber(0)).toBe("0");
            expect(formatCppNumber(145)).toBe("145");
        });

        it("should handle negative numbers", (): void => {
            expect(formatCppNumber(-10000)).toBe("-10'000");
            expect(formatCppNumber(-500)).toBe("-500");
        });

        it("should not add separators for floating point numbers", (): void => {
            expect(formatCppNumber(0.0899)).toBe("0.0899");
            expect(formatCppNumber(2.57)).toBe("2.57");
            expect(formatCppNumber(1000.5)).toBe("1000.5");
        });
    });

    describe("needsClangFormatGuard function", (): void => {
        it("should return true when model number contains /", (): void => {
            expect(needsClangFormatGuard("2025/6M")).toBe(true);
        });

        it("should return true when model number contains arithmetic operators", (): void => {
            expect(needsClangFormatGuard("Model+1")).toBe(true);
            expect(needsClangFormatGuard("Model-2")).toBe(true);
            expect(needsClangFormatGuard("Model*3")).toBe(true);
        });

        it("should return false when model number has no special chars", (): void => {
            expect(needsClangFormatGuard("Generic")).toBe(false);
            expect(needsClangFormatGuard("Model123")).toBe(false);
        });
    });

    describe("generateProfileHeader function", (): void => {
        it("should generate a valid header with all sections", (): void => {
            const result = generateProfileHeader(baseSettings, "OldDanube", "2025/6M");

            expect(result).toContain("#pragma once");
            expect(result).toContain('#include "../utils/enums.h"');
            expect(result).toContain(
                "// NOLINTBEGIN(cppcoreguidelines-macro-usage,cppcoreguidelines-macro-to-enum)",
            );
            expect(result).toContain(
                "// NOLINTEND(cppcoreguidelines-macro-usage,cppcoreguidelines-macro-to-enum)",
            );
        });

        it("should include device name and model number", (): void => {
            const result = generateProfileHeader(baseSettings, "OldDanube", "2025/6M");

            expect(result).toContain("#define DEVICE_NAME OldDanube");
            expect(result).toContain("#define MODEL_NUMBER 2025/6M");
        });

        it("should set ADD_BLE_SERVICE_TO_DEVICE_NAME to true when device name is 11 characters or less", (): void => {
            const result = generateProfileHeader(baseSettings, "CustomRower", "Generic");

            expect(result).toContain("#define ADD_BLE_SERVICE_TO_DEVICE_NAME true");
        });

        it("should set ADD_BLE_SERVICE_TO_DEVICE_NAME to false when device name is longer than 11 characters", (): void => {
            const result = generateProfileHeader(baseSettings, "Custom Rower Device", "Generic");

            expect(result).toContain("#define ADD_BLE_SERVICE_TO_DEVICE_NAME false");
        });

        it("should include clang-format guard when model number contains special chars", (): void => {
            const result = generateProfileHeader(baseSettings, "OldDanube", "2025/6M");

            expect(result).toContain("// clang-format off");
            expect(result).toContain("// NOLINTNEXTLINE(bugprone-macro-parentheses)");
            expect(result).toContain("#define MODEL_NUMBER 2025/6M");
            expect(result).toContain("// clang-format on");
        });

        it("should omit clang-format guard when model number has no special chars", (): void => {
            const result = generateProfileHeader(baseSettings, "CustomRower", "Generic");

            expect(result).not.toContain("// clang-format off");
            expect(result).not.toContain("// NOLINTNEXTLINE(bugprone-macro-parentheses)");
            expect(result).toContain("#define MODEL_NUMBER Generic");
        });

        it("should include hardware settings", (): void => {
            const result = generateProfileHeader(baseSettings, "TestDevice", "Generic");

            expect(result).toContain("// Hardware settings");
            expect(result).toContain("#define IMPULSES_PER_REVOLUTION 6");
            expect(result).toContain("#define FLYWHEEL_INERTIA 0.0899");
            expect(result).toContain("#define SPROCKET_RADIUS 3.2");
            expect(result).toContain("#define CONCEPT_2_MAGIC_NUMBER 2.57");
        });

        it("should convert rowingStoppedThreshold from seconds to milliseconds", (): void => {
            const result = generateProfileHeader(baseSettings, "TestDevice", "Generic");

            expect(result).toContain("#define ROWING_STOPPED_THRESHOLD_PERIOD 10'000");
        });

        it("should convert maxDragFactorRecoveryPeriod from seconds to milliseconds", (): void => {
            const result = generateProfileHeader(baseSettings, "TestDevice", "Generic");

            expect(result).toContain("#define MAX_DRAG_FACTOR_RECOVERY_PERIOD 4'000");
        });

        it("should include drag factor settings", (): void => {
            const result = generateProfileHeader(baseSettings, "TestDevice", "Generic");

            expect(result).toContain("// Drag factor filter settings");
            expect(result).toContain("#define GOODNESS_OF_FIT_THRESHOLD 0.67");
            expect(result).toContain("#define LOWER_DRAG_FACTOR_THRESHOLD 10");
            expect(result).toContain("#define UPPER_DRAG_FACTOR_THRESHOLD 200");
            expect(result).toContain("#define DRAG_COEFFICIENTS_ARRAY_LENGTH 5");
        });

        it("should map StrokeDetectionType.Torque correctly", (): void => {
            const result = generateProfileHeader(baseSettings, "TestDevice", "Generic");

            expect(result).toContain("#define STROKE_DETECTION_TYPE STROKE_DETECTION_TORQUE");
        });

        it("should map StrokeDetectionType.Slope correctly", (): void => {
            const settings: IRowingProfileSettings = {
                ...baseSettings,
                strokeDetectionSettings: {
                    ...baseSettings.strokeDetectionSettings,
                    strokeDetectionType: StrokeDetectionType.Slope,
                },
            };

            const result = generateProfileHeader(settings, "TestDevice", "Generic");

            expect(result).toContain("#define STROKE_DETECTION_TYPE STROKE_DETECTION_SLOPE");
        });

        it("should map StrokeDetectionType.Both correctly", (): void => {
            const settings: IRowingProfileSettings = {
                ...baseSettings,
                strokeDetectionSettings: {
                    ...baseSettings.strokeDetectionSettings,
                    strokeDetectionType: StrokeDetectionType.Both,
                },
            };

            const result = generateProfileHeader(settings, "TestDevice", "Generic");

            expect(result).toContain("#define STROKE_DETECTION_TYPE STROKE_DETECTION_BOTH");
        });

        it("should include all stroke detection settings", (): void => {
            const result = generateProfileHeader(baseSettings, "TestDevice", "Generic");

            expect(result).toContain("// Stroke phase detection filter settings");
            expect(result).toContain("#define MINIMUM_POWERED_TORQUE 0");
            expect(result).toContain("#define MINIMUM_DRAG_TORQUE 0.08");
            expect(result).toContain("#define MINIMUM_RECOVERY_SLOPE 0");
            expect(result).toContain("#define MINIMUM_RECOVERY_TIME 145");
            expect(result).toContain("#define MINIMUM_DRIVE_TIME 160");
            expect(result).toContain("#define IMPULSE_DATA_ARRAY_LENGTH 9");
            expect(result).toContain("#define DRIVE_HANDLE_FORCES_MAX_CAPACITY 59");
        });

        it("should not include omitted firmware defaults", (): void => {
            const result = generateProfileHeader(baseSettings, "TestDevice", "Generic");

            expect(result).not.toContain("ENABLE_RUNTIME_SETTINGS");
            expect(result).not.toContain("ADD_SERIAL_TO_DEVICE_NAME");
            expect(result).not.toContain("MIN_BLE_UPDATE_INTERVAL");
            expect(result).not.toContain("FLOATING_POINT_PRECISION");
        });

        it("should produce a full snapshot matching expected format", (): void => {
            const result = generateProfileHeader(baseSettings, "OldDanube", "2025/6M");

            const expected = [
                "#pragma once",
                "",
                '#include "../utils/enums.h"',
                "",
                "// NOLINTBEGIN(cppcoreguidelines-macro-usage,cppcoreguidelines-macro-to-enum)",
                "",
                "#define DEVICE_NAME OldDanube",
                "// clang-format off",
                "// NOLINTNEXTLINE(bugprone-macro-parentheses)",
                "#define MODEL_NUMBER 2025/6M",
                "// clang-format on",
                "",
                "#define ADD_BLE_SERVICE_TO_DEVICE_NAME true",
                "",
                "// Hardware settings",
                "#define IMPULSES_PER_REVOLUTION 6",
                "#define FLYWHEEL_INERTIA 0.0899",
                "#define SPROCKET_RADIUS 3.2",
                "#define CONCEPT_2_MAGIC_NUMBER 2.57",
                "",
                "// Sensor signal filter settings",
                "#define ROTATION_DEBOUNCE_TIME_MIN 4",
                "#define ROWING_STOPPED_THRESHOLD_PERIOD 10'000",
                "",
                "// Drag factor filter settings",
                "#define GOODNESS_OF_FIT_THRESHOLD 0.67",
                "#define MAX_DRAG_FACTOR_RECOVERY_PERIOD 4'000",
                "#define LOWER_DRAG_FACTOR_THRESHOLD 10",
                "#define UPPER_DRAG_FACTOR_THRESHOLD 200",
                "#define DRAG_COEFFICIENTS_ARRAY_LENGTH 5",
                "",
                "// Stroke phase detection filter settings",
                "#define MINIMUM_POWERED_TORQUE 0",
                "#define MINIMUM_DRAG_TORQUE 0.08",
                "#define STROKE_DETECTION_TYPE STROKE_DETECTION_TORQUE",
                "#define MINIMUM_RECOVERY_SLOPE 0",
                "#define MINIMUM_RECOVERY_TIME 145",
                "#define MINIMUM_DRIVE_TIME 160",
                "#define IMPULSE_DATA_ARRAY_LENGTH 9",
                "#define DRIVE_HANDLE_FORCES_MAX_CAPACITY 59",
                "",
                "// NOLINTEND(cppcoreguidelines-macro-usage,cppcoreguidelines-macro-to-enum)",
                "",
            ].join("\n");

            expect(result).toBe(expected);
        });
    });
});
