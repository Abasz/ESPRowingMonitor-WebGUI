import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";

import { DragCoordinator } from "../services/drag-coordinator.service";
import { DragSessionManager } from "../services/drag-session-manager.service";
import { pointerEventFromMouse, pointerEventFromTouch } from "../utils/pointer-event-data";
import { TileDefinition } from "../utils/tile-layout.interfaces";

/**
 * Lightweight wrapper component for palette tiles.
 *
 * Follows the Material component pattern: uses an element selector
 * (`dnd-palette-drag`), projects consumer content via `<ng-content>`,
 * and owns its visual/interaction styles via a scoped stylesheet.
 *
 * Encapsulates:
 * - drag initiation (mousedown / touchstart → DragCoordinator)
 * - CSS state class (`.dragging`)
 * - palette item styles (cursor, transitions, drag state)
 *
 * Consumers only project the item's visible content (icon + label).
 * Override via `--dnd-*` CSS custom property tokens.
 */
@Component({
    selector: "dnd-palette-drag",
    template: "<ng-content></ng-content>",
    styleUrls: ["./palette-drag.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        "[class.dragging]": "isDragging()",
        "(mousedown)": "onMouseDown($event)",
        "(touchstart)": "onTouchStart($event)",
    },
})
export class PaletteDragComponent {
    readonly tileDefinition: InputSignal<TileDefinition> = input.required<TileDefinition>();

    readonly isDragging: Signal<boolean> = computed((): boolean => {
        const session = this.sessionManager.dragSession();

        return session?.id === this.tileDefinition().id && session?.actionType === "place";
    });

    constructor(
        private readonly sessionManager: DragSessionManager,
        private readonly coordinator: DragCoordinator,
    ) {}

    onMouseDown(event: MouseEvent): void {
        if (this.sessionManager.dragSession()) {
            return;
        }

        event.preventDefault();
        this.coordinator.startPaletteDrag(pointerEventFromMouse(event), this.tileDefinition());
        this.coordinator.registerListeners("mouse");
    }

    onTouchStart(event: TouchEvent): void {
        if (event.touches.length !== 1) {
            return;
        }

        if (this.sessionManager.dragSession()) {
            return;
        }

        event.preventDefault();
        this.coordinator.startPaletteDrag(
            pointerEventFromTouch(event, event.touches[0]),
            this.tileDefinition(),
        );
        this.coordinator.registerListeners("touch");
    }
}
