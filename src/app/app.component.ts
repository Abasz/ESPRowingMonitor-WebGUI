import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    isDevMode,
    OnDestroy,
} from "@angular/core";
import { MatIconRegistry } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SwUpdate, VersionEvent, VersionReadyEvent } from "@angular/service-worker";
import {
    filter,
    interval,
    map,
    merge,
    Observable,
    pairwise,
    startWith,
    switchMap,
    take,
    takeUntil,
    tap,
} from "rxjs";

import { BleServiceFlag } from "../common/ble.interfaces";
import { ICalculatedMetrics, IErgConnectionStatus, IHeartRate } from "../common/common.interfaces";
import { DataService } from "../common/services/data.service";
import { UtilsService } from "../common/services/utils.service";
import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";
import { NgUnsubscribeDirective } from "../common/utils/unsubscribe-base.component";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent extends NgUnsubscribeDirective implements AfterViewInit, OnDestroy {
    BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;

    elapseTime$: Observable<number>;
    heartRateData$: Observable<IHeartRate | undefined>;
    rowingData$: Observable<ICalculatedMetrics>;

    constructor(
        private cd: ChangeDetectorRef,
        private dataService: DataService,
        private utils: UtilsService,
        private swUpdate: SwUpdate,
        private snackBar: MatSnackBar,
        private matIconReg: MatIconRegistry,
    ) {
        super();
        this.matIconReg.setDefaultFontSetClass("material-symbols-sharp");

        this.heartRateData$ = this.dataService.streamHeartRate$();
        this.elapseTime$ = this.dataService.ergConnectionStatus$().pipe(
            filter(
                (connectionStatus: IErgConnectionStatus): boolean => connectionStatus.status === "connected",
            ),
            take(1),
            switchMap(
                (): Observable<number> =>
                    merge(
                        interval(1000),
                        this.rowingData$.pipe(
                            pairwise(),
                            filter(
                                ([previous, current]: [ICalculatedMetrics, ICalculatedMetrics]): boolean =>
                                    previous.activityStartTime !== current.activityStartTime,
                            ),
                        ),
                    ).pipe(
                        startWith(0),
                        map(
                            (): number =>
                                (Date.now() - this.dataService.getActivityStartTime().getTime()) / 1000,
                        ),
                    ),
            ),
        );
        this.rowingData$ = this.dataService.streamAllMetrics$().pipe(
            tap((): void => {
                this.cd.detectChanges();
            }),
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
                    takeUntil(this.ngUnsubscribe),
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
    }

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    override ngOnDestroy(): void {
        super.ngOnDestroy();
        this.utils.disableWackeLock();
    }
}
