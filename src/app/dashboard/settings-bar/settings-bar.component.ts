import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, Signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { MatIconButton } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIcon } from "@angular/material/icon";
import { MatToolbar } from "@angular/material/toolbar";
import { MatTooltip } from "@angular/material/tooltip";
import { interval, map, take } from "rxjs";

import { BleServiceFlag, BleServiceNames } from "../../../common/ble.interfaces";
import { IErgConnectionStatus, IRowerSettings, ISessionSummary } from "../../../common/common.interfaces";
import { DataRecorderService } from "../../../common/services/data-recorder.service";
import { ErgConnectionService } from "../../../common/services/ergometer/erg-connection.service";
import { ErgGenericDataService } from "../../../common/services/ergometer/erg-generic-data.service";
import { ErgSettingsService } from "../../../common/services/ergometer/erg-settings.service";
import { MetricsService } from "../../../common/services/metrics.service";
import { UtilsService } from "../../../common/services/utils.service";
import { BatteryLevelPipe } from "../../../common/utils/battery-level.pipe";
import { LogbookDialogComponent } from "../../logbook-dialog/logbook-dialog.component";
import { ConnectErgButtonComponent } from "../../toolbar-buttons/connect-erg-button.component";
import { ConnectHeartRateButtonComponent } from "../../toolbar-buttons/connect-heart-rate-button.component";
import { OpenSettingsButtonComponent } from "../../toolbar-buttons/open-settings-button.component";

@Component({
    selector: "app-settings-bar",
    templateUrl: "./settings-bar.component.html",
    styleUrls: ["./settings-bar.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatToolbar,
        MatIcon,
        MatTooltip,
        MatIconButton,
        DatePipe,
        BatteryLevelPipe,
        ConnectErgButtonComponent,
        ConnectHeartRateButtonComponent,
        OpenSettingsButtonComponent,
    ],
})
export class SettingsBarComponent {
    BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;
    BleServiceNames: typeof BleServiceNames = BleServiceNames;

    batteryLevel: Signal<number> = toSignal(this.ergGenericDataService.streamMonitorBatteryLevel$(), {
        initialValue: 0,
    });

    ergConnectionStatus: Signal<IErgConnectionStatus> = toSignal(
        this.ergConnectionService.connectionStatus$(),
        {
            requireSync: true,
        },
    );

    settings: Signal<IRowerSettings> = this.ergSettingsService.settings;
    timeOfDay: Signal<number> = toSignal(interval(1000).pipe(map((): number => Date.now())), {
        initialValue: Date.now(),
    });

    constructor(
        private metricsService: MetricsService,
        private dataRecorder: DataRecorderService,
        private ergConnectionService: ErgConnectionService,
        private ergGenericDataService: ErgGenericDataService,
        private ergSettingsService: ErgSettingsService,
        private dialog: MatDialog,
        private utils: UtilsService,
        private destroyRef: DestroyRef,
    ) {}

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

    reset(): void {
        this.metricsService.reset();
    }
}
