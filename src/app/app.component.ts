import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
} from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SwUpdate, VersionEvent, VersionReadyEvent } from "@angular/service-worker";
import { filter, interval, map, Observable, startWith, switchMap, take, takeUntil, tap } from "rxjs";

import { BleServiceFlag, IAppState, IHeartRate } from "../common/common.interfaces";
import { BluetoothMetricsService } from "../common/services/ble-data.service";
import { DataRecorderService } from "../common/services/data-recorder.service";
import { DataService } from "../common/services/data.service";
import { HeartRateService } from "../common/services/heart-rate.service";
import { UtilsService } from "../common/services/utils.service";
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

    elapseTime$: Observable<number>;

    heartRateData$: Observable<IHeartRate | undefined>;
    isConnected$: Observable<boolean>;
    rowingData$: Observable<IAppState>;

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
    ) {
        super();
        this.heartRateData$ = this.dataService.heartRateData();
        this.isConnected$ = this.dataService.connectionStatus();
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
        this.rowingData$ = this.dataService.appState().pipe(
            tap((): void => {
                this.cd.detectChanges();
            }),
        );

        this.swUpdate.versionUpdates
            .pipe(
                filter((evt: VersionEvent): evt is VersionReadyEvent => evt.type === "VERSION_READY"),
                switchMap((evt: VersionReadyEvent): Observable<void> => {
                    console.log(`Current app version: ${evt.currentVersion.hash}`);
                    console.log(`New app version ready for use: ${evt.latestVersion.hash}`);

                    return this.snackBar.open("Update Available", "Reload").onAction();
                }),
                takeUntil(this.ngUnsubscribe),
            )
            .subscribe((): void => {
                window.location.reload();
            });
    }

    async handleAction($event: ButtonClickedTargets): Promise<void> {
        if ($event === "reset") {
            this.activityStartTime = Date.now();
            this.dataService.reset();
        }

        if ($event === "settings") {
            this.dialog.open(SettingsDialogComponent, {
                autoFocus: false,
            });
        }

        if ($event === "download") {
            this.dataRecorder.download();
            this.dataRecorder.downloadRaw();
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
        try {
            await this.swUpdate.checkForUpdate();
        } catch (err) {
            this.snackBar.open(`Failed to check for updates: ", ${err}`, "Dismiss");
            console.error("Failed to check for updates:", err);
        }
        this.utils.enableWakeLock();
    }

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    override ngOnDestroy(): void {
        super.ngOnDestroy();
        this.utils.disableWackeLock();
    }
}
