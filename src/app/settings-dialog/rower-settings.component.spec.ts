import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";

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
    let mockRowingProfileService: jasmine.SpyObj<RowingProfileService>;

    const mockRowerSettings: IRowerSettings = {
        bleServiceFlag: 0,
        logLevel: 1,
        logToSdCard: false,
        logDeltaTimes: false,
        isRuntimeSettingsEnabled: true,
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
    };

    const mockStrokeDetectionSettings: IStrokeDetectionSettings = {
        strokeDetectionType: StrokeDetectionType.Torque,
        impulseDataArrayLength: 6,
        minimumPoweredTorque: 0.01,
        minimumDragTorque: 0.005,
        minimumRecoverySlopeMargin: 0.05,
        minimumRecoverySlope: 0.1,
        minimumRecoveryTime: 400,
        minimumDriveTime: 200,
        driveHandleForcesMaxCapacity: 20,
        isCompiledWithDouble: true,
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
        mockRowingProfileService = jasmine.createSpyObj("RowingProfileService", [
            "getAllProfiles",
            "getProfile",
            "saveAsCustomProfile",
        ]);

        mockRowingProfileService.getAllProfiles.and.returnValue({
            "test-profile": mockProfileData,
            [CUSTOM_PROFILE_KEY]: mockProfileData,
        });

        mockRowingProfileService.getProfile.and.returnValue(mockProfileData);

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
        fixture.componentRef.setInput("strokeSettings", mockStrokeDetectionSettings);
        fixture.componentRef.setInput("isConnected", true);
        fixture.componentRef.setInput("isSmallScreen", false);
    });

    describe("Component Creation & Initialization", (): void => {
        it("should instantiate the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize the form with all controls and default values", (): void => {
            fixture.detectChanges();

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

        it("should patch form values from @Input rowerSettings and strokeSettings on ngOnInit", (): void => {
            fixture.detectChanges();

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
        it("should enable the form when both isConnected and isRuntimeSettingsEnabled are true", (): void => {
            fixture.componentRef.setInput("isConnected", true);
            const enabledRowingSettings = { ...mockRowerSettings, isRuntimeSettingsEnabled: true };
            fixture.componentRef.setInput("rowerSettings", enabledRowingSettings);

            fixture.detectChanges();

            expect(component.settingsForm.enabled).toBe(true);
        });

        describe("should keep the form disabled", (): void => {
            it("when isConnected is false", (): void => {
                fixture.componentRef.setInput("isConnected", false);
                const enabledRowingSettings = { ...mockRowerSettings, isRuntimeSettingsEnabled: true };
                fixture.componentRef.setInput("rowerSettings", enabledRowingSettings);

                fixture.detectChanges();

                expect(component.settingsForm.disabled).toBe(true);
            });

            it("when isRuntimeSettingsEnabled is false", (): void => {
                fixture.componentRef.setInput("isConnected", true);
                const disabledRowingSettings = { ...mockRowerSettings, isRuntimeSettingsEnabled: false };
                fixture.componentRef.setInput("rowerSettings", disabledRowingSettings);

                fixture.detectChanges();

                expect(component.settingsForm.disabled).toBe(true);
            });
        });
    });

    describe("Form Validators & Dynamic Validation", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

        it("should set correct max validator for impulseDataArrayLength based on isCompiledWithDouble", (): void => {
            const impulseControl =
                component.settingsForm.controls.strokeDetectionSettings.controls.impulseDataArrayLength;

            // with isCompiledWithDouble = true, max should be 15
            impulseControl.setValue(16);
            expect(impulseControl.hasError("max")).toBe(true);

            impulseControl.setValue(15);
            expect(impulseControl.hasError("max")).toBe(false);

            const strokeSettingsWithoutDouble = {
                ...mockStrokeDetectionSettings,
                isCompiledWithDouble: false,
            };
            fixture.componentRef.setInput("strokeSettings", strokeSettingsWithoutDouble);
            component.ngOnInit();

            // max should now be 18
            impulseControl.setValue(19);
            expect(impulseControl.hasError("max")).toBe(true);

            impulseControl.setValue(18);
            expect(impulseControl.hasError("max")).toBe(false);
        });

        it("should emit isFormValidChange when form validity changes", (): void => {
            spyOn(component.isFormValidChange, "emit");

            component.settingsForm.patchValue({
                machineSettings: { flywheelInertia: 0.1 },
            });

            fixture.detectChanges();

            expect(component.isFormValidChange.emit).toHaveBeenCalled();
        });
    });

    describe("Dynamic Field State Management", (): void => {
        beforeEach((): void => {
            const enabledRowingSettings = { ...mockRowerSettings, isRuntimeSettingsEnabled: true };
            fixture.componentRef.setInput("rowerSettings", enabledRowingSettings);
            fixture.componentRef.setInput("isConnected", true);
            fixture.detectChanges();
        });

        describe("when strokeDetectionType is set to Torque", (): void => {
            it("should disable minimumRecoverySlope field", (): void => {
                const minimumRecoverySlope =
                    component.settingsForm.controls.strokeDetectionSettings.controls.minimumRecoverySlope;

                component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                    StrokeDetectionType.Torque,
                );

                fixture.detectChanges();

                expect(minimumRecoverySlope.disabled).toBe(true);
            });

            it("should enable minimumRecoverySlopeMargin field", (): void => {
                const minimumRecoverySlopeMargin =
                    component.settingsForm.controls.strokeDetectionSettings.controls
                        .minimumRecoverySlopeMargin;

                component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                    StrokeDetectionType.Torque,
                );

                fixture.detectChanges();

                expect(minimumRecoverySlopeMargin.enabled).toBe(true);
            });
        });

        describe("when strokeDetectionType is set to Slope", (): void => {
            it("should enable minimumRecoverySlope field", (): void => {
                const minimumRecoverySlope =
                    component.settingsForm.controls.strokeDetectionSettings.controls.minimumRecoverySlope;

                component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                    StrokeDetectionType.Slope,
                );

                fixture.detectChanges();

                expect(minimumRecoverySlope.enabled).toBe(true);
            });

            it("should disable minimumRecoverySlopeMargin field", (): void => {
                const minimumRecoverySlopeMargin =
                    component.settingsForm.controls.strokeDetectionSettings.controls
                        .minimumRecoverySlopeMargin;

                component.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.setValue(
                    StrokeDetectionType.Slope,
                );

                fixture.detectChanges();

                expect(minimumRecoverySlopeMargin.disabled).toBe(true);
            });
        });

        it("should not change field states when isRuntimeSettingsEnabled is false", (): void => {
            const disabledRowingSettings = { ...mockRowerSettings, isRuntimeSettingsEnabled: false };
            fixture.componentRef.setInput("rowerSettings", disabledRowingSettings);
            fixture.detectChanges();

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

            fixture.detectChanges();

            expect(minimumRecoverySlope.disabled).toBe(initialRecoverySlopeState);
            expect(minimumRecoverySlopeMargin.disabled).toBe(initialRecoverySlopeMarginState);
        });
    });

    describe("Profile Management", (): void => {
        beforeEach((): void => {
            const enabledRowingSettings = { ...mockRowerSettings, isRuntimeSettingsEnabled: true };
            fixture.componentRef.setInput("rowerSettings", enabledRowingSettings);
            fixture.detectChanges();
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

            it("should not load a profile when isRuntimeSettingsEnabled is false", (): void => {
                const disabledRowingSettings = { ...mockRowerSettings, isRuntimeSettingsEnabled: false };
                fixture.componentRef.setInput("rowerSettings", disabledRowingSettings);
                fixture.detectChanges();

                component.loadProfile("test-profile");

                expect(mockRowingProfileService.getProfile).not.toHaveBeenCalled();
                expect(component.isProfileLoaded).toBe(false);
            });

            it("should not load a profile when profileData is not found", (): void => {
                mockRowingProfileService.getProfile.and.returnValue(undefined);

                component.loadProfile("non-existent-profile");

                expect(mockRowingProfileService.getProfile).toHaveBeenCalledWith("non-existent-profile");
                expect(component.isProfileLoaded).toBe(false);
            });

            it("should set _isProfileLoaded to true after loading a profile", (): void => {
                expect(component.isProfileLoaded).toBe(false);

                component.loadProfile("test-profile");

                expect(component.isProfileLoaded).toBe(true);
            });
        });
    });

    describe("Custom Profile Saving", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

        describe("saveAsCustomProfile", (): void => {
            it("should save as custom profile if form is dirty", (): void => {
                component.settingsForm.markAsDirty();
                spyOn(component.settingsForm, "getRawValue").and.returnValue({
                    machineSettings: mockProfileData.settings.machineSettings,
                    sensorSignalSettings: mockProfileData.settings.sensorSignalSettings,
                    dragFactorSettings: mockProfileData.settings.dragFactorSettings,
                    strokeDetectionSettings: mockProfileData.settings.strokeDetectionSettings,
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
                spyOn(component.settingsForm, "getRawValue").and.returnValue({
                    machineSettings: mockProfileData.settings.machineSettings,
                    sensorSignalSettings: mockProfileData.settings.sensorSignalSettings,
                    dragFactorSettings: mockProfileData.settings.dragFactorSettings,
                    strokeDetectionSettings: mockProfileData.settings.strokeDetectionSettings,
                });

                component.saveAsCustomProfile();

                expect(mockRowingProfileService.getAllProfiles).toHaveBeenCalled();
                expect(component.availableProfiles()).toBeDefined();
            });
        });
    });

    describe("Utility Methods", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

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
        beforeEach((): void => {
            fixture.detectChanges();
        });

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

        it("should be invalid when possibleRecoveryDatapointCount exceeds maxAllowedDatapoints", (): void => {
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

        it("should mark maxDragFactorRecoveryPeriod as touched and set errors when validation fails", (): void => {
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

        it("should clear errors when validation passes after previously failing", (): void => {
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
        beforeEach((): void => {
            fixture.detectChanges();
        });

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
