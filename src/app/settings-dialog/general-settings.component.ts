import { DatePipe } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    effect,
    input,
    InputSignal,
    isDevMode,
    OnInit,
    output,
    OutputEmitterRef,
    signal,
    Signal,
    WritableSignal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
    FormControl,
    FormGroup,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from "@angular/forms";
import { MatIconButton } from "@angular/material/button";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatOption } from "@angular/material/core";
import { MatDialog } from "@angular/material/dialog";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatIcon } from "@angular/material/icon";
import { MatSelect } from "@angular/material/select";
import { MatTooltip } from "@angular/material/tooltip";
import { SwUpdate } from "@angular/service-worker";
import { map, startWith } from "rxjs";

import { BleServiceFlag, BleServiceNames, IDeviceInformation, LogLevel } from "../../common/ble.interfaces";
import { HeartRateMonitorMode, IRowerSettings, IValidationErrors } from "../../common/common.interfaces";
import { versionInfo } from "../../common/data/version";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { EnumToArrayPipe } from "../../common/utils/enum-to-array.pipe";
import { getValidationErrors } from "../../common/utils/utility.functions";
import { OtaDialogComponent } from "../ota-settings-dialog/ota-dialog.component";

type GeneralSettingsFormGroup = FormGroup<{
    bleMode: FormControl<BleServiceFlag>;
    logLevel: FormControl<LogLevel>;
    heartRateMonitor: FormControl<HeartRateMonitorMode>;
    deltaTimeLogging: FormControl<boolean>;
    logToSdCard: FormControl<boolean>;
}>;

@Component({
    selector: "app-general-settings",
    templateUrl: "./general-settings.component.html",
    styleUrls: ["./general-settings.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatSelect,
        MatOption,
        MatError,
        MatCheckbox,
        MatIconButton,
        MatIcon,
        MatTooltip,
        DatePipe,
        EnumToArrayPipe,
    ],
})
export class GeneralSettingsComponent implements OnInit {
    readonly BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;
    readonly BleServiceNames: typeof BleServiceNames = BleServiceNames;
    readonly LogLevel: typeof LogLevel = LogLevel;

    readonly rowerSettings: InputSignal<IRowerSettings> = input.required<IRowerSettings>();
    readonly deviceInfo: InputSignal<IDeviceInformation> = input.required<IDeviceInformation>();
    readonly isConnected: InputSignal<boolean> = input.required<boolean>();
    readonly isGuiUpdateInProgress: WritableSignal<boolean> = signal<boolean>(false);

    readonly isFormValidChange: OutputEmitterRef<boolean> = output<boolean>();

    readonly settingsForm: GeneralSettingsFormGroup;
    readonly settingsFormErrors: Signal<ValidationErrors | null>;

    readonly compileDate: Date = new Date(versionInfo.timeStamp);

    private readonly formValueChanged: Signal<
        Partial<
            | Omit<IRowerSettings, "isRuntimeSettingsEnabled">
            | "machineSettings"
            | "sensorSignalSettings"
            | "dragFactorSettings"
        >
    >;

    constructor(
        private swUpdate: SwUpdate,
        private dialog: MatDialog,
        private fb: NonNullableFormBuilder,
        private configManager: ConfigManagerService,
    ) {
        this.settingsForm = this.fb.group({
            bleMode: [{ value: BleServiceFlag.CpsService, disabled: true }],
            logLevel: [{ value: LogLevel.Silent, disabled: true }, [Validators.min(0), Validators.max(6)]],
            heartRateMonitor: [
                this.configManager.getItem("heartRateMonitor") as HeartRateMonitorMode,
                Validators.pattern(/^(off|ble|ant)$/),
            ],
            deltaTimeLogging: [
                {
                    value: false,
                    disabled: true,
                },
            ],
            logToSdCard: [
                {
                    value: false,
                    disabled: true,
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

        this.formValueChanged = toSignal(
            this.settingsForm.valueChanges.pipe(startWith(this.settingsForm.value)),
            {
                requireSync: true,
            },
        );

        effect((): void => {
            this.formValueChanged();
            this.isFormValidChange.emit(this.settingsForm.valid);
        });
    }

    ngOnInit(): void {
        const rowerSettings = this.rowerSettings();
        const isConnected = this.isConnected();

        this.settingsForm.patchValue({
            bleMode: rowerSettings.generalSettings.bleServiceFlag,
            logLevel: rowerSettings.generalSettings.logLevel,
            heartRateMonitor: this.configManager.getItem("heartRateMonitor") as HeartRateMonitorMode,
            deltaTimeLogging: rowerSettings.generalSettings.logDeltaTimes,
            logToSdCard: rowerSettings.generalSettings.logToSdCard,
        });

        if (isConnected) {
            this.settingsForm.enable();
        }

        this.settingsForm.controls.heartRateMonitor.enable();

        if (rowerSettings.generalSettings.logDeltaTimes === undefined) {
            this.settingsForm.controls.deltaTimeLogging.disable();
        }
        if (rowerSettings.generalSettings.logToSdCard === undefined) {
            this.settingsForm.controls.logToSdCard.disable();
        }
    }

    async checkForUpdates(): Promise<void> {
        if (isDevMode() || this.isGuiUpdateInProgress()) {
            return;
        }

        this.isGuiUpdateInProgress.set(true);
        try {
            await this.swUpdate.checkForUpdate();
        } finally {
            this.isGuiUpdateInProgress.set(false);
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
    }

    getForm(): GeneralSettingsFormGroup {
        return this.settingsForm;
    }
}
