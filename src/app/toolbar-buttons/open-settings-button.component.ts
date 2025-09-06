import { ChangeDetectionStrategy, Component, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatIconButton } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";
import { filter, firstValueFrom, timeout } from "rxjs";

import { IDeviceInformation } from "../../common/ble.interfaces";
import { IErgConnectionStatus, IRowerSettings } from "../../common/common.interfaces";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { ErgGenericDataService } from "../../common/services/ergometer/erg-generic-data.service";
import { ErgSettingsService } from "../../common/services/ergometer/erg-settings.service";
import { UtilsService } from "../../common/services/utils.service";
import { SettingsDialogComponent } from "../settings-dialog/settings-dialog.component";

@Component({
    selector: "app-open-settings-button",
    templateUrl: "./open-settings-button.component.html",
    styleUrls: ["./open-settings-button.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIcon, MatTooltip, MatIconButton],
})
export class OpenSettingsButtonComponent {
    readonly ergConnectionStatus: Signal<IErgConnectionStatus> = toSignal(
        this.ergConnectionService.connectionStatus$(),
        {
            requireSync: true,
        },
    );

    readonly isBleAvailable: boolean = isSecureContext === true && navigator.bluetooth !== undefined;

    readonly rowerSettings: Signal<IRowerSettings> = this.ergSettingsService.rowerSettings;

    constructor(
        private ergGenericDataService: ErgGenericDataService,
        private ergSettingsService: ErgSettingsService,
        private ergConnectionService: ErgConnectionService,
        private utils: UtilsService,
        private dialog: MatDialog,
    ) {}

    async openSettings(): Promise<void> {
        if (this.ergConnectionStatus().status === "connecting") {
            this.utils.mainSpinner().open();
            try {
                await this.handleConnectingFlow();
            } catch {
                // ignore any error, we just open the dialog with whatever data we have
            } finally {
                this.utils.mainSpinner().close();
            }
        }
        this.dialog.open(SettingsDialogComponent, {
            autoFocus: false,
            data: {
                rowerSettings: this.rowerSettings(),
                ergConnectionStatus: this.ergConnectionStatus(),
                deviceInfo: this.ergGenericDataService.deviceInfo(),
            },
        });
    }

    private async handleConnectingFlow(): Promise<void> {
        const finalStatus = await this.waitForConnectionProcessComplete();

        if (finalStatus.status !== "connected") {
            return;
        }

        await this.waitForDeviceInfoReady();
    }

    private waitForConnectionProcessComplete(): Promise<IErgConnectionStatus> {
        return firstValueFrom(
            this.ergConnectionService
                .connectionStatus$()
                .pipe(
                    filter(
                        (connectionStatus: IErgConnectionStatus): boolean =>
                            connectionStatus.status !== "connecting",
                    ),
                ),
        );
    }

    private waitForDeviceInfoReady(): Promise<IDeviceInformation> {
        return firstValueFrom(
            this.ergGenericDataService.deviceInfo$.pipe(
                filter((deviceInfo: IDeviceInformation): boolean => Object.keys(deviceInfo).length > 0),
                timeout({ first: 5000 }),
            ),
        );
    }
}
