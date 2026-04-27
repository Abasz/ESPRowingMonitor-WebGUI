import { CdkScrollable } from "@angular/cdk/scrolling";
import { AsyncPipe } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    Inject,
    Signal,
    signal,
    viewChild,
    WritableSignal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatButton } from "@angular/material/button";
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogActions,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
} from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTab, MatTabGroup } from "@angular/material/tabs";
import { firstValueFrom, map, Observable, take } from "rxjs";

import { IDeviceInformation } from "../../../common/ble.interfaces";
import { IErgConnectionStatus, IRowerSettings } from "../../../common/common.interfaces";
import { ConfigManagerService } from "../../../common/services/config-manager.service";
import { DataRecorderService } from "../../../common/services/data-recorder.service";
import { ErgConnectionService } from "../../../common/services/ergometer/erg-connection.service";
import { ErgSettingsService } from "../../../common/services/ergometer/erg-settings.service";
import { UtilsService } from "../../../common/services/utils.service";
import { SnackBarConfirmComponent } from "../../../common/snack-bar-confirm/snack-bar-confirm.component";
import { BulkUploadProgressDialogComponent } from "../bulk-upload-dialog/bulk-upload-progress-dialog.component";
import {
    BulkUploadPromptDialogComponent,
    BulkUploadPromptResult,
} from "../bulk-upload-dialog/bulk-upload-prompt-dialog.component";
import {
    ExportProfileDialogComponent,
    ExportProfileDialogResult,
} from "../export-profile-dialog/export-profile-dialog.component";

import { DisplaySettingsComponent } from "./display-settings/display-settings.component";
import { GeneralSettingsComponent } from "./general-settings/general-settings.component";
import { RowingSettingsComponent, RowingSettingsFormGroup } from "./rower-settings/rowing-settings.component";
import { SettingsExportService } from "./settings-export.service";

enum SettingsTab {
    General = 0,
    Display = 1,
    Rowing = 2,
}

