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
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButton } from "@angular/material/button";
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
} from "@angular/material/dialog";
import { MatFormField, MatHint, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTab, MatTabGroup } from "@angular/material/tabs";
import { firstValueFrom, map, Observable } from "rxjs";

import { IDeviceInformation } from "../../common/ble.interfaces";
import { HeartRateMonitorMode, IErgConnectionStatus, IRowerSettings } from "../../common/common.interfaces";
import { versionInfo } from "../../common/data/version";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { ErgSettingsService } from "../../common/services/ergometer/erg-settings.service";
import { UtilsService } from "../../common/services/utils.service";
import { SnackBarConfirmComponent } from "../../common/snack-bar-confirm/snack-bar-confirm.component";

import { GeneralSettingsComponent } from "./general-settings.component";
import { RowingSettingsComponent, RowingSettingsFormGroup } from "./rowing-settings.component";

interface ISettingsExport {
    schemaVersion: 1;
    exportedAt: string;
    appBuildTimestamp: string;
    profileName: string;
    deviceInfo: IDeviceInformation;
    generalSettings: {
        bleMode: number;
        logLevel: number;
        heartRateMonitor: HeartRateMonitorMode;
        deltaTimeLogging: boolean | undefined;
        logToSdCard: boolean | undefined;
    };
    rowingSettings: Record<string, unknown>;
}

@Component({
    selector: "app-settings-dialog",
    templateUrl: "./settings-dialog.component.html",
    styleUrls: ["./settings-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatDialogTitle,
        CdkScrollable,
        MatDialogContent,
        MatDialogActions,
        MatButton,
        MatTab,
        MatTabGroup,
        GeneralSettingsComponent,
        RowingSettingsComponent,
        AsyncPipe,
        MatFormField,
        MatHint,
        MatLabel,
        MatInput,
        ReactiveFormsModule,
    ],
})
export class SettingsDialogComponent {
    readonly rowingSettings: Signal<RowingSettingsComponent> = viewChild.required(RowingSettingsComponent);
    readonly generalSettings: Signal<GeneralSettingsComponent> = viewChild.required(GeneralSettingsComponent);
    readonly exportProfileNameControl: FormControl<string>;

    readonly isSaveButtonEnabled: Signal<boolean> = computed((): boolean => {
        const currentTab = this.currentTabIndex();
        const isGeneralFormSaveable = this.isGeneralFormSaveable();
        const isRowingFormSaveable = this.isRowingFormSaveable();

        return (currentTab === 0 && isGeneralFormSaveable) || (currentTab === 1 && isRowingFormSaveable);
    });

    readonly breakPoints$: Observable<boolean> = this.utils
        .breakpointHelper([[599, "max"]])
        .pipe(map((value: { [key: string]: boolean }): boolean => value.maxW599));

    readonly currentTabIndex: WritableSignal<number> = signal<number>(0);

    private readonly isGeneralFormSaveable: WritableSignal<boolean> = signal<boolean>(true);
    private readonly isRowingFormSaveable: WritableSignal<boolean> = signal<boolean>(true);

    private isSaving: boolean = false;

    constructor(
        private dialogRef: MatDialogRef<SettingsDialogComponent>,
        private utils: UtilsService,
        private configManager: ConfigManagerService,
        private ergSettingsService: ErgSettingsService,
        private ergConnectionService: ErgConnectionService,
        private snackBar: MatSnackBar,
        @Inject(MAT_DIALOG_DATA)
        public data: {
            rowerSettings: IRowerSettings;
            ergConnectionStatus: IErgConnectionStatus;
            deviceInfo: IDeviceInformation;
        },
    ) {
        this.exportProfileNameControl = new FormControl<string>("", {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(60)],
        });
        if (this.data.ergConnectionStatus.status !== "connected") {
            this.exportProfileNameControl.disable({ emitEvent: false });
        }

