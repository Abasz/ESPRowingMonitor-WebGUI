import { BreakpointObserver } from "@angular/cdk/layout";
import { signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, Observable, of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BleServiceFlag } from "../../common/ble.interfaces";
import {
    Config,
    ICalculatedMetrics,
    IErgConnectionStatus,
    IHeartRate,
    IHRConnectionStatus,
    SessionState,
} from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { ErgGenericDataService } from "../../common/services/ergometer/erg-generic-data.service";
import { ErgSettingsService } from "../../common/services/ergometer/erg-settings.service";
import { HeartRateService } from "../../common/services/heart-rate/heart-rate.service";
import { MetricsService } from "../../common/services/metrics.service";
import { SessionManagerService } from "../../common/services/session-manager.service";
import { UtilsService } from "../../common/services/utils.service";

import {
    DASHBOARD_TILE_DEFINITIONS,
    DashboardTileDefinition,
    DashboardTileId,
    DEFAULT_LANDSCAPE_LAYOUT,
    DEFAULT_PORTRAIT_LAYOUT,
    LANDSCAPE_GRID_COLUMNS,
    LANDSCAPE_GRID_ROWS,
    PORTRAIT_GRID_COLUMNS,
    PORTRAIT_GRID_ROWS,
} from "./dashboard-tile-definitions";
import { DashboardComponent } from "./dashboard.component";
import { PlacedDashboardTile } from "./dashboard.interfaces";
import { createMockMetrics } from "./tiles/dashboard-tile.test.helpers";