@Component({
    selector: "app-settings-dialog",
    templateUrl: "./settings-dialog.component.html",
    styleUrls: ["./settings-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [SettingsExportService],
    imports: [
        MatDialogTitle,
        CdkScrollable,
        MatDialogContent,
        MatDialogActions,
        MatButton,
        MatTab,
        MatTabGroup,
        GeneralSettingsComponent,
        DisplaySettingsComponent,
        RowingSettingsComponent,
        AsyncPipe,
    ],
})
export class SettingsDialogComponent {
    readonly SettingsTab: typeof SettingsTab = SettingsTab;

    readonly rowingSettings: Signal<RowingSettingsComponent> = viewChild.required(RowingSettingsComponent);
    readonly generalSettings: Signal<GeneralSettingsComponent> = viewChild.required(GeneralSettingsComponent);
    readonly displaySettings: Signal<DisplaySettingsComponent> = viewChild.required(DisplaySettingsComponent);

    readonly isSaveButtonEnabled: Signal<boolean> = computed((): boolean => {
        const currentTab = this.currentTabIndex();
        const isGeneralFormSaveable = this.isGeneralFormSaveable();
        const isDisplayFormSaveable = this.isDisplayFormSaveable();
        const isRowingFormSaveable = this.isRowingFormSaveable();

        return (
            (currentTab === SettingsTab.General && isGeneralFormSaveable) ||
            (currentTab === SettingsTab.Display && isDisplayFormSaveable) ||
            (currentTab === SettingsTab.Rowing && isRowingFormSaveable)
        );
    });

    readonly breakPoints$: Observable<boolean> = this.utils
        .breakpointHelper([[599, "max"]])
        .pipe(map((value: { [key: string]: boolean }): boolean => value.maxW599));

    readonly currentTabIndex: WritableSignal<number> = signal<number>(0);

    private readonly isGeneralFormSaveable: WritableSignal<boolean> = signal<boolean>(true);
    private readonly isDisplayFormSaveable: WritableSignal<boolean> = signal<boolean>(true);
    private readonly isRowingFormSaveable: WritableSignal<boolean> = signal<boolean>(true);

    private isSaving: boolean = false;

    constructor(
        private dialogRef: MatDialogRef<SettingsDialogComponent>,
        private utils: UtilsService,
        private configManager: ConfigManagerService,
        private dataRecorder: DataRecorderService,
        private ergSettingsService: ErgSettingsService,
        private ergConnectionService: ErgConnectionService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private settingsExportService: SettingsExportService,
        @Inject(MAT_DIALOG_DATA)
        public data: {
            rowerSettings: IRowerSettings;
            ergConnectionStatus: IErgConnectionStatus;
            deviceInfo: IDeviceInformation;
        },
    ) {
        this.breakPoints$.pipe(takeUntilDestroyed()).subscribe((isSmallScreen: boolean): void => {
            if (isSmallScreen) {
                this.dialogRef.updateSize("95vw");

                return;
            }

            this.dialogRef.updateSize("100%");
        });

        this.dialogRef.disableClose = true;
        this.dialogRef
            .backdropClick()
            .pipe(takeUntilDestroyed())
            .subscribe((): Promise<void> => this.handleDialogClose());
        this.dialogRef
            .keydownEvents()
            .pipe(takeUntilDestroyed())
            .subscribe(async (event: KeyboardEvent): Promise<void> => {
                if (event.key === "Escape") {
                    await this.handleDialogClose();
                }
            });
    }

    onGeneralFormValidityChange(isValid: boolean): void {
        this.isGeneralFormSaveable.set(isValid && this.generalSettings().getForm().dirty);
    }

    onDisplayFormValidityChange(isValid: boolean): void {
        const display = this.displaySettings();
        this.isDisplayFormSaveable.set(isValid && (display.getForm().dirty || display.isLayoutDirty()));
    }

    onRowingFormValidityChange(isValid: boolean): void {
        this.isRowingFormSaveable.set(
            isValid && (this.rowingSettings().getForm().dirty || this.rowingSettings().isProfileLoaded),
        );
    }

    async saveSettings(): Promise<void> {
        if (this.isSaving) {
            return;
        }

        this.isSaving = true;

        try {
            const currentTabIndex = this.currentTabIndex();
            const tabsWithChanges = this.getSaveableTabLabels(currentTabIndex);

            if (tabsWithChanges.length > 0 && (await this.showSaveConfirmation(tabsWithChanges))) {
                await this.saveGeneralSettings();
                this.saveDisplaySettings();
                await this.saveRowingSettings();
            } else {
                await this.saveCurrentTabSettings(currentTabIndex);
            }

            this.dialogRef.close();
        } finally {
            this.isSaving = false;
        }
    }

    onTabChange(newTabIndex: SettingsTab): void {
        this.currentTabIndex.set(newTabIndex);
    }

    async exportProfile(): Promise<void> {
        if (this.rowingSettings().getForm().invalid) {
            return;
        }

        const result = await firstValueFrom(
            this.dialog
                .open<
                    ExportProfileDialogComponent,
                    void,
                    ExportProfileDialogResult
                >(ExportProfileDialogComponent, { width: "360px", maxWidth: "95vw" })
                .afterClosed(),
        );

        if (!result) {
            return;
        }

        const formValue = this.rowingSettings().getForm().getRawValue();

        await this.settingsExportService.exportRowerProfile(
            {
                machineSettings: formValue.machineSettings,
                sensorSignalSettings: formValue.sensorSignalSettings,
                dragFactorSettings: formValue.dragFactorSettings,
                strokeDetectionSettings: formValue.strokeDetectionSettings,
            },
            result.deviceName,
            result.modelNumber,
        );
    }

    async handleDialogClose(): Promise<void> {
        if (
            (!this.rowingSettings().getForm().dirty &&
                !this.generalSettings().getForm().dirty &&
                !this.displaySettings().getForm().dirty &&
                !this.displaySettings().isLayoutDirty()) ||
            (await firstValueFrom(
                this.snackBar
                    .openFromComponent(SnackBarConfirmComponent, {
                        duration: undefined,
                        data: {
                            text: "You have unsaved changes. Close without saving?",
                            cancel: "No",
                        },
                    })
                    .onAction()
                    .pipe(map((): boolean => true)),
                { defaultValue: false },
            ))
        ) {
            this.dialogRef.close();
        }
    }

    private async saveGeneralSettings(): Promise<void> {
        const general = this.generalSettings();
        const settingsForm = general.getForm();

        if (settingsForm.controls.logLevel.dirty) {
            await this.ergSettingsService.changeLogLevel(settingsForm.controls.logLevel.value);
        }

        if (settingsForm.controls.deltaTimeLogging.dirty) {
            await this.ergSettingsService.changeDeltaTimeLogging(
                settingsForm.controls.deltaTimeLogging.value,
            );
        }

        if (settingsForm.controls.logToSdCard.dirty) {
            await this.ergSettingsService.changeLogToSdCard(settingsForm.controls.logToSdCard.value);
        }

        if (settingsForm.controls.bleMode.dirty) {
            await this.ergSettingsService.changeBleServiceType(settingsForm.controls.bleMode.value);
        }

        if (settingsForm.controls.heartRateMonitor.dirty) {
            this.configManager.setGroup("general", {
                device: {
                    ...this.configManager.getGroup("general").device,
                    heartRateMonitor: settingsForm.controls.heartRateMonitor.value,
                },
            });
        }

        if (settingsForm.controls.autoSession.dirty) {
            this.configManager.setGroup("general", {
                session: {
                    ...this.configManager.getGroup("general").session,
                    autoSession: settingsForm.controls.autoSession.value,
                },
            });
        }

        if (settingsForm.controls.autoLap.dirty || settingsForm.controls.autoLapValue.dirty) {
            this.configManager.setGroup("general", {
                session: {
                    ...this.configManager.getGroup("general").session,
                    autoLap: settingsForm.controls.autoLap.value,
                    autoLapValue: settingsForm.controls.autoLapValue.value,
                },
            });
        }

        if (
            settingsForm.controls.intervalsApiKey.dirty ||
            settingsForm.controls.intervalsAthleteId.dirty ||
            settingsForm.controls.intervalsAutoUpload.dirty
        ) {
            const apiKey = settingsForm.controls.intervalsApiKey.value;
            const hasApiKeyChanged = apiKey !== "" && general.hasApiKeyChanged();

            this.configManager.setGroup("general", {
                intervalsIcu: {
                    apiKey,
                    athleteId: settingsForm.controls.intervalsAthleteId.value,
                    autoUploadEnabled: settingsForm.controls.intervalsAutoUpload.getRawValue(),
                },
            });

            if (!hasApiKeyChanged || !(await this.dataRecorder.hasSessions())) {
                return;
            }

            this.dialogRef
                .afterClosed()
                .pipe(take(1))
                // eslint-disable-next-line rxjs-angular/prefer-takeuntil -- overlayRef.dispose() fires before afterClosed() emits, so takeUntilDestroyed would unsubscribe too early take(1) takes care of completing the observable after the first emission which on close
                .subscribe((): void => {
                    void this.openBulkUploadFlow(general.isFirstTimeSetup());
                });
        }
    }

    private async saveRowingSettings(): Promise<void> {
        const rowingSettingsForm = this.rowingSettings().getForm();
        const isProfileLoaded = this.rowingSettings().isProfileLoaded;

        if (rowingSettingsForm.dirty) {
            this.rowingSettings().saveAsCustomProfile();
        }

        if (isProfileLoaded || rowingSettingsForm.controls.machineSettings.dirty) {
            const machineSettings = rowingSettingsForm.controls.machineSettings.getRawValue();

            await this.ergSettingsService.changeMachineSettings(machineSettings);
        }

        await this.handleSensorAndDragSettings(rowingSettingsForm, isProfileLoaded);

        if (isProfileLoaded || rowingSettingsForm.controls.strokeDetectionSettings.dirty) {
            const strokeDetectionSettings = rowingSettingsForm.controls.strokeDetectionSettings.getRawValue();

            await this.ergSettingsService.changeStrokeSettings(strokeDetectionSettings);
        }

        if (isProfileLoaded || rowingSettingsForm.dirty) {
            await this.ergSettingsService.restartDevice();
            await this.ergConnectionService.reconnect();
        }
    }

    private saveDisplaySettings(): void {
        const display = this.displaySettings();
        const displaySettingsForm = display.getForm();

        if (displaySettingsForm.dirty || display.isLayoutDirty()) {
            const formValue = displaySettingsForm.getRawValue();

            this.configManager.setGroup("display", {
                general: { unitSystem: formValue.unitSystem },
                forceCurve: {
                    showPeakForceInTitle: formValue.showPeakForceInTitle,
                    showGridLines: formValue.showGridLines,
                    showAxisLabels: formValue.showAxisLabels,
                },
                layout: display.getLayoutConfig(),
                averaging: display.getAveragingConfig(),
            });
        }
    }

    private async saveCurrentTabSettings(currentTabIndex: number): Promise<void> {
        switch (currentTabIndex) {
            case SettingsTab.General:
                await this.saveGeneralSettings();
                break;
            case SettingsTab.Display:
                this.saveDisplaySettings();
                break;
            case SettingsTab.Rowing:
                await this.saveRowingSettings();
                break;
            default:
                throw new Error(`Invalid tab index: ${currentTabIndex}`);
        }
    }

    private async handleSensorAndDragSettings(
        form: RowingSettingsFormGroup,
        isLoaded: boolean,
    ): Promise<void> {
        const sensorSettingsForm = form.controls.sensorSignalSettings;
        const dragSettingsForm = form.controls.dragFactorSettings;

        const isSensorSettingsDirty = isLoaded || sensorSettingsForm.dirty;
        const isDragSettingsDirty = isLoaded || dragSettingsForm.dirty;

        if (!isSensorSettingsDirty && !isDragSettingsDirty) {
            return;
        }

        const newSensorSettings = sensorSettingsForm.getRawValue();
        const newDragSettings = dragSettingsForm.getRawValue();

        const isRotationDebounceIncreased =
            newSensorSettings.rotationDebounceTime >
            this.data.rowerSettings.rowingSettings.sensorSignalSettings.rotationDebounceTime;
        const isMaxDragFactorRecoveryPeriodIncreased =
            newDragSettings.maxDragFactorRecoveryPeriod >
            this.data.rowerSettings.rowingSettings.dragFactorSettings.maxDragFactorRecoveryPeriod;

        if (isRotationDebounceIncreased && isMaxDragFactorRecoveryPeriodIncreased) {
            await this.ergSettingsService.changeSensorSignalSettings(newSensorSettings);
            await this.ergSettingsService.changeDragFactorSettings(newDragSettings);

            return;
        }

        if (isDragSettingsDirty) {
            await this.ergSettingsService.changeDragFactorSettings(newDragSettings);
        }

        if (isSensorSettingsDirty) {
            await this.ergSettingsService.changeSensorSignalSettings(newSensorSettings);
        }
    }

    private async openBulkUploadFlow(isFirstSetup: boolean): Promise<void> {
        const promptResult = await firstValueFrom(
            this.dialog
                .open<
                    BulkUploadPromptDialogComponent,
                    { isFirstSetup: boolean },
                    BulkUploadPromptResult
                >(BulkUploadPromptDialogComponent, { data: { isFirstSetup }, disableClose: true })
                .afterClosed(),
        );

        if (!promptResult || promptResult === "skip") {
            return;
        }

        this.dialog.open<BulkUploadProgressDialogComponent, { resetTracking: boolean }>(
            BulkUploadProgressDialogComponent,
            { data: { resetTracking: promptResult === "upload-all-reset" }, disableClose: true },
        );
    }

    private showSaveConfirmation(tabsWithChanges: Array<string>): Promise<boolean> {
        const changedTabsText = this.buildChangedTabsText(tabsWithChanges);

        return firstValueFrom(
            this.snackBar
                .openFromComponent(SnackBarConfirmComponent, {
                    duration: undefined,
                    data: {
                        text: changedTabsText,
                        cancel: "No",
                    },
                })
                .onAction()
                .pipe(map((): boolean => true)),
            { defaultValue: false },
        );
    }

    private getSaveableTabLabels(currentTabIndex: number): Array<string> {
        const tabsWithChanges: Array<string> = [];

        if (currentTabIndex !== SettingsTab.General && this.isGeneralFormSaveable()) {
            tabsWithChanges.push("General");
        }

        if (currentTabIndex !== SettingsTab.Display && this.isDisplayFormSaveable()) {
            tabsWithChanges.push("Display");
        }

        if (currentTabIndex !== SettingsTab.Rowing && this.isRowingFormSaveable()) {
            tabsWithChanges.push("Rowing");
        }

        return tabsWithChanges;
    }

    private buildChangedTabsText(tabsWithChanges: Array<string>): string {
        if (tabsWithChanges.length === 1) {
            return `${tabsWithChanges[0]} tab has changes, save those too?`;
        }

        if (tabsWithChanges.length === 2) {
            return `${tabsWithChanges[0]} and ${tabsWithChanges[1]} tabs have changes, save those too?`;
        }

        const leadingTabs = tabsWithChanges.slice(0, -1).join(", ");
        const lastTab = tabsWithChanges[tabsWithChanges.length - 1];

        return `${leadingTabs}, and ${lastTab} tabs have changes, save those too?`;
    }
}
