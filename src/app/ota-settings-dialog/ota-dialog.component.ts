import { DecimalPipe } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    Inject,
    signal,
    Signal,
    WritableSignal,
} from "@angular/core";
import { MatButton } from "@angular/material/button";
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogActions,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
} from "@angular/material/dialog";
import { MatProgressBar } from "@angular/material/progress-bar";
import { MatSnackBar } from "@angular/material/snack-bar";
import { firstValueFrom, map } from "rxjs";

import { OtaError } from "../../common/ble.interfaces";
import { SnackBarConfirmComponent } from "../../common/snack-bar-confirm/snack-bar-confirm.component";
import { BytePipe } from "../../common/utils/bytes.pipe";
import { SecondsToTimePipe } from "../../common/utils/seconds-to-time.pipe";

import { OtaResultDialogComponent } from "./ota-result-dialog.component";
import { OtaService } from "./ota.service";

const fullMessage: { [key: string]: string } = {
    timeOut: "Request has timed out, probably device has disconnected",
    checksumError: "Invalid firmware file",
    incorrectFirmwareSize: "Invalid firmware file",
    internalStorageError: "Invalid firmware file",
    default: "Unknown error occurred",
};

enum UpdateState {
    InProgress,
    Completed,
    Errored,
    Aborting,
}

@Component({
    selector: "app-ota-dialog",
    templateUrl: "./ota-dialog.component.html",
    styleUrls: ["./ota-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatProgressBar,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatButton,
        BytePipe,
        SecondsToTimePipe,
        DecimalPipe,
    ],
    providers: [OtaService],
})
export class OtaDialogComponent {
    readonly UpdateState: typeof UpdateState = UpdateState;
    readonly progress: Signal<number>;
    readonly updateState: WritableSignal<UpdateState> = signal(UpdateState.InProgress);

    constructor(
        private snack: MatSnackBar,
        private dialogRef: MatDialogRef<OtaDialogComponent>,
        private dialog: MatDialog,
        private otaService: OtaService,
        @Inject(MAT_DIALOG_DATA)
        public data: {
            firmwareSize: number;
            file: File;
        },
    ) {
        this.progress = computed((): number => this.otaService.progress() / 1000);
        this.initOta();
    }

    async cancelUpdate(): Promise<void> {
        const isAbortConfirmed = await firstValueFrom(
            this.snack
                .openFromComponent(SnackBarConfirmComponent, {
                    duration: undefined,
                    data: { text: "Abort firmware update?", confirm: "Yes" },
                })
                .onAction()
                .pipe(map((): boolean => true)),
            { defaultValue: false },
        );
        if (!isAbortConfirmed) {
            return;
        }

        try {
            this.updateState.set(UpdateState.Aborting);
            await this.otaService.abortOta();
        } catch (e: unknown) {
            if (e instanceof OtaError) {
                this.openOtaResultDialog(
                    e.name.pascalCaseToSentence(),
                    fullMessage[e.message.toFirstLowerCase()] ?? fullMessage.default,
                );
            } else {
                console.error(e);
                this.openOtaResultDialog("Abort error", fullMessage.default);
            }
        }
        this.dialogRef.close();
    }

    async initOta(): Promise<void> {
        try {
            await this.otaService.performOta(this.data.file);
            if (this.progress() === this.data.firmwareSize) {
                this.updateState.set(UpdateState.Completed);
                this.openOtaResultDialog(
                    "Update complete",
                    "Firmware update was successful, device will restart",
                );
                this.dialogRef.close();
            }
        } catch (e: unknown) {
            this.updateState.set(UpdateState.Errored);
            if (e instanceof OtaError) {
                this.openOtaResultDialog(
                    e.name.pascalCaseToSentence(),
                    fullMessage[e.message.toFirstLowerCase()] ?? fullMessage.default,
                );
            } else {
                console.error(e);
                this.openOtaResultDialog("Update error", fullMessage.default);
            }
            this.dialogRef.close();
        }
    }

    private openOtaResultDialog(title: string, message: string): void {
        this.dialog.open(OtaResultDialogComponent, {
            autoFocus: false,
            data: {
                title,
                message,
            },
        });
    }
}
