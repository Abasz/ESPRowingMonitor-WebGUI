import { NgComponentOutlet } from "@angular/common";
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    computed,
    OnDestroy,
    Signal,
    Type,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { filter, interval, map, merge, Observable, pairwise, startWith, switchMap, take } from "rxjs";

import {
    Config,
    ICalculatedMetrics,
    IDisplayConfig,
    IErgConnectionStatus,
    IHeartRate,
} from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { MetricsService } from "../../common/services/metrics.service";
import { UtilsService } from "../../common/services/utils.service";

import {
    DASHBOARD_TILE_DEFINITIONS,
    DashboardContext,
    DashboardContextKey,
    DashboardTileComponent,
    DashboardTileId,
    TileComponentInputs,
} from "./dashboard-tile-definitions";
import { DashboardTileDefinition, PlacedDashboardTile } from "./dashboard.interfaces";
import { SettingsBarComponent } from "./settings-bar/settings-bar.component";

@Component({
    selector: "app-dashboard",
    templateUrl: "./dashboard.component.html",
    styleUrls: ["./dashboard.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SettingsBarComponent, NgComponentOutlet],
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
    readonly elapseTime: Signal<number>;
    readonly heartRateData: Signal<IHeartRate | undefined> = toSignal(this.metricsService.heartRateData$);
    readonly displayConfig: Signal<IDisplayConfig>;
    readonly layoutTiles: Signal<Array<PlacedDashboardTile>>;
    readonly rowingData: Signal<ICalculatedMetrics> = toSignal(this.metricsService.allMetrics$, {
        initialValue: {
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
        },
    });

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

    constructor(
        private metricsService: MetricsService,
        private ergConnectionService: ErgConnectionService,
        private utils: UtilsService,
        private configManager: ConfigManagerService,
    ) {
        this.elapseTime = toSignal(
            this.ergConnectionService.connectionStatus$().pipe(
                filter(
                    (connectionStatus: IErgConnectionStatus): boolean =>
                        connectionStatus.status === "connected",
                ),
                take(1),
                switchMap(
                    (): Observable<number> =>
                        merge(
                            interval(1000),
                            this.metricsService.allMetrics$.pipe(
                                pairwise(),
                                filter(
                                    ([previous, current]: [
                                        ICalculatedMetrics,
                                        ICalculatedMetrics,
                                    ]): boolean => previous.activityStartTime !== current.activityStartTime,
                                ),
                            ),
                        ).pipe(
                            startWith(0),
                            map(
                                (): number =>
                                    (Date.now() - this.metricsService.getActivityStartTime().getTime()) /
                                    1000,
                            ),
                        ),
                ),
            ),
            { initialValue: 0 },
        );

        this.displayConfig = toSignal(
            this.configManager.configChanged$.pipe(map((config: Config): IDisplayConfig => config.display)),
            {
                requireSync: true,
            },
        );

        this.layoutTiles = toSignal(
            this.configManager.configChanged$.pipe(
                map((config: Config): Array<PlacedDashboardTile> => config.display.layout.tiles),
            ),
            {
                requireSync: true,
            },
        );
    }

    async ngAfterViewInit(): Promise<void> {
        this.utils.enableWakeLock();
    }

    ngOnDestroy(): void {
        this.utils.disableWakeLock();
    }
}
