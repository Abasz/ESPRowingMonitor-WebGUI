import { HttpEvent, HttpEventType, HttpResponse } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, Inject, signal, WritableSignal } from "@angular/core";
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from "@angular/material/bottom-sheet";
import { MatButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatListModule, MatSelectionListChange } from "@angular/material/list";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSnackBar } from "@angular/material/snack-bar";
import { unzip } from "fflate/browser";
import { firstValueFrom } from "rxjs";
import { filter, map, tap } from "rxjs/operators";

import { FirmwareAsset, VersionInfo } from "../../common/common.interfaces";
import { versionInfo } from "../../common/data/version";
import { FirmwareUpdateManagerService } from "../../common/services/ergometer/firmware-update-manager.service";

@Component({
    selector: "app-firmware-profile-selection",
    templateUrl: "./firmware-profile-selection.component.html",
    styleUrls: ["./firmware-profile-selection.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatListModule, MatButton, MatIcon, MatListModule, MatProgressBarModule],
})
export class FirmwareProfileSelectionComponent {
    readonly availableProfiles: Array<FirmwareAsset>;
    readonly isLoading: WritableSignal<boolean> = signal(true);
    readonly isDownloading: WritableSignal<boolean> = signal(false);
    readonly downloadProgress: WritableSignal<number> = signal(0);
    readonly progressMode: WritableSignal<"determinate" | "indeterminate"> = signal("indeterminate");
    readonly selectedProfile: WritableSignal<FirmwareAsset | undefined> = signal<FirmwareAsset | undefined>(
        undefined,
    );

    readonly versionInfo: VersionInfo = versionInfo;

    constructor(
        private firmwareUpdateManager: FirmwareUpdateManagerService,
        private snackBar: MatSnackBar,
        private bottomSheetRef: MatBottomSheetRef<FirmwareProfileSelectionComponent>,
        @Inject(MAT_BOTTOM_SHEET_DATA) public data: Array<FirmwareAsset>,
    ) {
        this.availableProfiles = data;
    }

    onSelectionChange(event: MatSelectionListChange): void {
        const selected = event.options[0].value as FirmwareAsset;
        this.selectedProfile.set(selected);
    }

    async startUpdate(profile: FirmwareAsset | undefined): Promise<void> {
        if (profile === undefined) {
            return;
        }
        this.progressMode.set("indeterminate");
        this.downloadProgress.set(0);
        this.isDownloading.set(true);

        try {
            const download$ = this.firmwareUpdateManager.downloadFirmware(profile.fileName);

            const firmwareData: ArrayBuffer = await firstValueFrom(
                download$.pipe(
                    tap((event: HttpEvent<ArrayBuffer>): void => {
                        if (event.type === HttpEventType.DownloadProgress) {
                            const loaded = event.loaded ?? 0;

                            if (event.total === undefined || event.total === 0) {
                                return;
                            }

                            this.progressMode.set("determinate");

                            this.downloadProgress.set(Math.floor((loaded / event.total) * 100));
                        }
                    }),
                    filter(
                        (event: HttpEvent<ArrayBuffer>): event is HttpResponse<ArrayBuffer> =>
                            event.type === HttpEventType.Response,
                    ),
                    map((event: HttpResponse<ArrayBuffer>): ArrayBuffer => event.body as ArrayBuffer),
                ),
            );

            this.progressMode.set("indeterminate");
            // extract firmware.bin from zip
            const firmwareFile = await this.extractFirmwareBin(firmwareData);

            if (!firmwareFile) {
                throw new Error("firmware.bin not found in downloaded archive");
            }

            // close bottom sheet and return the firmware file
            this.bottomSheetRef.dismiss({
                firmwareFile,
                profile,
            });
        } catch (error) {
            console.error("Failed to download or extract firmware:", error);
            this.snackBar.open("Failed to download firmware", "Dismiss", { duration: 5000 });
        } finally {
            this.isDownloading.set(false);
        }
    }

    cancel(): void {
        this.bottomSheetRef.dismiss();
    }

    private extractFirmwareBin(zipData: ArrayBuffer): Promise<File | null> {
        return new Promise(
            (resolve: (value: File | null) => void, reject: (reason?: unknown) => void): void => {
                try {
                    const uint8Array = new Uint8Array(zipData);

                    unzip(uint8Array, (err: Error | null, unzipped: Record<string, Uint8Array>): void => {
                        if (err) {
                            reject(err);

                            return;
                        }

                        // look for firmware.bin file
                        const firmwareBinData = unzipped["firmware.bin"];
                        if (!firmwareBinData) {
                            resolve(null);

                            return;
                        }

                        // create File object from extracted data
                        const firmwareBlob = new Blob([new Uint8Array(firmwareBinData)], {
                            type: "application/octet-stream",
                        });
                        const firmwareFile = new File([firmwareBlob], "firmware.bin", {
                            type: "application/octet-stream",
                        });

                        resolve(firmwareFile);
                    });
                } catch (error) {
                    reject(error);
                }
            },
        );
    }
}
