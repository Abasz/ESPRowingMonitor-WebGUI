import { ChangeDetectionStrategy, Component, DestroyRef, Signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { MatDialog } from "@angular/material/dialog";
import { interval, map, take } from "rxjs";

import { BleServiceFlag } from "../../common/ble.interfaces";
import {
    HeartRateMonitorMode,
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

    batteryLevel: Signal<number> = toSignal(this.dataService.ergBatteryLevel$, {
        initialValue: 0,
    });

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

    ergConnectionStatus: Signal<IErgConnectionStatus> = toSignal(this.dataService.ergConnectionStatus$, {
        requireSync: true,
    });
    heartRateMonitorMode: Signal<HeartRateMonitorMode> = toSignal(
        this.configManager.heartRateMonitorChanged$,
        { requireSync: true },
    );
    hrConnectionStatus: Signal<IHRConnectionStatus> = toSignal(this.dataService.hrConnectionStatus$, {
        requireSync: true,
    });
    isBleAvailable: boolean = isSecureContext && navigator.bluetooth !== undefined;
    settings: Signal<IRowerSettings> = this.dataService.settings;
    timeOfDay: Signal<number> = toSignal(interval(1000).pipe(map((): number => Date.now())), {
        initialValue: Date.now(),
    });

    constructor(
        private dataService: DataService,
        private dataRecorder: DataRecorderService,
        private metricsService: ErgMetricsService,
        private dialog: MatDialog,
        private heartRateService: HeartRateService,
        private utils: UtilsService,
        private destroyRef: DestroyRef,
        private configManager: ConfigManagerService,
    ) {}

    async ergoMonitorDiscovery(): Promise<void> {
        await this.metricsService.discover();
    }

    async heartRateMonitorDiscovery(): Promise<void> {
        await this.heartRateService.discover();
    }

    openLogbook(): void {
        this.utils.mainSpinner().open();
        this.dataRecorder
            .getSessionSummaries$()
            .pipe(take(1), takeUntilDestroyed(this.destroyRef))
            .subscribe((sessions: Array<ISessionSummary>): void => {
                this.utils.mainSpinner().close();
                this.dialog.open(LogbookDialogComponent, {
                    autoFocus: false,
                    data: sessions,
                    maxWidth: "95vw",
                });
            });
    }

    openSettings(): void {
        this.dialog.open(SettingsDialogComponent, {
            autoFocus: false,
            data: this.settings(),
        });
    }

    reset(): void {
        this.dataService.reset();
    }
}
