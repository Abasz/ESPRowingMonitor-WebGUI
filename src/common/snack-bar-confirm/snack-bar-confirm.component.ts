import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from "@angular/material/snack-bar";

@Component({
    templateUrl: "./snack-bar-confirm.component.html",
    styleUrls: ["./snack-bar-confirm.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SnackBarConfirmComponent {
    constructor(
        @Inject(MAT_SNACK_BAR_DATA) public text: string,
        private snackRef: MatSnackBarRef<SnackBarConfirmComponent>
    ) {}

    cancel(): void {
        this.snackRef.dismiss();
    }

    confirmed(): void {
        this.snackRef.dismissWithAction();
    }
}
