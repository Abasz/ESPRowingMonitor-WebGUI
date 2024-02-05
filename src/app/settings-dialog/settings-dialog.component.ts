import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { map, Observable, startWith } from "rxjs";

import { IValidationErrors, LogLevel } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DataService } from "../../common/services/data.service";
import { WebSocketService } from "../../common/services/websocket.service";
import { getValidationErrors } from "../../common/utils/utility.functions";

import { HeartRateMonitorMode } from "./../../common/common.interfaces";

type SettingsFormGroup = FormGroup<{
    websocketAddress: FormControl<string>;
    logLevel: FormControl<LogLevel>;
    heartRateMonitor: FormControl<HeartRateMonitorMode>;
    logToWebSocket: FormControl<boolean>;
    logToSdCard: FormControl<boolean>;
}>;

@Component({
    selector: "app-settings-dialog",
    templateUrl: "./settings-dialog.component.html",
    styleUrls: ["./settings-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent {
    LogLevel: typeof LogLevel = LogLevel;

    isSecureContext: boolean = isSecureContext;

    settingsForm: SettingsFormGroup = this.fb.group({
        websocketAddress: [
            this.configManager.getItem("webSocketAddress"),
            [
                Validators.required,
                Validators.pattern(
                    /^wss?:\/\/[a-z0-9-]+(\.?[a-z0-9-])+(:[0-9]+)?([\/?][-a-zA-Z0-9+&@#\/%?=~_]*)?$/,
                ),
            ],
        ],
        logLevel: [this.dataService.getLogLevel(), [Validators.min(0), Validators.max(6)]],
        heartRateMonitor: [
            this.configManager.getItem("heartRateMonitor") as HeartRateMonitorMode,
            Validators.pattern(/^(off|ble|ant)$/),
        ],
        logToWebSocket: [
            {
                value: this.dataService.getWebSocketLoggingState() ?? false,
                disabled: this.dataService.getWebSocketLoggingState() === undefined ? true : false,
            },
        ],
        logToSdCard: [
            {
                value: this.dataService.getSdCardLoggingState() ?? false,
                disabled: this.dataService.getSdCardLoggingState() === undefined ? true : false,
            },
        ],
    });

    settingsFormErrors$: Observable<ValidationErrors | null> = this.settingsForm.statusChanges.pipe(
        startWith("INVALID"),
        map((): IValidationErrors => getValidationErrors(this.settingsForm.controls)),
    );

    constructor(
        private configManager: ConfigManagerService,
        private dataService: DataService,
        private webSocketService: WebSocketService,
        private fb: NonNullableFormBuilder,
        private dialogRef: MatDialogRef<SettingsDialogComponent>,
    ) {}

    submitLoginForm(): void {
        if (this.settingsForm.get("logLevel")?.dirty) {
            this.webSocketService.changeLogLevel(this.settingsForm.value.logLevel as LogLevel);
        }
        if (this.settingsForm.get("logToWebSocket")?.dirty) {
            this.webSocketService.changeLogToWebSocket(this.settingsForm.value.logToWebSocket as boolean);
        }
        if (this.settingsForm.get("logToSdCard")?.dirty) {
            this.webSocketService.changeLogToSdCard(this.settingsForm.value.logToSdCard as boolean);
        }

        if (this.settingsForm.get("websocketAddress")?.dirty) {
            this.configManager.setItem(
                "webSocketAddress",
                this.settingsForm.value.websocketAddress as string,
            );
        }
        if (this.settingsForm.get("heartRateMonitor")?.dirty) {
            this.configManager.setItem(
                "heartRateMonitor",
                this.settingsForm.value.heartRateMonitor as HeartRateMonitorMode,
            );
        }
        this.dialogRef.close();
    }
}
