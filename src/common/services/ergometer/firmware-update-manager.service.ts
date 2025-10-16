import { HttpClient, HttpEvent } from "@angular/common/http";
import { Injectable, signal, Signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatBottomSheet } from "@angular/material/bottom-sheet";
import { MatDialog } from "@angular/material/dialog";
import { firstValueFrom, Observable } from "rxjs";

import { FirmwareProfileSelectionComponent } from "../../../app/firmware-profile-dialog/firmware-profile-selection.component";
import { OtaDialogComponent } from "../../../app/ota-settings-dialog/ota-dialog.component";
import { IDeviceInformation } from "../../ble.interfaces";
import { FirmwareAsset } from "../../common.interfaces";
import { versionInfo } from "../../data/version";

import { ErgGenericDataService } from "./erg-generic-data.service";

@Injectable({
    providedIn: "root",
})
export class FirmwareUpdateManagerService {
    static readonly FIRMWARE_RELEASE_URL: string =
        "https://github.com/Abasz/ESPRowingMonitor/releases/latest";

    readonly isUpdateAvailable: Signal<undefined | boolean>;

    private _isUpdateAvailable: WritableSignal<undefined | boolean> = signal(undefined);

    constructor(
        private http: HttpClient,
        private dialog: MatDialog,
        private bottomSheet: MatBottomSheet,
        private ergGenericDataService: ErgGenericDataService,
    ) {
        this.isUpdateAvailable = this._isUpdateAvailable.asReadonly();

        this.ergGenericDataService.deviceInfo$
            .pipe(takeUntilDestroyed())
            .subscribe((deviceInfo: IDeviceInformation): void => {
                if (Object.keys(deviceInfo).length === 0) {
                    this._isUpdateAvailable.set(undefined);

                    return;
                }

                this.checkForFirmwareUpdate();
            });
    }

    /**
     * Checks for firmware updates by comparing the device firmware version with the static release data from version.ts.
     */
    checkForFirmwareUpdate(): boolean {
        this._isUpdateAvailable.set(undefined);

        const firmwareNumber = this.ergGenericDataService.deviceInfo().firmwareNumber;

        if (!firmwareNumber) {
            this._isUpdateAvailable.set(false);
            console.warn("Could not retrieve device firmware version");

            return false;
        }

        const releaseData = versionInfo.latestFirmwareRelease;

        const releaseDate = new Date(releaseData.updatedAt);
        let firmwareDate: Date;

        try {
            firmwareDate = this.parseFirmwareVersionToDate(firmwareNumber);
        } catch (error) {
            console.warn("Could not parse firmware version date:", error);
            this._isUpdateAvailable.set(false);

            return false;
        }

        const releaseDateOnly = new Date(
            releaseDate.getFullYear(),
            releaseDate.getMonth(),
            releaseDate.getDate(),
        );
        const firmwareDateOnly = new Date(
            firmwareDate.getFullYear(),
            firmwareDate.getMonth(),
            firmwareDate.getDate(),
        );

        const isUpdateAvailable = releaseDateOnly > firmwareDateOnly;
        this._isUpdateAvailable.set(isUpdateAvailable);

        return isUpdateAvailable;
    }

    /**
     * Gets available firmware profiles for the current device hardware revision from static version data
     */
    getAvailableFirmwareProfiles(hardwareRevision: string): Array<FirmwareAsset> {
        let profiles = versionInfo.latestFirmwareRelease.assets;

        return profiles.filter(
            (profile: FirmwareAsset): boolean => profile.hardwareRevision === hardwareRevision,
        );
    }

    /**
     * Downloads firmware file from local assets folder
     */
    downloadFirmware(fileName: string): Observable<HttpEvent<ArrayBuffer>> {
        const downloadUrl = `./assets/firmware/${fileName}`;

        return this.http.get(downloadUrl, {
            reportProgress: true,
            observe: "events",
            responseType: "arraybuffer",
        });
    }

    async openFirmwareSelector(hardwareRevision: string): Promise<void> {
        const bottomSheetRef = this.bottomSheet.open(FirmwareProfileSelectionComponent, {
            data: this.getAvailableFirmwareProfiles(hardwareRevision),
            autoFocus: false,
        });

        const result = await firstValueFrom(bottomSheetRef.afterDismissed());
        if (result?.firmwareFile && result?.profile) {
            this.dialog.open(OtaDialogComponent, {
                autoFocus: false,
                disableClose: true,
                data: {
                    firmwareSize: result.firmwareFile.size / 1000,
                    file: result.firmwareFile,
                },
            });
        }
    }

    /**
     * Parses firmware version string to Date object.
     *
     * Assumes firmware version format is YYYYMMDD or contains a date
     */
    private parseFirmwareVersionToDate(firmwareVersion: string): Date {
        const match = /^(\d{4})(\d{2})(\d{2})$/.exec(firmwareVersion);
        if (!match) {
            throw new Error("Invalid yyyymmdd format");
        }
        const [, year, month, day]: RegExpMatchArray = match;

        return new Date(Number(year), Number(month) - 1, Number(day));
    }
}
