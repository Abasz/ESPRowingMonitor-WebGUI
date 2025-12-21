import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    IRowerSettings,
    IStrokeDetectionSettings,
    ProfileData,
    StrokeDetectionType,
} from "../../common/common.interfaces";
import { CUSTOM_PROFILE_KEY } from "../../common/data/standard-profiles";
import { RowingProfileService } from "../../common/services/rowing-profile.service";

import { RowingSettingsComponent } from "./rowing-settings.component";

describe("RowingSettingsComponent", (): void => {
    let component: RowingSettingsComponent;
    let fixture: ComponentFixture<RowingSettingsComponent>;
    let mockRowingProfileService: Pick<
        RowingProfileService,
        "getAllProfiles" | "getProfile" | "saveAsCustomProfile"
    >;

    const mockRowerSettings: IRowerSettings = {
        generalSettings: {
            bleServiceFlag: 0,
            logLevel: 1,
            logToSdCard: false,
            logDeltaTimes: false,
            isRuntimeSettingsEnabled: true,
            isCompiledWithDouble: true,
        },
        rowingSettings: {
            machineSettings: {
                flywheelInertia: 0.05,
                magicConstant: 2.8,
                sprocketRadius: 1.5,
                impulsePerRevolution: 11,
            },
            sensorSignalSettings: {
                rotationDebounceTime: 25,
                rowingStoppedThreshold: 3000,
            },
            dragFactorSettings: {
                goodnessOfFitThreshold: 0.96,
                maxDragFactorRecoveryPeriod: 8,
                dragFactorLowerThreshold: 90,
                dragFactorUpperThreshold: 220,
                dragCoefficientsArrayLength: 4,
            },
            strokeDetectionSettings: {
                strokeDetectionType: StrokeDetectionType.Torque,
                impulseDataArrayLength: 6,
                minimumPoweredTorque: 0.01,
                minimumDragTorque: 0.005,
                minimumRecoverySlopeMargin: 0.05,
                minimumRecoverySlope: 0.1,
                minimumRecoveryTime: 400,
                minimumDriveTime: 200,
                driveHandleForcesMaxCapacity: 20,
            },
        },
    };

    const mockProfileData: ProfileData = {
        name: "Test Profile",
        profileId: "testProfile",
        settings: {
            machineSettings: {
                flywheelInertia: 0.06,
                magicConstant: 3.0,
                sprocketRadius: 1.6,
                impulsePerRevolution: 10,
            },
            sensorSignalSettings: {
                rotationDebounceTime: 30,
                rowingStoppedThreshold: 2500,
            },
            dragFactorSettings: {
                goodnessOfFitThreshold: 0.95,
                maxDragFactorRecoveryPeriod: 10,
                dragFactorLowerThreshold: 85,
                dragFactorUpperThreshold: 200,
                dragCoefficientsArrayLength: 5,
            },
            strokeDetectionSettings: {
                strokeDetectionType: StrokeDetectionType.Slope,
                impulseDataArrayLength: 8,
                minimumPoweredTorque: 0.02,
                minimumDragTorque: 0.01,
                minimumRecoverySlopeMargin: 0.1,
                minimumRecoverySlope: 0.2,
                minimumRecoveryTime: 500,
                minimumDriveTime: 250,
                driveHandleForcesMaxCapacity: 25,
            },
        },
    };

    beforeEach(async (): Promise<void> => {
        mockRowingProfileService = {
            getAllProfiles: vi.fn(),
            getProfile: vi.fn(),
            saveAsCustomProfile: vi.fn(),
        };

        vi.mocked(mockRowingProfileService.getAllProfiles).mockReturnValue({
            "test-profile": mockProfileData,
            [CUSTOM_PROFILE_KEY]: mockProfileData,
        });

        vi.mocked(mockRowingProfileService.getProfile).mockReturnValue(mockProfileData);

        await TestBed.configureTestingModule({
            imports: [RowingSettingsComponent, ReactiveFormsModule],
            providers: [
                { provide: RowingProfileService, useValue: mockRowingProfileService },
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RowingSettingsComponent);
        component = fixture.componentInstance;

        fixture.componentRef.setInput("rowerSettings", mockRowerSettings);
        fixture.componentRef.setInput("isConnected", true);
        fixture.componentRef.setInput("isSmallScreen", false);
        // do not call whenStable here becuase some tests rely on ngOnInit not having been called yet
    });

    describe("Component Creation & Initialization", (): void => {
        it("should instantiate the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize the form with all controls and default values", async (): Promise<void> => {
            await fixture.whenStable();

            expect(component.settingsForm).toBeDefined();
            expect(component.settingsForm.controls.machineSettings).toBeDefined();
            expect(component.settingsForm.controls.sensorSignalSettings).toBeDefined();
            expect(component.settingsForm.controls.dragFactorSettings).toBeDefined();
            expect(component.settingsForm.controls.strokeDetectionSettings).toBeDefined();
            expect(component.settingsForm.controls.machineSettings.disabled).toBe(false);
            expect(component.settingsForm.controls.sensorSignalSettings.disabled).toBe(false);
            expect(component.settingsForm.controls.dragFactorSettings.disabled).toBe(false);
            expect(component.settingsForm.controls.strokeDetectionSettings.disabled).toBe(false);
        });

        it("should patch form values from @Input rowerSettings on ngOnInit", async (): Promise<void> => {
            await fixture.whenStable();

            expect(component.settingsForm.value.machineSettings?.flywheelInertia).toBe(0.05);
            expect(component.settingsForm.value.machineSettings?.magicConstant).toBe(2.8);
            expect(component.settingsForm.value.sensorSignalSettings?.rotationDebounceTime).toBe(25);
            expect(component.settingsForm.value.dragFactorSettings?.goodnessOfFitThreshold).toBe(0.96);
            expect(component.settingsForm.value.strokeDetectionSettings?.strokeDetectionType).toBe(
                StrokeDetectionType.Torque,
            );
        });
    });

    describe("Form Enable/Disable Logic", (): void => {
        it("should enable the form when both isConnected and isRuntimeSettingsEnabled are true", async (): Promise<void> => {
            fixture.componentRef.setInput("isConnected", true);
            const enabledRowingSettings = {
                ...mockRowerSettings,
                generalSettings: {
                    ...mockRowerSettings.generalSettings,
                    isRuntimeSettingsEnabled: true,
                },
            };
            fixture.componentRef.setInput("rowerSettings", enabledRowingSettings);
            await fixture.whenStable();

            expect(component.settingsForm.enabled).toBe(true);
        });

        describe("should keep the form disabled", (): void => {
            it("when isConnected is false", async (): Promise<void> => {
                fixture.componentRef.setInput("isConnected", false);
                const enabledRowingSettings = {
                    ...mockRowerSettings,
                    generalSettings: {
                        ...mockRowerSettings.generalSettings,
                        isRuntimeSettingsEnabled: true,
                    },
                };
                fixture.componentRef.setInput("rowerSettings", enabledRowingSettings);
                await fixture.whenStable();

                expect(component.settingsForm.disabled).toBe(true);
            });

            it("when isRuntimeSettingsEnabled is false", async (): Promise<void> => {
                fixture.componentRef.setInput("isConnected", true);
                const disabledRowingSettings = {
                    ...mockRowerSettings,
                    generalSettings: {
                        ...mockRowerSettings.generalSettings,
                        isRuntimeSettingsEnabled: false,
                    },
                };
                fixture.componentRef.setInput("rowerSettings", disabledRowingSettings);
                await fixture.whenStable();

                expect(component.settingsForm.disabled).toBe(true);
            });
        });
    });

    describe("Form Validators & Dynamic Validation", (): void => {
        it("should set correct max validator for impulseDataArrayLength based on isCompiledWithDouble", async (): Promise<void> => {
            await fixture.whenStable();
            const impulseControl =
                component.settingsForm.controls.strokeDetectionSettings.controls.impulseDataArrayLength;

            // with isCompiledWithDouble = true, max should be 15
            impulseControl.setValue(16);
            expect(impulseControl.hasError("max")).toBe(true);

            impulseControl.setValue(15);
            expect(impulseControl.hasError("max")).toBe(false);

            const rowerSettingsWithoutDouble = {
                ...mockRowerSettings,
                generalSettings: {
                    ...mockRowerSettings.generalSettings,
                    isCompiledWithDouble: false,
                },
            };
            fixture.componentRef.setInput("rowerSettings", rowerSettingsWithoutDouble);
            component.ngOnInit();
            await fixture.whenStable();

            // max should now be 18
            impulseControl.setValue(19);
            expect(impulseControl.hasError("max")).toBe(true);

            impulseControl.setValue(18);
            expect(impulseControl.hasError("max")).toBe(false);
        });

        it("should emit isFormValidChange when form validity changes", async (): Promise<void> => {
            vi.spyOn(component.isFormValidChange, "emit");

            component.settingsForm.patchValue({
                machineSettings: { flywheelInertia: 0.1 },
            });

            await fixture.whenStable();
            expect(component.isFormValidChange.emit).toHaveBeenCalled();
        });
    });

    describe("Dynamic Field State Management", (): void => {
        beforeEach(async (): Promise<void> => {
            const enabledRowingSettings = {
                ...mockRowerSettings,
                generalSettings: {
                    ...mockRowerSettings.generalSettings,
                    isRuntimeSettingsEnabled: true,
                },
            };
            fixture.componentRef.setInput("rowerSettings", enabledRowingSettings);
            fixture.componentRef.setInput("isConnected", true);
            await fixture.whenStable();
        });

        describe("when strokeDetectionType is set to Torque (legacy firmware)", (): void => {
            it("should disable minimumRecoverySlope field", (): void => {
                const minimumRecoverySlope =
                    component.settingsForm.controls.strokeDetectionSettings.controls.minimumRecoverySlope;

                component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                    StrokeDetectionType.Torque,
                );

                expect(minimumRecoverySlope.disabled).toBe(true);
            });

            it("should enable minimumRecoverySlopeMargin field when value is not NaN", (): void => {
                const minimumRecoverySlopeMargin =
                    component.settingsForm.controls.strokeDetectionSettings.controls
                        .minimumRecoverySlopeMargin;

                component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                    StrokeDetectionType.Torque,
                );

                // legacy firmware has non-NaN value, so field should be enabled
                expect(minimumRecoverySlopeMargin.enabled).toBe(true);
            });
        });

        describe("when strokeDetectionType is set to Slope", (): void => {
            it("should enable minimumRecoverySlope field", async (): Promise<void> => {
                await fixture.whenStable();
                const minimumRecoverySlope =
                    component.settingsForm.controls.strokeDetectionSettings.controls.minimumRecoverySlope;

                component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                    StrokeDetectionType.Slope,
                );

                await fixture.whenStable();
                expect(minimumRecoverySlope.enabled).toBe(true);
            });

            it("should disable minimumRecoverySlopeMargin field", async (): Promise<void> => {
                const minimumRecoverySlopeMargin =
                    component.settingsForm.controls.strokeDetectionSettings.controls
                        .minimumRecoverySlopeMargin;

                component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                    StrokeDetectionType.Slope,
                );

                await fixture.whenStable();
                expect(minimumRecoverySlopeMargin.disabled).toBe(true);
            });
        });

        it("should not change field states when isRuntimeSettingsEnabled is false", async (): Promise<void> => {
            const disabledRowingSettings = {
                ...mockRowerSettings,
                generalSettings: { ...mockRowerSettings.generalSettings, isRuntimeSettingsEnabled: false },
            };
            fixture.componentRef.setInput("rowerSettings", disabledRowingSettings);
            await fixture.whenStable();

            const minimumRecoverySlope =
                component.settingsForm.controls.strokeDetectionSettings.controls.minimumRecoverySlope;
            const minimumRecoverySlopeMargin =
                component.settingsForm.controls.strokeDetectionSettings.controls.minimumRecoverySlopeMargin;

            // eslint-disable-next-line @typescript-eslint/naming-convention
            const initialRecoverySlopeState = minimumRecoverySlope.disabled;
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const initialRecoverySlopeMarginState = minimumRecoverySlopeMargin.disabled;

            component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                StrokeDetectionType.Slope,
            );

            expect(minimumRecoverySlope.disabled).toBe(initialRecoverySlopeState);
            expect(minimumRecoverySlopeMargin.disabled).toBe(initialRecoverySlopeMarginState);
        });

        describe("minimumRecoverySlopeMargin with new firmware (NaN value)", (): void => {
            beforeEach(async (): Promise<void> => {
                const newFirmwareSettings = {
                    ...mockRowerSettings,
                    generalSettings: {
                        ...mockRowerSettings.generalSettings,
                        isRuntimeSettingsEnabled: true,
                    },
                    rowingSettings: {
                        ...mockRowerSettings.rowingSettings,
                        strokeDetectionSettings: {
                            ...mockRowerSettings.rowingSettings.strokeDetectionSettings,
                            minimumRecoverySlopeMargin: NaN,
                        },
                    },
                };
                fixture.componentRef.setInput("rowerSettings", newFirmwareSettings);
                fixture.componentRef.setInput("isConnected", true);
                await fixture.whenStable();
            });

            it("should always disable minimumRecoverySlopeMargin field when value is NaN", (): void => {
                const minimumRecoverySlopeMargin =
                    component.settingsForm.controls.strokeDetectionSettings.controls
                        .minimumRecoverySlopeMargin;

                // even with Torque mode, field should be disabled for new firmware
                component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                    StrokeDetectionType.Torque,
                );

                expect(minimumRecoverySlopeMargin.disabled).toBe(true);
            });

            it("should return false for showMinimumRecoverySlopeMargin signal", (): void => {
                expect(component.showMinimumRecoverySlopeMargin()).toBe(false);
            });
        });
    });

    describe("Profile Management", (): void => {
        beforeEach(async (): Promise<void> => {
            const enabledRowingSettings = {
                ...mockRowerSettings,
                generalSettings: {
                    ...mockRowerSettings.generalSettings,
                    isRuntimeSettingsEnabled: true,
                },
            };
            fixture.componentRef.setInput("rowerSettings", enabledRowingSettings);
            await fixture.whenStable();
        });

        describe("loadProfile", (): void => {
            it("should load a profile and patch form values if profileKey is valid and runtime settings enabled", (): void => {
                component.loadProfile("test-profile");

                expect(mockRowingProfileService.getProfile).toHaveBeenCalledWith("test-profile");
                expect(component.settingsForm.value.machineSettings?.flywheelInertia).toBe(0.06);
                expect(component.settingsForm.value.machineSettings?.magicConstant).toBe(3.0);
                expect(component.isProfileLoaded).toBe(true);
            });

            it("should not load a profile when profileKey is undefined", (): void => {
                component.loadProfile(undefined);

                expect(mockRowingProfileService.getProfile).not.toHaveBeenCalled();
                expect(component.isProfileLoaded).toBe(false);
            });

            it("should not load a profile when isRuntimeSettingsEnabled is false", async (): Promise<void> => {
                const disabledRowingSettings = {
                    ...mockRowerSettings,
                    generalSettings: {
                        ...mockRowerSettings.generalSettings,
                        isRuntimeSettingsEnabled: false,
                    },
                };
                fixture.componentRef.setInput("rowerSettings", disabledRowingSettings);
                await fixture.whenStable();

                component.loadProfile("test-profile");

                expect(mockRowingProfileService.getProfile).not.toHaveBeenCalled();
                expect(component.isProfileLoaded).toBe(false);
            });

            it("should not load a profile when profileData is not found", (): void => {
                vi.mocked(mockRowingProfileService.getProfile).mockReturnValue(undefined);

                component.loadProfile("non-existent-profile");

                expect(mockRowingProfileService.getProfile).toHaveBeenCalledWith("non-existent-profile");
                expect(component.isProfileLoaded).toBe(false);
            });

            it("should set _isProfileLoaded to true after loading a profile", (): void => {
                expect(component.isProfileLoaded).toBe(false);

                component.loadProfile("test-profile");

                expect(component.isProfileLoaded).toBe(true);
            });

            describe("minimumRecoverySlopeMargin handling for different firmware/profile combinations", (): void => {
                it("should use NaN when current firmware has NaN (new firmware)", async (): Promise<void> => {
                    const newFirmwareSettings = {
                        ...mockRowerSettings,
                        generalSettings: {
                            ...mockRowerSettings.generalSettings,
                            isRuntimeSettingsEnabled: true,
                        },
                        rowingSettings: {
                            ...mockRowerSettings.rowingSettings,
                            strokeDetectionSettings: {
                                ...mockRowerSettings.rowingSettings.strokeDetectionSettings,
                                minimumRecoverySlopeMargin: NaN,
                            },
                        },
                    };
                    fixture.componentRef.setInput("rowerSettings", newFirmwareSettings);

                    component.loadProfile("test-profile");

                    const loadedValue =
                        component.settingsForm.getRawValue().strokeDetectionSettings
                            .minimumRecoverySlopeMargin;
                    expect(Number.isNaN(loadedValue)).toBe(true);
                });

                it("should use 0 when current firmware has valid number (legacy) but profile has NaN (from new firmware)", async (): Promise<void> => {
                    const legacyFirmwareSettings = {
                        ...mockRowerSettings,
                        generalSettings: {
                            ...mockRowerSettings.generalSettings,
                            isRuntimeSettingsEnabled: true,
                        },
                    };
                    fixture.componentRef.setInput("rowerSettings", legacyFirmwareSettings);
                    await fixture.whenStable();

                    const newFirmwareProfile: ProfileData = {
                        ...mockProfileData,
                        settings: {
                            ...mockProfileData.settings,
                            strokeDetectionSettings: {
                                ...mockProfileData.settings.strokeDetectionSettings,
                                minimumRecoverySlopeMargin: NaN,
                            },
                        },
                    };
                    vi.mocked(mockRowingProfileService.getProfile).mockReturnValue(newFirmwareProfile);

                    component.loadProfile("test-profile");

                    const loadedValue =
                        component.settingsForm.value.strokeDetectionSettings?.minimumRecoverySlopeMargin;
                    expect(loadedValue).toBe(0);
                });

                it("should use 0 when current firmware has valid number (legacy) but profile has undefined (from JSON)", async (): Promise<void> => {
                    const legacyFirmwareSettings = {
                        ...mockRowerSettings,
                        generalSettings: {
                            ...mockRowerSettings.generalSettings,
                            isRuntimeSettingsEnabled: true,
                        },
                    };
                    fixture.componentRef.setInput("rowerSettings", legacyFirmwareSettings);
                    await fixture.whenStable();

                    const profileWithUndefined: ProfileData = {
                        ...mockProfileData,
                        settings: {
                            ...mockProfileData.settings,
                            strokeDetectionSettings: {
                                ...mockProfileData.settings.strokeDetectionSettings,
                                minimumRecoverySlopeMargin: undefined as unknown as number,
                            },
                        },
                    };
                    vi.mocked(mockRowingProfileService.getProfile).mockReturnValue(profileWithUndefined);

                    component.loadProfile("test-profile");

                    const loadedValue =
                        component.settingsForm.value.strokeDetectionSettings?.minimumRecoverySlopeMargin;
                    expect(loadedValue).toBe(0);
                });

                it("should use profile value when both current firmware and profife have valid numbers (legacy)", async (): Promise<void> => {
                    const legacyFirmwareSettings = {
                        ...mockRowerSettings,
                        generalSettings: {
                            ...mockRowerSettings.generalSettings,
                            isRuntimeSettingsEnabled: true,
                        },
                    };
                    fixture.componentRef.setInput("rowerSettings", legacyFirmwareSettings);
                    await fixture.whenStable();

                    component.loadProfile("test-profile");

                    const loadedValue =
                        component.settingsForm.value.strokeDetectionSettings?.minimumRecoverySlopeMargin;
                    expect(loadedValue).toBe(0.1); // from mockProfileData
                });
            });
        });
    });

    describe("Custom Profile Saving", (): void => {
        describe("saveAsCustomProfile", (): void => {
            it("should save as custom profile if form is dirty", (): void => {
                component.settingsForm.markAsDirty();
                vi.spyOn(component.settingsForm, "getRawValue").mockReturnValue({
                    machineSettings: mockProfileData.settings.machineSettings,
                    sensorSignalSettings: mockProfileData.settings.sensorSignalSettings,
                    dragFactorSettings: mockProfileData.settings.dragFactorSettings,
                    strokeDetectionSettings: mockProfileData.settings
                        .strokeDetectionSettings as Required<IStrokeDetectionSettings>,
                });

                component.saveAsCustomProfile();

                expect(mockRowingProfileService.saveAsCustomProfile).toHaveBeenCalled();
                expect(mockRowingProfileService.getAllProfiles).toHaveBeenCalled();
            });

            it("should not save as custom profile if form is not dirty", (): void => {
                component.saveAsCustomProfile();

                expect(mockRowingProfileService.saveAsCustomProfile).not.toHaveBeenCalled();
            });

            it("should update availableProfiles after saving custom profile", (): void => {
                component.settingsForm.markAsDirty();
                vi.spyOn(component.settingsForm, "getRawValue").mockReturnValue({
                    machineSettings: mockProfileData.settings.machineSettings,
                    sensorSignalSettings: mockProfileData.settings.sensorSignalSettings,
                    dragFactorSettings: mockProfileData.settings.dragFactorSettings,
                    strokeDetectionSettings: mockProfileData.settings
                        .strokeDetectionSettings as Required<IStrokeDetectionSettings>,
                });

                component.saveAsCustomProfile();

                expect(mockRowingProfileService.saveAsCustomProfile).toHaveBeenCalled();
                expect(mockRowingProfileService.getAllProfiles).toHaveBeenCalled();
                expect(component.availableProfiles()).toEqual({
                    "test-profile": mockProfileData,
                    [CUSTOM_PROFILE_KEY]: mockProfileData,
                });
            });

            it("should omit minimumRecoverySlopeMargin property when value is NaN (for JSON serialization)", (): void => {
                component.settingsForm.markAsDirty();
                vi.spyOn(component.settingsForm, "getRawValue").mockReturnValue({
                    machineSettings: mockProfileData.settings.machineSettings,
                    sensorSignalSettings: mockProfileData.settings.sensorSignalSettings,
                    dragFactorSettings: mockProfileData.settings.dragFactorSettings,
                    strokeDetectionSettings: {
                        ...mockProfileData.settings.strokeDetectionSettings,
                        minimumRecoverySlopeMargin: NaN,
                    },
                });

                component.saveAsCustomProfile();

                const savedSettings = vi.mocked(mockRowingProfileService.saveAsCustomProfile).mock
                    .lastCall?.[0];
                expect(savedSettings?.strokeDetectionSettings).toBeDefined();
                expect("minimumRecoverySlopeMargin" in savedSettings!.strokeDetectionSettings).toBe(false);
            });

            it("should keep valid number values when saving (legacy firmware)", (): void => {
                component.settingsForm.markAsDirty();
                vi.spyOn(component.settingsForm, "getRawValue").mockReturnValue({
                    machineSettings: mockProfileData.settings.machineSettings,
                    sensorSignalSettings: mockProfileData.settings.sensorSignalSettings,
                    dragFactorSettings: mockProfileData.settings.dragFactorSettings,
                    strokeDetectionSettings: {
                        ...mockProfileData.settings.strokeDetectionSettings,
                        minimumRecoverySlopeMargin: 0.05,
                    },
                });

                component.saveAsCustomProfile();

                expect(mockRowingProfileService.saveAsCustomProfile).toHaveBeenCalledWith(
                    expect.objectContaining({
                        strokeDetectionSettings: expect.objectContaining({
                            minimumRecoverySlopeMargin: 0.05,
                        }),
                    }),
                );
            });
        });
    });

    describe("Utility Methods", (): void => {
        describe("profileCompareFn", (): void => {
            it("should return 1 if a is custom profile and b is not", (): void => {
                const a = { key: CUSTOM_PROFILE_KEY, value: mockProfileData };
                const b = { key: "standard-profile", value: mockProfileData };

                const result = component.profileCompareFn(a, b);

                expect(result).toBe(1);
            });

            it("should return -1 if b is custom profile and a is not", (): void => {
                const a = { key: "standard-profile", value: mockProfileData };
                const b = { key: CUSTOM_PROFILE_KEY, value: mockProfileData };

                const result = component.profileCompareFn(a, b);

                expect(result).toBe(-1);
            });

            it("should compare keys alphabetically for standard profiles", (): void => {
                const a = { key: "profile-b", value: mockProfileData };
                const b = { key: "profile-a", value: mockProfileData };

                const result = component.profileCompareFn(a, b);

                expect(result).toBeGreaterThan(0);
            });
        });

        it("should format a decimal as a percentage string", (): void => {
            expect(component.formatPercent(0.5)).toBe("50%");
            expect(component.formatPercent(0.123)).toBe("12%");
            expect(component.formatPercent(1.0)).toBe("100%");
            expect(component.formatPercent(0.999)).toBe("99%");
        });

        it("should return the settingsForm instance", (): void => {
            const form = component.getForm();

            expect(form).toBe(component.settingsForm);
        });
    });

    describe("Cross-field Validator: maxDragFactorRecoveryPeriod", (): void => {
        it("should be valid when possibleRecoveryDatapointCount is within allowed range", (): void => {
            // set values that result in valid calculation: (20 * 1000) / 25 = 800 < 1000
            component.settingsForm.patchValue({
                sensorSignalSettings: { rotationDebounceTime: 25 },
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 20 },
            });

            expect(component.settingsForm.hasError("maxDragFactorRecoveryPeriodExceeded")).toBe(false);
            expect(
                component.settingsForm.controls.dragFactorSettings.controls.maxDragFactorRecoveryPeriod.hasError(
                    "max",
                ),
            ).toBe(false);
        });

        it("should be invalid when possibleRecoveryDatapointCount exceeds maxAllowedDatapoints", async (): Promise<void> => {
            await fixture.whenStable();
            // set values that result in invalid calculation: (30 * 1000) / 25 = 1200 > 1000
            component.settingsForm.patchValue({
                sensorSignalSettings: { rotationDebounceTime: 25 },
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 30 },
            });

            expect(component.settingsForm.hasError("maxDragFactorRecoveryPeriodExceeded")).toBe(true);
            expect(
                component.settingsForm.controls.dragFactorSettings.controls.maxDragFactorRecoveryPeriod.hasError(
                    "max",
                ),
            ).toBe(true);
        });

        it("should be valid when rotationDebounceTime is undefined", (): void => {
            component.settingsForm.patchValue({
                sensorSignalSettings: { rotationDebounceTime: undefined },
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 50 },
            });

            expect(component.settingsForm.hasError("maxDragFactorRecoveryPeriodExceeded")).toBe(false);
        });

        it("should be valid when maxDragFactorRecoveryPeriod is undefined", (): void => {
            component.settingsForm.patchValue({
                sensorSignalSettings: { rotationDebounceTime: 25 },
                dragFactorSettings: { maxDragFactorRecoveryPeriod: undefined },
            });

            expect(component.settingsForm.hasError("maxDragFactorRecoveryPeriodExceeded")).toBe(false);
        });

        it("should mark maxDragFactorRecoveryPeriod as touched and set errors when validation fails", async (): Promise<void> => {
            await fixture.whenStable();
            const maxDragFactorControl =
                component.settingsForm.controls.dragFactorSettings.controls.maxDragFactorRecoveryPeriod;

            maxDragFactorControl.markAsUntouched();

            component.settingsForm.patchValue({
                sensorSignalSettings: { rotationDebounceTime: 25 },
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 50 },
            });

            expect(maxDragFactorControl.touched).toBe(true);
            expect(maxDragFactorControl.hasError("max")).toBe(true);
        });

        it("should clear errors when validation passes after previously failing", async (): Promise<void> => {
            await fixture.whenStable();
            const maxDragFactorControl =
                component.settingsForm.controls.dragFactorSettings.controls.maxDragFactorRecoveryPeriod;

            component.settingsForm.patchValue({
                sensorSignalSettings: { rotationDebounceTime: 25 },
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 50 },
            });

            expect(maxDragFactorControl.hasError("max")).toBe(true);

            component.settingsForm.patchValue({
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 10 },
            });

            expect(maxDragFactorControl.hasError("max")).toBe(false);
        });
    });

    describe("Edge Cases & Robustness", (): void => {
        it("should handle missing form control values in validation gracefully", (): void => {
            expect((): void => {
                component.settingsForm.patchValue({
                    sensorSignalSettings: {},
                    dragFactorSettings: {},
                });
                const isValid = component.settingsForm.valid;
                expect(typeof isValid).toBe("boolean");
            }).not.toThrow();
        });

        it("should handle missing or malformed input data without throwing", (): void => {
            expect((): void => {
                component.loadProfile("");
                component.saveAsCustomProfile();
                component.formatPercent(NaN);
                component.getForm();
            }).not.toThrow();
        });

        it("should handle undefined profileKey in loadProfile", (): void => {
            expect((): void => {
                component.loadProfile(undefined);
            }).not.toThrow();
            expect(component.isProfileLoaded).toBe(false);
        });

        it("should handle empty string profileKey in loadProfile", (): void => {
            expect((): void => {
                component.loadProfile("");
            }).not.toThrow();
            expect(component.isProfileLoaded).toBe(false);
        });
    });
});
