import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IRowingProfileSettings, ProfileData, StrokeDetectionType } from "../common.interfaces";
import { CUSTOM_PROFILE_KEY, STANDARD_PROFILES } from "../data/standard-profiles";

import { RowingProfileService } from "./rowing-profile.service";

describe("RowingProfileService", (): void => {
    let rowingProfileService: RowingProfileService;

    const mockProfileSettings: IRowingProfileSettings = {
        machineSettings: {
            flywheelInertia: 0.07848,
            magicConstant: 2.8,
            sprocketRadius: 1.5,
            impulsePerRevolution: 3,
        },
        sensorSignalSettings: {
            rotationDebounceTime: 7,
            rowingStoppedThreshold: 7,
        },
        dragFactorSettings: {
            goodnessOfFitThreshold: 0.97,
            maxDragFactorRecoveryPeriod: 6,
            dragFactorLowerThreshold: 75,
            dragFactorUpperThreshold: 250,
            dragCoefficientsArrayLength: 1,
        },
        strokeDetectionSettings: {
            strokeDetectionType: StrokeDetectionType.Torque,
            impulseDataArrayLength: 7,
            minimumPoweredTorque: 0,
            minimumDragTorque: 0.14,
            minimumRecoverySlopeMargin: 0.00002,
            minimumRecoverySlope: 0.01,
            minimumRecoveryTime: 800,
            minimumDriveTime: 400,
            driveHandleForcesMaxCapacity: 255,
        },
    };

    const mockCustomProfile: ProfileData = {
        name: "Custom Profile",
        profileId: CUSTOM_PROFILE_KEY,
        settings: mockProfileSettings,
    };

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [RowingProfileService, provideZonelessChangeDetection()],
        });

        rowingProfileService = TestBed.inject(RowingProfileService);

        localStorage.clear();
    });

    afterEach((): void => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it("should be created", (): void => {
        expect(rowingProfileService).toBeTruthy();
    });

    describe("getAllProfiles method", (): void => {
        it("should return all standard profiles when no custom profile exists", (): void => {
            const result = rowingProfileService.getAllProfiles();

            expect(result).toEqual(STANDARD_PROFILES);
            expect(Object.keys(result)).not.toContain(CUSTOM_PROFILE_KEY);
        });

        it("should include custom profile when it exists", (): void => {
            localStorage.setItem("rowingSettingsCustomProfile", JSON.stringify(mockProfileSettings));

            const result = rowingProfileService.getAllProfiles();

            expect(result).toEqual({
                ...STANDARD_PROFILES,
                [CUSTOM_PROFILE_KEY]: mockCustomProfile,
            });
            expect(Object.keys(result)).toContain(CUSTOM_PROFILE_KEY);
            expect(result[CUSTOM_PROFILE_KEY]).toEqual(mockCustomProfile);
        });

        it("should not include custom profile when localStorage contains invalid data", (): void => {
            localStorage.setItem("rowingSettingsCustomProfile", "invalid-json");

            const result = rowingProfileService.getAllProfiles();

            expect(result).toEqual(STANDARD_PROFILES);
            expect(Object.keys(result)).not.toContain(CUSTOM_PROFILE_KEY);
        });
    });

    describe("getProfile method", (): void => {
        it("should return the correct standard profile when profile key exists", (): void => {
            const profileKey = Object.keys(STANDARD_PROFILES)[0];

            const result = rowingProfileService.getProfile(profileKey);

            expect(result).toEqual(STANDARD_PROFILES[profileKey]);
        });

        it("should return undefined when profile key does not exist", (): void => {
            const result = rowingProfileService.getProfile("nonExistentProfile");

            expect(result).toBeUndefined();
        });

        describe("when requesting custom profile", (): void => {
            it("should return custom profile when it exists in localStorage", (): void => {
                localStorage.setItem("rowingSettingsCustomProfile", JSON.stringify(mockProfileSettings));

                const result = rowingProfileService.getProfile(CUSTOM_PROFILE_KEY);

                expect(result).toEqual(mockCustomProfile);
            });

            it("should return undefined when custom profile does not exist", (): void => {
                const result = rowingProfileService.getProfile(CUSTOM_PROFILE_KEY);

                expect(result).toBeUndefined();
            });

            it("should return undefined when localStorage contains invalid custom profile data", (): void => {
                localStorage.setItem("rowingSettingsCustomProfile", "invalid-json");

                const result = rowingProfileService.getProfile(CUSTOM_PROFILE_KEY);

                expect(result).toBeUndefined();
            });
        });
    });

    describe("getCustomProfile method", (): void => {
        it("should return custom profile settings when they exist in localStorage", (): void => {
            localStorage.setItem("rowingSettingsCustomProfile", JSON.stringify(mockProfileSettings));

            const result = rowingProfileService.getCustomProfile();

            expect(result).toEqual(mockProfileSettings);
        });

        it("should return undefined when no custom profile exists in localStorage", (): void => {
            const result = rowingProfileService.getCustomProfile();

            expect(result).toBeUndefined();
        });

        it("should return undefined and log warning when localStorage contains invalid JSON", (): void => {
            localStorage.setItem("rowingSettingsCustomProfile", "invalid-json");
            vi.spyOn(console, "warn");

            const result = rowingProfileService.getCustomProfile();

            expect(result).toBeUndefined();
            expect(console.warn).toHaveBeenCalledWith(
                "Failed to load custom profile from localStorage:",
                expect.any(Error),
            );
        });

        it("should handle localStorage access errors gracefully", (): void => {
            const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation((): never => {
                throw new Error("localStorage access denied");
            });
            vi.spyOn(console, "warn");

            const result = rowingProfileService.getCustomProfile();

            expect(getItem).toHaveBeenCalled();
            expect(result).toBeUndefined();
            expect(console.warn).toHaveBeenCalledWith(
                "Failed to load custom profile from localStorage:",
                expect.any(Error),
            );
        });
    });

    describe("saveAsCustomProfile method", (): void => {
        it("should save custom profile settings to localStorage", (): void => {
            rowingProfileService.saveAsCustomProfile(mockProfileSettings);

            const stored = localStorage.getItem("rowingSettingsCustomProfile");
            expect(stored).toBe(JSON.stringify(mockProfileSettings));
        });

        it("should overwrite existing custom profile", (): void => {
            const existingSettings: IRowingProfileSettings = {
                ...mockProfileSettings,
                machineSettings: {
                    ...mockProfileSettings.machineSettings,
                    flywheelInertia: 0.05,
                },
            };
            localStorage.setItem("rowingSettingsCustomProfile", JSON.stringify(existingSettings));

            rowingProfileService.saveAsCustomProfile(mockProfileSettings);

            const stored = localStorage.getItem("rowingSettingsCustomProfile");
            expect(stored).toBe(JSON.stringify(mockProfileSettings));
            expect(JSON.parse(stored!)).toEqual(mockProfileSettings);
        });

        it("should handle localStorage save errors gracefully", (): void => {
            const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((): void => undefined);
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation((): never => {
                throw new Error("localStorage quota exceeded");
            });

            rowingProfileService.saveAsCustomProfile(mockProfileSettings);

            expect(setItemSpy).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to save custom profile to localStorage:",
                expect.any(Error),
            );
        });

        it("should save profile with complex nested settings correctly", (): void => {
            const complexSettings: IRowingProfileSettings = {
                ...mockProfileSettings,
                strokeDetectionSettings: {
                    ...mockProfileSettings.strokeDetectionSettings,
                    strokeDetectionType: StrokeDetectionType.Both,
                    minimumRecoveryTime: 1200,
                },
            };

            rowingProfileService.saveAsCustomProfile(complexSettings);

            const stored = localStorage.getItem("rowingSettingsCustomProfile");
            const parsedSettings = JSON.parse(stored!);
            expect(parsedSettings).toEqual(complexSettings);
            expect(parsedSettings.strokeDetectionSettings.strokeDetectionType).toBe(StrokeDetectionType.Both);
        });
    });

    describe("integration scenarios", (): void => {
        it("should maintain consistency between save and retrieve operations", (): void => {
            rowingProfileService.saveAsCustomProfile(mockProfileSettings);

            const retrievedCustom = rowingProfileService.getCustomProfile();
            expect(retrievedCustom).toEqual(mockProfileSettings);

            const retrievedProfile = rowingProfileService.getProfile(CUSTOM_PROFILE_KEY);
            expect(retrievedProfile).toEqual(mockCustomProfile);

            const allProfiles = rowingProfileService.getAllProfiles();
            expect(allProfiles[CUSTOM_PROFILE_KEY]).toEqual(mockCustomProfile);
        });

        it("should handle multiple save and retrieve operations correctly", (): void => {
            const settings1: IRowingProfileSettings = {
                ...mockProfileSettings,
                machineSettings: { ...mockProfileSettings.machineSettings, flywheelInertia: 0.05 },
            };
            const settings2: IRowingProfileSettings = {
                ...mockProfileSettings,
                machineSettings: { ...mockProfileSettings.machineSettings, flywheelInertia: 0.08 },
            };

            rowingProfileService.saveAsCustomProfile(settings1);
            expect(rowingProfileService.getCustomProfile()?.machineSettings.flywheelInertia).toBe(0.05);

            rowingProfileService.saveAsCustomProfile(settings2);
            expect(rowingProfileService.getCustomProfile()?.machineSettings.flywheelInertia).toBe(0.08);
        });

        it("should not affect standard profiles when custom profile operations are performed", (): void => {
            const originalStandardProfiles = { ...STANDARD_PROFILES };

            rowingProfileService.saveAsCustomProfile(mockProfileSettings);
            const allProfiles = rowingProfileService.getAllProfiles();

            Object.keys(originalStandardProfiles).forEach((key: string): void => {
                expect(allProfiles[key]).toEqual(originalStandardProfiles[key]);
            });
        });
    });
});
