import { ChangeDetectionStrategy, Component, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";

import { BleServiceNames } from "../../common/ble.interfaces";
import { HeartRateMonitorMode, IHRConnectionStatus } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { HeartRateService } from "../../common/services/heart-rate/heart-rate.service";
import { MetricsService } from "../../common/services/metrics.service";

@Component({
    selector: "app-connect-heart-rate-button",
    templateUrl: "./connect-heart-rate-button.component.html",
    styleUrls: ["./connect-heart-rate-button.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIcon, MatTooltip, MatIconButton],
    host: {
        "[style.display]": "this.heartRateMonitorMode() === 'off' ? 'contents' : 'block'",
    },
})
export class ConnectHeartRateButtonComponent {
    readonly BleServiceNames: typeof BleServiceNames = BleServiceNames;

    readonly heartRateMonitorMode: Signal<HeartRateMonitorMode> = toSignal(
        this.configManager.heartRateMonitorChanged$,
        { requireSync: true },
    );
    readonly hrConnectionStatus: Signal<IHRConnectionStatus> = toSignal(
        this.metricsService.hrConnectionStatus$,
        {
            requireSync: true,
        },
    );
    readonly isBleAvailable: boolean = isSecureContext === true && navigator.bluetooth !== undefined;

    constructor(
        private configManager: ConfigManagerService,
        private metricsService: MetricsService,
        private heartRateService: HeartRateService,
    ) {}

    async heartRateMonitorDiscovery(): Promise<void> {
        await this.heartRateService.discover();
    }
}
