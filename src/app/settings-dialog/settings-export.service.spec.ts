import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { IRowingProfileSettings, StrokeDetectionType } from "../../common/common.interfaces";

import { SettingsExportService } from "./settings-export.service";

describe("SettingsExportService", (): void => {
    let service: SettingsExportService;
    let createObjectURLSpy: Mock;
    let revokeObjectURLSpy: Mock;
    let mockAnchorElement: { href: string; download: string; click: ReturnType<typeof vi.fn> };

    const mockSettings: IRowingProfileSettings = {
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

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [SettingsExportService],
        });

        service = TestBed.inject(SettingsExportService);

        Object.defineProperty(navigator, "canShare", {
            value: undefined,
            writable: true,
            configurable: true,
        });

        mockAnchorElement = {
            href: "",
            download: "",
            click: vi.fn(),
        };

        vi.spyOn(document, "createElement").mockReturnValue(
            mockAnchorElement as unknown as HTMLAnchorElement,
        );

        createObjectURLSpy = vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-url");
        revokeObjectURLSpy = vi.spyOn(window.URL, "revokeObjectURL").mockReturnValue();
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    describe("exportRowerProfile method", (): void => {
        it("should trigger a file download", async (): Promise<void> => {
            await service.exportRowerProfile(mockSettings, "TestDevice", "Generic");

            expect(mockAnchorElement.click).toHaveBeenCalled();
        });

        it("should use camelCased device name as the filename", async (): Promise<void> => {
            await service.exportRowerProfile(mockSettings, "TestDevice", "Generic");

            expect(mockAnchorElement.download).toBe("testDevice.rower-profile.h");
        });

        it("should camelCase device name with spaces in the filename", async (): Promise<void> => {
            await service.exportRowerProfile(mockSettings, "My Custom Rower", "Generic");

            expect(mockAnchorElement.download).toBe("myCustomRower.rower-profile.h");
        });

        it("should create a Blob URL for download", async (): Promise<void> => {
            await service.exportRowerProfile(mockSettings, "TestDevice", "Generic");

            expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
            expect(mockAnchorElement.href).toBe("blob:mock-url");
        });

        it("should revoke the Blob URL after download", async (): Promise<void> => {
            await service.exportRowerProfile(mockSettings, "TestDevice", "Generic");

            expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
        });

        it("should pass the Blob with text/plain type to createObjectURL", async (): Promise<void> => {
            await service.exportRowerProfile(mockSettings, "TestDevice", "Generic");

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;

            expect(blobArg.type).toBe("text/plain");
        });

        it("should include device name in the generated header", async (): Promise<void> => {
            await service.exportRowerProfile(mockSettings, "TestDevice", "Generic");

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            const content = await blobArg.text();

            expect(content).toContain("#define DEVICE_NAME TestDevice");
        });

        it("should include model number in the generated header", async (): Promise<void> => {
            await service.exportRowerProfile(mockSettings, "TestDevice", "MyModel");

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            const content = await blobArg.text();

            expect(content).toContain("#define MODEL_NUMBER MyModel");
        });

        it("should convert settings to C++ header format", async (): Promise<void> => {
            await service.exportRowerProfile(mockSettings, "TestDevice", "Generic");

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            const content = await blobArg.text();

            expect(content).toContain("#pragma once");
            expect(content).toContain("#define FLYWHEEL_INERTIA 0.0899");
            expect(content).toContain("#define ROWING_STOPPED_THRESHOLD_PERIOD 10'000");
            expect(content).toContain("#define STROKE_DETECTION_TYPE STROKE_DETECTION_TORQUE");
        });

        it("should strip minimumRecoverySlopeMargin and still produce valid output", async (): Promise<void> => {
            const settingsWithDeprecatedField: IRowingProfileSettings = {
                ...mockSettings,
                strokeDetectionSettings: {
                    ...mockSettings.strokeDetectionSettings,
                    minimumRecoverySlopeMargin: 0.02,
                },
            };

            await service.exportRowerProfile(settingsWithDeprecatedField, "TestDevice", "Generic");

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            const content = await blobArg.text();

            expect(content).toContain("#define FLYWHEEL_INERTIA 0.0899");
            expect(content).not.toContain("RECOVERY_SLOPE_MARGIN");
        });
    });
});
