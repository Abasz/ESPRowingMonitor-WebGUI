import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { interval, map, Observable, startWith, take } from "rxjs";

import { BleServiceFlag } from "../../common/ble.interfaces";
import {
    IErgConnectionStatus,
    IHRConnectionStatus,
    IRowerSettings,
    ISessionSummary,
} from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DataRecorderService } from "../../common/services/data-recorder.service";
import { DataService } from "../../common/services/data.service";
import { ErgMetricsService } from "../../common/services/erg-metric-data.service";
import { HeartRateService } from "../../common/services/heart-rate.service";
import { UtilsService } from "../../common/services/utils.service";
import { LogbookDialogComponent } from "../logbook-dialog/logbook-dialog.component";
import { SettingsDialogComponent } from "../settings-dialog/settings-dialog.component";

@Component({
    selector: "app-settings-bar",
    templateUrl: "./settings-bar.component.html",
    styleUrls: ["./settings-bar.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsBarComponent {
    BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;

    batteryLevel$: Observable<number>;

    bleConnectionStatusIcons: {
        connected: string;
        connecting: string;
        searching: string;
        disconnected: string;
    } = {
        connected: "bluetooth_connected",
        connecting: "bluetooth_connected",
        searching: "bluetooth_searching",
        disconnected: "bluetooth",
    };

    ergConnectionStatus$: Observable<IErgConnectionStatus>;
    hrConnectionStatus$: Observable<IHRConnectionStatus>;
    isBleAvailable: boolean = isSecureContext && navigator.bluetooth !== undefined;
    settingsData$: Observable<IRowerSettings>;
    timeOfDay$: Observable<number> = interval(1000).pipe(
        startWith(Date.now()),
        map((): number => Date.now()),
    );

    constructor(
        private dataService: DataService,
        private dataRecorder: DataRecorderService,
        private metricsService: ErgMetricsService,
        private dialog: MatDialog,
        private heartRateService: HeartRateService,
        private utils: UtilsService,
        public configManager: ConfigManagerService,
    ) {
        this.ergConnectionStatus$ = this.dataService.ergConnectionStatus$();
        this.hrConnectionStatus$ = this.heartRateService.connectionStatus$();
        this.settingsData$ = this.dataService.streamSettings$();
        this.batteryLevel$ = this.dataService.streamMonitorBatteryLevel$();
    }

    downloadSession(): void {
        this.utils.mainSpinner().open();
        this.dataRecorder
            .getSessionSummaries$()
            .pipe(take(1))
            // eslint-disable-next-line rxjs-angular/prefer-takeuntil
            .subscribe((sessions: Array<ISessionSummary>): void => {
                this.utils.mainSpinner().close();
                this.dialog.open(LogbookDialogComponent, {
                    autoFocus: false,
                    data: sessions,
                });
            });
    }

    async ergoMonitorDiscovery(): Promise<void> {
        await this.metricsService.discover();
    }

    async heartRateMonitorDiscovery(): Promise<void> {
        await this.heartRateService.discover();
    }

    openSettings(): void {
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        this.settingsData$.pipe(take(1)).subscribe((settings: IRowerSettings): void => {
            this.dialog.open(SettingsDialogComponent, {
                autoFocus: false,
                data: settings,
            });
        });
    }

    reset(): void {
        this.dataService.reset();
    }
}
