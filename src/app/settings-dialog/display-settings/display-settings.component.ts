import {
    ChangeDetectionStrategy,
    Component,
    computed,
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
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatDivider } from "@angular/material/divider";
import { MatIcon } from "@angular/material/icon";
import { startWith } from "rxjs";

import {
    IDashboardLayoutConfig,
    IDisplayLayoutConfig,
    OrientationLock,
    UnitSystem,
} from "../../../common/common.interfaces";
import { ConfigManagerService } from "../../../common/services/config-manager.service";
import {
    LANDSCAPE_GRID_COLUMNS,
    LANDSCAPE_GRID_ROWS,
    PORTRAIT_GRID_COLUMNS,
    PORTRAIT_GRID_ROWS,
} from "../../dashboard/dashboard-tile-definitions";
import { TileLayoutEditorComponent } from "../tile-layout-editor/tile-layout-editor.component";

type EditOrientation = Exclude<OrientationLock, "auto">;

type DisplaySettingsFormGroup = FormGroup<{
    showPeakForceInTitle: FormControl<boolean>;
    showGridLines: FormControl<boolean>;
    showAxisLabels: FormControl<boolean>;
    unitSystem: FormControl<UnitSystem>;
}>;

interface IEditorLayout {
    tileLayout: IDashboardLayoutConfig;
    rows: number;
    columns: number;
}

@Component({
    selector: "app-display-settings",
    templateUrl: "./display-settings.component.html",
    styleUrls: ["./display-settings.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButton,
        MatButtonToggle,
        MatButtonToggleGroup,
        MatCheckbox,
        MatDivider,
        MatIcon,
        TileLayoutEditorComponent,
    ],
})
export class DisplaySettingsComponent {
    readonly isFormValidChange: OutputEmitterRef<boolean> = output<boolean>();
    readonly settingsForm: DisplaySettingsFormGroup;
    readonly isLayoutDirty: WritableSignal<boolean> = signal<boolean>(false);

    readonly landscapeLayout: WritableSignal<IDashboardLayoutConfig>;
    readonly portraitLayout: WritableSignal<IDashboardLayoutConfig>;
    readonly currentEditorLayout: Signal<IEditorLayout> = computed((): IEditorLayout => {
        const isEditorPortrait = this.isEditorPortraitMode();
        const currentLayout = this.isEditorPortraitMode() ? this.portraitLayout() : this.landscapeLayout();

        return {
            tileLayout: currentLayout,
            rows: isEditorPortrait ? PORTRAIT_GRID_ROWS : LANDSCAPE_GRID_ROWS,
            columns: isEditorPortrait ? PORTRAIT_GRID_COLUMNS : LANDSCAPE_GRID_COLUMNS,
        };
    });

    readonly orientationLock: WritableSignal<OrientationLock>;
    readonly editorOrientationSelection: WritableSignal<EditOrientation> =
        signal<EditOrientation>("landscape");
    readonly isEditorPortraitMode: Signal<boolean> = computed((): boolean => {
        const lock = this.orientationLock();
        const editorSelection = this.editorOrientationSelection();

        return lock !== "auto" ? lock === "portrait" : editorSelection === "portrait";
    });

    private initialLandscapeLayout: IDashboardLayoutConfig;
    private initialPortraitLayout: IDashboardLayoutConfig;

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

        this.landscapeLayout = signal<IDashboardLayoutConfig>(config.display.layout.landscape);
        this.portraitLayout = signal<IDashboardLayoutConfig>(config.display.layout.portrait);
        this.orientationLock = signal<OrientationLock>(config.display.layout.orientationLock);

        this.initialLandscapeLayout = structuredClone(config.display.layout.landscape);
        this.initialPortraitLayout = structuredClone(config.display.layout.portrait);

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

    getLayoutConfig(): IDisplayLayoutConfig {
        return {
            landscape: this.landscapeLayout(),
            portrait: this.portraitLayout(),
            orientationLock: this.orientationLock(),
        };
    }

    onOrientationLockChange(lock: OrientationLock): void {
        this.orientationLock.set(lock);
        if (lock !== "auto") {
            this.editorOrientationSelection.set(lock);
        }
        this.isLayoutDirty.set(true);
        this.isFormValidChange.emit(this.settingsForm.valid);
    }

    onEditOrientationChange(showPortrait: EditOrientation): void {
        this.editorOrientationSelection.set(showPortrait);
    }

    onResetLayout(): void {
        const initial = this.isEditorPortraitMode()
            ? this.initialPortraitLayout
            : this.initialLandscapeLayout;
        this.setCurrentLayout(initial);
    }

    onClearLayout(): void {
        this.setCurrentLayout({ tiles: [] });
    }

    onLayoutChange(layout: IDashboardLayoutConfig): void {
        this.setCurrentLayout(layout);
    }

    private setCurrentLayout(layout: IDashboardLayoutConfig): void {
        this.isEditorPortraitMode() ? this.portraitLayout.set(layout) : this.landscapeLayout.set(layout);

        this.isLayoutDirty.set(true);
        this.isFormValidChange.emit(this.settingsForm.valid);
    }
}
