import {
    ChangeDetectionStrategy,
    Component,
    effect,
    output,
    OutputEmitterRef,
    Signal,
    signal,
    WritableSignal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from "@angular/forms";
import { MatButton } from "@angular/material/button";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatDivider } from "@angular/material/divider";
import { MatIcon } from "@angular/material/icon";
import { MatRadioButton, MatRadioGroup } from "@angular/material/radio";
import { startWith } from "rxjs";

import { IDashboardLayoutConfig, UnitSystem } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";

import { TileLayoutEditorComponent } from "./tile-layout-editor/tile-layout-editor.component";

type DisplaySettingsFormGroup = FormGroup<{
    showPeakForceInTitle: FormControl<boolean>;
    showGridLines: FormControl<boolean>;
    showAxisLabels: FormControl<boolean>;
    unitSystem: FormControl<UnitSystem>;
}>;

@Component({
    selector: "app-display-settings",
    templateUrl: "./display-settings.component.html",
    styleUrls: ["./display-settings.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatIcon,
        ReactiveFormsModule,
        MatCheckbox,
        MatDivider,
        MatButton,
        MatRadioGroup,
        MatRadioButton,
        TileLayoutEditorComponent,
    ],
})
export class DisplaySettingsComponent {
    readonly isFormValidChange: OutputEmitterRef<boolean> = output<boolean>();
    readonly settingsForm: DisplaySettingsFormGroup;

    readonly layout: WritableSignal<IDashboardLayoutConfig>;
    readonly isLayoutDirty: WritableSignal<boolean> = signal<boolean>(false);

    private readonly formValueChanged: Signal<
        Partial<{
            showPeakForceInTitle: boolean;
            showGridLines: boolean;
            showAxisLabels: boolean;
            unitSystem: UnitSystem;
        }>
    >;

    constructor(
        private formBuilder: NonNullableFormBuilder,
        private configManager: ConfigManagerService,
    ) {
        const config = this.configManager.getConfig();

        this.settingsForm = this.formBuilder.group({
            showPeakForceInTitle: [config.display.forceCurve.showPeakForceInTitle],
            showGridLines: [config.display.forceCurve.showGridLines],
            showAxisLabels: [config.display.forceCurve.showAxisLabels],
            unitSystem: [config.display.general.unitSystem],
        });

        this.layout = signal<IDashboardLayoutConfig>(config.display.layout);

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

    getLayout(): IDashboardLayoutConfig {
        return this.layout();
    }

    onResetLayout(): void {
        this.layout.set(this.configManager.getConfig().display.layout);
        this.isLayoutDirty.set(true);
        this.isFormValidChange.emit(this.settingsForm.valid);
    }

    onClearLayout(): void {
        this.layout.set({ tiles: [] });
        this.isLayoutDirty.set(true);
        this.isFormValidChange.emit(this.settingsForm.valid);
    }

    onLayoutChange(layout: IDashboardLayoutConfig): void {
        this.layout.set(layout);
        this.isLayoutDirty.set(true);
        this.isFormValidChange.emit(this.settingsForm.valid);
    }
}
