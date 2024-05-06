import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { interval, map, Observable, startWith, take } from "rxjs";

import { BleServiceFlag } from "../../common/ble.interfaces";
import { IErgConnectionStatus, IHRConnectionStatus, IRowerSettings } from "../../common/common.interfaces";
import { BluetoothMetricsService } from "../../common/services/ble-data.service";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DataRecorderService } from "../../common/services/data-recorder.service";
import { DataService } from "../../common/services/data.service";
import { HeartRateService } from "../../common/services/heart-rate.service";
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
        searching: string;
        disconnected: string;
    } = {
        connected: "bluetooth_connected",
        searching: "bluetooth_searching",
        disconnected: "bluetooth",
    };

    ergConnectionStatus$: Observable<IErgConnectionStatus>;
    hrConnectionStatus$: Observable<IHRConnectionStatus>;
    settingsData$: Observable<IRowerSettings>;
    timeOfDay$: Observable<number> = interval(1000).pipe(
        startWith(Date.now()),
        map((): number => Date.now()),
    );

    constructor(
        private dataService: DataService,
        private dataRecorder: DataRecorderService,
        private metricsService: BluetoothMetricsService,
        private dialog: MatDialog,
        private heartRateService: HeartRateService,
        public configManager: ConfigManagerService,
    ) {
        this.ergConnectionStatus$ = this.dataService.ergConnectionStatus$();
        this.hrConnectionStatus$ = this.heartRateService.connectionStatus$();
        this.settingsData$ = this.dataService.streamSettings$();
        this.batteryLevel$ = this.dataService.streamMonitorBatteryLevel$();
    }

    downloadSession(): void {
        this.dataRecorder.download();
        this.dataRecorder.downloadDeltaTimes();
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
