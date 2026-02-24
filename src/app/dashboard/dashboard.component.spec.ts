import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, Observable, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BleServiceFlag } from "../../common/ble.interfaces";
import {
    Config,
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

import {
    DASHBOARD_TILE_DEFINITIONS,
    DashboardTileDefinition,
    DashboardTileId,
    DEFAULT_DASHBOARD_LAYOUT,
} from "./dashboard-tile-definitions";
import { DashboardComponent } from "./dashboard.component";
import { PlacedDashboardTile } from "./dashboard.interfaces";
import { createMockMetrics } from "./tiles/dashboard-tile.test.helpers";

describe("DashboardComponent", (): void => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;
    let metricsServiceSpy: Pick<
        MetricsService,
        "getActivityStartTime" | "allMetrics$" | "heartRateData$" | "hrConnectionStatus$"
    >;
    let ergConnectionServiceSpy: Pick<ErgConnectionService, "connectionStatus$">;
    let utilsServiceSpy: Pick<UtilsService, "enableWakeLock" | "disableWakeLock">;
    let allMetricsSubject: BehaviorSubject<ICalculatedMetrics>;
    let heartRateDataSubject: BehaviorSubject<IHeartRate | undefined>;
    let connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let configManagerServiceSpy: Pick<ConfigManagerService, "configChanged$" | "getGroup">;
    let configSubject: BehaviorSubject<Config>;

    // test data constants
    const mockInitialMetrics: ICalculatedMetrics = createMockMetrics({
        activityStartTime: new Date("2024-01-01T10:00:00.000Z"),
    });

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
            getActivityStartTime: vi.fn(),
            allMetrics$: allMetricsSubject.asObservable(),
            heartRateData$: heartRateDataSubject.asObservable(),
            hrConnectionStatus$: of({ status: "disconnected" } as IHRConnectionStatus),
        };

        ergConnectionServiceSpy = {
            connectionStatus$: (): Observable<IErgConnectionStatus> => connectionStatusSubject.asObservable(),
        };

        utilsServiceSpy = {
            enableWakeLock: vi.fn(),
            disableWakeLock: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [
                { provide: MetricsService, useValue: metricsServiceSpy },
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
            vi.mocked(metricsServiceSpy.getActivityStartTime).mockReturnValue(
                mockInitialMetrics.activityStartTime,
            );

            expect(component.elapseTime()).toBe(0);
            expect(component.heartRateData()).toBeUndefined();
            expect(component.rowingData()).toEqual(mockInitialMetrics);
            expect(component.displayConfig().forceCurve.showPeakForceInTitle).toBe(true);
            expect(component.displayConfig().forceCurve.showGridLines).toBe(true);
            expect(component.displayConfig().forceCurve.showAxisLabels).toBe(true);
            expect(component.displayConfig().general.unitSystem).toBe("metric");
            expect(component.layoutTiles()).toEqual(DEFAULT_DASHBOARD_LAYOUT.tiles);
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
        it("should default to DEFAULT_DASHBOARD_LAYOUT tiles", (): void => {
            expect(component.layoutTiles()).toEqual(DEFAULT_DASHBOARD_LAYOUT.tiles);
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
                    layout: { tiles: customTiles },
                },
            });

            expect(component.layoutTiles()).toEqual(customTiles);
        });
    });

    describe("elapseTime signal", (): void => {
        describe("when erg is disconnected", (): void => {
            it("should maintain initial value of 0", (): void => {
                expect(component.elapseTime()).toBe(0);
            });
        });

        describe("when erg connects", (): void => {
            const now = Date.now();

            beforeEach((): void => {
                vi.useFakeTimers();
                vi.setSystemTime(now);
                vi.mocked(metricsServiceSpy.getActivityStartTime).mockReturnValue(
                    mockInitialMetrics.activityStartTime,
                );
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should start calculating elapsed time from activity start", async (): Promise<void> => {
                const activityStartTime = new Date(now - 5000);
                vi.mocked(metricsServiceSpy.getActivityStartTime).mockReturnValue(activityStartTime);
                expect(component.elapseTime()).toBe(0);

                connectionStatusSubject.next(mockConnectedStatus);

                expect(component.elapseTime()).toBeCloseTo(5, 0);
                await vi.advanceTimersByTimeAsync(2000);
                expect(component.elapseTime()).toBeCloseTo(7, 0);
            });
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

            expect(tiles.length).toBe(DEFAULT_DASHBOARD_LAYOUT.tiles.length);
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
                        tiles: [
                            {
                                id: "distance",
                                position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                            },
                        ],
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
