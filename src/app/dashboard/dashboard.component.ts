import { BreakpointObserver, BreakpointState } from "@angular/cdk/layout";
import { NgComponentOutlet } from "@angular/common";
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    OnDestroy,
    Signal,
    Type,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, scan } from "rxjs";

import {
    AveragingMode,
    Config,
    ICalculatedMetrics,
    IDisplayConfig,
    IDisplayLayoutConfig,
    IHeartRate,
    OrientationLock,
} from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { MetricsService } from "../../common/services/metrics.service";
import { SessionManagerService } from "../../common/services/session-manager.service";
import { UtilsService } from "../../common/services/utils.service";

import {
    DASHBOARD_TILE_DEFINITIONS,
    DashboardContext,
    DashboardContextKey,
    DashboardTileComponent,
    DashboardTileId,
    LANDSCAPE_GRID_COLUMNS,
    LANDSCAPE_GRID_ROWS,
    PORTRAIT_GRID_COLUMNS,
    PORTRAIT_GRID_ROWS,
    TileComponentInputs,
} from "./dashboard-tile-definitions";
import { DashboardTileDefinition, PlacedDashboardTile } from "./dashboard.interfaces";
import { SettingsBarComponent } from "./settings-bar/settings-bar.component";

type AverageableMetricKey = Exclude<
    keyof ICalculatedMetrics,
    "distance" | "strokeCount" | "handleForces" | "totalWork"
>;

const PERFORMANCE_METRIC_KEYS: ReadonlyArray<AverageableMetricKey> = [
    "speed",
    "avgStrokePower",
    "strokeRate",
];

const ALL_AVERAGEABLE_METRIC_KEYS: ReadonlyArray<AverageableMetricKey> = [
    ...PERFORMANCE_METRIC_KEYS,
    "driveDuration",
    "recoveryDuration",
    "dragFactor",
    "peakForce",
    "peakForcePositionNorm",
    "distPerStroke",
    "driveLength",
];

const ZERO_METRICS: ICalculatedMetrics = {
    avgStrokePower: 0,
    driveDuration: 0,
    recoveryDuration: 0,
    dragFactor: 0,
    distance: 0,
    strokeCount: 0,
    handleForces: [],
    peakForce: 0,
    peakForcePositionNorm: 0,
    strokeRate: 0,
    speed: 0,
    distPerStroke: 0,
    driveLength: 0,
    totalWork: 0,
};

/**
 * Extended ScreenOrientation interface including the lock/unlock methods
 * from the Screen Orientation API (not yet in TypeScript's lib.dom).
 */
interface ScreenOrientationWithLock extends ScreenOrientation {
    lock(orientation: string): Promise<void>;
    unlock(): void;
}

