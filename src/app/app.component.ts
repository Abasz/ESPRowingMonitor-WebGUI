import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { interval, map, Observable, startWith, switchMap, take } from "rxjs";

import { BleServiceFlag, IHeartRate, IRowerData } from "../common/common.interfaces";
import { DataRecorderService } from "../common/services/data-recorder.service";
import { DataService } from "../common/services/data.service";
import { HeartRateService } from "../common/services/heart-rate.service";
import { UtilsService } from "../common/services/utils.service";
import { WebSocketService } from "../common/services/websocket.service";

import { ButtonClickedTargets } from "./settings-bar/settings-bar.interfaces";
import { SettingsDialogComponent } from "./settings-dialog/settings-dialog.component";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit, OnDestroy {
    BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;

    elapseTime$: Observable<number> = this.dataService.rowingData().pipe(
        take(1),
        switchMap((): Observable<number> => {
            this.activityStartTime = Date.now();

            return interval(1000).pipe(
                startWith(0),
                map((): number => (Date.now() - this.activityStartTime) / 1000),
            );
        }),
    );

    heartRateData$: Observable<IHeartRate | undefined>;
    isConnected$: Observable<boolean>;
    rowingData$: Observable<IRowerData>;

    private activityStartTime: number = Date.now();

    constructor(
        private dataService: DataService,
        private dataRecorder: DataRecorderService,
        private webSocketService: WebSocketService,
        private dialog: MatDialog,
        private heartRateService: HeartRateService,
        private utils: UtilsService,
    ) {
        this.heartRateData$ = this.dataService.heartRateData();
        this.rowingData$ = this.dataService.rowingData();
        this.isConnected$ = this.webSocketService.connectionStatus();
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
        }

        if ($event === "heartRate") {
            await this.heartRateService.discover();
        }

        if ($event === "bluetooth") {
            this.webSocketService.changeBleServiceType(
                this.dataService.getBleServiceFlag() === BleServiceFlag.CpsService
                    ? BleServiceFlag.CscService
                    : BleServiceFlag.CpsService,
            );
        }
    }

    async ngAfterViewInit(): Promise<void> {
        await this.utils.enableWakeLock();
    }

    async ngOnDestroy(): Promise<void> {
        await this.utils.disableWackeLock();
    }
}
