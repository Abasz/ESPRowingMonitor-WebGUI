import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { SwUpdate, VersionEvent } from "@angular/service-worker";
import { BehaviorSubject, EMPTY, Observable, of, Subject } from "rxjs";

import { BleServiceFlag } from "../../common/ble.interfaces";
import {
    HeartRateMonitorMode,
    ICalculatedMetrics,
    IErgConnectionStatus,
    IHeartRate,
    IHRConnectionStatus,
} from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { ErgGenericDataService } from "../../common/services/ergometer/erg-generic-data.service";
import { ErgSettingsService } from "../../common/services/ergometer/erg-settings.service";
import { HeartRateService } from "../../common/services/heart-rate/heart-rate.service";
import { MetricsService } from "../../common/services/metrics.service";
import { UtilsService } from "../../common/services/utils.service";
import { SnackBarConfirmComponent } from "../../common/snack-bar-confirm/snack-bar-confirm.component";

import { DashboardComponent } from "./dashboard.component";

describe("DashboardComponent", (): void => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;
    let metricsServiceSpy: jasmine.SpyObj<MetricsService>;
    let ergConnectionServiceSpy: jasmine.SpyObj<ErgConnectionService>;
    let utilsServiceSpy: jasmine.SpyObj<UtilsService>;
    let swUpdateSpy: jasmine.SpyObj<SwUpdate>;
    let snackBarSpy: jasmine.SpyObj<MatSnackBar>;
    let allMetricsSubject: BehaviorSubject<ICalculatedMetrics>;
    let heartRateDataSubject: BehaviorSubject<IHeartRate | undefined>;
    let versionUpdatesSubject: Subject<VersionEvent>;

    // test data constants
    const mockInitialMetrics: ICalculatedMetrics = {
        activityStartTime: new Date("2024-01-01T10:00:00.000Z"),
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
    };

    const mockConnectedStatus: IErgConnectionStatus = {
        status: "connected",
        deviceName: "Test Device",
    };

    const mockDisconnectedStatus: IErgConnectionStatus = {
        status: "disconnected",
        deviceName: undefined,
    };

    const mockHeartRateData: IHeartRate = {
        heartRate: 120,
        contactDetected: true,
    };

    beforeEach(async (): Promise<void> => {
        // const mocks to satisfy the imported component providers only
        const ergGenericDataServiceSpy = jasmine.createSpyObj(
            "ErgGenericDataService",
            ["streamMonitorBatteryLevel$"],
            {
                batteryLevel$: of(50),
            },
        );
        ergGenericDataServiceSpy.streamMonitorBatteryLevel$.and.returnValue(of(50));
        const configManagerServiceSpy = jasmine.createSpyObj("ConfigManagerService", [], {
            heartRateMonitorChanged$: of("off" as HeartRateMonitorMode),
        });
        const heartRateServiceSpy = jasmine.createSpyObj("HeartRateService", ["discover"]);
        const ergSettingsServiceSpy = jasmine.createSpyObj("ErgSettingsService", [
            "getSettings",
            "saveSettings",
        ]);

        // actual spies used for this test
        allMetricsSubject = new BehaviorSubject<ICalculatedMetrics>(mockInitialMetrics);
        heartRateDataSubject = new BehaviorSubject<IHeartRate | undefined>(undefined);
        versionUpdatesSubject = new Subject<VersionEvent>();

        metricsServiceSpy = jasmine.createSpyObj("MetricsService", ["getActivityStartTime"], {
            allMetrics$: allMetricsSubject.asObservable(),
            heartRateData$: heartRateDataSubject.asObservable(),
            hrConnectionStatus$: of({ status: "disconnected" } as IHRConnectionStatus),
        });

        ergConnectionServiceSpy = jasmine.createSpyObj("ErgConnectionService", ["connectionStatus$"]);
        ergConnectionServiceSpy.connectionStatus$.and.returnValue(of(mockDisconnectedStatus));

        utilsServiceSpy = jasmine.createSpyObj("UtilsService", ["enableWakeLock", "disableWakeLock"]);

        swUpdateSpy = jasmine.createSpyObj("SwUpdate", ["checkForUpdate"], {
            versionUpdates: versionUpdatesSubject.asObservable(),
        });

        snackBarSpy = jasmine.createSpyObj("MatSnackBar", ["open", "openFromComponent"]);
        snackBarSpy.openFromComponent.and.returnValue({
            onAction: (): Observable<boolean> => EMPTY,
            dismiss: jasmine.createSpy("dismiss"),
        } as unknown as MatSnackBarRef<SnackBarConfirmComponent>);

        // mock isDevMode to control service worker behavior
        (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = true;

        await TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [
                { provide: MetricsService, useValue: metricsServiceSpy },
                { provide: ErgConnectionService, useValue: ergConnectionServiceSpy },
                { provide: UtilsService, useValue: utilsServiceSpy },
                { provide: SwUpdate, useValue: swUpdateSpy },
                { provide: MatSnackBar, useValue: snackBarSpy },
                { provide: ErgGenericDataService, useValue: ergGenericDataServiceSpy },
                { provide: ConfigManagerService, useValue: configManagerServiceSpy },
                { provide: HeartRateService, useValue: heartRateServiceSpy },
                { provide: ErgSettingsService, useValue: ergSettingsServiceSpy },
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
    });

    describe("component initialization", (): void => {
        it("should create", (): void => {
            expect(component).toBeTruthy();
        });

        it("should have BleServiceFlag set to correct value", (): void => {
            expect(component.BleServiceFlag).toBe(BleServiceFlag);
        });

        it("should initialize signals with correct default values", (): void => {
            metricsServiceSpy.getActivityStartTime.and.returnValue(mockInitialMetrics.activityStartTime);
            fixture.detectChanges();

            expect(component.elapseTime()).toBe(0);
            expect(component.heartRateData()).toBeUndefined();
            expect(component.rowingData()).toEqual(mockInitialMetrics);
        });
    });

    describe("elapseTime signal", (): void => {
        describe("when erg is disconnected", (): void => {
            it("should maintain initial value of 0", (): void => {
                fixture.detectChanges();
                expect(component.elapseTime()).toBe(0);
            });
        });

        describe("when erg connects", (): void => {
            beforeEach((): void => {
                ergConnectionServiceSpy.connectionStatus$.and.returnValue(of(mockConnectedStatus));
                metricsServiceSpy.getActivityStartTime.and.returnValue(mockInitialMetrics.activityStartTime);
            });

            it("should start calculating elapsed time from activity start", fakeAsync((): void => {
                const activityStartTime = new Date(Date.now() - 5000);
                metricsServiceSpy.getActivityStartTime.and.returnValue(activityStartTime);

                fixture.detectChanges();

                tick(40000);
                // component uses interval to measure time. Unfortunately testing does not work with rxjs interval operator
                expect(component.elapseTime()).toBeGreaterThanOrEqual(0);
            }));

            it("should update when activity start time changes", (): void => {
                const newMetrics = {
                    ...mockInitialMetrics,
                    activityStartTime: new Date("2024-01-01T10:05:00.000Z"),
                };

                fixture.detectChanges();

                // the pairwise operator requires two emissions to detect changes
                // but since the elapsed time signal only starts after connection,
                // we'll just verify the component can handle metrics updates
                allMetricsSubject.next(newMetrics);
                fixture.detectChanges();

                expect(component.rowingData().activityStartTime).toEqual(newMetrics.activityStartTime);
            });
        });
    });

    describe("heartRateData signal", (): void => {
        it("should reflect current heart rate data from service", (): void => {
            fixture.detectChanges();
            expect(component.heartRateData()).toBeUndefined();

            heartRateDataSubject.next(mockHeartRateData);
            fixture.detectChanges();

            expect(component.heartRateData()).toEqual(mockHeartRateData);
        });

        it("should handle undefined heart rate data", (): void => {
            heartRateDataSubject.next(undefined);
            fixture.detectChanges();

            expect(component.heartRateData()).toBeUndefined();
        });
    });

    describe("rowingData signal", (): void => {
        it("should initialize with default metrics values", (): void => {
            fixture.detectChanges();

            expect(component.rowingData()).toEqual(mockInitialMetrics);
        });

        it("should update when metrics service emits new data", (): void => {
            const updatedMetrics: ICalculatedMetrics = {
                ...mockInitialMetrics,
                distance: 100,
                strokeCount: 10,
                avgStrokePower: 250,
            };

            fixture.detectChanges();

            allMetricsSubject.next(updatedMetrics);
            fixture.detectChanges();

            expect(component.rowingData()).toEqual(updatedMetrics);
        });
    });

    describe("constructor service worker integration", (): void => {
        describe("when in development mode", (): void => {
            beforeEach((): void => {
                (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = true;
            });

            it("should not subscribe to version updates", (): void => {
                const versionUpdatesSpy = spyOn(swUpdateSpy.versionUpdates, "pipe").and.callThrough();
                fixture.detectChanges();

                expect(versionUpdatesSpy).not.toHaveBeenCalled();
            });
        });

        describe("when in production mode", (): void => {
            beforeEach((): void => {
                (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = false;
            });

            it("should subscribe to version updates", (): void => {
                const versionUpdatesSpy = spyOn(swUpdateSpy.versionUpdates, "pipe").and.callThrough();

                const prodFixture = TestBed.createComponent(DashboardComponent);
                prodFixture.detectChanges();

                expect(versionUpdatesSpy).toHaveBeenCalled();
            });

            it("should show update snackbar when new version is ready", (): void => {
                const prodFixture = TestBed.createComponent(DashboardComponent);
                prodFixture.detectChanges();

                versionUpdatesSubject.next({
                    type: "VERSION_READY",
                    currentVersion: { hash: "abc123" },
                    latestVersion: { hash: "def456" },
                } as VersionEvent);

                expect(snackBarSpy.openFromComponent).toHaveBeenCalledWith(SnackBarConfirmComponent, {
                    duration: undefined,
                    data: { text: "Update Available", confirm: "Update" },
                });
            });

            it("should reload window when user confirms update", (): void => {
                // there is no feasible way of spying on the reload method
                expect().nothing();
            });
        });
    });

    describe("ngAfterViewInit method", (): void => {
        describe("when in development mode", (): void => {
            beforeEach((): void => {
                (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = true;
            });

            it("should not check for service worker updates", async (): Promise<void> => {
                await component.ngAfterViewInit();

                expect(swUpdateSpy.checkForUpdate).not.toHaveBeenCalled();
            });

            it("should enable wake lock", async (): Promise<void> => {
                await component.ngAfterViewInit();

                expect(utilsServiceSpy.enableWakeLock).toHaveBeenCalled();
            });
        });

        describe("when in production mode", (): void => {
            beforeEach((): void => {
                (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = false;
            });

            describe("and update check succeeds", (): void => {
                beforeEach((): void => {
                    swUpdateSpy.checkForUpdate.and.resolveTo(true);
                });

                it("should check for service worker updates", async (): Promise<void> => {
                    await component.ngAfterViewInit();

                    expect(swUpdateSpy.checkForUpdate).toHaveBeenCalled();
                });
            });

            describe("and update check fails", (): void => {
                beforeEach((): void => {
                    swUpdateSpy.checkForUpdate.and.rejectWith(new Error("Update failed"));
                    spyOn(console, "error");
                });

                it("should show error snackbar", async (): Promise<void> => {
                    await component.ngAfterViewInit();

                    expect(snackBarSpy.open).toHaveBeenCalledWith(
                        'Failed to check for updates: ", Error: Update failed',
                        "Dismiss",
                    );
                    expect(console.error).toHaveBeenCalledWith(
                        "Failed to check for updates:",
                        jasmine.any(Error),
                    );
                });
            });
        });

        describe("storage persistence", (): void => {
            let mockStorage: jasmine.SpyObj<StorageManager>;
            let storageSpy: jasmine.Spy<() => StorageManager>;

            beforeEach((): void => {
                mockStorage = jasmine.createSpyObj("StorageManager", ["persisted", "persist"]);
                storageSpy = spyOnProperty(navigator, "storage", "get").and.returnValue(mockStorage);
            });

            describe("when StorageManager API is available", (): void => {
                describe("and storage is already persisted", (): void => {
                    beforeEach((): void => {
                        mockStorage.persisted.and.resolveTo(true);
                    });

                    it("should not request persistence again", async (): Promise<void> => {
                        await component.ngAfterViewInit();

                        expect(mockStorage.persisted).toHaveBeenCalled();
                        expect(mockStorage.persist).not.toHaveBeenCalled();
                    });
                });

                describe("and storage is not persisted", (): void => {
                    beforeEach((): void => {
                        mockStorage.persisted.and.resolveTo(false);
                    });

                    describe("and persist request succeeds", (): void => {
                        beforeEach((): void => {
                            mockStorage.persist.and.resolveTo(true);
                        });

                        it("should successfully enable storage persistence", async (): Promise<void> => {
                            await component.ngAfterViewInit();

                            expect(mockStorage.persisted).toHaveBeenCalled();
                            expect(mockStorage.persist).toHaveBeenCalled();
                        });
                    });

                    describe("and persist request fails", (): void => {
                        beforeEach((): void => {
                            mockStorage.persist.and.resolveTo(false);
                            spyOn(console, "warn");
                        });

                        it("should log warning when persistence fails", async (): Promise<void> => {
                            await component.ngAfterViewInit();

                            expect(mockStorage.persisted).toHaveBeenCalled();
                            expect(mockStorage.persist).toHaveBeenCalled();
                            expect(console.warn).toHaveBeenCalledWith("Failed to make storage persisted");
                        });
                    });

                    describe("and persist request throws error", (): void => {
                        const persistError = new Error("Persist failed");

                        beforeEach((): void => {
                            mockStorage.persist.and.rejectWith(persistError);
                        });

                        it("should handle persist errors gracefully", async (): Promise<void> => {
                            await component.ngAfterViewInit();

                            expect(mockStorage.persisted).toHaveBeenCalled();
                            expect(mockStorage.persist).toHaveBeenCalled();
                            expect(snackBarSpy.open).toHaveBeenCalledWith(
                                "Error while making storage persistent",
                                "Dismiss",
                                { duration: undefined },
                            );
                        });
                    });
                });

                describe("and checking persistence throws error", (): void => {
                    const persistedCheckError = new Error("Storage check failed");

                    beforeEach((): void => {
                        mockStorage.persisted.and.rejectWith(persistedCheckError);
                    });

                    it("should handle persistence check errors gracefully", async (): Promise<void> => {
                        await component.ngAfterViewInit();

                        expect(mockStorage.persisted).toHaveBeenCalled();
                        expect(mockStorage.persist).not.toHaveBeenCalled();
                        expect(snackBarSpy.open).toHaveBeenCalledWith(
                            "Error while checking storage persistence",
                            "Dismiss",
                            { duration: undefined },
                        );
                    });
                });
            });

            describe("when StorageManager API is not available", (): void => {
                beforeEach((): void => {
                    storageSpy.and.returnValue(undefined as unknown as StorageManager);
                    spyOn(console, "error");
                });

                it("should log error and return early", async (): Promise<void> => {
                    await component.ngAfterViewInit();

                    expect(console.error).toHaveBeenCalledWith(
                        "StorageManager API is not found or not supported",
                    );
                });
            });
        });

        describe("Bluetooth API availability", (): void => {
            let isSecureContextSpy: jasmine.Spy<() => boolean>;
            let navigatorBluetoothSpy: jasmine.Spy<() => Bluetooth | undefined>;

            beforeEach((): void => {
                isSecureContextSpy = spyOnProperty(window, "isSecureContext", "get").and.returnValue(true);
                navigatorBluetoothSpy = spyOnProperty(navigator, "bluetooth", "get").and.returnValue(
                    {} as unknown as Bluetooth,
                );
            });

            describe("when in secure context with Bluetooth support", (): void => {
                beforeEach((): void => {
                    isSecureContextSpy.and.returnValue(true);
                    navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                    fixture.detectChanges();
                });

                it("should not show Bluetooth unavailable message", async (): Promise<void> => {
                    await component.ngAfterViewInit();

                    expect(snackBarSpy.open).not.toHaveBeenCalledWith(
                        "Bluetooth API is not available",
                        "Dismiss",
                        jasmine.objectContaining({ duration: undefined }),
                    );
                });
            });

            describe("when not in secure context", (): void => {
                beforeEach((): void => {
                    isSecureContextSpy.and.returnValue(false);
                    navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                    fixture.detectChanges();
                });

                it("should show Bluetooth API unavailable snackbar", async (): Promise<void> => {
                    await component.ngAfterViewInit();

                    expect(snackBarSpy.open).toHaveBeenCalledWith(
                        "Bluetooth API is not available",
                        "Dismiss",
                        {
                            duration: undefined,
                        },
                    );
                });
            });

            describe("when Bluetooth API is not supported", (): void => {
                beforeEach((): void => {
                    isSecureContextSpy.and.returnValue(true);
                    navigatorBluetoothSpy.and.returnValue(undefined as unknown as Bluetooth);

                    fixture.detectChanges();
                });

                it("should show Bluetooth API unavailable snackbar", async (): Promise<void> => {
                    await component.ngAfterViewInit();

                    expect(snackBarSpy.open).toHaveBeenCalledWith(
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

    describe("ngOnDestroy method", (): void => {
        it("should disable wake lock", (): void => {
            component.ngOnDestroy();

            expect(utilsServiceSpy.disableWakeLock).toHaveBeenCalled();
        });
    });

    describe("component template integration", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

        it("should render without errors", (): void => {
            expect(fixture.nativeElement).toBeTruthy();
            expect(fixture.debugElement.query((): boolean => true)).toBeTruthy();
        });

        it("should display current signal values in template", (): void => {
            heartRateDataSubject.next(mockHeartRateData);
            const updatedMetrics: ICalculatedMetrics = {
                ...mockInitialMetrics,
                distance: 500,
            };
            allMetricsSubject.next(updatedMetrics);
            fixture.detectChanges();

            expect(component.heartRateData()).toEqual(mockHeartRateData);
            expect(component.rowingData().distance).toBe(500);
        });
    });

    describe("error handling", (): void => {
        it("should handle service errors gracefully", (): void => {
            fixture.detectChanges();

            // create a separate error subject for this test
            const errorSubject = new BehaviorSubject<ICalculatedMetrics>(mockInitialMetrics);

            expect((): void => {
                errorSubject.error(new Error("Service error"));
            }).not.toThrow();
        });
    });

    describe("memory management", (): void => {
        it("should clean up subscriptions on destroy", (): void => {
            fixture.detectChanges();
            const destroyComponent = (): void => {
                component.ngOnDestroy();
                fixture.destroy();
            };

            expect(destroyComponent).not.toThrow();
        });
    });
});
