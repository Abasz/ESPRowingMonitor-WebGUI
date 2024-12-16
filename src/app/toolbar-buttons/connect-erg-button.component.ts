import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";

import { BleServiceNames } from "../../common/ble.interfaces";
import { IErgConnectionStatus } from "../../common/common.interfaces";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";

@Component({
    selector: "app-connect-erg-button",
    templateUrl: "./connect-erg-button.component.html",
    styleUrls: ["./connect-erg-button.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIcon, MatTooltip, MatIconButton, NgClass],
})
export class ConnectErgButtonComponent {
    BleConnectionStatusIcons: {
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
    BleServiceNames: typeof BleServiceNames = BleServiceNames;

    ergConnectionStatus: Signal<IErgConnectionStatus> = toSignal(
        this.ergConnectionService.connectionStatus$(),
        {
            requireSync: true,
        },
    );

    isBleAvailable: boolean = isSecureContext && navigator.bluetooth !== undefined;

    constructor(private ergConnectionService: ErgConnectionService) {}

    async ergoMonitorDiscovery(): Promise<void> {
        await this.ergConnectionService.discover();
    }
}