@Component({
    selector: "app-dashboard",
    templateUrl: "./dashboard.component.html",
    styleUrls: ["./dashboard.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SettingsBarComponent, NgComponentOutlet],
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
    readonly elapseTime: Signal<number> = this.sessionManager.elapsedTime;
    readonly heartRateData: Signal<IHeartRate | undefined> = toSignal(this.metricsService.heartRateData$, {
        requireSync: true,
    });
    readonly displayConfig: Signal<IDisplayConfig>;
    readonly layoutTiles: Signal<Array<PlacedDashboardTile>>;
    readonly gridColumns: Signal<number>;
    readonly gridRows: Signal<number>;
    readonly rowingData: Signal<ICalculatedMetrics>;

    readonly tileEntries: Signal<
        ReadonlyMap<DashboardTileId, { component: Type<DashboardTileComponent>; inputs: TileComponentInputs }>
    > = computed(
        (): ReadonlyMap<
            DashboardTileId,
            { component: Type<DashboardTileComponent>; inputs: TileComponentInputs }
        > =>
            new Map(
                [...this.tileRegistry.entries()].map(
                    ([id, entry]: [
                        DashboardTileId,
                        {
                            component: Type<DashboardTileComponent>;
                            inputs: Signal<TileComponentInputs>;
                        },
                    ]): [
                        DashboardTileId,
                        { component: Type<DashboardTileComponent>; inputs: TileComponentInputs },
                    ] => [id, { component: entry.component, inputs: entry.inputs() }],
                ),
            ),
    );

    private readonly tileRegistry: ReadonlyMap<
        DashboardTileId,
        { component: Type<DashboardTileComponent>; inputs: Signal<TileComponentInputs> }
    > = new Map(
        DASHBOARD_TILE_DEFINITIONS.map(
            (
                entry: DashboardTileDefinition,
            ): [
                DashboardTileId,
                {
                    component: Type<DashboardTileComponent>;
                    inputs: Signal<TileComponentInputs>;
                },
            ] => [
                entry.id,
                {
                    component: entry.component as Type<DashboardTileComponent>,
                    inputs: computed(
                        (): TileComponentInputs => ({
                            ...Object.fromEntries(
                                entry.context.map(
                                    (
                                        name: DashboardContextKey,
                                    ): [DashboardContextKey, DashboardContext[DashboardContextKey]] => [
                                        name,
                                        this.contextReaders[name](),
                                    ],
                                ),
                            ),
                            label: entry.label,
                            ...(entry.icon !== undefined ? { icon: entry.icon } : {}),
                        }),
                    ),
                },
            ],
        ),
    );

    private readonly contextReaders: Record<
        DashboardContextKey,
        () => DashboardContext[DashboardContextKey]
    > = {
        rowingData: (): ICalculatedMetrics => this.rowingData(),
        heartRateData: (): IHeartRate | undefined => this.heartRateData(),
        elapseTime: (): number => this.elapseTime(),
        displayConfig: (): IDisplayConfig => this.displayConfig(),
    };

    private readonly isDeviceOrientationPortrait: Signal<boolean>;
    private readonly orientationLock: Signal<OrientationLock>;
    private readonly isPortrait: Signal<boolean>;
    private isOrientationLocked: boolean = false;

    constructor(
        private metricsService: MetricsService,
        private sessionManager: SessionManagerService,
        private utils: UtilsService,
        private configManager: ConfigManagerService,
        private breakpointObserver: BreakpointObserver,
    ) {
        this.displayConfig = toSignal(
            this.configManager.configChanged$.pipe(map((config: Config): IDisplayConfig => config.display)),
            {
                requireSync: true,
            },
        );

        this.rowingData = toSignal(
            this.sessionManager.sessionMetrics$.pipe(
                scan(
                    (
                        buffer: Array<ICalculatedMetrics>,
                        current: ICalculatedMetrics,
                    ): Array<ICalculatedMetrics> => {
                        const { mode, windowSize }: { mode: AveragingMode; windowSize: number } =
                            this.displayConfig().averaging;

                        if (mode === "off" || current.strokeRate === 0) {
                            return [current];
                        }

                        const last = buffer[buffer.length - 1];

                        if (last !== undefined && last.strokeCount === current.strokeCount) {
                            return [...buffer.slice(0, -1), current];
                        }

                        const updated = [...buffer, current];

                        while (updated.length > windowSize) {
                            updated.shift();
                        }

                        return updated;
                    },
                    [] as Array<ICalculatedMetrics>,
                ),
                map((buffer: Array<ICalculatedMetrics>): ICalculatedMetrics => {
                    if (buffer.length <= 1) {
                        return buffer[buffer.length - 1];
                    }

                    const mode = this.displayConfig().averaging.mode;
                    const keys =
                        mode === "performance" ? PERFORMANCE_METRIC_KEYS : ALL_AVERAGEABLE_METRIC_KEYS;

                    return DashboardComponent.averageMetrics(buffer, keys);
                }),
            ),
            { initialValue: ZERO_METRICS },
        );

        this.isDeviceOrientationPortrait = toSignal(
            this.breakpointObserver
                .observe("(orientation: portrait)")
                .pipe(map((state: BreakpointState): boolean => state.matches)),
            { initialValue: false },
        );

        this.orientationLock = computed((): OrientationLock => this.displayConfig().layout.orientationLock);

        this.isPortrait = computed((): boolean => {
            switch (this.orientationLock()) {
                case "portrait":
                    return true;
                case "landscape":
                    return false;
                default:
                    return this.isDeviceOrientationPortrait();
            }
        });

        this.gridColumns = computed((): number =>
            this.isPortrait() ? PORTRAIT_GRID_COLUMNS : LANDSCAPE_GRID_COLUMNS,
        );
        this.gridRows = computed((): number =>
            this.isPortrait() ? PORTRAIT_GRID_ROWS : LANDSCAPE_GRID_ROWS,
        );

        this.layoutTiles = computed((): Array<PlacedDashboardTile> => {
            const layout: IDisplayLayoutConfig = this.displayConfig().layout;

            return this.isPortrait() ? layout.portrait.tiles : layout.landscape.tiles;
        });

        effect((): void => {
            const lock = this.orientationLock();
            void this.applyOrientationLock(lock);
        });
    }

    async ngAfterViewInit(): Promise<void> {
        this.utils.enableWakeLock();
    }

    ngOnDestroy(): void {
        this.utils.disableWakeLock();
        this.unlockOrientation();
    }

    private async applyOrientationLock(lock: OrientationLock): Promise<void> {
        if (lock === "auto") {
            this.unlockOrientation();

            return;
        }

        if (!this.supportsOrientationLock()) {
            return;
        }

        try {
            await (screen.orientation as ScreenOrientationWithLock).lock(
                lock === "portrait" ? "portrait-primary" : "landscape-primary",
            );
            this.isOrientationLocked = true;
        } catch {
            // lock failed silently (not in standalone mode, or unsupported).
            // The layout is already correct from isPortrait(); no action needed.
        }
    }

    private unlockOrientation(): void {
        if (!this.isOrientationLocked || !this.supportsOrientationLock()) {
            return;
        }

        (screen.orientation as ScreenOrientationWithLock).unlock();
        this.isOrientationLocked = false;
    }

    private supportsOrientationLock(): boolean {
        return typeof (screen?.orientation as ScreenOrientationWithLock | undefined)?.lock === "function";
    }

    private static averageMetrics(
        buffer: ReadonlyArray<ICalculatedMetrics>,
        keys: ReadonlyArray<AverageableMetricKey>,
    ): ICalculatedMetrics {
        const latest = buffer[buffer.length - 1];
        const count = buffer.length;

        return {
            ...latest,
            ...Object.fromEntries(
                keys.map((key: AverageableMetricKey): [AverageableMetricKey, number] => [
                    key,
                    buffer.reduce((sum: number, entry: ICalculatedMetrics): number => sum + entry[key], 0) /
                        count,
                ]),
            ),
        } as ICalculatedMetrics;
    }
}
