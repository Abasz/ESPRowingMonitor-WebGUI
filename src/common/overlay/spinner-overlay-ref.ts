import { AnimationEvent } from "@angular/animations";
import { OverlayRef } from "@angular/cdk/overlay";
import { filter, take } from "rxjs/operators";

import { SpinnerOverlayComponent } from "./spinner-overlay.component";

export class SpinnerOverlayRef {
    componentInstance: SpinnerOverlayComponent | undefined;

    constructor(private overlayRef: OverlayRef) {}

    close(): void {
        this.componentInstance &&
            this.componentInstance.animationStateChanged
                .pipe(
                    filter((event: AnimationEvent): boolean => event.phaseName === "start"),
                    take(1),
                )
                .subscribe((): void => {
                    this.overlayRef.detachBackdrop();
                });

        this.componentInstance &&
            this.componentInstance.animationStateChanged
                .pipe(
                    filter(
                        (event: AnimationEvent): boolean =>
                            event.phaseName === "done" && event.toState === "leave",
                    ),
                    take(1),
                )
                .subscribe((): void => {
                    this.overlayRef.dispose();

                    this.componentInstance = undefined;
                });

        this.componentInstance && this.componentInstance.startExitAnimation();
    }
}
