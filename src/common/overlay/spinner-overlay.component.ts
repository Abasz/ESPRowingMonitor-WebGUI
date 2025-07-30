import { ChangeDetectionStrategy, Component, EventEmitter, signal, WritableSignal } from "@angular/core";
import { MatProgressSpinner } from "@angular/material/progress-spinner";

import { SpinnerOverlayRef } from "./spinner-overlay-ref";

@Component({
    selector: "app-spinner",
    templateUrl: "./spinner-overlay.component.html",
    styleUrls: ["./spinner-overlay.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatProgressSpinner],
})
export class SpinnerOverlayComponent {
    readonly animationState: WritableSignal<"void" | "enter" | "leave"> = signal("void");
    readonly animationStateChanged: EventEmitter<AnimationEvent> = new EventEmitter<AnimationEvent>();

    constructor(public dialogRef: SpinnerOverlayRef) {}

    onAnimationDone(event: AnimationEvent): void {
        this.animationStateChanged.emit(event);
    }

    onAnimationStart(event: AnimationEvent): void {
        this.animationStateChanged.emit(event);
    }

    startExitAnimation(): void {
        this.animationState.set("leave");
    }
}
