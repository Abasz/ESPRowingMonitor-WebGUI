import { DecimalPipe } from "@angular/common";
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    isDevMode,
    OnDestroy,
    Signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { MatIcon, MatIconRegistry } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SwUpdate, VersionEvent, VersionReadyEvent } from "@angular/service-worker";
import { filter, interval, map, merge, Observable, pairwise, startWith, switchMap, take } from "rxjs";

import { BleServiceFlag } from "../common/ble.interfaces";
import { ICalculatedMetrics, IErgConnectionStatus, IHeartRate } from "../common/common.interfaces";
import { MetricsService } from "../common/services/metrics.service";
import { UtilsService } from "../common/services/utils.service";
import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";
import { BatteryLevelPipe } from "../common/utils/battery-level.pipe";
import { RoundNumberPipe } from "../common/utils/round-number.pipe";
import { SecondsToTimePipe } from "../common/utils/seconds-to-time.pipe";

import { ErgConnectionService } from "./../common/services/ergometer/erg-connection.service";
import { ForceCurveComponent } from "./force-curve/force-curve.component";
import { MetricComponent } from "./metric/metric.component";
import { SettingsBarComponent } from "./settings-bar/settings-bar.component";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
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
    ]
})
export class AppComponent implements AfterViewInit, OnDestroy {
    BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;

    elapseTime: Signal<number>;
    heartRateData: Signal<IHeartRate | undefined> = toSignal(this.metricsService.heartRateData$);
    rowingData: Signal<ICalculatedMetrics> = toSignal(this.metricsService.allMetrics$, {
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
        private swUpdate: SwUpdate,
        private snackBar: MatSnackBar,
        private matIconReg: MatIconRegistry,
    ) {
        this.matIconReg.setDefaultFontSetClass("material-symbols-sharp");

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

        if (!isDevMode()) {
            this.swUpdate.versionUpdates
                .pipe(
                    filter((evt: VersionEvent): evt is VersionReadyEvent => evt.type === "VERSION_READY"),
                    switchMap((evt: VersionReadyEvent): Observable<void> => {
                        console.log(`Current app version: ${evt.currentVersion.hash}`);
                        console.log(`New app version ready for use: ${evt.latestVersion.hash}`);

                        return this.snackBar
                            .openFromComponent(SnackBarConfirmComponent, {
                                duration: undefined,
                                data: { text: "Update Available", confirm: "Update" },
                            })
                            .onAction();
                    }),
                    takeUntilDestroyed(),
                )
                .subscribe((): void => {
                    window.location.reload();
                });
        }
    }

    async ngAfterViewInit(): Promise<void> {
        if (!isDevMode()) {
            try {
                await this.swUpdate.checkForUpdate();
            } catch (err) {
                this.snackBar.open(`Failed to check for updates: ", ${err}`, "Dismiss");
                console.error("Failed to check for updates:", err);
            }
        }
        this.utils.enableWakeLock();

        if (navigator.storage === undefined) {
            console.error("StorageManager API is not found or not supported");

            return;
        }

        if (!(await navigator.storage.persisted())) {
            if (!(await navigator.storage.persist())) {
                console.warn("Failed to make storage persisted");
            }
        }

        if (!isSecureContext || navigator.bluetooth === undefined) {
            this.snackBar.open("Bluetooth API is not available", "Dismiss", {
                duration: undefined,
            });
        }
    }

    ngOnDestroy(): void {
        this.utils.disableWackeLock();
    }
}
