import { provideHttpClient } from "@angular/common/http";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SwUpdate } from "@angular/service-worker";
import { BehaviorSubject, EMPTY, of, take } from "rxjs";

import { IDeviceInformation } from "../../common/ble.interfaces";
import { IErgConnectionStatus, IRowerSettings } from "../../common/common.interfaces";
import { SpinnerOverlay } from "../../common/overlay/spinner-overlay.service";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { ErgSettingsService } from "../../common/services/ergometer/erg-settings.service";
import { UtilsService } from "../../common/services/utils.service";

import { SettingsDialogComponent } from "./settings-dialog.component";

interface IMockGeneralForm {
    dirty: boolean;
    controls: Record<string, { dirty: boolean; value: unknown }>;
    value: Record<string, unknown>;
}

interface IMockRowingForm {
    dirty: boolean;
    controls: Record<string, { dirty: boolean; getRawValue: () => unknown }>;
    value: Record<string, unknown>;
}

// mock navigator.bluetooth.getDevices for test environment
if (!navigator.bluetooth) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).bluetooth = {};
}
if (!navigator.bluetooth.getDevices) {
    navigator.bluetooth.getDevices = async (): Promise<Array<BluetoothDevice>> => [];
}

describe("SettingsDialogComponent", (): void => {
    let component: SettingsDialogComponent;
    let fixture: ComponentFixture<SettingsDialogComponent>;
    let mockMatDialogRef: jasmine.SpyObj<MatDialogRef<SettingsDialogComponent>>;
    let mockConfigManagerService: jasmine.SpyObj<ConfigManagerService>;
    let mockErgSettingsService: jasmine.SpyObj<ErgSettingsService>;
    let mockErgConnectionService: jasmine.SpyObj<ErgConnectionService>;
    let mockSnackBar: jasmine.SpyObj<MatSnackBar>;
    let mockSpinnerOverlay: jasmine.SpyObj<SpinnerOverlay>;
    let mockUtilsService: jasmine.SpyObj<UtilsService>;
    let mockSwUpdate: jasmine.SpyObj<SwUpdate>;
    let breakpointSubject: BehaviorSubject<{ maxW599: boolean }>;

    // helper functions to reduce duplication
    const createMockGeneralForm: (
        dirty?: boolean,
        controlValues?: Record<string, unknown>,
    ) => IMockGeneralForm = (
        dirty: boolean = false,
        controlValues: Record<string, unknown> = {},
    ): IMockGeneralForm => {
        const defaultControlValues: Record<string, unknown> = {
            logLevel: 1,
            deltaTimeLogging: false,
            logToSdCard: false,
            bleMode: 0,
            heartRateMonitor: "none",
            ...controlValues,
        };

        return {
            dirty,
            controls: Object.keys(defaultControlValues).reduce(
                (
                    acc: Record<string, { dirty: boolean; value: unknown }>,
                    key: string,
                ): Record<string, { dirty: boolean; value: unknown }> => {
                    acc[key] = {
                        dirty: (defaultControlValues[key] as { dirty: boolean }).dirty ?? dirty,
                        value: defaultControlValues[key],
                    };

                    return acc;
                },
                {} as Record<string, { dirty: boolean; value: unknown }>,
            ),
            value: defaultControlValues,
        };
    };

    const createMockRowingForm: (
        dirty?: boolean,
        controlValues?: Record<string, unknown>,
    ) => IMockRowingForm = (
        dirty: boolean = false,
        controlValues: Record<string, unknown> = {},
    ): IMockRowingForm => {
        const defaultControlValues: Record<string, unknown> = {
            machineSettings: {},
            dragFactorSettings: {},
            sensorSignalSettings: {},
            strokeDetectionSettings: {},
            ...controlValues,
        };

        return {
            dirty,
            controls: Object.keys(defaultControlValues).reduce(
                (
                    acc: Record<string, { dirty: boolean; getRawValue: () => unknown }>,
                    key: string,
                ): Record<string, { dirty: boolean; getRawValue: () => unknown }> => {
                    acc[key] = {
                        dirty: (defaultControlValues[key] as { dirty: boolean }).dirty ?? dirty,
                        getRawValue: (): unknown => defaultControlValues[key],
                    };

                    return acc;
                },
                {} as Record<string, { dirty: boolean; getRawValue: () => unknown }>,
            ),
            value: defaultControlValues,
        };
    };

    const setupMockChildComponents: (
        generalFormDirty?: boolean,
        rowingFormDirty?: boolean,
        isProfileLoaded?: boolean,
    ) => void = (
        generalFormDirty: boolean = false,
        rowingFormDirty: boolean = false,
        isProfileLoaded: boolean = false,
    ): void => {
        const mockGeneralForm = createMockGeneralForm(generalFormDirty);
        const mockRowingForm = createMockRowingForm(rowingFormDirty);

        // check if generalSettings is already spied upon
        try {
            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
        } catch {
            // already spied, just update the return value
            (
                (component as unknown as Record<string, jasmine.Spy>).generalSettings as jasmine.Spy
            ).and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
        }

        component.onGeneralFormValidityChange(true);

        // check if rowingSettings is already spied upon
        try {
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                isProfileLoaded,
            } as unknown as ReturnType<typeof component.rowingSettings>);
        } catch {
            // already spied, just update the return value
            (
                (component as unknown as Record<string, jasmine.Spy>).rowingSettings as jasmine.Spy
            ).and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                isProfileLoaded,
            } as unknown as ReturnType<typeof component.rowingSettings>);
        }

        component.onRowingFormValidityChange(true);
    };

    beforeEach(async (): Promise<void> => {
        const mockRowerSettings: IRowerSettings = {
            generalSettings: {
                bleServiceFlag: 0,
                logLevel: 1,
                logToSdCard: false,
                logDeltaTimes: false,
                isRuntimeSettingsEnabled: false,
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
                    strokeDetectionType: 0,
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

        const mockErgConnectionStatus: IErgConnectionStatus = {
            deviceName: "Test Device",
            status: "connected",
        };

        const mockDeviceInfo: IDeviceInformation = {
            modelNumber: "Test Model",
            firmwareNumber: "1.0.0",
            manufacturerName: "Test Manufacturer",
        };

        const mockDialogData = {
            rowerSettings: mockRowerSettings,
            ergConnectionStatus: mockErgConnectionStatus,
            deviceInfo: mockDeviceInfo,
        };

        mockMatDialogRef = jasmine.createSpyObj<MatDialogRef<SettingsDialogComponent>>("MatDialogRef", [
            "close",
            "updateSize",
            "backdropClick",
            "keydownEvents",
        ]);
        mockMatDialogRef.disableClose = false;
        mockMatDialogRef.backdropClick.and.returnValue(of({} as MouseEvent));
        mockMatDialogRef.keydownEvents.and.returnValue(of({} as KeyboardEvent));

        mockConfigManagerService = jasmine.createSpyObj<ConfigManagerService>("ConfigManagerService", [
            "getItem",
            "setItem",
        ]);
        mockConfigManagerService.getItem.and.returnValue("ble");

        mockErgSettingsService = jasmine.createSpyObj<ErgSettingsService>("ErgSettingsService", [
            "changeLogLevel",
            "changeDeltaTimeLogging",
            "changeLogToSdCard",
            "changeBleServiceType",
            "changeMachineSettings",
            "changeDragFactorSettings",
            "changeSensorSignalSettings",
            "changeStrokeSettings",
            "restartDevice",
        ]);
        mockErgSettingsService.changeLogLevel.and.resolveTo();
        mockErgSettingsService.changeDeltaTimeLogging.and.resolveTo();
        mockErgSettingsService.changeLogToSdCard.and.resolveTo();
        mockErgSettingsService.changeBleServiceType.and.resolveTo();
        mockErgSettingsService.changeMachineSettings.and.resolveTo();
        mockErgSettingsService.changeDragFactorSettings.and.resolveTo();
        mockErgSettingsService.changeSensorSignalSettings.and.resolveTo();
        mockErgSettingsService.changeStrokeSettings.and.resolveTo();
        mockErgSettingsService.restartDevice.and.resolveTo();

        mockErgConnectionService = jasmine.createSpyObj<ErgConnectionService>("ErgConnectionService", [
            "reconnect",
            "connectionStatus$",
        ]);
        mockErgConnectionService.reconnect.and.resolveTo();
        mockErgConnectionService.connectionStatus$.and.returnValue(of(mockErgConnectionStatus));

        mockSnackBar = jasmine.createSpyObj<MatSnackBar>("MatSnackBar", ["open", "openFromComponent"]);
        mockSnackBar.openFromComponent.and.returnValue({
            onAction: jasmine.createSpy("onAction").and.returnValue(of(true)),
        } as unknown as ReturnType<MatSnackBar["openFromComponent"]>);

        mockSpinnerOverlay = jasmine.createSpyObj<SpinnerOverlay>("SpinnerOverlay", ["open"]);

        breakpointSubject = new BehaviorSubject<{ maxW599: boolean }>({ maxW599: false });

        mockUtilsService = jasmine.createSpyObj<UtilsService>("UtilsService", ["breakpointHelper"]);
        mockUtilsService.breakpointHelper.and.returnValue(breakpointSubject.asObservable());

        mockSwUpdate = jasmine.createSpyObj<SwUpdate>("SwUpdate", ["checkForUpdate"], {
            isEnabled: false,
        });

        await TestBed.configureTestingModule({
            imports: [SettingsDialogComponent],
            providers: [
                provideHttpClient(),
                { provide: MatDialogRef, useValue: mockMatDialogRef },
                { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: ErgSettingsService, useValue: mockErgSettingsService },
                { provide: MatSnackBar, useValue: mockSnackBar },
                { provide: SpinnerOverlay, useValue: mockSpinnerOverlay },
                { provide: UtilsService, useValue: mockUtilsService },
                { provide: SwUpdate, useValue: mockSwUpdate },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsDialogComponent);
        component = fixture.componentInstance;

        fixture.detectChanges();
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
        it("should have proper buttons with correct state", (): void => {
            const dialogActions = fixture.debugElement.nativeElement.querySelector("[mat-dialog-actions]");
            const buttons = dialogActions.querySelectorAll("button");
            expect(buttons).toHaveSize(2);

            const saveButton = dialogActions.querySelector("button[ng-reflect-disabled]") || buttons[0];
            const cancelButton = buttons[1];

            expect(saveButton.textContent.trim()).toBe("Save");
            expect(cancelButton.textContent.trim()).toBe("Cancel");

            setupMockChildComponents(false, false, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);
            fixture.detectChanges();

            expect(saveButton.disabled).toBe(true);

            setupMockChildComponents(true, true, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);
            fixture.detectChanges();

            expect(saveButton.disabled).toBe(false);
        });

        it("should call MatDialogRef.close() when closeDialog method is called with no dirty forms", (): void => {
            setupMockChildComponents(false, false);

            component.handleDialogClose();

            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });

        it("should display MatSnackBar confirmation when forms are dirty on close", async (): Promise<void> => {
            setupMockChildComponents(true, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
        });

        it("should handle snackbar dismissal without action in close dialog", async (): Promise<void> => {
            const mockSnackBarRef = {
                onAction: jasmine.createSpy("onAction").and.returnValue(of()),
            };
            mockSnackBar.openFromComponent = jasmine
                .createSpy("openFromComponent")
                .and.returnValue(mockSnackBarRef);

            setupMockChildComponents(true, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockSnackBarRef.onAction).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });

        it("should respond to ESC keydown events properly", (): void => {
            expect(mockMatDialogRef.keydownEvents).toHaveBeenCalled();
        });

        it("should respond to backdrop click events properly", (): void => {
            expect(mockMatDialogRef.backdropClick).toHaveBeenCalled();
        });
    });

    describe("tabs", (): void => {
        it("should be rendered with their child components correctly", (): void => {
            const tabGroup = fixture.debugElement.nativeElement.querySelector("mat-tab-group");

            expect(tabGroup).toBeTruthy();
            expect(tabGroup.getAttribute("ng-reflect-selected-index")).toBeDefined();
            expect(component.generalSettings).toBeDefined();
            expect(component.rowingSettings).toBeDefined();
        });

        it("should update currentTabIndex when onTabChange is called", (): void => {
            expect(component.currentTabIndex()).toBe(0);

            component.onTabChange(1);
            expect(component.currentTabIndex()).toBe(1);

            component.onTabChange(0);
            expect(component.currentTabIndex()).toBe(0);
        });

        it("should handle switching with dirty forms correctly", (): void => {
            setupMockChildComponents(true, false);

            component.currentTabIndex.set(0);
            component.onTabChange(1);
            expect(component.currentTabIndex()).toBe(1);

            const generalForm = component.generalSettings().getForm();
            const rowingForm = component.rowingSettings().getForm();
            expect(generalForm.dirty).toBe(true);
            expect(rowingForm.dirty).toBe(false);
        });

        it("should update save button state when switching", (): void => {
            setupMockChildComponents(true, true);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(false);

            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(true);

            component.onTabChange(1);
            expect(component.isSaveButtonEnabled()).toBe(false);

            component.onRowingFormValidityChange(true);
            expect(component.isSaveButtonEnabled()).toBe(true);

            component.onTabChange(0);
            expect(component.isSaveButtonEnabled()).toBe(true);
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
            setupMockChildComponents(true, true, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(true);

            component.currentTabIndex.set(1);
            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        describe("when toggling validity", (): void => {
            it("should reflect changes in general form validity", (): void => {
                setupMockChildComponents(true, true, false);
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
                setupMockChildComponents(true, true, false);
                component.currentTabIndex.set(1);

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
            setupMockChildComponents(true, true, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            // start on general tab - should be enabled
            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(true);

            // switch to rowing tab - should still be enabled
            component.currentTabIndex.set(1);
            expect(component.isSaveButtonEnabled()).toBe(true);

            // now with profile loaded but clean forms
            setupMockChildComponents(false, false, true);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            // general tab with clean forms - should be disabled
            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(false);

            // rowing tab with clean forms but profile loaded - should be enabled
            component.currentTabIndex.set(1);
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
            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
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
            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(false);
            component.currentTabIndex.set(1);
            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should handle forms becoming pristine after being dirty", (): void => {
            setupMockChildComponents(true, true);
            component.handleDialogClose();
            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();

            mockSnackBar.openFromComponent.calls.reset();

            setupMockChildComponents(false, false);
            component.handleDialogClose();
            expect(mockSnackBar.openFromComponent).not.toHaveBeenCalled();
            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });
    });

    describe("when rowing profile is loaded", (): void => {
        it("should enable save button on rowing tab even if form is pristine", (): void => {
            setupMockChildComponents(false, false, true);
            component.currentTabIndex.set(1);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should enable save even with invalid forms on rowing tab", (): void => {
            setupMockChildComponents(false, false, true);
            component.currentTabIndex.set(1);
            component.onGeneralFormValidityChange(false);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should not enable save button on general tab", (): void => {
            setupMockChildComponents(false, false, true);
            component.currentTabIndex.set(0);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should save rowing settings even if not dirty", async (): Promise<void> => {
            const mockGeneralForm = createMockGeneralForm(false);
            const mockRowingForm = createMockRowingForm(false, {
                machineSettings: { flywheelInertia: 0.06 },
            });

            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                isProfileLoaded: true,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(false);
            component.onRowingFormValidityChange(true);

            component.currentTabIndex.set(1);

            await component.saveSettings();

            expect(mockErgSettingsService.changeMachineSettings).toHaveBeenCalledWith(
                jasmine.objectContaining({
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

            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            component.currentTabIndex.set(1);

            await component.saveSettings();

            expect(mockErgSettingsService.changeLogLevel).toHaveBeenCalledWith(2);
            expect(mockErgSettingsService.changeDeltaTimeLogging).toHaveBeenCalledWith(true);
            expect(mockErgSettingsService.changeLogToSdCard).toHaveBeenCalledWith(true);
            expect(mockErgSettingsService.changeBleServiceType).toHaveBeenCalledWith(1);
            expect(mockConfigManagerService.setItem).toHaveBeenCalledWith("heartRateMonitor", "ant");
            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });

        describe("should save rowing settings", async (): Promise<void> => {
            it("when both debounce and max drag period decrease first drag factor settings then sensor settings", async (): Promise<void> => {
                const mockRowingForm = createMockRowingForm(true, {
                    dragFactorSettings: { maxDragFactorRecoveryPeriod: 7 },
                    sensorSignalSettings: { rotationDebounceTime: 20 },
                });

                spyOn(component, "rowingSettings").and.returnValue({
                    getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                    saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                } as unknown as ReturnType<typeof component.rowingSettings>);
                component.onRowingFormValidityChange(true);

                await component.saveSettings();

                expect(mockErgSettingsService.changeDragFactorSettings).toHaveBeenCalledBefore(
                    mockErgSettingsService.changeSensorSignalSettings!,
                );
            });

            it("when both debounce and max drag period increase first sensor settings then drag factor settings", async (): Promise<void> => {
                const mockRowingForm = createMockRowingForm(true, {
                    dragFactorSettings: { maxDragFactorRecoveryPeriod: 9 },
                    sensorSignalSettings: { rotationDebounceTime: 30 },
                });

                spyOn(component, "rowingSettings").and.returnValue({
                    getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                    saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                } as unknown as ReturnType<typeof component.rowingSettings>);
                component.onRowingFormValidityChange(true);

                await component.saveSettings();

                expect(mockErgSettingsService.changeSensorSignalSettings).toHaveBeenCalledBefore(
                    mockErgSettingsService.changeDragFactorSettings!,
                );
            });

            it("when debounce and drag period value change direction is opposite first drag factor settings then sensor settings", async (): Promise<void> => {
                const mockRowingForm = createMockRowingForm(true, {
                    dragFactorSettings: { maxDragFactorRecoveryPeriod: 9 },
                    sensorSignalSettings: { rotationDebounceTime: 20 },
                });
                spyOn(component, "rowingSettings").and.returnValue({
                    getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                    saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                } as unknown as ReturnType<typeof component.rowingSettings>);
                component.onRowingFormValidityChange(true);

                await component.saveSettings();

                expect(mockErgSettingsService.changeDragFactorSettings).toHaveBeenCalledBefore(
                    mockErgSettingsService.changeSensorSignalSettings!,
                );
            });

            it("and save drag factor settings drag factor form when drag factor form is dirty", async (): Promise<void> => {
                const mockRowingForm = createMockRowingForm(true, {
                    dragFactorSettings: { maxDragFactorRecoveryPeriod: 9 },
                    sensorSignalSettings: { dirty: false, rotationDebounceTime: 25 },
                });
                spyOn(component, "rowingSettings").and.returnValue({
                    getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                    saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
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
                spyOn(component, "rowingSettings").and.returnValue({
                    getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                    saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
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
                spyOn(component, "rowingSettings").and.returnValue({
                    getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                    saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
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
                spyOn(component, "rowingSettings").and.returnValue({
                    getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                    saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                } as unknown as ReturnType<typeof component.rowingSettings>);
                component.onRowingFormValidityChange(true);
                component.currentTabIndex.set(1);

                await component.saveSettings();

                expect(mockErgSettingsService.changeMachineSettings).toHaveBeenCalledWith(
                    jasmine.objectContaining({
                        flywheelInertia: 0.06,
                    }),
                );
                expect(mockErgSettingsService.changeDragFactorSettings).toHaveBeenCalledWith(
                    jasmine.objectContaining({
                        goodnessOfFitThreshold: 0.95,
                    }),
                );
                expect(mockErgSettingsService.changeSensorSignalSettings).toHaveBeenCalledWith(
                    jasmine.objectContaining({
                        rotationDebounceTime: 30,
                    }),
                );
                expect(mockErgSettingsService.changeStrokeSettings).toHaveBeenCalledWith(
                    jasmine.objectContaining({
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
                    spyOn(component, "rowingSettings").and.returnValue({
                        getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                        saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
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

                    expect(mockErgSettingsService.restartDevice).toHaveBeenCalledBefore(
                        mockErgConnectionService.reconnect!,
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

            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            const mockSnackBarRef = {
                onAction: jasmine.createSpy("onAction").and.returnValue(of(true)),
            };
            mockSnackBar.openFromComponent = jasmine
                .createSpy("openFromComponent")
                .and.returnValue(mockSnackBarRef);

            component.currentTabIndex.set(0);

            await component.saveSettings();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
                    data: jasmine.objectContaining({
                        text: "Rowing tab has changes, save those too?",
                    }),
                }),
            );

            expect(mockErgSettingsService.changeMachineSettings).toHaveBeenCalledWith(
                jasmine.objectContaining({
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

            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            const mockSnackBarRef = {
                onAction: jasmine.createSpy("onAction").and.returnValue(of(true)),
            };
            mockSnackBar.openFromComponent = jasmine
                .createSpy("openFromComponent")
                .and.returnValue(mockSnackBarRef);

            component.currentTabIndex.set(1);

            await component.saveSettings();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
                    data: jasmine.objectContaining({
                        text: "General tab has changes, save those too?",
                    }),
                }),
            );

            expect(mockErgSettingsService.changeLogLevel).toHaveBeenCalledBefore(
                mockErgSettingsService.changeMachineSettings!,
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

            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            const mockSnackBarRef = {
                onAction: jasmine.createSpy("onAction").and.returnValue(EMPTY),
            };
            mockSnackBar.openFromComponent = jasmine
                .createSpy("openFromComponent")
                .and.returnValue(mockSnackBarRef);

            component.currentTabIndex.set(0);

            await component.saveSettings();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
                    data: jasmine.objectContaining({
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

            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            const mockSnackBarRef = {
                onAction: jasmine.createSpy("onAction").and.returnValue(of(false)),
            };
            mockSnackBar.openFromComponent = jasmine
                .createSpy("openFromComponent")
                .and.returnValue(mockSnackBarRef);

            component.currentTabIndex.set(0);

            await component.saveSettings();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
        });

        it("should prevent multiple simultaneous save operations", async (): Promise<void> => {
            let resolvePromise: () => void;
            const pendingPromise = new Promise<void>((resolve: () => void): void => {
                resolvePromise = resolve;
            });

            mockErgSettingsService.changeLogLevel = jasmine
                .createSpy("changeLogLevel")
                .and.returnValue(pendingPromise);

            const mockGeneralForm = createMockGeneralForm(true, {
                logLevel: 2,
            });
            const mockRowingForm = createMockRowingForm(false);

            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(false);

            const mockSnackBarRef = {
                onAction: jasmine.createSpy("onAction").and.returnValue(of(true)),
            };
            mockSnackBar.openFromComponent = jasmine
                .createSpy("openFromComponent")
                .and.returnValue(mockSnackBarRef);

            component.currentTabIndex.set(1);

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

    describe("errors", (): void => {
        it("should be handled gracefully when saving general settings", async (): Promise<void> => {
            mockErgSettingsService.changeLogLevel = jasmine
                .createSpy("changeLogLevel")
                .and.rejectWith(new Error("Service error"));

            const mockGeneralForm = createMockGeneralForm(true, {
                logLevel: 2,
                deltaTimeLogging: true,
                logToSdCard: true,
                bleMode: 1,
                heartRateMonitor: "ant",
            });

            spyOn(component, "generalSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            spyOn(component, "rowingSettings").and.returnValue({
                getForm: jasmine.createSpy("getForm").and.returnValue(
                    createMockRowingForm(false, {
                        machineSettings: {},
                        dragFactorSettings: {},
                        sensorSignalSettings: {},
                        strokeDetectionSettings: {},
                    }),
                ),
                saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(false);

            const mockSnackBarRef = {
                onAction: jasmine.createSpy("onAction").and.returnValue(of(true)),
            };
            mockSnackBar.openFromComponent = jasmine
                .createSpy("openFromComponent")
                .and.returnValue(mockSnackBarRef);

            component.currentTabIndex.set(1);

            await expectAsync(component.saveSettings()).toBeRejected();
        });

        it("should be handled when saving rowing settings", async (): Promise<void> => {
            const serviceErrors = [
                { service: "changeMachineSettings", error: "Machine settings error" },
                { service: "changeDragFactorSettings", error: "Drag factor error" },
                { service: "changeSensorSignalSettings", error: "Sensor signal error" },
                { service: "changeStrokeSettings", error: "Stroke settings error" },
            ];

            for (const { error } of serviceErrors) {
                mockErgSettingsService.changeMachineSettings = jasmine
                    .createSpy("changeMachineSettings")
                    .and.rejectWith(new Error(error));
                mockErgSettingsService.changeDragFactorSettings = jasmine
                    .createSpy("changeDragFactorSettings")
                    .and.rejectWith(new Error(error));
                mockErgSettingsService.changeSensorSignalSettings = jasmine
                    .createSpy("changeSensorSignalSettings")
                    .and.rejectWith(new Error(error));
                mockErgSettingsService.changeStrokeSettings = jasmine
                    .createSpy("changeStrokeSettings")
                    .and.rejectWith(new Error(error));

                const mockRowingForm = createMockRowingForm(true, {
                    machineSettings: { flywheelInertia: 0.06 },
                    dragFactorSettings: { goodnessOfFitThreshold: 0.95 },
                    sensorSignalSettings: { rotationDebounceTime: 30 },
                    strokeDetectionSettings: { minimumPoweredTorque: 0.02 },
                });

                const generalSettingsSpy = jasmine.createSpy("generalSettings").and.returnValue({
                    getForm: jasmine.createSpy("getForm").and.returnValue(createMockGeneralForm(false)),
                } as unknown as ReturnType<typeof component.generalSettings>);

                const rowingSettingsSpy = jasmine.createSpy("rowingSettings").and.returnValue({
                    getForm: jasmine.createSpy("getForm").and.returnValue(mockRowingForm),
                    saveAsCustomProfile: jasmine.createSpy("saveAsCustomProfile"),
                } as unknown as ReturnType<typeof component.rowingSettings>);

                (component as unknown as Record<string, unknown>).generalSettings = generalSettingsSpy;
                (component as unknown as Record<string, unknown>).rowingSettings = rowingSettingsSpy;

                component.onGeneralFormValidityChange(false);
                component.onRowingFormValidityChange(true);

                component.currentTabIndex.set(0);

                await expectAsync(component.saveSettings()).toBeRejected();
            }
        });
    });
});
