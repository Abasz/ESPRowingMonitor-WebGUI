import { DecimalPipe } from "@angular/common";
import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatIcon } from "@angular/material/icon";
import { filter, interval, map, merge, Observable, pairwise, startWith, switchMap, take } from "rxjs";

import { BleServiceFlag } from "../../common/ble.interfaces";
import { ICalculatedMetrics, IErgConnectionStatus, IHeartRate } from "../../common/common.interfaces";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { MetricsService } from "../../common/services/metrics.service";
import { UtilsService } from "../../common/services/utils.service";
import { BatteryLevelPipe } from "../../common/utils/battery-level.pipe";
import { RoundNumberPipe } from "../../common/utils/round-number.pipe";
import { SecondsToTimePipe } from "../../common/utils/seconds-to-time.pipe";

import { ForceCurveComponent } from "./force-curve/force-curve.component";
import { MetricComponent } from "./metric/metric.component";
import { SettingsBarComponent } from "./settings-bar/settings-bar.component";

@Component({
    selector: "app-dashboard",
    templateUrl: "./dashboard.component.html",
    styleUrls: ["./dashboard.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SettingsBarComponent,
        MetricComponent,
        ForceCurveComponent,
        MatIcon,
        DecimalPipe,
        SecondsToTimePipe,
        RoundNumberPipe,
        BatteryLevelPipe,
    ],
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
    readonly BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;

    readonly elapseTime: Signal<number>;
    readonly heartRateData: Signal<IHeartRate | undefined> = toSignal(this.metricsService.heartRateData$);
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

    constructor(
        private metricsService: MetricsService,
        private ergConnectionService: ErgConnectionService,
        private utils: UtilsService,
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
    }

    async ngAfterViewInit(): Promise<void> {
        this.utils.enableWakeLock();
    }

    ngOnDestroy(): void {
        this.utils.disableWakeLock();
    }
}
