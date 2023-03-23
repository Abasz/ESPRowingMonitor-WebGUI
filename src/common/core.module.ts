import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MAT_SNACK_BAR_DEFAULT_OPTIONS, MatSnackBarModule } from "@angular/material/snack-bar";
import { SpinnerOverlayModule } from "./overlay/spinner-overlay.module";
    SpinnerOverlayModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
@NgModule({
    imports: MODULES,
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
