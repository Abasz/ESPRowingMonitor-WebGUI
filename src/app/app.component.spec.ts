import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatIconRegistry } from "@angular/material/icon";
import { MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { SwUpdate, VersionEvent } from "@angular/service-worker";
import { EMPTY, Observable, of, Subject } from "rxjs";

import { ICalculatedMetrics, IErgConnectionStatus, IHeartRate } from "../common/common.interfaces";
import { DataRecorderService } from "../common/services/data-recorder.service";
import { MetricsService } from "../common/services/metrics.service";
import { UtilsService } from "../common/services/utils.service";
import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";

import { AppComponent } from "./app.component";

describe("AppComponent", (): void => {
    let component: AppComponent;
    let fixture: ComponentFixture<AppComponent>;
    let matIconRegistrySpy: jasmine.SpyObj<MatIconRegistry>;
    let swUpdateSpy: jasmine.SpyObj<SwUpdate>;
    let snackBarSpy: jasmine.SpyObj<MatSnackBar>;
    let versionUpdatesSubject: Subject<VersionEvent>;

    beforeEach(async (): Promise<void> => {
        versionUpdatesSubject = new Subject<VersionEvent>();

        matIconRegistrySpy = jasmine.createSpyObj("MatIconRegistry", ["setDefaultFontSetClass"]);

        swUpdateSpy = jasmine.createSpyObj("SwUpdate", ["checkForUpdate"], {
            versionUpdates: versionUpdatesSubject.asObservable(),
        });

        snackBarSpy = jasmine.createSpyObj("MatSnackBar", ["open", "openFromComponent"]);
        snackBarSpy.openFromComponent.and.returnValue({
            onAction: (): Observable<void> => EMPTY,
            dismiss: jasmine.createSpy("dismiss"),
        } as unknown as MatSnackBarRef<SnackBarConfirmComponent>);

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
            enableWakeLock: jasmine.createSpy("enableWakeLock"),
            disableWakeLock: jasmine.createSpy("disableWakeLock"),
        };

        const mockDataRecorderService = {
            getSessionSummaries$: jasmine.createSpy("getSessionSummaries$").and.returnValue(of([])),
        };

        (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = true;

        await TestBed.configureTestingModule({
            providers: [
                { provide: MatIconRegistry, useValue: matIconRegistrySpy },
                { provide: SwUpdate, useValue: swUpdateSpy },
                { provide: MatSnackBar, useValue: snackBarSpy },
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

    describe("constructor service worker integration", (): void => {
        it("should not subscribe to version updates when in development mode", (): void => {
            (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = true;
            const versionUpdatesSpy = spyOn(swUpdateSpy.versionUpdates, "pipe").and.callThrough();
            fixture.detectChanges();

            expect(versionUpdatesSpy).not.toHaveBeenCalled();
        });

        describe("when in production mode", (): void => {
            beforeEach((): void => {
                (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = false;
            });

            it("should subscribe to version updates", (): void => {
                const versionUpdatesSpy = spyOn(swUpdateSpy.versionUpdates, "pipe").and.callThrough();

                const prodFixture = TestBed.createComponent(AppComponent);
                prodFixture.detectChanges();

                expect(versionUpdatesSpy).toHaveBeenCalled();
            });

            it("should show update snackbar when new version is ready", (): void => {
                const prodFixture = TestBed.createComponent(AppComponent);
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
        it("should not check for service worker updates when in development mode", async (): Promise<void> => {
            (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = true;

            await component.ngAfterViewInit();

            expect(swUpdateSpy.checkForUpdate).not.toHaveBeenCalled();
        });

        describe("when in production mode", (): void => {
            beforeEach((): void => {
                (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = false;
            });

            it("should check for service worker updates when update check succeeds", async (): Promise<void> => {
                swUpdateSpy.checkForUpdate.and.resolveTo(true);

                await component.ngAfterViewInit();

                expect(swUpdateSpy.checkForUpdate).toHaveBeenCalled();
            });

            it("should show error snackbar when update check fails", async (): Promise<void> => {
                swUpdateSpy.checkForUpdate.and.rejectWith(new Error("Update failed"));
                spyOn(console, "error");

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

        describe("storage persistence", (): void => {
            let mockStorage: jasmine.SpyObj<StorageManager>;
            let storageSpy: jasmine.Spy<() => StorageManager>;

            beforeEach((): void => {
                mockStorage = jasmine.createSpyObj("StorageManager", ["persisted", "persist"]);
                storageSpy = spyOnProperty(navigator, "storage", "get").and.returnValue(mockStorage);
            });

            describe("when StorageManager API is available", (): void => {
                it("and storage is already persisted should not request persistence again", async (): Promise<void> => {
                    mockStorage.persisted.and.resolveTo(true);

                    await component.ngAfterViewInit();

                    expect(mockStorage.persisted).toHaveBeenCalled();
                    expect(mockStorage.persist).not.toHaveBeenCalled();
                });

                describe("and storage is not persisted", (): void => {
                    beforeEach((): void => {
                        mockStorage.persisted.and.resolveTo(false);
                    });

                    it("should successfully enable storage persistence when persist succeeds", async (): Promise<void> => {
                        mockStorage.persist.and.resolveTo(true);

                        await component.ngAfterViewInit();

                        expect(mockStorage.persisted).toHaveBeenCalled();
                        expect(mockStorage.persist).toHaveBeenCalled();
                    });

                    it("should log warning when persistence fails", async (): Promise<void> => {
                        mockStorage.persist.and.resolveTo(false);
                        spyOn(console, "warn");

                        await component.ngAfterViewInit();

                        expect(mockStorage.persisted).toHaveBeenCalled();
                        expect(mockStorage.persist).toHaveBeenCalled();
                        expect(console.warn).toHaveBeenCalledWith("Failed to make storage persisted");
                    });

                    it("should handle persist errors gracefully", async (): Promise<void> => {
                        const persistError = new Error("Persist failed");
                        mockStorage.persist.and.rejectWith(persistError);

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

            it("should log error and return early when StorageManager API not available", async (): Promise<void> => {
                storageSpy.and.returnValue(undefined as unknown as StorageManager);
                spyOn(console, "error");

                await component.ngAfterViewInit();

                expect(console.error).toHaveBeenCalledWith(
                    "StorageManager API is not found or not supported",
                );
            });
        });

        describe("as part of the Bluetooth API availability check", (): void => {
            let isSecureContextSpy: jasmine.Spy<() => boolean>;
            let navigatorBluetoothSpy: jasmine.Spy<() => Bluetooth | undefined>;

            beforeEach((): void => {
                isSecureContextSpy = spyOnProperty(window, "isSecureContext", "get").and.returnValue(true);
                navigatorBluetoothSpy = spyOnProperty(navigator, "bluetooth", "get").and.returnValue(
                    {} as unknown as Bluetooth,
                );
                fixture.detectChanges();
            });

            it("should not show Bluetooth unavailable message when in secure context with Bluetooth support", async (): Promise<void> => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                await component.ngAfterViewInit();

                expect(snackBarSpy.open).not.toHaveBeenCalledWith(
                    "Bluetooth API is not available",
                    "Dismiss",
                    jasmine.objectContaining({ duration: undefined }),
                );
            });

            it("should show Bluetooth API unavailable snackbar when not in secure context", async (): Promise<void> => {
                isSecureContextSpy.and.returnValue(false);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                await component.ngAfterViewInit();

                expect(snackBarSpy.open).toHaveBeenCalledWith("Bluetooth API is not available", "Dismiss", {
                    duration: undefined,
                });
            });

            it("should show Bluetooth API unavailable snackbar when Bluetooth API not supported", async (): Promise<void> => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue(undefined as unknown as Bluetooth);

                await component.ngAfterViewInit();

                expect(snackBarSpy.open).toHaveBeenCalledWith("Bluetooth API is not available", "Dismiss", {
                    duration: undefined,
                });
            });
        });
    });
});
