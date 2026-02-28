import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { SwUpdate } from "@angular/service-worker";
import { BehaviorSubject, EMPTY, of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
} from "./settings-dialog.test.helpers";

describe("SettingsDialogComponent error handling", (): void => {
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
    let breakpointSubject: BehaviorSubject<{ maxW599: boolean }>;

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

        breakpointSubject = new BehaviorSubject<{ maxW599: boolean }>({ maxW599: false });

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
