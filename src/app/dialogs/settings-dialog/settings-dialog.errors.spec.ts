import { signal } from "@angular/core";
import { MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    DEFAULT_LANDSCAPE_LAYOUT,
    DEFAULT_PORTRAIT_LAYOUT,
} from "../../dashboard/dashboard-tile-definitions";

import { SettingsDialogComponent } from "./settings-dialog.component";
import {
    createMockDisplayForm,
    createMockGeneralForm,
    createMockRowingForm,
    createSettingsDialogTestBed,
    ISettingsDialogTestBedResult,
} from "./settings-dialog.test.helpers";

describe("SettingsDialogComponent error handling", (): void => {
    let component: SettingsDialogComponent;
    let mockErgSettingsService: ISettingsDialogTestBedResult["mockErgSettingsService"];
    let mockConfigManagerService: ISettingsDialogTestBedResult["mockConfigManagerService"];
    let mockSnackBar: ISettingsDialogTestBedResult["mockSnackBar"];

    beforeEach(async (): Promise<void> => {
        // eslint-disable-next-line @typescript-eslint/typedef -- There is a bug in ESLint wanting type annotation on this but that results in invalid TS syntax
        ({ component, mockErgSettingsService, mockConfigManagerService, mockSnackBar } =
            await createSettingsDialogTestBed());
    });

    describe("errors", (): void => {
        it("should be handled gracefully when saving general settings", async (): Promise<void> => {
            mockErgSettingsService.changeLogLevel = vi.fn().mockRejectedValue(new Error("Service error"));

            const mockGeneralForm = createMockGeneralForm(true, {
                logLevel: 2,
                deltaTimeLogging: true,
                logToSdCard: true,
                bleMode: 1,
                heartRateMonitor: "ant",
            });

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
                getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(
                    createMockRowingForm(false, {
                        machineSettings: {},
                        dragFactorSettings: {},
                        sensorSignalSettings: {},
                        strokeDetectionSettings: {},
                    }),
                ),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(false);
            component.onRowingFormValidityChange(false);

            const mockSnackBarRef = {
                onAction: vi.fn().mockReturnValue(of(true)),
            };
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
                mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
            );

            component.currentTabIndex.set(0);

            await expect(component.saveSettings()).rejects.toThrow();
        });

        it("should be handled when saving rowing settings", async (): Promise<void> => {
            const serviceErrors = [
                { service: "changeMachineSettings", error: "Machine settings error" },
                { service: "changeDragFactorSettings", error: "Drag factor error" },
                { service: "changeSensorSignalSettings", error: "Sensor signal error" },
                { service: "changeStrokeSettings", error: "Stroke settings error" },
            ];

            for (const { error } of serviceErrors) {
                mockErgSettingsService.changeMachineSettings = vi.fn().mockRejectedValue(new Error(error));
                mockErgSettingsService.changeDragFactorSettings = vi.fn().mockRejectedValue(new Error(error));
                mockErgSettingsService.changeSensorSignalSettings = vi
                    .fn()
                    .mockRejectedValue(new Error(error));
                mockErgSettingsService.changeStrokeSettings = vi.fn().mockRejectedValue(new Error(error));

                const mockRowingForm = createMockRowingForm(true, {
                    machineSettings: { flywheelInertia: 0.06 },
                    dragFactorSettings: { goodnessOfFitThreshold: 0.95 },
                    sensorSignalSettings: { rotationDebounceTime: 30 },
                    strokeDetectionSettings: { minimumPoweredTorque: 0.02 },
                });

                const generalSettingsSpy = vi.fn().mockReturnValue({
                    getForm: vi.fn().mockReturnValue(createMockGeneralForm(false)),
                } as unknown as ReturnType<typeof component.generalSettings>);

                const displaySettingsSpy = vi.fn().mockReturnValue({
                    getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                    isLayoutDirty: signal(false),
                    getLayoutConfig: vi.fn().mockReturnValue({
                        landscape: DEFAULT_LANDSCAPE_LAYOUT,
                        portrait: DEFAULT_PORTRAIT_LAYOUT,
                        orientationLock: "auto",
                    }),
                    getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
                } as unknown as ReturnType<typeof component.displaySettings>);

                const rowingSettingsSpy = vi.fn().mockReturnValue({
                    getForm: vi.fn().mockReturnValue(mockRowingForm),
                    saveAsCustomProfile: vi.fn(),
                } as unknown as ReturnType<typeof component.rowingSettings>);

                (component as unknown as Record<string, unknown>).generalSettings = generalSettingsSpy;
                (component as unknown as Record<string, unknown>).displaySettings = displaySettingsSpy;
                (component as unknown as Record<string, unknown>).rowingSettings = rowingSettingsSpy;

                component.onGeneralFormValidityChange(false);
                component.onDisplayFormValidityChange(false);
                component.onRowingFormValidityChange(true);

                component.currentTabIndex.set(2);

                await expect(component.saveSettings()).rejects.toThrow();
            }
        });

        it("should be handled when saving display settings", async (): Promise<void> => {
            mockConfigManagerService.setGroup = vi.fn().mockImplementation((): void => {
                throw new Error("Local storage error");
            });

            const mockDisplayForm = createMockDisplayForm(true, true);

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockGeneralForm(false)),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
                getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockRowingForm(false)),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(false);
            component.onDisplayFormValidityChange(true);
            component.onRowingFormValidityChange(false);

            component.currentTabIndex.set(1);

            await expect(component.saveSettings()).rejects.toThrow("Local storage error");
        });

        it("should be handled during cross-tab save when one tab fails", async (): Promise<void> => {
            mockErgSettingsService.changeLogLevel = vi
                .fn()
                .mockRejectedValue(new Error("General save failed"));

            const mockGeneralForm = createMockGeneralForm(true, {
                logLevel: 2,
            });
            const mockRowingForm = createMockRowingForm(true, {
                machineSettings: { flywheelInertia: 0.06 },
            });

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
                getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(false);
            component.onRowingFormValidityChange(true);

            const mockSnackBarRef = {
                onAction: vi.fn().mockReturnValue(of(true)),
            };
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
                mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
            );

            component.currentTabIndex.set(0);

            await expect(component.saveSettings()).rejects.toThrow();
        });

        it("should be handled when BLE mode change fails", async (): Promise<void> => {
            mockErgSettingsService.changeBleServiceType = vi
                .fn()
                .mockRejectedValue(new Error("BLE service change failed"));

            const mockGeneralForm = createMockGeneralForm(true, {
                bleMode: 1,
            });

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
                getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockRowingForm(false)),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(false);
            component.onRowingFormValidityChange(false);

            component.currentTabIndex.set(0);

            await expect(component.saveSettings()).rejects.toThrow();
        });
    });
});
