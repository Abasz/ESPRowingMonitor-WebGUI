import { provideZonelessChangeDetection, signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatIconRegistry } from "@angular/material/icon";
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { SwUpdate, VersionEvent } from "@angular/service-worker";
import { EMPTY, Observable, of, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { IDeviceInformation } from "../common/ble.interfaces";
import { ICalculatedMetrics, IErgConnectionStatus, IHeartRate } from "../common/common.interfaces";
import { DataRecorderService } from "../common/services/data-recorder.service";
import { ErgConnectionService } from "../common/services/ergometer/erg-connection.service";
import { ErgGenericDataService } from "../common/services/ergometer/erg-generic-data.service";
import { FirmwareUpdateManagerService } from "../common/services/ergometer/firmware-update-manager.service";
import { MetricsService } from "../common/services/metrics.service";
import { UtilsService } from "../common/services/utils.service";
import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";

import { AppComponent } from "./app.component";

describe("AppComponent", (): void => {
    let component: AppComponent;
    let fixture: ComponentFixture<AppComponent>;
    let matIconRegistrySpy: Pick<MatIconRegistry, "setDefaultFontSetClass">;
    let swUpdateSpy: Pick<SwUpdate, "checkForUpdate" | "versionUpdates" | "isEnabled">;
    let snackBarSpy: Pick<MatSnackBar, "open" | "openFromComponent">;
    let ergConnectionServiceSpy: Pick<ErgConnectionService, "connectionStatus$">;
    let ergGenericDataServiceSpy: Pick<ErgGenericDataService, "deviceInfo">;
    let firmwareUpdateManagerSpy: Pick<
        FirmwareUpdateManagerService,
        "openFirmwareSelector" | "isUpdateAvailable"
    >;
    let versionUpdatesSubject: Subject<VersionEvent>;
    let connectionStatusSubject: Subject<IErgConnectionStatus>;
    let isUpdateAvailableSignal: WritableSignal<undefined | boolean>;
    let deviceInfoSignal: WritableSignal<IDeviceInformation>;

    beforeEach(async (): Promise<void> => {
        versionUpdatesSubject = new Subject<VersionEvent>();
        connectionStatusSubject = new Subject<IErgConnectionStatus>();

        matIconRegistrySpy = {
            setDefaultFontSetClass: vi.fn(),
        };

        swUpdateSpy = {
            checkForUpdate: vi.fn(),
            versionUpdates: versionUpdatesSubject.asObservable(),
            isEnabled: true,
        };

        snackBarSpy = {
            open: vi.fn(),
            openFromComponent: vi.fn(),
        };
        vi.mocked(snackBarSpy.openFromComponent).mockReturnValue({
            onAction: (): Observable<void> => EMPTY,
            dismiss: vi.fn(),
        } as unknown as MatSnackBarRef<SnackBarConfirmComponent>);

        ergConnectionServiceSpy = {
            connectionStatus$: vi.fn(),
        };
        vi.mocked(ergConnectionServiceSpy.connectionStatus$).mockReturnValue(
            connectionStatusSubject.asObservable(),
        );

        deviceInfoSignal = signal<IDeviceInformation>({
            hardwareRevision: "devkit-v1",
        } as IDeviceInformation);
        ergGenericDataServiceSpy = {
            deviceInfo: deviceInfoSignal,
        };

        isUpdateAvailableSignal = signal<undefined | boolean>(undefined);
        firmwareUpdateManagerSpy = {
            openFirmwareSelector: vi.fn(),
            isUpdateAvailable: isUpdateAvailableSignal,
        };

        const mockMetricsService = {
            heartRateData$: of({ heartRate: 75 } as IHeartRate),
            allMetrics$: of({
                activityStartTime: new Date(),
                avgStrokePower: 0,
                driveDuration: 0,
                recoveryDuration: 0,
                dragFactor: 0,
                distance: 0,
                strokeCount: 0,
                handleForces: [],
                peakForce: 0,
                strokeRate: 0,
                speed: 0,
                distPerStroke: 0,
            } as ICalculatedMetrics),
            ergConnectionStatus$: of({ status: "connected" } as IErgConnectionStatus),
            getActivityStartTime: (): Date => new Date(),
            ergBatteryLevel$: of(80),
            hrConnectionStatus$: of({ status: "connected" }),
            settings: of({ bleServiceFlag: 0, logLevel: 1 }),
        };

        const mockUtilsService = {
            enableWakeLock: vi.fn(),
            disableWakeLock: vi.fn(),
        };

        const mockDataRecorderService = {
            getSessionSummaries$: vi.fn().mockReturnValue(of([])),
        };

        await TestBed.configureTestingModule({
            providers: [
                { provide: MatIconRegistry, useValue: matIconRegistrySpy },
                { provide: SwUpdate, useValue: swUpdateSpy },
                { provide: MatSnackBar, useValue: snackBarSpy },
                { provide: ErgConnectionService, useValue: ergConnectionServiceSpy },
                { provide: ErgGenericDataService, useValue: ergGenericDataServiceSpy },
                { provide: FirmwareUpdateManagerService, useValue: firmwareUpdateManagerSpy },
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: UtilsService, useValue: mockUtilsService },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                provideZonelessChangeDetection(),
            ],
            imports: [AppComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(AppComponent);
        component = fixture.componentInstance;
    });

    describe("as part of component creation", (): void => {
        it("should create the app", (): void => {
            expect(component).toBeTruthy();
        });

        it("should set default font set class for Material icons", (): void => {
            expect(matIconRegistrySpy.setDefaultFontSetClass).toHaveBeenCalledWith("material-symbols-sharp");
        });
    });

    describe("as part of firmware update check functionality", (): void => {
        beforeEach((): void => {
            vi.useFakeTimers();
        });

        afterEach((): void => {
            vi.useRealTimers();
        });

        it("should subscribe to connection status changes on component creation", (): void => {
            expect(ergConnectionServiceSpy.connectionStatus$).toHaveBeenCalled();
        });

        it("should check isUpdateAvailable when device connects after 5 second delay", async (): Promise<void> => {
            connectionStatusSubject.next({ status: "connected" } as IErgConnectionStatus);
            vi.spyOn(firmwareUpdateManagerSpy, "isUpdateAvailable");

            await vi.advanceTimersByTimeAsync(4000);
            expect(firmwareUpdateManagerSpy.isUpdateAvailable).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1000);
            expect(firmwareUpdateManagerSpy.isUpdateAvailable).toHaveBeenCalledTimes(1);
        });

        it("should only check isUpdateAvailable for connected status", async (): Promise<void> => {
            vi.spyOn(firmwareUpdateManagerSpy, "isUpdateAvailable");
            const statuses = ["connecting", "connected", "disconnected", "searching", "connecting"];

            for await (const status of statuses) {
                connectionStatusSubject.next({ status } as IErgConnectionStatus);
                await vi.advanceTimersByTimeAsync(5000);
            }

            expect(firmwareUpdateManagerSpy.isUpdateAvailable).toHaveBeenCalledTimes(1);

            connectionStatusSubject.next({ status: "connected" } as IErgConnectionStatus);
            await vi.advanceTimersByTimeAsync(5000);

            expect(firmwareUpdateManagerSpy.isUpdateAvailable).toHaveBeenCalledTimes(2);
        });

        describe("when firmware update is available", (): void => {
            beforeEach((): void => {
                isUpdateAvailableSignal.set(true);
            });

            it("should show notification for supported hardware with Update action", async (): Promise<void> => {
                const mockSnackBarRef = {
                    onAction: vi.fn().mockReturnValue(EMPTY),
                } as unknown as MatSnackBarRef<TextOnlySnackBar>;
                vi.mocked(snackBarSpy.open).mockReturnValue(mockSnackBarRef);

                deviceInfoSignal.set({
                    hardwareRevision: "devkit-v1",
                } as IDeviceInformation);

                connectionStatusSubject.next({ status: "connected" } as IErgConnectionStatus);
                await vi.advanceTimersByTimeAsync(5000);

                expect(vi.mocked(snackBarSpy.open)).toHaveBeenCalledWith(
                    "Firmware update available",
                    "Update",
                    {
                        duration: 30000,
                    },
                );
            });

            it("should call openFirmwareSelector when Update action is clicked for supported hardware", async (): Promise<void> => {
                const actionSubject = new Subject<void>();
                const mockSnackBarRef = {
                    onAction: vi.fn().mockReturnValue(actionSubject.asObservable()),
                } as unknown as MatSnackBarRef<TextOnlySnackBar>;
                vi.mocked(snackBarSpy.open).mockReturnValue(mockSnackBarRef);

                deviceInfoSignal.set({
                    hardwareRevision: "devkit-v1",
                } as IDeviceInformation);

                connectionStatusSubject.next({ status: "connected" } as IErgConnectionStatus);
                await vi.advanceTimersByTimeAsync(5000);

                actionSubject.next();
                await vi.runAllTimersAsync();

                expect(firmwareUpdateManagerSpy.openFirmwareSelector).toHaveBeenCalledWith("devkit-v1");
            });

            it("should show notification for custom hardware with GitHub action", async (): Promise<void> => {
                const mockSnackBarRef = {
                    onAction: vi.fn().mockReturnValue(EMPTY),
                } as unknown as MatSnackBarRef<TextOnlySnackBar>;
                vi.mocked(snackBarSpy.open).mockReturnValue(mockSnackBarRef);

                deviceInfoSignal.set({
                    hardwareRevision: "custom",
                } as IDeviceInformation);

                connectionStatusSubject.next({ status: "connected" } as IErgConnectionStatus);
                await vi.advanceTimersByTimeAsync(5000);

                expect(vi.mocked(snackBarSpy.open)).toHaveBeenCalledWith(
                    "Firmware update available for custom board",
                    "View on GitHub",
                    {
                        duration: 30000,
                    },
                );
            });

            it("should open GitHub releases page when action is clicked for custom hardware", async (): Promise<void> => {
                const windowOpenSpy = vi.spyOn(globalThis, "open").mockImplementation((): null => null);

                const actionSubject = new Subject<void>();
                const mockSnackBarRef = {
                    onAction: vi.fn().mockReturnValue(actionSubject.asObservable()),
                } as unknown as MatSnackBarRef<TextOnlySnackBar>;
                vi.mocked(snackBarSpy.open).mockReturnValue(mockSnackBarRef);

                deviceInfoSignal.set({
                    hardwareRevision: "custom",
                } as IDeviceInformation);

                connectionStatusSubject.next({ status: "connected" } as IErgConnectionStatus);
                await vi.advanceTimersByTimeAsync(5000);

                actionSubject.next();
                await vi.runAllTimersAsync();

                expect(windowOpenSpy).toHaveBeenCalledWith(
                    FirmwareUpdateManagerService.FIRMWARE_RELEASE_URL,
                    "_blank",
                );
                windowOpenSpy.mockRestore();
            });

            it("should show notification for missing hardware revision with GitHub action", async (): Promise<void> => {
                const mockSnackBarRef = {
                    onAction: vi.fn().mockReturnValue(EMPTY),
                } as unknown as MatSnackBarRef<TextOnlySnackBar>;
                vi.mocked(snackBarSpy.open).mockReturnValue(mockSnackBarRef);

                deviceInfoSignal.set({} as IDeviceInformation);

                connectionStatusSubject.next({ status: "connected" } as IErgConnectionStatus);
                await vi.advanceTimersByTimeAsync(5000);

                expect(vi.mocked(snackBarSpy.open)).toHaveBeenCalledWith(
                    "Firmware update available for custom board",
                    "View on GitHub",
                    {
                        duration: 30000,
                    },
                );
            });
        });

        describe("when no firmware update is available", (): void => {
            it("should not show notification", async (): Promise<void> => {
                isUpdateAvailableSignal.set(false);

                connectionStatusSubject.next({
                    status: "connected",
                    deviceName: "test-device",
                } as IErgConnectionStatus);
                await vi.advanceTimersByTimeAsync(5000);

                expect(snackBarSpy.open).not.toHaveBeenCalledWith(
                    expect.stringMatching(/Firmware update available.*/),
                    expect.any(String),
                    expect.any(Object),
                );
            });
        });
    });

    describe("constructor service worker integration", (): void => {
        it("should not subscribe to version updates when service worker is disabled", (): void => {
            vi.spyOn(swUpdateSpy, "isEnabled", "get").mockReturnValue(false);
            const versionUpdatesSpy = vi.spyOn(swUpdateSpy.versionUpdates, "pipe");

            expect(versionUpdatesSpy).not.toHaveBeenCalled();
        });

        describe("when in production mode", (): void => {
            beforeEach((): void => {
                vi.spyOn(swUpdateSpy, "isEnabled", "get").mockReturnValue(true);
            });

            it("should subscribe to version updates", async (): Promise<void> => {
                const versionUpdatesSpy = vi.spyOn(swUpdateSpy.versionUpdates, "pipe");

                TestBed.createComponent(AppComponent);

                expect(versionUpdatesSpy).toHaveBeenCalled();
            });

            it("should show update snackbar when new version is ready", (): void => {
                versionUpdatesSubject.next({
                    type: "VERSION_READY",
                    currentVersion: { hash: "abc123" },
                    latestVersion: { hash: "def456" },
                } as VersionEvent);

                expect(vi.mocked(snackBarSpy.openFromComponent)).toHaveBeenCalledWith(
                    SnackBarConfirmComponent,
                    {
                        duration: undefined,
                        data: { text: "Update Available", confirm: "Update" },
                    },
                );
            });

            it("should reload window when user confirms update", (): void => {
                // there is no feasible way of spying on the reload method
                // No expectation needed here
            });
        });
    });

    describe("ngAfterViewInit method", (): void => {
        it("should not check for service worker updates when service worker is disabled", async (): Promise<void> => {
            vi.spyOn(swUpdateSpy, "isEnabled", "get").mockReturnValue(false);

            await component.ngAfterViewInit();

            expect(swUpdateSpy.checkForUpdate).not.toHaveBeenCalled();
        });

        describe("when in production mode", (): void => {
            beforeEach((): void => {
                vi.spyOn(swUpdateSpy, "isEnabled", "get").mockReturnValue(true);
            });

            it("should check for service worker updates when update check succeeds", async (): Promise<void> => {
                vi.mocked(swUpdateSpy.checkForUpdate).mockResolvedValue(true);

                await component.ngAfterViewInit();

                expect(vi.mocked(swUpdateSpy.checkForUpdate)).toHaveBeenCalled();
            });

            it("should show error snackbar when update check fails", async (): Promise<void> => {
                vi.mocked(swUpdateSpy.checkForUpdate).mockRejectedValue(new Error("Update failed"));
                vi.spyOn(console, "error");

                await component.ngAfterViewInit();

                expect(vi.mocked(snackBarSpy.open)).toHaveBeenCalledWith(
                    'Failed to check for updates: ", Error: Update failed',
                    "Dismiss",
                );
                expect(console.error).toHaveBeenCalledWith("Failed to check for updates:", expect.any(Error));
            });
        });

        describe("storage persistence", (): void => {
            let mockStorage: Pick<StorageManager, "persisted" | "persist">;
            let storageSpy: Mock;

            beforeEach((): void => {
                mockStorage = {
                    persisted: vi.fn(),
                    persist: vi.fn(),
                };
                storageSpy = vi
                    .spyOn(navigator, "storage", "get")
                    .mockReturnValue(mockStorage as unknown as StorageManager);
            });

            describe("when StorageManager API is available", (): void => {
                it("and storage is already persisted should not request persistence again", async (): Promise<void> => {
                    vi.mocked(mockStorage.persisted).mockResolvedValue(true);

                    await component.ngAfterViewInit();

                    expect(vi.mocked(mockStorage.persisted)).toHaveBeenCalled();
                    expect(vi.mocked(mockStorage.persist)).not.toHaveBeenCalled();
                });

                describe("and storage is not persisted", (): void => {
                    beforeEach((): void => {
                        vi.mocked(mockStorage.persisted).mockResolvedValue(false);
                    });

                    it("should successfully enable storage persistence when persist succeeds", async (): Promise<void> => {
                        vi.mocked(mockStorage.persist).mockResolvedValue(true);

                        await component.ngAfterViewInit();

                        expect(vi.mocked(mockStorage.persisted)).toHaveBeenCalled();
                        expect(vi.mocked(mockStorage.persist)).toHaveBeenCalled();
                    });

                    it("should log warning when persistence fails", async (): Promise<void> => {
                        vi.mocked(mockStorage.persist).mockResolvedValue(false);
                        vi.spyOn(console, "warn");

                        await component.ngAfterViewInit();

                        expect(vi.mocked(mockStorage.persisted)).toHaveBeenCalled();
                        expect(vi.mocked(mockStorage.persist)).toHaveBeenCalled();
                        expect(console.warn).toHaveBeenCalledWith("Failed to make storage persisted");
                    });

                    it("should handle persist errors gracefully", async (): Promise<void> => {
                        const persistError = new Error("Persist failed");
                        vi.mocked(mockStorage.persist).mockRejectedValue(persistError);

                        await component.ngAfterViewInit();

                        expect(vi.mocked(mockStorage.persisted)).toHaveBeenCalled();
                        expect(vi.mocked(mockStorage.persist)).toHaveBeenCalled();
                        expect(vi.mocked(snackBarSpy.open)).toHaveBeenCalledWith(
                            "Error while making storage persistent",
                            "Dismiss",
                            { duration: undefined },
                        );
                    });
                });

                describe("and checking persistence throws error", (): void => {
                    const persistedCheckError = new Error("Storage check failed");

                    beforeEach((): void => {
                        vi.mocked(mockStorage.persisted).mockRejectedValue(persistedCheckError);
                    });

                    it("should handle persistence check errors gracefully", async (): Promise<void> => {
                        await component.ngAfterViewInit();

                        expect(vi.mocked(mockStorage.persisted)).toHaveBeenCalled();
                        expect(vi.mocked(mockStorage.persist)).not.toHaveBeenCalled();
                        expect(vi.mocked(snackBarSpy.open)).toHaveBeenCalledWith(
                            "Error while checking storage persistence",
                            "Dismiss",
                            { duration: undefined },
                        );
                    });
                });
            });

            it("should log error and return early when StorageManager API not available", async (): Promise<void> => {
                storageSpy.mockReturnValue(undefined as unknown as StorageManager);
                vi.spyOn(console, "error");

                await component.ngAfterViewInit();

                expect(console.error).toHaveBeenCalledWith(
                    "StorageManager API is not found or not supported",
                );
            });
        });

        describe("as part of the Bluetooth API availability check", (): void => {
            let isSecureContextSpy: Mock;
            let navigatorBluetoothSpy: Mock;

            beforeEach((): void => {
                isSecureContextSpy = vi.spyOn(window, "isSecureContext", "get").mockReturnValue(true);
                navigatorBluetoothSpy = vi
                    .spyOn(navigator, "bluetooth", "get")
                    .mockReturnValue({} as unknown as Bluetooth);
            });

            it("should not show Bluetooth unavailable message when in secure context with Bluetooth support", async (): Promise<void> => {
                isSecureContextSpy.mockReturnValue(true);
                navigatorBluetoothSpy.mockReturnValue({} as unknown as Bluetooth);

                await component.ngAfterViewInit();

                expect(vi.mocked(snackBarSpy.open)).not.toHaveBeenCalledWith(
                    "Bluetooth API is not available",
                    "Dismiss",
                    expect.objectContaining({ duration: undefined }),
                );
            });

            it("should show Bluetooth API unavailable snackbar when not in secure context", async (): Promise<void> => {
                isSecureContextSpy.mockReturnValue(false);
                navigatorBluetoothSpy.mockReturnValue({} as unknown as Bluetooth);

                await component.ngAfterViewInit();

                expect(vi.mocked(snackBarSpy.open)).toHaveBeenCalledWith(
                    "Bluetooth API is not available",
                    "Dismiss",
                    {
                        duration: undefined,
                    },
                );
            });

            it("should show Bluetooth API unavailable snackbar when Bluetooth API not supported", async (): Promise<void> => {
                isSecureContextSpy.mockReturnValue(true);
                navigatorBluetoothSpy.mockReturnValue(undefined as unknown as Bluetooth);

                await component.ngAfterViewInit();

                expect(vi.mocked(snackBarSpy.open)).toHaveBeenCalledWith(
                    "Bluetooth API is not available",
                    "Dismiss",
                    {
                        duration: undefined,
                    },
                );
            });
        });
    });
});
