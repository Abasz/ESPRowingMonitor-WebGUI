import { OverlayRef } from "@angular/cdk/overlay";
import { filter, take } from "rxjs/operators";

import { SpinnerOverlayComponent } from "./spinner-overlay.component";

export class SpinnerOverlayRef {
    componentInstance: SpinnerOverlayComponent | undefined;

    constructor(private overlayRef: OverlayRef) {}

    close(): void {
        if (!this.componentInstance) {
            return;
        }

        this.componentInstance.animationStateChanged.pipe(take(1)).subscribe((): void => {
            this.overlayRef.detachBackdrop();
        });

        this.componentInstance.animationStateChanged
            .pipe(
                filter((event: AnimationEvent): boolean => event.type === "animationend"),
                take(1),
            )
            .subscribe((): void => {
                this.overlayRef.dispose();
                this.componentInstance = undefined;
            });

        this.componentInstance.startExitAnimation();
    }
}
