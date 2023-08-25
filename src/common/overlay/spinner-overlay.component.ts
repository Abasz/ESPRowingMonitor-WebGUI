import { animate, AnimationEvent, state, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter } from "@angular/core";

import { SpinnerOverlayRef } from "./spinner-overlay-ref";

@Component({
    selector: "app-spinner",
    templateUrl: "./spinner-overlay.component.html",
    styleUrls: ["./spinner-overlay.component.scss"],
    animations: [
        trigger("fade", [
            state("void", style({ opacity: 0 })),
            state("enter", style({ opacity: 1 })),
            state("leave", style({ opacity: 0 })),
            transition("* => enter", animate("400ms cubic-bezier(0.25, 0.8, 0.25, 1)")),
            transition("* => leave", animate("200ms cubic-bezier(0.25, 0.8, 0.25, 1)")),
        ]),
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpinnerOverlayComponent {
    animationState: "void" | "enter" | "leave" = "enter";
    animationStateChanged: EventEmitter<AnimationEvent> = new EventEmitter<AnimationEvent>();

    constructor(
        public dialogRef: SpinnerOverlayRef,
        private cd: ChangeDetectorRef,
    ) {}

    onAnimationDone(event: AnimationEvent): void {
        this.animationStateChanged.emit(event);
    }

    onAnimationStart(event: AnimationEvent): void {
        this.animationStateChanged.emit(event);
    }

    startExitAnimation(): void {
        this.animationState = "leave";
        this.cd.markForCheck();
    }
}
