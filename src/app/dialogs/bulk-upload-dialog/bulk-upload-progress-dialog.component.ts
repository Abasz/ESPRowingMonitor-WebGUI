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
    MatDialogActions,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
} from "@angular/material/dialog";
import { MatProgressBar } from "@angular/material/progress-bar";

import { BulkUploadResult, IntervalsIcuService } from "../../../common/services/intervals-icu.service";

@Component({
    selector: "app-bulk-upload-progress-dialog",
    templateUrl: "./bulk-upload-progress-dialog.component.html",
    styleUrls: ["./bulk-upload-progress-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton, MatProgressBar],
})
export class BulkUploadProgressDialogComponent {
    readonly uploaded: WritableSignal<number> = signal<number>(0);
    readonly failed: WritableSignal<number> = signal<number>(0);
    readonly total: WritableSignal<number> = signal<number>(0);
    readonly result: WritableSignal<BulkUploadResult | undefined> = signal<BulkUploadResult | undefined>(
        undefined,
    );

    readonly progressPercent: Signal<number> = computed((): number => {
        const total = this.total();

        return total > 0 ? ((this.uploaded() + this.failed()) / total) * 100 : 0;
    });

    readonly progressMode: Signal<"determinate" | "indeterminate"> = computed(
        (): "determinate" | "indeterminate" => {
            const total = this.total();
            const result = this.result();

            return total > 0 || result !== undefined ? "determinate" : "indeterminate";
        },
    );

    constructor(
        private dialogRef: MatDialogRef<BulkUploadProgressDialogComponent>,
        private intervalsService: IntervalsIcuService,
        @Inject(MAT_DIALOG_DATA)
        public data: { resetTracking: boolean },
    ) {
        this.dialogRef.disableClose = true;
        void this.startUpload();
    }

    onCancel(): void {
        this.intervalsService.cancelBulkUpload();
    }

    onClose(): void {
        this.dialogRef.close();
    }

    private async startUpload(): Promise<void> {
        try {
            const uploadResult = await this.intervalsService.runBulkUpload(
                this.data.resetTracking,
                (uploaded: number, failed: number, total: number): void => {
                    this.total.set(total);
                    this.uploaded.set(uploaded);
                    this.failed.set(failed);
                },
            );

            this.uploaded.set(uploadResult.uploaded);
            this.failed.set(uploadResult.failed);
            this.result.set(uploadResult);
        } catch {
            this.result.set({ uploaded: this.uploaded(), failed: this.failed(), cancelled: false });
        } finally {
            this.dialogRef.disableClose = false;
        }
    }
}
