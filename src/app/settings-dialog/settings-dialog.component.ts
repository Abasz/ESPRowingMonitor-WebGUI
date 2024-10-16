import { ChangeDetectionStrategy, Component, Inject, isDevMode } from "@angular/core";
import { FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { SwUpdate } from "@angular/service-worker";
import { map, Observable, startWith } from "rxjs";

import { BleServiceFlag, LogLevel } from "../../common/ble.interfaces";
import { IRowerSettings, IValidationErrors } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DataService } from "../../common/services/data.service";
import { getValidationErrors } from "../../common/utils/utility.functions";
import { versionInfo } from "../../version";

import { HeartRateMonitorMode } from "./../../common/common.interfaces";

type SettingsFormGroup = FormGroup<{
    bleMode: FormControl<BleServiceFlag>;
    logLevel: FormControl<LogLevel>;
    heartRateMonitor: FormControl<HeartRateMonitorMode>;
    deltaTimeLogging: FormControl<boolean>;
    logToSdCard: FormControl<boolean>;
}>;

@Component({
    selector: "app-settings-dialog",
    templateUrl: "./settings-dialog.component.html",
    styleUrls: ["./settings-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent {
    BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;
    LogLevel: typeof LogLevel = LogLevel;

    compileDate: Date = new Date(versionInfo.timeStamp);

    settingsForm: SettingsFormGroup = this.fb.group({
        bleMode: [this.settings.bleServiceFlag],
        logLevel: [this.settings.logLevel, [Validators.min(0), Validators.max(6)]],
        heartRateMonitor: [
            this.configManager.getItem("heartRateMonitor") as HeartRateMonitorMode,
            Validators.pattern(/^(off|ble|ant)$/),
        ],
        deltaTimeLogging: [
            {
                value: this.settings.logDeltaTimes ?? false,
                disabled: this.settings.logDeltaTimes === undefined,
            },
        ],
        logToSdCard: [
            {
                value: this.settings.logToSdCard ?? false,
                disabled: this.settings.logToSdCard === undefined ? true : false,
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
        private fb: NonNullableFormBuilder,
        private dialogRef: MatDialogRef<SettingsDialogComponent>,
        private swUpdate: SwUpdate,
        @Inject(MAT_DIALOG_DATA) private settings: IRowerSettings,
    ) {}

    checkForUpdates(): void {
        if (!isDevMode()) {
            this.swUpdate.checkForUpdate();
        }
    }

    async submitLoginForm(): Promise<void> {
        if (this.settingsForm.get("logLevel")?.dirty) {
            await this.dataService.changeLogLevel(this.settingsForm.value.logLevel as LogLevel);
        }

        if (this.settingsForm.get("deltaTimeLogging")?.dirty) {
            await this.dataService.changeDeltaTimeLogging(
                this.settingsForm.value.deltaTimeLogging as boolean,
            );
        }

        if (this.settingsForm.get("logToSdCard")?.dirty) {
            await this.dataService.changeLogToSdCard(this.settingsForm.value.logToSdCard as boolean);
        }

        if (this.settingsForm.get("bleMode")?.dirty) {
            await this.dataService.changeBleServiceType(this.settingsForm.value.bleMode as BleServiceFlag);
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
