import { DecimalPipe, KeyValuePipe } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    effect,
    input,
    InputSignal,
    OnInit,
    output,
    OutputEmitterRef,
    Signal,
    signal,
    WritableSignal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
    AbstractControl,
    FormControl,
    FormGroup,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from "@angular/forms";
import { MatButton } from "@angular/material/button";
import { MatOption } from "@angular/material/core";
import {
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelDescription,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
} from "@angular/material/expansion";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatSelect } from "@angular/material/select";
import { MatSliderModule } from "@angular/material/slider";
import { MatTooltip } from "@angular/material/tooltip";
import { map, startWith } from "rxjs";

import {
    IDragFactorSettings,
    IMachineSettings,
    IRowerSettings,
    ISensorSignalSettings,
    IStrokeDetectionSettings,
    IValidationErrors,
    StrokeDetectionType,
} from "../../common/common.interfaces";
import { CUSTOM_PROFILE_KEY, ProfileData } from "../../common/data/standard-profiles";
import { RowingProfileService } from "../../common/services/rowing-profile.service";
import { EnumToArrayPipe } from "../../common/utils/enum-to-array.pipe";
import { getValidationErrors } from "../../common/utils/utility.functions";

export type RowingSettingsFormGroup = FormGroup<{
    machineSettings: FormGroup<{
        flywheelInertia: FormControl<number>;
        magicConstant: FormControl<number>;
        sprocketRadius: FormControl<number>;
        impulsePerRevolution: FormControl<number>;
    }>;
    sensorSignalSettings: FormGroup<{
        rotationDebounceTime: FormControl<number>;
        rowingStoppedThreshold: FormControl<number>;
    }>;
    dragFactorSettings: FormGroup<{
        goodnessOfFitThreshold: FormControl<number>;
        maxDragFactorRecoveryPeriod: FormControl<number>;
        dragFactorLowerThreshold: FormControl<number>;
        dragFactorUpperThreshold: FormControl<number>;
        dragCoefficientsArrayLength: FormControl<number>;
    }>;
    strokeDetectionSettings: FormGroup<{
        strokeDetectionType: FormControl<StrokeDetectionType>;
        impulseDataArrayLength: FormControl<number>;
        minimumPoweredTorque: FormControl<number>;
        minimumDragTorque: FormControl<number>;
        minimumRecoverySlopeMargin: FormControl<number>;
        minimumRecoverySlope: FormControl<number>;
        minimumRecoveryTime: FormControl<number>;
        minimumDriveTime: FormControl<number>;
        driveHandleForcesMaxCapacity: FormControl<number>;
    }>;
}>;

@Component({
    selector: "app-rowing-settings",
    templateUrl: "./rowing-settings.component.html",
    styleUrls: ["./rowing-settings.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        DecimalPipe,
        KeyValuePipe,
        MatError,
        MatFormField,
        MatLabel,
        MatSelect,
        MatOption,
        MatInput,
        MatSliderModule,
        MatButton,
        MatAccordion,
        MatExpansionPanel,
        MatExpansionPanelHeader,
        MatExpansionPanelTitle,
        MatExpansionPanelDescription,
        MatTooltip,
        EnumToArrayPipe,
    ],
})
export class RowingSettingsComponent implements OnInit {
    StrokeDetectionType: typeof StrokeDetectionType = StrokeDetectionType;

    rowerSettings: InputSignal<IRowerSettings> = input.required<IRowerSettings>();
    strokeSettings: InputSignal<IStrokeDetectionSettings> = input.required<IStrokeDetectionSettings>();
    isConnected: InputSignal<boolean> = input.required<boolean>();
    isSmallScreen: InputSignal<boolean> = input.required<boolean>();

    readonly isFormValidChange: OutputEmitterRef<boolean> = output<boolean>();

    settingsForm: RowingSettingsFormGroup;
    settingsFormErrors: Signal<ValidationErrors | null>;
    strokeDetectionType: Signal<StrokeDetectionType>;

    selectedProfileKey: string | undefined;
    availableProfiles: WritableSignal<Record<string, ProfileData>>;

    get isProfileLoaded(): boolean {
        return this._isProfileLoaded;
    }

    private readonly formValueChanged: Signal<
        Partial<IMachineSettings> &
            Partial<ISensorSignalSettings> &
            Partial<IDragFactorSettings> &
            Partial<IStrokeDetectionSettings>
    >;

    private _isProfileLoaded: boolean = false;

