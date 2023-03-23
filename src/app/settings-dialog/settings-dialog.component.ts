import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { map, Observable, startWith } from "rxjs";

import { IValidationErrors, LogLevel } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DataService } from "../../common/services/data.service";
import { WebSocketService } from "../../common/services/websocket.service";
import { getValidationErrors } from "../../common/utils/utility.functions";

type SettingsFormGroup = FormGroup<{
    websocketAddress: FormControl<string>;
    logLevel: FormControl<LogLevel>;
}>;

@Component({
    selector: "app-settings-dialog",
    templateUrl: "./settings-dialog.component.html",
    styleUrls: ["./settings-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent {
    LogLevel: typeof LogLevel = LogLevel;

    settingsForm: SettingsFormGroup = this.fb.group({
        websocketAddress: [
            this.configManager.getItem("webSocketAddress"),
            [
                Validators.required,
                Validators.pattern(
                    /^ws:\/\/[a-z0-9-]+(\.?[a-z0-9-])+(:[0-9]+)?([\/?][-a-zA-Z0-9+&@#\/%?=~_]*)?$/
                ),
            ],
        ],
        logLevel: [this.dataService.getLogLevel(), [Validators.min(0), Validators.max(6)]],
    });

    settingsFormErrors$: Observable<ValidationErrors | null> = this.settingsForm.statusChanges.pipe(
        startWith("INVALID"),
        map((): IValidationErrors => getValidationErrors(this.settingsForm.controls))
    );

    constructor(
        private configManager: ConfigManagerService,
        private dataService: DataService,
        private webSocketService: WebSocketService,
        private fb: NonNullableFormBuilder,
        private dialogRef: MatDialogRef<SettingsDialogComponent>
    ) {}

    submitLoginForm(): void {
        this.configManager.setItem("webSocketAddress", this.settingsForm.value.websocketAddress as string);
        this.webSocketService.changeLogLevel(this.settingsForm.value.logLevel as LogLevel);
        this.dialogRef.close();
    }
}
