import { ChangeDetectionStrategy, Component, effect, output, OutputEmitterRef, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from "@angular/forms";
import { MatCheckbox } from "@angular/material/checkbox";
import { startWith } from "rxjs";

import { ConfigManagerService } from "../../common/services/config-manager.service";

type DisplaySettingsFormGroup = FormGroup<{
    showPeakForceInTitle: FormControl<boolean>;
}>;

@Component({
    selector: "app-display-settings",
    templateUrl: "./display-settings.component.html",
    styleUrls: ["./display-settings.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, MatCheckbox],
})
export class DisplaySettingsComponent {
    readonly isFormValidChange: OutputEmitterRef<boolean> = output<boolean>();
    readonly settingsForm: DisplaySettingsFormGroup;

    private readonly formValueChanged: Signal<
        Partial<{
            showPeakForceInTitle: boolean;
        }>
    >;

    constructor(
        private formBuilder: NonNullableFormBuilder,
        private configManager: ConfigManagerService,
    ) {
        this.settingsForm = this.formBuilder.group({
            showPeakForceInTitle: [this.configManager.getItem("display", "showPeakForceInTitle")],
        });

        this.formValueChanged = toSignal(
            this.settingsForm.valueChanges.pipe(startWith(this.settingsForm.value)),
            { requireSync: true },
        );

        effect((): void => {
            this.formValueChanged();
            this.isFormValidChange.emit(this.settingsForm.valid);
        });
    }

    getForm(): DisplaySettingsFormGroup {
        return this.settingsForm;
    }
}
