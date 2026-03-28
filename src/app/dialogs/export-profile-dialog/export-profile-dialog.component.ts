import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    FormControl,
    FormGroup,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";
import { MatButton } from "@angular/material/button";
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";

export interface ExportProfileDialogResult {
    deviceName: string;
    modelNumber: string;
}

type ExportProfileForm = FormGroup<{
    deviceName: FormControl<string>;
    modelNumber: FormControl<string>;
}>;

@Component({
    selector: "app-export-profile-dialog",
    templateUrl: "./export-profile-dialog.component.html",
    styleUrls: ["./export-profile-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatButton,
        MatFormField,
        MatLabel,
        MatError,
        MatInput,
    ],
})
export class ExportProfileDialogComponent {
    readonly exportForm: ExportProfileForm = this.fb.group({
        deviceName: [
            "Custom Rower",
            [Validators.required, Validators.maxLength(18), Validators.pattern(/^[A-Za-z0-9_ -]+$/)],
        ],
        modelNumber: ["Generic", [Validators.required]],
    });

    constructor(
        private fb: NonNullableFormBuilder,
        private dialogRef: MatDialogRef<ExportProfileDialogComponent, ExportProfileDialogResult>,
    ) {}

    onExport(): void {
        if (this.exportForm.invalid) {
            return;
        }

        this.dialogRef.close(this.exportForm.getRawValue());
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}
