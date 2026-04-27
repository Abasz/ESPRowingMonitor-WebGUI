import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";
import { MatButton } from "@angular/material/button";
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
} from "@angular/material/dialog";

export type BulkUploadPromptResult = "upload-all" | "upload-all-reset" | "keep-existing" | "skip";

@Component({
    selector: "app-bulk-upload-prompt-dialog",
    templateUrl: "./bulk-upload-prompt-dialog.component.html",
    styleUrls: ["./bulk-upload-prompt-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton],
})
export class BulkUploadPromptDialogComponent {
    constructor(
        private dialogRef: MatDialogRef<BulkUploadPromptDialogComponent, BulkUploadPromptResult>,
        @Inject(MAT_DIALOG_DATA)
        public data: { isFirstSetup: boolean },
    ) {}

    onSkipAction(): void {
        this.dialogRef.close("skip");
    }

    onSecondaryAction(): void {
        this.dialogRef.close("keep-existing");
    }

    onPrimaryAction(): void {
        this.dialogRef.close(this.data.isFirstSetup ? "upload-all" : "upload-all-reset");
    }
}
