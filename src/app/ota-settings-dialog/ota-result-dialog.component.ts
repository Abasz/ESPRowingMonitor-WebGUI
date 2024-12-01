import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";
import { MatButton } from "@angular/material/button";
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
} from "@angular/material/dialog";

import { OtaService } from "./ota.service";

@Component({
    selector: "app-ota-result-dialog",
    templateUrl: "./ota-result-dialog.component.html",
    styleUrls: ["./ota-result-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton],
    providers: [OtaService],
})
export class OtaResultDialogComponent {
    constructor(
        @Inject(MAT_DIALOG_DATA)
        public data: {
            title: string;
            message: string;
        },
    ) {}
}
