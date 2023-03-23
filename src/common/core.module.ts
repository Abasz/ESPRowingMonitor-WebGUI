import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MAT_SNACK_BAR_DEFAULT_OPTIONS, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatToolbarModule } from "@angular/material/toolbar";
import { NgChartsModule } from "ng2-charts";

import { SpinnerOverlayModule } from "./overlay/spinner-overlay.module";
import { BatteryLevelPipe } from "./utils/battery-level.pipe";
import { CustomNumberPipe } from "./utils/custom-number.pipe";
import { EnumToArrayPipe } from "./utils/enum-to-array.pipe";
import { SecondsToTimePipe } from "./utils/seconds-to-time.pipe";

const MODULES = [
    SpinnerOverlayModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatToolbarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatSelectModule,
    NgChartsModule,
];

const DECLARATIONS = [SecondsToTimePipe, CustomNumberPipe, BatteryLevelPipe, EnumToArrayPipe];

@NgModule({
    imports: MODULES,
    declarations: DECLARATIONS,
    exports: [...DECLARATIONS, ...MODULES],
    providers: [
        {
            provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
            useValue: {
                duration: 5000,
                verticalPosition: "top",
                horizontalPosition: "end",
            },
        },
    ],
})
export class CoreModule {}
