import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import { SpinnerOverlayComponent } from "./spinner-overlay.component";
import { SpinnerOverlayService } from "./spinner-overlay.service";

@NgModule({
    declarations: [SpinnerOverlayComponent],
    imports: [CommonModule, MatProgressSpinnerModule],
    exports: [SpinnerOverlayComponent],
    providers: [SpinnerOverlayService],
})
export class SpinnerOverlayModule {}
