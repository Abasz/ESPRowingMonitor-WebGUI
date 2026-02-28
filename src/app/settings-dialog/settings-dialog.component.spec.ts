import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { SwUpdate } from "@angular/service-worker";
import { BehaviorSubject, EMPTY, of, take } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IDisplayLayoutConfig } from "../../common/common.interfaces";
import { SpinnerOverlay } from "../../common/overlay/spinner-overlay.service";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { ErgSettingsService } from "../../common/services/ergometer/erg-settings.service";
import { UtilsService } from "../../common/services/utils.service";
import { DEFAULT_LANDSCAPE_LAYOUT, DEFAULT_PORTRAIT_LAYOUT } from "../dashboard/dashboard-tile-definitions";

import { SettingsDialogComponent } from "./settings-dialog.component";
import {
    createMockConfigManagerService,
    createMockDialogData,
    createMockDisplayForm,
    createMockGeneralForm,
    createMockRowingForm,
    setupCleanGeneralAndDisplayForms,
    setupMockChildComponents,
} from "./settings-dialog.test.helpers";

describe("SettingsDialogComponent", (): void => {
    let component: SettingsDialogComponent;
    let fixture: ComponentFixture<SettingsDialogComponent>;
    let mockMatDialogRef: Pick<
        MatDialogRef<SettingsDialogComponent>,
        "close" | "updateSize" | "backdropClick" | "keydownEvents" | "disableClose"
    >;
    let mockConfigManagerService: Pick<ConfigManagerService, "getConfig" | "getGroup" | "setGroup">;
    let mockErgSettingsService: Pick<
        ErgSettingsService,
        | "changeLogLevel"
        | "changeDeltaTimeLogging"
        | "changeLogToSdCard"
        | "changeBleServiceType"
        | "changeMachineSettings"
        | "changeDragFactorSettings"
        | "changeSensorSignalSettings"
        | "changeStrokeSettings"
        | "restartDevice"
    >;
    let mockErgConnectionService: Pick<ErgConnectionService, "reconnect" | "connectionStatus$">;
    let mockSnackBar: Pick<MatSnackBar, "open" | "openFromComponent">;
    let mockSpinnerOverlay: Pick<SpinnerOverlay, "open">;
    let mockUtilsService: Pick<UtilsService, "breakpointHelper">;
    let mockSwUpdate: Pick<SwUpdate, "checkForUpdate" | "isEnabled">;
    let breakpointSubject: BehaviorSubject<{
        maxW599: boolean;
    }>;

    beforeEach(async (): Promise<void> => {
        vi.spyOn(navigator, "bluetooth", "get").mockReturnValue({
            getDevices: (): Promise<Array<BluetoothDevice>> => Promise.resolve([]),
        } as unknown as Bluetooth);

        const mockDialogData = createMockDialogData();

        mockMatDialogRef = {
            close: vi.fn(),
            updateSize: vi.fn(),
            backdropClick: vi.fn(),
            keydownEvents: vi.fn(),
            disableClose: false,
        };
        vi.mocked(mockMatDialogRef.backdropClick).mockReturnValue(EMPTY);
        vi.mocked(mockMatDialogRef.keydownEvents).mockReturnValue(EMPTY);

        mockConfigManagerService = createMockConfigManagerService();

        mockErgSettingsService = {
            changeLogLevel: vi.fn(),
            changeDeltaTimeLogging: vi.fn(),
            changeLogToSdCard: vi.fn(),
            changeBleServiceType: vi.fn(),
            changeMachineSettings: vi.fn(),
            changeDragFactorSettings: vi.fn(),
            changeSensorSignalSettings: vi.fn(),
            changeStrokeSettings: vi.fn(),
            restartDevice: vi.fn(),
        };
        vi.mocked(mockErgSettingsService.changeLogLevel).mockResolvedValue();
        vi.mocked(mockErgSettingsService.changeDeltaTimeLogging).mockResolvedValue();
        vi.mocked(mockErgSettingsService.changeLogToSdCard).mockResolvedValue();
        vi.mocked(mockErgSettingsService.changeBleServiceType).mockResolvedValue();
        vi.mocked(mockErgSettingsService.changeMachineSettings).mockResolvedValue();
        vi.mocked(mockErgSettingsService.changeDragFactorSettings).mockResolvedValue();
        vi.mocked(mockErgSettingsService.changeSensorSignalSettings).mockResolvedValue();
        vi.mocked(mockErgSettingsService.changeStrokeSettings).mockResolvedValue();
        vi.mocked(mockErgSettingsService.restartDevice).mockResolvedValue();

        mockErgConnectionService = {
            reconnect: vi.fn(),
            connectionStatus$: vi.fn(),
        };
        vi.mocked(mockErgConnectionService.reconnect).mockResolvedValue();
        vi.mocked(mockErgConnectionService.connectionStatus$).mockReturnValue(
            of(mockDialogData.ergConnectionStatus),
        );

        mockSnackBar = {
            open: vi.fn(),
            openFromComponent: vi.fn(),
        };
        vi.mocked(mockSnackBar.openFromComponent).mockReturnValue({
            onAction: vi.fn().mockReturnValue(of(true)),
        } as unknown as MatSnackBarRef<TextOnlySnackBar>);

        mockSpinnerOverlay = {
            open: vi.fn(),
        };

        breakpointSubject = new BehaviorSubject<{
            maxW599: boolean;
        }>({ maxW599: false });

        mockUtilsService = {
            breakpointHelper: vi.fn(),
        };
        vi.mocked(mockUtilsService.breakpointHelper).mockReturnValue(breakpointSubject.asObservable());

        mockSwUpdate = {
            checkForUpdate: vi.fn(),
            isEnabled: false,
        };

        await TestBed.configureTestingModule({
            imports: [SettingsDialogComponent],
            providers: [
                { provide: MatDialogRef, useValue: mockMatDialogRef },
                { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: ErgSettingsService, useValue: mockErgSettingsService },
                { provide: MatSnackBar, useValue: mockSnackBar },
                { provide: SpinnerOverlay, useValue: mockSpinnerOverlay },
                { provide: UtilsService, useValue: mockUtilsService },
                { provide: SwUpdate, useValue: mockSwUpdate },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsDialogComponent);
        component = fixture.componentInstance;
    });

    describe("as part of the initialization and layout management", (): void => {
        it("should be created", (): void => {
            expect(component).toBeTruthy();
        });

        it("should set disableClose to true on initialization", (): void => {
            expect(mockMatDialogRef.disableClose).toBe(true);
        });

        it("should have the correct dialog title", async (): Promise<void> => {
            const titleElement = fixture.debugElement.nativeElement.querySelector("[mat-dialog-title]");
            expect(titleElement.textContent.trim()).toBe("Settings");
        });

        it("should call MatDialogRef.updateSize when breakpoint changes", (): void => {
            expect(mockMatDialogRef.updateSize).toHaveBeenCalled();
        });

        it("should call UtilsService.breakpointHelper on initialization", (): void => {
            expect(mockUtilsService.breakpointHelper).toHaveBeenCalledWith([[599, "max"]]);
        });

        it("should have breakPoints$ observable", (): void => {
            expect(component.breakPoints$).toBeDefined();
        });

        describe("handle responsive layout", (): void => {
            it("when big screen", (): void => {
                breakpointSubject.next({ maxW599: false });

                component.breakPoints$.pipe(take(1)).subscribe((isSmallScreen: boolean): void => {
                    expect(isSmallScreen).toBe(false);
                    expect(mockMatDialogRef.updateSize).toHaveBeenCalledWith("560px");
                });
            });

            it("when small screen", (): void => {
                breakpointSubject.next({ maxW599: true });

                component.breakPoints$.pipe(take(1)).subscribe((isSmallScreen: boolean): void => {
                    expect(isSmallScreen).toBe(true);
                    expect(mockMatDialogRef.updateSize).toHaveBeenCalledWith("90%");
                });
            });
        });

        it("should receive correct data from MAT_DIALOG_DATA injection", (): void => {
            expect(component.data).toBeDefined();
            expect(component.data.rowerSettings).toBeDefined();
            expect(component.data.rowerSettings.generalSettings).toBeDefined();
            expect(component.data.rowerSettings.rowingSettings).toBeDefined();
            expect(component.data.ergConnectionStatus).toBeDefined();
            expect(component.data.deviceInfo).toBeDefined();

            expect(component.data.ergConnectionStatus.deviceName).toBe("Test Device");
            expect(component.data.deviceInfo.modelNumber).toBe("Test Model");
        });
    });

    describe("dialog actions", (): void => {
        it("should have proper buttons with correct state", async (): Promise<void> => {
            const dialogActions = fixture.debugElement.nativeElement.querySelector("[mat-dialog-actions]");
            const buttons = dialogActions.querySelectorAll("button");
            expect(buttons).toHaveLength(2);

            const saveButton = dialogActions.querySelector("button[ng-reflect-disabled]") || buttons[0];
            const cancelButton = buttons[1];

            expect(saveButton.textContent.trim()).toBe("Save");
            expect(cancelButton.textContent.trim()).toBe("Cancel");

            setupMockChildComponents(component, false, false, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);
            await fixture.whenStable();

            expect(saveButton.disabled).toBe(true);

            setupMockChildComponents(component, true, true, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);
            await fixture.whenStable();

            expect(saveButton.disabled).toBe(false);
        });

        it("should call MatDialogRef.close() when closeDialog method is called with no dirty forms", (): void => {
            setupMockChildComponents(component, false, false);

            component.handleDialogClose();

            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });

        it("should display MatSnackBar confirmation when forms are dirty on close", async (): Promise<void> => {
            setupMockChildComponents(component, true, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
        });

        it("should handle snackbar dismissal without action in close dialog", async (): Promise<void> => {
            const mockSnackBarRef = {
                onAction: vi.fn().mockReturnValue(of()),
            };
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
                mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
            );

            setupMockChildComponents(component, true, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockSnackBarRef.onAction).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });

        it("should respond to ESC keydown events properly", (): void => {
            expect(mockMatDialogRef.keydownEvents).toHaveBeenCalled();
        });

        it("should handle ESC key with clean forms", (): void => {
            setupMockChildComponents(component, false, false);

            component.handleDialogClose();

            expect(mockMatDialogRef.close).toHaveBeenCalled();
            expect(mockSnackBar.openFromComponent).not.toHaveBeenCalled();
        });

        it("should handle ESC key with dirty forms showing confirmation", (): void => {
            setupMockChildComponents(component, true, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });

        it("should respond to backdrop click events properly", (): void => {
            expect(mockMatDialogRef.backdropClick).toHaveBeenCalled();
        });

        it("should handle backdrop click with clean forms", (): void => {
            setupMockChildComponents(component, false, false);

            component.handleDialogClose();

            expect(mockMatDialogRef.close).toHaveBeenCalled();
            expect(mockSnackBar.openFromComponent).not.toHaveBeenCalled();
        });

        it("should handle backdrop click with dirty forms showing confirmation", (): void => {
            setupMockChildComponents(component, true, false);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });

        it("should handle display form dirty state in close confirmation", (): void => {
            setupMockChildComponents(component, false, false, false, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });

        it("should show confirmation when layout is dirty but all forms are clean", (): void => {
            const mockGeneralForm = createMockGeneralForm(false);
            const mockRowingForm = createMockRowingForm(false);
            const mockDisplayForm = createMockDisplayForm(false);

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(true),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });
    });

    describe("form validation state", (): void => {
        it("should be invalid when both forms are invalid", (): void => {
            component.onGeneralFormValidityChange(false);
            component.onRowingFormValidityChange(false);

            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should be invalid when only general form is valid", (): void => {
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(false);

            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should be invalid when only rowing form is valid", (): void => {
            component.onGeneralFormValidityChange(false);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should be valid when both forms are valid", (): void => {
            setupMockChildComponents(component, true, true, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(true);

            component.currentTabIndex.set(2);
            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        describe("when toggling validity", (): void => {
            it("should reflect changes in general form validity", (): void => {
                setupMockChildComponents(component, true, true, false);
                component.currentTabIndex.set(0);

                component.onGeneralFormValidityChange(false);
                component.onRowingFormValidityChange(true);
                expect(component.isSaveButtonEnabled()).toBe(false);
                component.onGeneralFormValidityChange(true);
                expect(component.isSaveButtonEnabled()).toBe(true);
                component.onGeneralFormValidityChange(false);
                expect(component.isSaveButtonEnabled()).toBe(false);
            });

            it("should reflect changes in rowing form validity", (): void => {
                setupMockChildComponents(component, true, true, false);
                component.currentTabIndex.set(2);

                component.onGeneralFormValidityChange(true);
                component.onRowingFormValidityChange(false);
                expect(component.isSaveButtonEnabled()).toBe(false);
                component.onRowingFormValidityChange(true);
                expect(component.isSaveButtonEnabled()).toBe(true);
                component.onRowingFormValidityChange(false);
                expect(component.isSaveButtonEnabled()).toBe(false);
            });
        });

        it("should enable save button when switching tabs based on tab-specific conditions", (): void => {
            setupMockChildComponents(component, true, true, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            // start on general tab - should be enabled
            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(true);

            // switch to rowing tab - should still be enabled
            component.currentTabIndex.set(2);
            expect(component.isSaveButtonEnabled()).toBe(true);

            // now with profile loaded but clean forms
            setupMockChildComponents(component, false, false, true);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            // general tab with clean forms - should be disabled
            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(false);

            // rowing tab with clean forms but profile loaded - should be enabled
            component.currentTabIndex.set(2);
            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should disable save button when general form is invalid even when dirty", (): void => {
            const mockGeneralForm = {
                ...createMockGeneralForm(true, {
                    logLevel: 2,
                }),
                valid: false,
            };
            const mockRowingForm = createMockRowingForm(false);
            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onGeneralFormValidityChange(false);
            component.onRowingFormValidityChange(true);
            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should disable save button when rowing form is invalid even when dirty", (): void => {
            const mockGeneralForm = createMockGeneralForm(true);
            const mockRowingForm = {
                ...createMockRowingForm(true, {
                    machineSettings: { flywheelInertia: 0.06 },
                }),
                valid: false,
            };
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
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(true);
            component.onRowingFormValidityChange(false);
            component.currentTabIndex.set(2);
            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should handle forms becoming pristine after being dirty", (): void => {
            setupMockChildComponents(component, true, true);
            component.handleDialogClose();
            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();

            vi.mocked(mockSnackBar.openFromComponent).mockClear();

            setupMockChildComponents(component, false, false);
            component.handleDialogClose();
            expect(mockSnackBar.openFromComponent).not.toHaveBeenCalled();
            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });
    });

    describe("when rowing profile is loaded", (): void => {
        it("should enable save button on rowing tab even if form is pristine", (): void => {
            setupMockChildComponents(component, false, false, true);
            component.currentTabIndex.set(2);
            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should enable save even with invalid forms on rowing tab", (): void => {
            setupMockChildComponents(component, false, false, true);
            component.currentTabIndex.set(2);
            component.onGeneralFormValidityChange(false);
            component.onDisplayFormValidityChange(false);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should not enable save button on general tab", (): void => {
            setupMockChildComponents(component, false, false, true);
            component.currentTabIndex.set(0);
            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should enable save button on display tab when layout is dirty but form is clean", (): void => {
            const mockGeneralForm = createMockGeneralForm(false);
            const mockRowingForm = createMockRowingForm(false);
            const mockDisplayForm = createMockDisplayForm(false);

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(true),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            component.currentTabIndex.set(1);

            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should save rowing settings even if not dirty", async (): Promise<void> => {
            const mockGeneralForm = createMockGeneralForm(false);
            const mockRowingForm = createMockRowingForm(false, {
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
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: true,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(false);
            component.onDisplayFormValidityChange(false);
            component.onRowingFormValidityChange(true);

            component.currentTabIndex.set(2);

            await component.saveSettings();

            expect(mockErgSettingsService.changeMachineSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    flywheelInertia: 0.06,
                }),
            );
            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });
    });

    describe("saveSettings method", (): void => {
        it("should save general settings", async (): Promise<void> => {
            const mockGeneralForm = {
                dirty: true,
                controls: {
                    logLevel: { dirty: true, value: 2 },
                    deltaTimeLogging: { dirty: true, value: true },
                    logToSdCard: { dirty: true, value: true },
                    bleMode: { dirty: true, value: 1 },
                    heartRateMonitor: { dirty: true, value: "ant" },
                },
                value: {
                    heartRateMonitor: "ant",
                },
            };
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
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
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
                    heartRateMonitor: "ant",
                }),
            );
            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });

        it("should save display settings when form is dirty", async (): Promise<void> => {
            const mockGeneralForm = createMockGeneralForm(false);
            const mockRowingForm = createMockRowingForm(false);
            const mockDisplayForm = createMockDisplayForm(true);

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
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
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(true),
                getLayoutConfig: vi.fn().mockReturnValue(customLayout),
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
            });
            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });

        it("should not save display settings when form and layout are both clean", async (): Promise<void> => {
            const mockGeneralForm = createMockGeneralForm(true, { logLevel: 2 });
            const mockRowingForm = createMockRowingForm(false);
            const mockDisplayForm = createMockDisplayForm(false);

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
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

        describe("should save rowing settings", async (): Promise<void> => {
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
                        ...vi.mocked(mockErgSettingsService.changeDragFactorSettings).mock
                            .invocationCallOrder,
                    ),
                ).toBeLessThan(
                    Math.min(
                        ...vi.mocked(mockErgSettingsService.changeSensorSignalSettings!).mock
                            .invocationCallOrder,
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
                        ...vi.mocked(mockErgSettingsService.changeSensorSignalSettings).mock
                            .invocationCallOrder,
                    ),
                ).toBeLessThan(
                    Math.min(
                        ...vi.mocked(mockErgSettingsService.changeDragFactorSettings!).mock
                            .invocationCallOrder,
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
                        ...vi.mocked(mockErgSettingsService.changeDragFactorSettings).mock
                            .invocationCallOrder,
                    ),
                ).toBeLessThan(
                    Math.min(
                        ...vi.mocked(mockErgSettingsService.changeSensorSignalSettings!).mock
                            .invocationCallOrder,
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
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
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
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
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
                Math.min(
                    ...vi.mocked(mockErgSettingsService.changeMachineSettings!).mock.invocationCallOrder,
                ),
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
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
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
            const mockGeneralForm = {
                dirty: false,
                controls: {
                    logLevel: { dirty: false, value: 1 },
                    deltaTimeLogging: { dirty: false, value: false },
                    logToSdCard: { dirty: false, value: false },
                    bleMode: { dirty: false, value: 0 },
                    heartRateMonitor: { dirty: false, value: "none" },
                },
            };
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
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
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
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(true),
                getLayoutConfig: vi.fn().mockReturnValue(customLayout),
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
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
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
});
