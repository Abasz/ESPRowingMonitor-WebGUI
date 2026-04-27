import { signal } from "@angular/core";
import { MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { EMPTY, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDisplayLayoutConfig } from "../../../common/common.interfaces";
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
    setupCleanGeneralAndDisplayForms,
} from "./settings-dialog.test.helpers";

describe("SettingsDialogComponent saveSettings method", (): void => {
    let component: SettingsDialogComponent;
    let mockMatDialogRef: ISettingsDialogTestBedResult["mockMatDialogRef"];
    let mockConfigManagerService: ISettingsDialogTestBedResult["mockConfigManagerService"];
    let mockErgSettingsService: ISettingsDialogTestBedResult["mockErgSettingsService"];
    let mockErgConnectionService: ISettingsDialogTestBedResult["mockErgConnectionService"];
    let mockSnackBar: ISettingsDialogTestBedResult["mockSnackBar"];

    beforeEach(async (): Promise<void> => {
        // eslint-disable-next-line @typescript-eslint/typedef -- There is a bug in ESLint wanting type annotation on this but that results in invalid TS syntax
        ({
            component,
            mockMatDialogRef,
            mockConfigManagerService,
            mockErgSettingsService,
            mockErgConnectionService,
            mockSnackBar,
        } = await createSettingsDialogTestBed());
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    it("should save general settings", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(true, {
            logLevel: { dirty: true, value: 2 },
            deltaTimeLogging: { dirty: true, value: true },
            logToSdCard: { dirty: true, value: true },
            bleMode: { dirty: true, value: 1 },
            heartRateMonitor: { dirty: true, value: "ant" },
            autoSession: { dirty: true, value: "off" },
        });
        const mockRowingForm = {
            dirty: false,
            controls: {
                machineSettings: { dirty: false, getRawValue: (): object => ({}) },
                dragFactorSettings: { dirty: false, getRawValue: (): object => ({}) },
                sensorSignalSettings: { dirty: false, getRawValue: (): object => ({}) },
                strokeDetectionSettings: { dirty: false, getRawValue: (): object => ({}) },
            },
        };
        const mockDisplayForm = createMockDisplayForm(false);

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
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
            getForm: vi.fn().mockReturnValue(mockRowingForm),
            saveAsCustomProfile: vi.fn(),
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(true);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        component.currentTabIndex.set(0);

        await component.saveSettings();

        expect(mockErgSettingsService.changeLogLevel).toHaveBeenCalledWith(2);
        expect(mockErgSettingsService.changeDeltaTimeLogging).toHaveBeenCalledWith(true);
        expect(mockErgSettingsService.changeLogToSdCard).toHaveBeenCalledWith(true);
        expect(mockErgSettingsService.changeBleServiceType).toHaveBeenCalledWith(1);
        expect(mockConfigManagerService.setGroup).toHaveBeenCalledWith(
            "general",
            expect.objectContaining({
                device: expect.objectContaining({ heartRateMonitor: "ant" }),
            }),
        );
        expect(mockConfigManagerService.setGroup).toHaveBeenCalledWith(
            "general",
            expect.objectContaining({
                session: expect.objectContaining({ autoSession: "off" }),
            }),
        );
        expect(mockMatDialogRef.close).toHaveBeenCalled();
    });

    it("should save autoLap settings when autoLap or autoLapValue is dirty", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(true, {
            autoLap: { dirty: true, value: "distance" },
            autoLapValue: { dirty: true, value: 1000 },
        });
        const mockRowingForm = createMockRowingForm(false);
        const mockDisplayForm = createMockDisplayForm(false);

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
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
            getForm: vi.fn().mockReturnValue(mockRowingForm),
            saveAsCustomProfile: vi.fn(),
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(true);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        component.currentTabIndex.set(0);

        await component.saveSettings();

        expect(mockConfigManagerService.setGroup).toHaveBeenCalledWith("general", {
            session: expect.objectContaining({
                autoLap: "distance",
                autoLapValue: 1000,
            }),
        });
        expect(mockMatDialogRef.close).toHaveBeenCalled();
    });

    it("should save display settings when form is dirty", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(false);
        const mockRowingForm = createMockRowingForm(false);
        const mockDisplayForm = createMockDisplayForm(true);

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
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
            getForm: vi.fn().mockReturnValue(mockRowingForm),
            saveAsCustomProfile: vi.fn(),
            isProfileLoaded: false,
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(false);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(false);

        component.currentTabIndex.set(1);

        await component.saveSettings();

        expect(mockConfigManagerService.setGroup).toHaveBeenCalledWith("display", {
            general: { unitSystem: "metric" },
            forceCurve: {
                showPeakForceInTitle: true,
                showGridLines: true,
                showAxisLabels: true,
            },
            layout: {
                landscape: DEFAULT_LANDSCAPE_LAYOUT,
                portrait: DEFAULT_PORTRAIT_LAYOUT,
                orientationLock: "auto",
            },
            averaging: { mode: "off", windowSize: 3 },
        });
        expect(mockMatDialogRef.close).toHaveBeenCalled();
    });

    it("should save display settings when only layout is dirty", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(false);
        const mockRowingForm = createMockRowingForm(false);
        const mockDisplayForm = createMockDisplayForm(false);
        const customLayout: IDisplayLayoutConfig = {
            landscape: {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    },
                ],
            },
            portrait: DEFAULT_PORTRAIT_LAYOUT,
            orientationLock: "auto",
        };

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
        } as unknown as ReturnType<typeof component.generalSettings>);
        vi.spyOn(component, "displaySettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockDisplayForm),
            isLayoutDirty: signal(true),
            getLayoutConfig: vi.fn().mockReturnValue(customLayout),
            getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
        } as unknown as ReturnType<typeof component.displaySettings>);
        vi.spyOn(component, "rowingSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockRowingForm),
            saveAsCustomProfile: vi.fn(),
            isProfileLoaded: false,
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(false);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(false);

        component.currentTabIndex.set(1);

        await component.saveSettings();

        expect(mockConfigManagerService.setGroup).toHaveBeenCalledWith("display", {
            general: { unitSystem: "metric" },
            forceCurve: {
                showPeakForceInTitle: true,
                showGridLines: true,
                showAxisLabels: true,
            },
            layout: customLayout,
            averaging: { mode: "off", windowSize: 3 },
        });
        expect(mockMatDialogRef.close).toHaveBeenCalled();
    });

    it("should not save display settings when form and layout are both clean", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(true, { logLevel: 2 });
        const mockRowingForm = createMockRowingForm(false);
        const mockDisplayForm = createMockDisplayForm(false);

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
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
            getForm: vi.fn().mockReturnValue(mockRowingForm),
            saveAsCustomProfile: vi.fn(),
            isProfileLoaded: false,
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(true);
        component.onDisplayFormValidityChange(false);
        component.onRowingFormValidityChange(false);

        component.currentTabIndex.set(0);

        await component.saveSettings();

        expect(mockConfigManagerService.setGroup).not.toHaveBeenCalledWith("display", expect.anything());
    });

    describe("should save rowing settings", (): void => {
        beforeEach((): void => {
            setupCleanGeneralAndDisplayForms(component);
        });

        it("when both debounce and max drag period decrease first drag factor settings then sensor settings", async (): Promise<void> => {
            const mockRowingForm = createMockRowingForm(true, {
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 7 },
                sensorSignalSettings: { rotationDebounceTime: 20 },
            });

            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onRowingFormValidityChange(true);

            await component.saveSettings();

            expect(
                Math.min(
                    ...vi.mocked(mockErgSettingsService.changeDragFactorSettings).mock.invocationCallOrder,
                ),
            ).toBeLessThan(
                Math.min(
                    ...vi.mocked(mockErgSettingsService.changeSensorSignalSettings!).mock.invocationCallOrder,
                ),
            );
        });

        it("when both debounce and max drag period increase first sensor settings then drag factor settings", async (): Promise<void> => {
            const mockRowingForm = createMockRowingForm(true, {
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 9 },
                sensorSignalSettings: { rotationDebounceTime: 30 },
            });

            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onRowingFormValidityChange(true);

            await component.saveSettings();

            expect(
                Math.min(
                    ...vi.mocked(mockErgSettingsService.changeSensorSignalSettings).mock.invocationCallOrder,
                ),
            ).toBeLessThan(
                Math.min(
                    ...vi.mocked(mockErgSettingsService.changeDragFactorSettings!).mock.invocationCallOrder,
                ),
            );
        });

        it("when debounce and drag period value change direction is opposite first drag factor settings then sensor settings", async (): Promise<void> => {
            const mockRowingForm = createMockRowingForm(true, {
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 9 },
                sensorSignalSettings: { rotationDebounceTime: 20 },
            });
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onRowingFormValidityChange(true);

            await component.saveSettings();

            expect(
                Math.min(
                    ...vi.mocked(mockErgSettingsService.changeDragFactorSettings).mock.invocationCallOrder,
                ),
            ).toBeLessThan(
                Math.min(
                    ...vi.mocked(mockErgSettingsService.changeSensorSignalSettings!).mock.invocationCallOrder,
                ),
            );
        });

        it("and save drag factor settings drag factor form when drag factor form is dirty", async (): Promise<void> => {
            const mockRowingForm = createMockRowingForm(true, {
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 9 },
                sensorSignalSettings: { dirty: false, rotationDebounceTime: 25 },
            });
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onRowingFormValidityChange(true);

            await component.saveSettings();

            expect(mockErgSettingsService.changeDragFactorSettings).toHaveBeenCalled();
            expect(mockErgSettingsService.changeSensorSignalSettings).not.toHaveBeenCalled();
        });

        it("and save sensor settings when sensor settings form is dirty", async (): Promise<void> => {
            const mockRowingForm = createMockRowingForm(true, {
                dragFactorSettings: { dirty: false, maxDragFactorRecoveryPeriod: 8 },
                sensorSignalSettings: { rotationDebounceTime: 30 },
            });
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onRowingFormValidityChange(true);

            await component.saveSettings();

            expect(mockErgSettingsService.changeSensorSignalSettings).toHaveBeenCalled();
            expect(mockErgSettingsService.changeDragFactorSettings).not.toHaveBeenCalled();
        });

        it("without sensor settings or drag factor settings when neither is dirty", async (): Promise<void> => {
            const mockRowingForm = createMockRowingForm(false, {
                dragFactorSettings: { maxDragFactorRecoveryPeriod: 8 },
                sensorSignalSettings: { rotationDebounceTime: 25 },
            });
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onRowingFormValidityChange(false);

            await component.saveSettings();

            expect(mockErgSettingsService.changeSensorSignalSettings).not.toHaveBeenCalled();
            expect(mockErgSettingsService.changeDragFactorSettings).not.toHaveBeenCalled();
        });

        it("with all settings when all forms are dirty", async (): Promise<void> => {
            const mockRowingForm = createMockRowingForm(true, {
                machineSettings: {
                    flywheelInertia: 0.06,
                },
                dragFactorSettings: {
                    goodnessOfFitThreshold: 0.95,
                },
                sensorSignalSettings: {
                    rotationDebounceTime: 30,
                },
                strokeDetectionSettings: {
                    minimumPoweredTorque: 0.02,
                },
            });
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onRowingFormValidityChange(true);
            component.currentTabIndex.set(2);

            await component.saveSettings();

            expect(mockErgSettingsService.changeMachineSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    flywheelInertia: 0.06,
                }),
            );
            expect(mockErgSettingsService.changeDragFactorSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    goodnessOfFitThreshold: 0.95,
                }),
            );
            expect(mockErgSettingsService.changeSensorSignalSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    rotationDebounceTime: 30,
                }),
            );
            expect(mockErgSettingsService.changeStrokeSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    minimumPoweredTorque: 0.02,
                }),
            );
            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });

        describe("and when any of the forms are dirty", (): void => {
            let mockRowingForm: ReturnType<typeof createMockRowingForm>;
            beforeEach((): void => {
                mockRowingForm = createMockRowingForm(true, {
                    machineSettings: { flywheelInertia: 0.06 },
                    dragFactorSettings: { goodnessOfFitThreshold: 0.95 },
                    sensorSignalSettings: { rotationDebounceTime: 30 },
                    strokeDetectionSettings: { minimumPoweredTorque: 0.02 },
                });
                vi.spyOn(component, "rowingSettings").mockReturnValue({
                    getForm: vi.fn().mockReturnValue(mockRowingForm),
                    saveAsCustomProfile: vi.fn(),
                    isProfileLoaded: false,
                } as unknown as ReturnType<typeof component.rowingSettings>);
                component.onRowingFormValidityChange(true);
            });

            it("send restart device request", async (): Promise<void> => {
                await component.saveSettings();

                expect(mockErgSettingsService.restartDevice).toHaveBeenCalled();
            });

            it("reconnect to device after restart request", async (): Promise<void> => {
                await component.saveSettings();

                expect(
                    Math.min(...vi.mocked(mockErgSettingsService.restartDevice).mock.invocationCallOrder),
                ).toBeLessThan(
                    Math.min(...vi.mocked(mockErgConnectionService.reconnect!).mock.invocationCallOrder),
                );
            });
        });
    });

    it("should save both tabs when user confirms cross-tab save", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(true, {
            logLevel: 2,
            deltaTimeLogging: true,
            logToSdCard: true,
            bleMode: 1,
            heartRateMonitor: "ant",
        });

        const mockRowingForm = createMockRowingForm(true, {
            machineSettings: { flywheelInertia: 0.06 },
            dragFactorSettings: { goodnessOfFitThreshold: 0.95 },
            sensorSignalSettings: { rotationDebounceTime: 30 },
            strokeDetectionSettings: { minimumPoweredTorque: 0.02 },
        });

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
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
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(true);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        const mockSnackBarRef = {
            onAction: vi.fn().mockReturnValue(of(true)),
        };
        vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
            mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
        );

        component.currentTabIndex.set(0);

        await component.saveSettings();

        expect(mockSnackBar.openFromComponent).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                data: expect.objectContaining({
                    text: "Rowing tab has changes, save those too?",
                }),
            }),
        );

        expect(mockErgSettingsService.changeMachineSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                flywheelInertia: 0.06,
            }),
        );
        expect(mockErgSettingsService.changeLogLevel).toHaveBeenCalledWith(2);
        expect(mockMatDialogRef.close).toHaveBeenCalled();
    });

    it("should save general settings before rowing on cross-tab save", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(true, {
            logLevel: 2,
            deltaTimeLogging: true,
            logToSdCard: true,
            bleMode: 1,
            heartRateMonitor: "ant",
        });

        const mockRowingForm = createMockRowingForm(true, {
            machineSettings: { flywheelInertia: 0.06 },
            dragFactorSettings: { goodnessOfFitThreshold: 0.95 },
            sensorSignalSettings: { rotationDebounceTime: 30 },
            strokeDetectionSettings: { minimumPoweredTorque: 0.02 },
        });

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
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
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(true);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        const mockSnackBarRef = {
            onAction: vi.fn().mockReturnValue(of(true)),
        };
        vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
            mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
        );

        component.currentTabIndex.set(2);

        await component.saveSettings();

        expect(mockSnackBar.openFromComponent).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                data: expect.objectContaining({
                    text: "General tab has changes, save those too?",
                }),
            }),
        );

        expect(
            Math.min(...vi.mocked(mockErgSettingsService.changeLogLevel).mock.invocationCallOrder),
        ).toBeLessThan(
            Math.min(...vi.mocked(mockErgSettingsService.changeMachineSettings!).mock.invocationCallOrder),
        );
    });

    it("should save only current tab when user cancels cross-tab save", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(true, {
            logLevel: 2,
            deltaTimeLogging: true,
            logToSdCard: true,
            bleMode: 1,
            heartRateMonitor: "ant",
        });

        const mockRowingForm = createMockRowingForm(true, {
            machineSettings: { flywheelInertia: 0.06 },
            dragFactorSettings: { goodnessOfFitThreshold: 0.95 },
            sensorSignalSettings: { rotationDebounceTime: 30 },
            strokeDetectionSettings: {
                minimumPoweredTorque: 0.02,
            },
        });

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
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
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(true);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        const mockSnackBarRef = {
            onAction: vi.fn().mockReturnValue(EMPTY),
        };
        vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
            mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
        );

        component.currentTabIndex.set(0);

        await component.saveSettings();

        expect(mockSnackBar.openFromComponent).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                data: expect.objectContaining({
                    text: "Rowing tab has changes, save those too?",
                }),
            }),
        );

        expect(mockErgSettingsService.changeMachineSettings).not.toHaveBeenCalled();
        expect(mockErgSettingsService.changeLogLevel).toHaveBeenCalledWith(2);
        expect(mockMatDialogRef.close).toHaveBeenCalled();
    });

    it("should handle save confirmation dialog correctly", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(false);
        const mockRowingForm = {
            dirty: true,
            controls: {
                machineSettings: { dirty: false, getRawValue: (): object => ({}) },
                dragFactorSettings: { dirty: false, getRawValue: (): object => ({}) },
                sensorSignalSettings: { dirty: false, getRawValue: (): object => ({}) },
                strokeDetectionSettings: { dirty: false, getRawValue: (): object => ({}) },
            },
        };

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
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
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        const mockSnackBarRef = {
            onAction: vi.fn().mockReturnValue(of(false)),
        };
        vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
            mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
        );

        component.currentTabIndex.set(0);

        await component.saveSettings();

        expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
    });

    it("should include display tab in cross-tab save when layout is dirty", async (): Promise<void> => {
        const mockGeneralForm = createMockGeneralForm(false);
        const mockRowingForm = createMockRowingForm(false);
        const mockDisplayForm = createMockDisplayForm(false);
        const customLayout: IDisplayLayoutConfig = {
            landscape: {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    },
                ],
            },
            portrait: DEFAULT_PORTRAIT_LAYOUT,
            orientationLock: "auto",
        };

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
        } as unknown as ReturnType<typeof component.generalSettings>);
        vi.spyOn(component, "displaySettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockDisplayForm),
            isLayoutDirty: signal(true),
            getLayoutConfig: vi.fn().mockReturnValue(customLayout),
            getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
        } as unknown as ReturnType<typeof component.displaySettings>);
        vi.spyOn(component, "rowingSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockRowingForm),
            saveAsCustomProfile: vi.fn(),
            isProfileLoaded: false,
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(true);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        const mockSnackBarRef = {
            onAction: vi.fn().mockReturnValue(of(true)),
        };
        vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
            mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
        );

        component.currentTabIndex.set(0);

        await component.saveSettings();

        expect(mockSnackBar.openFromComponent).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                data: expect.objectContaining({
                    text: "Display tab has changes, save those too?",
                }),
            }),
        );
        expect(mockConfigManagerService.setGroup).toHaveBeenCalledWith("display", {
            general: { unitSystem: "metric" },
            forceCurve: {
                showPeakForceInTitle: true,
                showGridLines: true,
                showAxisLabels: true,
            },
            layout: customLayout,
            averaging: { mode: "off", windowSize: 3 },
        });
    });

    it("should prevent multiple simultaneous save operations", async (): Promise<void> => {
        let resolvePromise: () => void;
        const pendingPromise = new Promise<void>((resolve: () => void): void => {
            resolvePromise = resolve;
        });

        mockErgSettingsService.changeLogLevel = vi.fn().mockReturnValue(pendingPromise);

        const mockGeneralForm = createMockGeneralForm(true, {
            logLevel: 2,
        });
        const mockRowingForm = createMockRowingForm(false);

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockGeneralForm),
            hasApiKeyChanged: vi.fn().mockReturnValue(false),
            isFirstTimeSetup: vi.fn().mockReturnValue(true),
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

        const firstSavePromise = component.saveSettings();
        const secondSavePromise = component.saveSettings();
        const thirdSavePromise = component.saveSettings();

        expect(await secondSavePromise).toBeUndefined();
        expect(await thirdSavePromise).toBeUndefined();

        resolvePromise!();
        await firstSavePromise;

        expect(mockErgSettingsService.changeLogLevel).toHaveBeenCalledTimes(1);
        expect(mockMatDialogRef.close).toHaveBeenCalledTimes(1);
    });
});
