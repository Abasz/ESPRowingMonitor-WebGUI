import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";
import { MatButton } from "@angular/material/button";
import {
    MAT_SNACK_BAR_DATA,
    MatSnackBarAction,
    MatSnackBarActions,
    MatSnackBarLabel,
    MatSnackBarRef,
} from "@angular/material/snack-bar";

@Component({
    templateUrl: "./snack-bar-confirm.component.html",
    styleUrls: ["./snack-bar-confirm.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatSnackBarLabel, MatSnackBarActions, MatButton, MatSnackBarAction],
})
export class SnackBarConfirmComponent {
    constructor(
        @Inject(MAT_SNACK_BAR_DATA) public data: { text: string; confirm?: string; cancel?: string },
        private snackRef: MatSnackBarRef<SnackBarConfirmComponent>,
    ) {}

    cancel(): void {
        this.snackRef.dismiss();
    }

    confirmed(): void {
        this.snackRef.dismissWithAction();
    }
}
