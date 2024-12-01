import { CdkScrollable } from "@angular/cdk/scrolling";
import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, isDevMode, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
    FormControl,
    FormGroup,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from "@angular/forms";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatOption } from "@angular/material/core";
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
} from "@angular/material/dialog";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatIcon } from "@angular/material/icon";
import { MatSelect } from "@angular/material/select";
import { MatTooltip } from "@angular/material/tooltip";
import { SwUpdate } from "@angular/service-worker";
import { map, startWith } from "rxjs";

import { BleServiceFlag, IDeviceInformation, LogLevel } from "../../common/ble.interfaces";
import { IErgConnectionStatus, IRowerSettings, IValidationErrors } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DataService } from "../../common/services/data.service";
import { EnumToArrayPipe } from "../../common/utils/enum-to-array.pipe";
import { getValidationErrors } from "../../common/utils/utility.functions";
import { versionInfo } from "../../version";
import { OtaDialogComponent } from "../ota-settings-dialog/ota-dialog.component";

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
    standalone: true,
    imports: [
        MatDialogTitle,
        CdkScrollable,
        MatDialogContent,
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatSelect,
        MatOption,
        MatError,
        MatCheckbox,
        MatIconButton,
        MatTooltip,
        MatIcon,
        MatDialogActions,
        MatButton,
        MatDialogClose,
        DatePipe,
        EnumToArrayPipe,
    ],
})
export class SettingsDialogComponent {
    BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;
    LogLevel: typeof LogLevel = LogLevel;

    compileDate: Date = new Date(versionInfo.timeStamp);

    deviceInfo: IDeviceInformation = this.data.deviceInfo;

    isConnected: boolean = this.data.ergConnectionStatus.status === "connected";

    settingsForm: SettingsFormGroup;

    settingsFormErrors: Signal<ValidationErrors | null>;

    constructor(
        private configManager: ConfigManagerService,
        private dataService: DataService,
        private fb: NonNullableFormBuilder,
        private dialogRef: MatDialogRef<SettingsDialogComponent>,
        private swUpdate: SwUpdate,
        private dialog: MatDialog,
        @Inject(MAT_DIALOG_DATA)
        private data: {
            settings: IRowerSettings;
            ergConnectionStatus: IErgConnectionStatus;
            deviceInfo: IDeviceInformation;
        },
    ) {
        this.settingsForm = this.fb.group({
            bleMode: [{ value: this.data.settings.bleServiceFlag, disabled: !this.isConnected }],
            logLevel: [
                { value: this.data.settings.logLevel, disabled: !this.isConnected },
                [Validators.min(0), Validators.max(6)],
            ],
            heartRateMonitor: [
                this.configManager.getItem("heartRateMonitor") as HeartRateMonitorMode,
                Validators.pattern(/^(off|ble|ant)$/),
            ],
            deltaTimeLogging: [
                {
                    value: this.data.settings.logDeltaTimes ?? false,
                    disabled: this.data.settings.logDeltaTimes === undefined || !this.isConnected,
                },
            ],
            logToSdCard: [
                {
                    value: this.data.settings.logToSdCard ?? false,
                    disabled: this.data.settings.logToSdCard === undefined || !this.isConnected,
                },
            ],
        });

        this.settingsFormErrors = toSignal(
            this.settingsForm.statusChanges.pipe(
                startWith("INVALID"),
                map((): IValidationErrors => getValidationErrors(this.settingsForm.controls)),
            ),
            { requireSync: true },
        );
    }

    checkForUpdates(): void {
        if (!isDevMode()) {
            this.swUpdate.checkForUpdate();
        }
    }

    async otaUpdate(event: Event): Promise<void> {
        const inputElement = event.currentTarget;
        if (!(inputElement instanceof HTMLInputElement) || !inputElement?.files) {
            return;
        }

        this.dialog.open(OtaDialogComponent, {
            autoFocus: false,
            disableClose: true,
            data: {
                firmwareSize: inputElement.files[0].size / 1000,
                file: inputElement.files[0],
            },
        });

        this.dialogRef.close();
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
