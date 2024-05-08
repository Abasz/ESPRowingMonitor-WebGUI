import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    isDevMode,
    OnDestroy,
} from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SwUpdate, VersionEvent, VersionReadyEvent } from "@angular/service-worker";
import { filter, interval, map, Observable, startWith, switchMap, take, takeUntil, tap } from "rxjs";

import { BleServiceFlag } from "../common/ble.interfaces";
import { ICalculatedMetrics, IHeartRate, IRowerSettings } from "../common/common.interfaces";
import { BluetoothMetricsService } from "../common/services/ble-data.service";
import { DataRecorderService } from "../common/services/data-recorder.service";
import { DataService } from "../common/services/data.service";
import { HeartRateService } from "../common/services/heart-rate.service";
import { UtilsService } from "../common/services/utils.service";
import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";
import { NgUnsubscribeDirective } from "../common/utils/unsubscribe-base.component";

import { ButtonClickedTargets } from "./settings-bar/settings-bar.interfaces";
import { SettingsDialogComponent } from "./settings-dialog/settings-dialog.component";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent extends NgUnsubscribeDirective implements AfterViewInit, OnDestroy {
    BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;

    batteryLevel$: Observable<number>;
    elapseTime$: Observable<number>;
    heartRateData$: Observable<IHeartRate | undefined>;
    isConnected$: Observable<boolean>;
    rowingData$: Observable<ICalculatedMetrics>;
    settingsData$: Observable<IRowerSettings>;

    private activityStartTime: number = Date.now();

    constructor(
        private cd: ChangeDetectorRef,
        private metricsService: BluetoothMetricsService,
        private dataService: DataService,
        private dataRecorder: DataRecorderService,
        private dialog: MatDialog,
        private heartRateService: HeartRateService,
        private utils: UtilsService,
        private swUpdate: SwUpdate,
        private snackBar: MatSnackBar,
        private matIconReg: MatIconRegistry,
    ) {
        super();
        this.matIconReg.setDefaultFontSetClass("material-symbols-sharp");

        this.heartRateData$ = this.dataService.streamHeartRate$();
        this.isConnected$ = this.dataService.connectionStatus();
        this.settingsData$ = this.dataService.streamSettings$();
        this.batteryLevel$ = this.dataService.streamMonitorBatteryLevel$();
        this.elapseTime$ = this.isConnected$.pipe(
            filter((isConnected: boolean): boolean => isConnected),
            take(1),
            switchMap((): Observable<number> => {
                this.activityStartTime = Date.now();

                return interval(1000).pipe(
                    startWith(0),
                    map((): number => (Date.now() - this.activityStartTime) / 1000),
                );
            }),
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
                                data: "Update Available",
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

    async handleAction($event: ButtonClickedTargets): Promise<void> {
        if ($event === "reset") {
            this.activityStartTime = Date.now();
            this.dataService.reset();
        }

        if ($event === "settings") {
            // eslint-disable-next-line rxjs-angular/prefer-takeuntil
            this.settingsData$.pipe(take(1)).subscribe((settings: IRowerSettings): void => {
                this.dialog.open(SettingsDialogComponent, {
                    autoFocus: false,
                    data: settings,
                });
            });
        }

        if ($event === "download") {
            this.dataRecorder.download();
            this.dataRecorder.downloadDeltaTimes();
        }

        if ($event === "heartRate") {
            await this.heartRateService.discover();
        }

        if ($event === "bluetooth") {
            await this.metricsService.discover();
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