    constructor(
        private fb: NonNullableFormBuilder,
        private rowingProfileService: RowingProfileService,
    ) {
        this.availableProfiles = signal(this.rowingProfileService.getAllProfiles());

        this.settingsForm = this.fb.group(
            {
                machineSettings: this.fb.group({
                    flywheelInertia: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(0.0001), Validators.max(100)],
                    ],
                    magicConstant: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(1 / 35), Validators.max(255 / 35)],
                    ],
                    sprocketRadius: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(1 / 1000), Validators.max(65535 / 1000)],
                    ],
                    impulsePerRevolution: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(1), Validators.max(12)],
                    ],
                }),
                sensorSignalSettings: this.fb.group({
                    rotationDebounceTime: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(0), Validators.max(255)],
                    ],
                    rowingStoppedThreshold: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(4), Validators.max(255)],
                    ],
                }),
                dragFactorSettings: this.fb.group({
                    goodnessOfFitThreshold: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(0), Validators.max(1)],
                    ],
                    maxDragFactorRecoveryPeriod: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(1), Validators.max(255)],
                    ],
                    dragFactorLowerThreshold: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(0), Validators.max(65535)],
                    ],
                    dragFactorUpperThreshold: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(0), Validators.max(65535)],
                    ],
                    dragCoefficientsArrayLength: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(1), Validators.max(255)],
                    ],
                }),
                strokeDetectionSettings: this.fb.group({
                    strokeDetectionType: [{ value: StrokeDetectionType.Slope, disabled: true }],
                    impulseDataArrayLength: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(1), Validators.max(18)],
                    ],
                    minimumPoweredTorque: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(-32767 / 10000), Validators.max(32767 / 10000)],
                    ],
                    minimumDragTorque: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(-32767 / 10000), Validators.max(32767 / 10000)],
                    ],
                    minimumRecoverySlopeMargin: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(0), Validators.max(1)],
                    ],
                    minimumRecoverySlope: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(-32767 / 1000), Validators.max(32767 / 1000)],
                    ],
                    minimumRecoveryTime: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(0), Validators.max(4095)],
                    ],
                    minimumDriveTime: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(0), Validators.max(4095)],
                    ],
                    driveHandleForcesMaxCapacity: [
                        { value: 0, disabled: true },
                        [Validators.required, Validators.min(0), Validators.max(255)],
                    ],
                }),
            },
            { validators: [this.maxDragFactorRecoveryPeriodCrossFieldValidator()] },
        );

        this.settingsFormErrors = toSignal(
            this.settingsForm.statusChanges.pipe(
                startWith("INVALID"),
                map((): IValidationErrors => getValidationErrors(this.settingsForm.controls)),
            ),
            { requireSync: true },
        );

        this.strokeDetectionType = toSignal(
            this.settingsForm.controls.strokeDetectionSettings.controls.strokeDetectionType.valueChanges.pipe(
                startWith(StrokeDetectionType.Torque),
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

        effect((): void => {
            const strokeDetectionType = this.strokeDetectionType();
            this.updateDynamicFieldStates(strokeDetectionType);
        });
    }

    ngOnInit(): void {
        const rowerSettings = this.rowerSettings();
        const strokeSettings = this.strokeSettings();
        const isConnected = this.isConnected();

        const impulseDataArrayLengthControl =
            this.settingsForm.controls.strokeDetectionSettings.controls.impulseDataArrayLength;
        impulseDataArrayLengthControl.setValidators([
            Validators.min(1),
            Validators.max(strokeSettings.isCompiledWithDouble ? 15 : 18),
        ]);

        this.settingsForm.patchValue({
            machineSettings: {
                flywheelInertia: rowerSettings.machineSettings.flywheelInertia,
                magicConstant: rowerSettings.machineSettings.magicConstant,
                sprocketRadius: rowerSettings.machineSettings.sprocketRadius,
                impulsePerRevolution: rowerSettings.machineSettings.impulsePerRevolution,
            },
            sensorSignalSettings: {
                rotationDebounceTime: rowerSettings.sensorSignalSettings.rotationDebounceTime,
                rowingStoppedThreshold: rowerSettings.sensorSignalSettings.rowingStoppedThreshold,
            },
            dragFactorSettings: {
                goodnessOfFitThreshold: rowerSettings.dragFactorSettings.goodnessOfFitThreshold,
                maxDragFactorRecoveryPeriod: rowerSettings.dragFactorSettings.maxDragFactorRecoveryPeriod,
                dragFactorLowerThreshold: rowerSettings.dragFactorSettings.dragFactorLowerThreshold,
                dragFactorUpperThreshold: rowerSettings.dragFactorSettings.dragFactorUpperThreshold,
                dragCoefficientsArrayLength: rowerSettings.dragFactorSettings.dragCoefficientsArrayLength,
            },
            strokeDetectionSettings: {
                strokeDetectionType: strokeSettings.strokeDetectionType,
                impulseDataArrayLength: strokeSettings.impulseDataArrayLength,
                minimumPoweredTorque: strokeSettings.minimumPoweredTorque,
                minimumDragTorque: strokeSettings.minimumDragTorque,
                minimumRecoverySlopeMargin: strokeSettings.minimumRecoverySlopeMargin,
                minimumRecoverySlope: strokeSettings.minimumRecoverySlope,
                minimumRecoveryTime: strokeSettings.minimumRecoveryTime,
                minimumDriveTime: strokeSettings.minimumDriveTime,
                driveHandleForcesMaxCapacity: strokeSettings.driveHandleForcesMaxCapacity,
            },
        });

        if (isConnected && this.rowerSettings().isRuntimeSettingsEnabled) {
            this.settingsForm.enable();
            this.updateDynamicFieldStates(strokeSettings.strokeDetectionType);
        }
    }

    getForm(): RowingSettingsFormGroup {
        return this.settingsForm;
    }

    loadProfile(profileKey: string | undefined): void {
        if (!profileKey || !this.rowerSettings().isRuntimeSettingsEnabled) {
            return;
        }

        const profileData = this.rowingProfileService.getProfile(profileKey);
        if (!profileData) {
            return;
        }

        this.settingsForm.reset({
            machineSettings: profileData.settings.machineSettings,
            sensorSignalSettings: profileData.settings.sensorSignalSettings,
            dragFactorSettings: profileData.settings.dragFactorSettings,
            strokeDetectionSettings: profileData.settings.strokeDetectionSettings,
        });

        this._isProfileLoaded = true;
    }

    saveAsCustomProfile(): void {
        if (this.settingsForm.dirty) {
            this.rowingProfileService.saveAsCustomProfile(this.settingsForm.getRawValue());
            this.availableProfiles.set(this.rowingProfileService.getAllProfiles());
        }
    }

    profileCompareFn = (
        a: { key: string; value: ProfileData },
        b: { key: string; value: ProfileData },
    ): number => {
        // custom profile should always come last
        if (a.key === CUSTOM_PROFILE_KEY) return 1;
        if (b.key === CUSTOM_PROFILE_KEY) return -1;

        // for standard profiles, maintain original order (or alphabetical)
        return a.key.localeCompare(b.key);
    };

    formatPercent(value: number): string {
        return `${Math.floor(value * 100)}%`;
    }

    private updateDynamicFieldStates(strokeDetectionType: StrokeDetectionType): void {
        if (!this.rowerSettings().isRuntimeSettingsEnabled || !this.isConnected()) {
            return;
        }

        const minimumRecoverySlope =
            this.settingsForm.controls.strokeDetectionSettings.controls.minimumRecoverySlope;
        const minimumRecoverySlopeMargin =
            this.settingsForm.controls.strokeDetectionSettings.controls.minimumRecoverySlopeMargin;

        if (strokeDetectionType === StrokeDetectionType.Torque) {
            minimumRecoverySlope.disable();
        } else {
            minimumRecoverySlope.enable();
        }

        if (strokeDetectionType === StrokeDetectionType.Slope) {
            minimumRecoverySlopeMargin.disable();
        } else {
            minimumRecoverySlopeMargin.enable();
        }
    }

    private maxDragFactorRecoveryPeriodCrossFieldValidator(): ValidatorFn {
        return (formGroup: AbstractControl): ValidationErrors | null => {
            const rotationDebounceTime = formGroup.get("sensorSignalSettings.rotationDebounceTime")?.value;
            const maxDragFactorRecoveryPeriod = formGroup.get(
                "dragFactorSettings.maxDragFactorRecoveryPeriod",
            );

            if (!rotationDebounceTime || !maxDragFactorRecoveryPeriod?.value) {
                // eslint-disable-next-line no-null/no-null
                return null;
            }

            const possibleRecoveryDatapointCount =
                (maxDragFactorRecoveryPeriod.value * 1000) / rotationDebounceTime;
            const maxAllowedDatapoints = 1000;

            if (possibleRecoveryDatapointCount > maxAllowedDatapoints) {
                maxDragFactorRecoveryPeriod.markAsTouched();
                maxDragFactorRecoveryPeriod.setErrors({
                    max: true,
                });

                return {
                    maxDragFactorRecoveryPeriodExceeded: true,
                };
            }

            // eslint-disable-next-line no-null/no-null
            maxDragFactorRecoveryPeriod.setErrors(null);

            // eslint-disable-next-line no-null/no-null
            return null;
        };
    }
}