describe("DashboardComponent", (): void => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;
    let metricsServiceSpy: Pick<MetricsService, "heartRateData$" | "hrConnectionStatus$">;
    let sessionManagerSpy: Pick<SessionManagerService, "sessionState" | "elapsedTime" | "sessionMetrics$">;
    let mockSessionState: WritableSignal<SessionState>;
    let mockElapsedTime: WritableSignal<number>;
    let ergConnectionServiceSpy: Pick<ErgConnectionService, "connectionStatus$">;
    let utilsServiceSpy: Pick<UtilsService, "enableWakeLock" | "disableWakeLock">;
    let allMetricsSubject: BehaviorSubject<ICalculatedMetrics>;
    let heartRateDataSubject: BehaviorSubject<IHeartRate | undefined>;
    let connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let configManagerServiceSpy: Pick<ConfigManagerService, "configChanged$" | "getGroup">;
    let configSubject: BehaviorSubject<Config>;
    let breakpointSubject: BehaviorSubject<{ matches: boolean }>;

    // test data constants
    const mockInitialMetrics: ICalculatedMetrics = createMockMetrics();

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
        configSubject = new BehaviorSubject<Config>(new Config());
        configManagerServiceSpy = {
            configChanged$: configSubject.asObservable(),
            getGroup: vi.fn().mockReturnValue(true),
        };
        const heartRateServiceSpy = {
            discover: vi.fn(),
        };
        const ergSettingsServiceSpy = {
            getSettings: vi.fn(),
            saveSettings: vi.fn(),
            rowerSettings: signal({
                generalSettings: BleServiceFlag.CpsService,
            }),
        };

        // actual spies used for this test
        allMetricsSubject = new BehaviorSubject<ICalculatedMetrics>(mockInitialMetrics);
        heartRateDataSubject = new BehaviorSubject<IHeartRate | undefined>(undefined);
        connectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>(mockDisconnectedStatus);

        metricsServiceSpy = {
            heartRateData$: heartRateDataSubject.asObservable(),
            hrConnectionStatus$: of({ status: "disconnected" } as IHRConnectionStatus),
        };

        mockSessionState = signal<SessionState>("stopped");
        mockElapsedTime = signal<number>(0);
        sessionManagerSpy = {
            sessionState: mockSessionState,
            elapsedTime: mockElapsedTime,
            sessionMetrics$: allMetricsSubject.asObservable(),
        };

        ergConnectionServiceSpy = {
            connectionStatus$: (): Observable<IErgConnectionStatus> => connectionStatusSubject.asObservable(),
        };

        utilsServiceSpy = {
            enableWakeLock: vi.fn(),
            disableWakeLock: vi.fn(),
        };

        breakpointSubject = new BehaviorSubject<{ matches: boolean }>({ matches: false });

        await TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [
                { provide: MetricsService, useValue: metricsServiceSpy },
                { provide: SessionManagerService, useValue: sessionManagerSpy },
                { provide: ErgConnectionService, useValue: ergConnectionServiceSpy },
                { provide: UtilsService, useValue: utilsServiceSpy },
                {
                    provide: ErgGenericDataService,
                    useValue: {
                        streamMonitorBatteryLevel$: vi.fn().mockReturnValue(of(50)),
                        batteryLevel$: of(50),
                    },
                },
                { provide: ConfigManagerService, useValue: configManagerServiceSpy },
                { provide: HeartRateService, useValue: heartRateServiceSpy },
                { provide: ErgSettingsService, useValue: ergSettingsServiceSpy },
                {
                    provide: BreakpointObserver,
                    useValue: { observe: vi.fn().mockReturnValue(breakpointSubject.asObservable()) },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
    });

    describe("as part of component creation", (): void => {
        it("should create", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize signals with correct default values", (): void => {
            expect(component.elapseTime()).toBe(0);
            expect(component.heartRateData()).toBeUndefined();
            expect(component.rowingData()).toEqual(mockInitialMetrics);
            expect(component.displayConfig().forceCurve.showPeakForceInTitle).toBe(true);
            expect(component.displayConfig().forceCurve.showGridLines).toBe(true);
            expect(component.displayConfig().forceCurve.showAxisLabels).toBe(true);
            expect(component.displayConfig().general.unitSystem).toBe("metric");
            expect(component.layoutTiles()).toEqual(DEFAULT_LANDSCAPE_LAYOUT.tiles);
        });
    });

    describe("displayConfig signal", (): void => {
        it("should reflect config updates", (): void => {
            expect(component.displayConfig().forceCurve.showPeakForceInTitle).toBe(true);

            configSubject.next({
                ...configSubject.value,
                display: {
                    ...configSubject.value.display,
                    general: {
                        ...configSubject.value.display.general,
                        unitSystem: "imperial",
                    },
                    forceCurve: {
                        ...configSubject.value.display.forceCurve,
                        showPeakForceInTitle: false,
                    },
                },
            });

            expect(component.displayConfig().forceCurve.showPeakForceInTitle).toBe(false);
            expect(component.displayConfig().general.unitSystem).toBe("imperial");
        });
    });

    describe("layoutTiles signal", (): void => {
        it("should default to DEFAULT_LANDSCAPE_LAYOUT tiles", (): void => {
            expect(component.layoutTiles()).toEqual(DEFAULT_LANDSCAPE_LAYOUT.tiles);
        });

        it("should reflect config updates", (): void => {
            const customTiles: Array<PlacedDashboardTile> = [
                {
                    id: "distance",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                },
            ];

            configSubject.next({
                ...configSubject.value,
                display: {
                    ...configSubject.value.display,
                    layout: {
                        ...configSubject.value.display.layout,
                        landscape: { tiles: customTiles },
                    },
                },
            });

            expect(component.layoutTiles()).toEqual(customTiles);
        });

        it("should return portrait tiles when portrait orientation is active", (): void => {
            breakpointSubject.next({ matches: true });

            expect(component.layoutTiles()).toEqual(DEFAULT_PORTRAIT_LAYOUT.tiles);
        });
    });

    describe("gridColumns and gridRows signals", (): void => {
        it("should default to landscape grid dimensions", (): void => {
            expect(component.gridColumns()).toBe(LANDSCAPE_GRID_COLUMNS);
            expect(component.gridRows()).toBe(LANDSCAPE_GRID_ROWS);
        });

        it("should switch to portrait grid dimensions when breakpoint matches portrait", (): void => {
            breakpointSubject.next({ matches: true });

            expect(component.gridColumns()).toBe(PORTRAIT_GRID_COLUMNS);
            expect(component.gridRows()).toBe(PORTRAIT_GRID_ROWS);
        });

        it("should use portrait dimensions when orientationLock is portrait regardless of breakpoint", (): void => {
            configSubject.next({
                ...configSubject.value,
                display: {
                    ...configSubject.value.display,
                    layout: { ...configSubject.value.display.layout, orientationLock: "portrait" },
                },
            });

            expect(component.gridColumns()).toBe(PORTRAIT_GRID_COLUMNS);
            expect(component.gridRows()).toBe(PORTRAIT_GRID_ROWS);
        });

        it("should use landscape dimensions when orientationLock is landscape regardless of breakpoint", (): void => {
            breakpointSubject.next({ matches: true });
            configSubject.next({
                ...configSubject.value,
                display: {
                    ...configSubject.value.display,
                    layout: { ...configSubject.value.display.layout, orientationLock: "landscape" },
                },
            });

            expect(component.gridColumns()).toBe(LANDSCAPE_GRID_COLUMNS);
            expect(component.gridRows()).toBe(LANDSCAPE_GRID_ROWS);
        });
    });

    describe("elapseTime signal", (): void => {
        it("should reflect the sessionManager elapsedTime signal", (): void => {
            expect(component.elapseTime()).toBe(0);

            mockElapsedTime.set(42);
            expect(component.elapseTime()).toBe(42);
        });
    });

    describe("heartRateData signal", (): void => {
        it("should reflect current heart rate data from service", (): void => {
            expect(component.heartRateData()).toBeUndefined();

            heartRateDataSubject.next(mockHeartRateData);

            expect(component.heartRateData()).toEqual(mockHeartRateData);
        });
    });

    describe("rowingData signal", (): void => {
        it("should initialize with default metrics values", (): void => {
            expect(component.rowingData()).toEqual(mockInitialMetrics);
        });

        it("should update when metrics service emits new data", (): void => {
            const updatedMetrics: ICalculatedMetrics = {
                ...mockInitialMetrics,
                distance: 100,
                strokeCount: 10,
                avgStrokePower: 250,
            };

            allMetricsSubject.next(updatedMetrics);

            expect(component.rowingData()).toEqual(updatedMetrics);
        });
    });

    describe("metrics averaging", (): void => {
        const setAveragingConfig = (mode: "off" | "performance" | "all", windowSize: number = 3): void => {
            configSubject.next({
                ...configSubject.value,
                display: {
                    ...configSubject.value.display,
                    averaging: { mode, windowSize },
                },
            });
        };

        it("should pass through latest value when mode is off", (): void => {
            setAveragingConfig("off");

            const metrics1 = createMockMetrics({ distance: 10, strokeCount: 1, speed: 2 });
            const metrics2 = createMockMetrics({ distance: 20, strokeCount: 2, speed: 4 });

            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            expect(component.rowingData()).toEqual(metrics2);
        });

        it("should average performance metrics when mode is performance", (): void => {
            setAveragingConfig("performance", 2);

            const metrics1 = createMockMetrics({
                distance: 10,
                strokeCount: 1,
                speed: 2,
                avgStrokePower: 100,
                strokeRate: 20,
                dragFactor: 80,
            });
            const metrics2 = createMockMetrics({
                distance: 20,
                strokeCount: 2,
                speed: 4,
                avgStrokePower: 200,
                strokeRate: 30,
                dragFactor: 90,
            });

            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            const result = component.rowingData();

            expect(result.speed).toBe(3);
            expect(result.avgStrokePower).toBe(150);
            expect(result.strokeRate).toBe(25);
            expect(result.distance).toBe(20);
            expect(result.strokeCount).toBe(2);
            expect(result.dragFactor).toBe(90);
        });

        it("should average all averageable metrics when mode is all", (): void => {
            setAveragingConfig("all", 2);

            const metrics1 = createMockMetrics({
                distance: 10,
                strokeCount: 1,
                speed: 2,
                avgStrokePower: 100,
                strokeRate: 20,
                dragFactor: 80,
                driveDuration: 0.8,
                recoveryDuration: 1.2,
                peakForce: 200,
                distPerStroke: 8,
                driveLength: 1.0,
            });
            const metrics2 = createMockMetrics({
                distance: 20,
                strokeCount: 2,
                speed: 4,
                avgStrokePower: 200,
                strokeRate: 30,
                dragFactor: 90,
                driveDuration: 1.0,
                recoveryDuration: 1.4,
                peakForce: 300,
                distPerStroke: 10,
                driveLength: 1.4,
            });

            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            const result = component.rowingData();

            expect(result.speed).toBe(3);
            expect(result.avgStrokePower).toBe(150);
            expect(result.strokeRate).toBe(25);
            expect(result.dragFactor).toBe(85);
            expect(result.driveDuration).toBeCloseTo(0.9);
            expect(result.recoveryDuration).toBeCloseTo(1.3);
            expect(result.peakForce).toBe(250);
            expect(result.distPerStroke).toBe(9);
            expect(result.driveLength).toBeCloseTo(1.2);
            expect(result.distance).toBe(20);
            expect(result.strokeCount).toBe(2);
        });

        it("should respect window size and drop oldest values", (): void => {
            setAveragingConfig("performance", 2);

            const metrics1 = createMockMetrics({ distance: 10, strokeCount: 1, speed: 10, strokeRate: 20 });
            const metrics2 = createMockMetrics({ distance: 20, strokeCount: 2, speed: 20, strokeRate: 20 });
            const metrics3 = createMockMetrics({ distance: 30, strokeCount: 3, speed: 30, strokeRate: 20 });

            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);
            allMetricsSubject.next(metrics3);

            expect(component.rowingData().speed).toBe(25);
        });

        it("should return latest value when buffer has only one entry", (): void => {
            setAveragingConfig("all", 3);

            expect(component.rowingData()).toEqual(mockInitialMetrics);
        });

        it("should reset buffer when strokeRate drops to zero", (): void => {
            setAveragingConfig("performance", 3);

            const metrics1 = createMockMetrics({
                distance: 100,
                strokeCount: 10,
                speed: 4,
                avgStrokePower: 100,
                strokeRate: 20,
            });
            const metrics2 = createMockMetrics({
                distance: 200,
                strokeCount: 20,
                speed: 6,
                avgStrokePower: 150,
                strokeRate: 25,
            });
            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            const paddlingStopped = createMockMetrics({
                distance: 200,
                strokeCount: 20,
                speed: 4,
                avgStrokePower: 50,
                strokeRate: 0,
            });
            allMetricsSubject.next(paddlingStopped);

            expect(component.rowingData()).toEqual(paddlingStopped);
        });

        it("should not reset buffer when speed drops to zero but strokeRate is non-zero", (): void => {
            setAveragingConfig("performance", 2);

            const metrics1 = createMockMetrics({
                distance: 100,
                strokeCount: 10,
                speed: 4,
                avgStrokePower: 200,
                strokeRate: 20,
            });
            const metrics2 = createMockMetrics({
                distance: 200,
                strokeCount: 20,
                speed: 0,
                avgStrokePower: 100,
                strokeRate: 18,
            });
            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            // no reset: buffer still averages. avg=(200+100)/2=150, not raw 100 (what a reset would yield)
            expect(component.rowingData().avgStrokePower).toBe(150);
        });

        it("should update last buffer entry in-place when strokeCount is unchanged", (): void => {
            setAveragingConfig("performance", 3);
            // prime the buffer with two prior strokes so coalescing is observable via the average
            allMetricsSubject.next(
                createMockMetrics({
                    distance: 100,
                    strokeCount: 8,
                    avgStrokePower: 80,
                    strokeRate: 17,
                }),
            );
            allMetricsSubject.next(
                createMockMetrics({
                    distance: 200,
                    strokeCount: 9,
                    avgStrokePower: 90,
                    strokeRate: 18,
                }),
            );

            const metrics1 = createMockMetrics({
                distance: 300,
                strokeCount: 10,
                avgStrokePower: 110,
                strokeRate: 19,
            });
            const update1 = createMockMetrics({
                distance: 300,
                strokeCount: 10,
                avgStrokePower: 120,
                strokeRate: 21,
            });
            const update2 = createMockMetrics({
                distance: 300,
                strokeCount: 10,
                avgStrokePower: 130,
                strokeRate: 22,
            });
            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(update1);
            allMetricsSubject.next(update2);

            // avg=(80+90+130)/3=100; without coalescing avg would be (100+120+130)/3≈116.7
            expect(component.rowingData().avgStrokePower).toBe(100);
        });

        it("should never average handleForces", (): void => {
            setAveragingConfig("all", 2);

            const metrics1 = createMockMetrics({ distance: 10, strokeCount: 1, strokeRate: 20 });
            (metrics1 as { handleForces: Array<number> }).handleForces = [10, 20, 30];
            const metrics2 = createMockMetrics({ distance: 20, strokeCount: 2, strokeRate: 20 });
            (metrics2 as { handleForces: Array<number> }).handleForces = [40, 50, 60];

            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            expect(component.rowingData().handleForces).toEqual([40, 50, 60]);
        });

        it("should reset buffer when mode changes to off", (): void => {
            setAveragingConfig("performance", 3);

            const metrics1 = createMockMetrics({ distance: 10, strokeCount: 1, speed: 2, strokeRate: 20 });
            const metrics2 = createMockMetrics({ distance: 20, strokeCount: 2, speed: 4, strokeRate: 20 });
            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            setAveragingConfig("off");

            const metrics3 = createMockMetrics({ distance: 30, strokeCount: 3, speed: 6, strokeRate: 20 });
            allMetricsSubject.next(metrics3);

            expect(component.rowingData()).toEqual(metrics3);
        });

        it("should start accumulating when mode changes from off to performance", (): void => {
            setAveragingConfig("off");

            const metrics1 = createMockMetrics({ distance: 10, strokeCount: 1, speed: 2, strokeRate: 20 });
            allMetricsSubject.next(metrics1);

            setAveragingConfig("performance", 2);

            const metrics2 = createMockMetrics({ distance: 20, strokeCount: 2, speed: 4, strokeRate: 20 });
            const metrics3 = createMockMetrics({ distance: 30, strokeCount: 3, speed: 6, strokeRate: 20 });
            allMetricsSubject.next(metrics2);
            allMetricsSubject.next(metrics3);

            expect(component.rowingData().speed).toBe(5);
        });

        it("should trim buffer when window size decreases", (): void => {
            setAveragingConfig("performance", 4);

            const metrics1 = createMockMetrics({ distance: 10, strokeCount: 1, speed: 10, strokeRate: 20 });
            const metrics2 = createMockMetrics({ distance: 20, strokeCount: 2, speed: 20, strokeRate: 20 });
            const metrics3 = createMockMetrics({ distance: 30, strokeCount: 3, speed: 30, strokeRate: 20 });
            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);
            allMetricsSubject.next(metrics3);

            setAveragingConfig("performance", 2);

            const metrics4 = createMockMetrics({ distance: 40, strokeCount: 4, speed: 40, strokeRate: 20 });
            allMetricsSubject.next(metrics4);

            expect(component.rowingData().speed).toBe(35);
        });

        it("should keep buffer when window size increases", (): void => {
            setAveragingConfig("performance", 2);

            const metrics1 = createMockMetrics({ distance: 10, strokeCount: 1, speed: 10, strokeRate: 20 });
            const metrics2 = createMockMetrics({ distance: 20, strokeCount: 2, speed: 20, strokeRate: 20 });
            const metrics3 = createMockMetrics({ distance: 30, strokeCount: 3, speed: 30, strokeRate: 20 });
            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);
            allMetricsSubject.next(metrics3);

            setAveragingConfig("performance", 4);

            const metrics4 = createMockMetrics({ distance: 40, strokeCount: 4, speed: 40, strokeRate: 20 });
            allMetricsSubject.next(metrics4);

            expect(component.rowingData().speed).toBe(30);
        });

        it("should switch averaged key set when mode changes from all to performance", (): void => {
            setAveragingConfig("all", 2);

            const metrics1 = createMockMetrics({
                distance: 10,
                strokeCount: 1,
                speed: 2,
                strokeRate: 20,
                dragFactor: 80,
            });
            const metrics2 = createMockMetrics({
                distance: 20,
                strokeCount: 2,
                speed: 4,
                strokeRate: 20,
                dragFactor: 100,
            });
            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            expect(component.rowingData().dragFactor).toBe(90);

            setAveragingConfig("performance", 2);

            const metrics3 = createMockMetrics({
                distance: 30,
                strokeCount: 3,
                speed: 6,
                strokeRate: 20,
                dragFactor: 120,
            });
            allMetricsSubject.next(metrics3);

            expect(component.rowingData().dragFactor).toBe(120);
        });

        it("should switch averaged key set when mode changes from performance to all", (): void => {
            setAveragingConfig("performance", 2);

            const metrics1 = createMockMetrics({
                distance: 10,
                strokeCount: 1,
                speed: 2,
                strokeRate: 20,
                dragFactor: 80,
            });
            const metrics2 = createMockMetrics({
                distance: 20,
                strokeCount: 2,
                speed: 4,
                strokeRate: 20,
                dragFactor: 100,
            });
            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            expect(component.rowingData().dragFactor).toBe(100);

            setAveragingConfig("all", 2);

            const metrics3 = createMockMetrics({
                distance: 30,
                strokeCount: 3,
                speed: 6,
                strokeRate: 20,
                dragFactor: 120,
            });
            allMetricsSubject.next(metrics3);

            expect(component.rowingData().dragFactor).toBe(110);
        });

        it("should accumulate fresh buffer after strokeRate-zero reset", (): void => {
            setAveragingConfig("performance", 2);

            const metrics1 = createMockMetrics({ distance: 100, strokeCount: 10, speed: 4, strokeRate: 20 });
            const metrics2 = createMockMetrics({ distance: 200, strokeCount: 20, speed: 6, strokeRate: 20 });
            allMetricsSubject.next(metrics1);
            allMetricsSubject.next(metrics2);

            // rower stops: strokeRate drops to 0 → buffer resets
            allMetricsSubject.next(createMockMetrics({ distance: 200, strokeCount: 20, strokeRate: 0 }));

            const metrics3 = createMockMetrics({ distance: 10, strokeCount: 1, speed: 10, strokeRate: 20 });
            const metrics4 = createMockMetrics({ distance: 20, strokeCount: 2, speed: 20, strokeRate: 20 });
            const metrics5 = createMockMetrics({ distance: 30, strokeCount: 3, speed: 30, strokeRate: 20 });
            allMetricsSubject.next(metrics3);
            allMetricsSubject.next(metrics4);
            allMetricsSubject.next(metrics5);

            expect(component.rowingData().speed).toBe(25);
        });
    });

    describe("ngAfterViewInit method", (): void => {
        it("should enable wake lock", async (): Promise<void> => {
            await component.ngAfterViewInit();

            expect(vi.mocked(utilsServiceSpy.enableWakeLock)).toHaveBeenCalled();
        });
    });

    describe("ngOnDestroy method", (): void => {
        it("should disable wake lock", (): void => {
            component.ngOnDestroy();

            expect(vi.mocked(utilsServiceSpy.disableWakeLock)).toHaveBeenCalled();
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render tiles based on layout config", (): void => {
            fixture.detectChanges();

            const tiles = fixture.nativeElement.querySelectorAll(".dashboard .tile");

            expect(tiles.length).toBe(DEFAULT_LANDSCAPE_LAYOUT.tiles.length);
        });

        it("should render force curve tile component for ForceCurve tile type", (): void => {
            fixture.detectChanges();

            const forceCurveTile = fixture.nativeElement.querySelector(
                ".tile[data-tile-type='forceCurve'] app-force-curve-tile",
            );

            expect(forceCurveTile).toBeTruthy();
        });

        it("should render metric tile components for metric tile types", (): void => {
            fixture.detectChanges();

            const distanceTile = fixture.nativeElement.querySelector(
                ".tile[data-tile-type='distance'] app-distance-tile",
            );

            expect(distanceTile).toBeTruthy();
        });

        it("should apply grid positioning styles from tile config", (): void => {
            fixture.detectChanges();

            const firstTile = fixture.nativeElement.querySelector(".dashboard .tile");

            expect(firstTile).toBeTruthy();
            expect(firstTile.style.gridRow).toBeTruthy();
            expect(firstTile.style.gridColumn).toBeTruthy();
        });

        it("should update tiles when layout config changes", (): void => {
            fixture.detectChanges();

            configSubject.next({
                ...configSubject.value,
                display: {
                    ...configSubject.value.display,
                    layout: {
                        ...configSubject.value.display.layout,
                        landscape: {
                            tiles: [
                                {
                                    id: "distance",
                                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                                },
                            ],
                        },
                    },
                },
            });
            fixture.detectChanges();

            const tiles = fixture.nativeElement.querySelectorAll(".dashboard .tile");

            expect(tiles.length).toBe(1);
        });
    });

    describe("tileEntries signal", (): void => {
        it("should contain the correct component for a known tile type", (): void => {
            const expectedComponent = DASHBOARD_TILE_DEFINITIONS.find(
                (entry: DashboardTileDefinition): boolean => entry.id === "distance",
            )?.component;

            expect(component.tileEntries().get("distance")?.component).toBe(expectedComponent);
        });

        it("should return undefined for an unknown tile type", (): void => {
            expect(component.tileEntries().get("unknown" as DashboardTileId)).toBeUndefined();
        });

        it("should contain label, icon and rowingData for a rowingData-only tile with icon", (): void => {
            const inputs = component.tileEntries().get("pace")?.inputs;

            expect(Object.keys(inputs ?? {}).sort()).toEqual(["icon", "label", "rowingData"]);
            expect(inputs?.rowingData).toBe(component.rowingData());
            expect(inputs?.label).toBe("Pace");
            expect(inputs?.icon).toBe("speed");
        });

        it("should contain label and rowingData but no icon for a tile without icon", (): void => {
            const inputs = component.tileEntries().get("dragFactor")?.inputs;

            expect(Object.keys(inputs ?? {}).sort()).toEqual(["label", "rowingData"]);
            expect(inputs?.rowingData).toBe(component.rowingData());
            expect(inputs?.label).toBe("Drag Factor");
            expect(inputs?.icon).toBeUndefined();
        });

        it("should contain label, icon, rowingData and displayConfig for distance tile", (): void => {
            const inputs = component.tileEntries().get("distance")?.inputs;

            expect(Object.keys(inputs ?? {}).sort()).toEqual([
                "displayConfig",
                "icon",
                "label",
                "rowingData",
            ]);
            expect(inputs?.rowingData).toBe(component.rowingData());
            expect(inputs?.displayConfig).toBe(component.displayConfig());
            expect(inputs?.label).toBe("Distance");
            expect(inputs?.icon).toBe("distance");
        });

        it("should contain label, icon and elapseTime for timer tile", (): void => {
            const inputs = component.tileEntries().get("timer")?.inputs;

            expect(Object.keys(inputs ?? {}).sort()).toEqual(["elapseTime", "icon", "label"]);
            expect(inputs?.elapseTime).toBe(component.elapseTime());
            expect(inputs?.label).toBe("Timer");
            expect(inputs?.icon).toBe("timer");
        });

        it("should contain label, icon and heartRateData for heart rate tile", (): void => {
            heartRateDataSubject.next(mockHeartRateData);

            const inputs = component.tileEntries().get("heartRate")?.inputs;

            expect(Object.keys(inputs ?? {}).sort()).toEqual(["heartRateData", "icon", "label"]);
            expect(inputs?.heartRateData).toBe(component.heartRateData());
            expect(inputs?.label).toBe("Heart Rate");
            expect(inputs?.icon).toBe("ecg_heart");
        });

        it("should reflect updated signal values", (): void => {
            const updatedMetrics: ICalculatedMetrics = {
                ...mockInitialMetrics,
                distance: 500,
                strokeRate: 30,
            };
            allMetricsSubject.next(updatedMetrics);

            const inputs = component.tileEntries().get("pace")?.inputs;

            expect(inputs?.rowingData).toBe(component.rowingData());
            expect((inputs?.rowingData as ICalculatedMetrics).distance).toBe(500);
        });

        it("should match inputs declared in DASHBOARD_TILE_DEFINITIONS for every tile", (): void => {
            for (const entry of DASHBOARD_TILE_DEFINITIONS) {
                const inputs = component.tileEntries().get(entry.id)?.inputs;
                const expectedKeys = [
                    ...entry.context,
                    "label",
                    ...(entry.icon !== undefined ? ["icon"] : []),
                ];

                expect(Object.keys(inputs ?? {}).sort()).toEqual([...expectedKeys].sort());
            }
        });
    });
});