        this.breakPoints$.pipe(takeUntilDestroyed()).subscribe((isSmallScreen: boolean): void => {
            if (isSmallScreen) {
                this.dialogRef.updateSize("90%");

                return;
            }

            this.dialogRef.updateSize("560px");
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
            if (
                ((this.currentTabIndex() === 0 && this.isRowingFormSaveable()) ||
                    (this.currentTabIndex() === 1 && this.isGeneralFormSaveable())) &&
                (await this.showSaveConfirmation())
            ) {
                await this.saveGeneralSettings();
                await this.saveRowingSettings();
            } else {
                this.currentTabIndex() === 0
                    ? await this.saveGeneralSettings()
                    : await this.saveRowingSettings();
            }

            this.dialogRef.close();
        } finally {
            this.isSaving = false;
        }
    }

    onTabChange(newTabIndex: number): void {
        this.currentTabIndex.set(newTabIndex);
    }

    async handleDialogClose(): Promise<void> {
        if (
            (!this.rowingSettings().getForm().dirty && !this.generalSettings().getForm().dirty) ||
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

    async exportSettings(): Promise<void> {
        try {
            if (this.data.ergConnectionStatus.status !== "connected") {
                this.snackBar.open("Connect to a device before exporting settings", "Dismiss", {
                    duration: 3000,
                });

                return;
            }

            const profileName = this.getExportProfileName();
            if (!profileName) {
                this.snackBar.open("Please provide a profile name for export", "Dismiss", {
                    duration: 3000,
                });
                return;
            }

            const generalForm = this.generalSettings().getForm();
            const rowingForm = this.rowingSettings().getForm();
            const exportedAtIso = new Date().toISOString();

            const payload: ISettingsExport = {
                schemaVersion: 1,
                exportedAt: exportedAtIso,
                appBuildTimestamp: versionInfo.timeStamp,
                profileName,
                deviceInfo: this.data.deviceInfo,
                generalSettings: {
                    bleMode: generalForm.controls.bleMode.value,
                    logLevel: generalForm.controls.logLevel.value,
                    heartRateMonitor: generalForm.controls.heartRateMonitor.value,
                    deltaTimeLogging: generalForm.controls.deltaTimeLogging.value,
                    logToSdCard: generalForm.controls.logToSdCard.value,
                },
                rowingSettings: rowingForm.getRawValue(),
            };

            const fileName = this.buildExportFilename(payload.profileName, exportedAtIso);
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
            });

            await this.shareOrDownload(blob, fileName);
            this.snackBar.open("Settings exported", "Dismiss", { duration: 3000 });
        } catch (error) {
            console.error("exportSettings:", error);
            this.snackBar.open("Failed to export settings", "Dismiss", { duration: 3000 });
        }
    }

    private async saveGeneralSettings(): Promise<void> {
        const settingsForm = this.generalSettings().getForm();

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
            this.configManager.setItem(
                "heartRateMonitor",
                settingsForm.value.heartRateMonitor as HeartRateMonitorMode,
            );
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

    private showSaveConfirmation(): Promise<boolean> {
        return firstValueFrom(
            this.snackBar
                .openFromComponent(SnackBarConfirmComponent, {
                    duration: undefined,
                    data: {
                        text: `${this.currentTabIndex() === 1 ? "General" : "Rowing"} tab has changes, save those too?`,
                        cancel: "No",
                    },
                })
                .onAction()
                .pipe(map((): boolean => true)),
            { defaultValue: false },
        );
    }

    private buildExportFilename(profileName: string, exportedAt: string): string {
        const safeTimestamp = this.formatExportTimestamp(exportedAt);
        const safeName = profileName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40);

        const namePart = safeName.length > 0 ? `-${safeName}` : "";

        return `esprm-settings${namePart}-${safeTimestamp}.json`;
    }

    private formatExportTimestamp(isoTimestamp: string): string {
        return isoTimestamp.replace(/[:.]/g, "-");
    }

    private getExportProfileName(): string | undefined {
        const trimmed = this.exportProfileNameControl.value.trim();

        return trimmed.length > 0 ? trimmed : undefined;
    }

    private async shareOrDownload(blob: Blob, fileName: string): Promise<void> {
        const file = new File([blob], fileName, { type: "application/json" });
        const shareData: ShareData = {
            files: [file],
            title: "ESP Rowing Monitor Settings",
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);

            return;
        }

        const url = window.URL.createObjectURL(blob);
        const downloadTag = document.createElement("a");
        downloadTag.href = url;
        downloadTag.download = fileName;
        downloadTag.click();
        window.URL.revokeObjectURL(url);
    }
}
