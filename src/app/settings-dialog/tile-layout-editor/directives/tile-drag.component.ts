import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";

import { DndStateService } from "../services/dnd-state.service";
import { DragCoordinator } from "../services/drag-coordinator.service";
import { DragSessionManager } from "../services/drag-session-manager.service";
import { pointerEventFromMouse, pointerEventFromTouch } from "../utils/pointer-event-data";
import { PlacedTile } from "../utils/tile-layout.interfaces";

import {
    RESIZE_HANDLE_CONFIGS,
    ResizeHandleConfig,
    TileResizeHandleDirective,
} from "./tile-resize-handle.directive";

/**
 * Lightweight wrapper component for draggable grid tiles.
 *
 * Follows the Material component pattern: uses an element selector
 * (`dnd-tile-drag`), projects consumer content via `<ng-content>`,
 * and owns its visual/interaction styles via a scoped stylesheet.
 *
 * Encapsulates:
 * - drag initiation (mousedown / touchstart → DragCoordinator)
 * - CSS state classes (`.dragging`, `.resizing`, `.resize-drag-active`)
 * - grid positioning (host bindings for grid-row/column-start/end)
 * - resize-handle rendering (internal template, not consumer concern)
 * - all tile visual & interaction styles (cursor, transitions, drag state)
 *
 * Consumers only project the tile's visible content (icon + label).
 * Override via `--dnd-*` CSS custom property tokens.
 */
@Component({
    selector: "dnd-tile-drag",
    template: `
        <div class="content">
            <ng-content></ng-content>
        </div>
        <div class="resize-controls">
            @for (handle of resizeHandleConfigs; track handle.key) {
                <div [class]="handle.key" [dndTileResizeHandle]="handle.directions" [tile]="tile()">
                    {{ handle.symbol }}
                </div>
            }
        </div>
    `,
    styleUrls: ["./tile-drag.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TileResizeHandleDirective],
    host: {
        "[class.dragging]": "isDragging()",
        "[class.swap-preview]": "isDraggingInSwapPreview()",
        "[class.resizing]": "isResizing()",
        "[class.resize-drag-active]": "isResizing()",
        "[style.grid-row-start]": "tile().position.rowStart",
        "[style.grid-column-start]": "tile().position.columnStart",
        "[style.grid-row-end]": "gridRowEnd()",
        "[style.grid-column-end]": "gridColumnEnd()",
        "(mousedown)": "onMouseDown($event)",
        "(touchstart)": "onTouchStart($event)",
    },
})
export class TileDragComponent {
    readonly tile: InputSignal<PlacedTile> = input.required<PlacedTile>();

    readonly isDragging: Signal<boolean> = computed((): boolean => {
        const session = this.sessionManager.dragSession();

        return session?.id === this.tile().id && session?.actionType === "move";
    });

    readonly isDraggingInSwapPreview: Signal<boolean> = computed(
        (): boolean => this.isDragging() && this.dndState.isSwapPreviewActive(),
    );

    readonly isResizing: Signal<boolean> = computed((): boolean => {
        const session = this.sessionManager.dragSession();

        return session?.id === this.tile().id && session?.actionType === "resize";
    });

    readonly gridRowEnd: Signal<string> = computed((): string => `span ${this.tile().position.rowSpan}`);

    readonly gridColumnEnd: Signal<string> = computed(
        (): string => `span ${this.tile().position.columnSpan}`,
    );

    readonly resizeHandleConfigs: ReadonlyArray<ResizeHandleConfig> = RESIZE_HANDLE_CONFIGS;

    constructor(
        private readonly sessionManager: DragSessionManager,
        private readonly coordinator: DragCoordinator,
        private readonly dndState: DndStateService,
    ) {}

    onMouseDown(event: MouseEvent): void {
        if (this.sessionManager.dragSession()) {
            return;
        }

        event.preventDefault();
        this.coordinator.startTileDrag(pointerEventFromMouse(event), this.tile());
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
        this.coordinator.startTileDrag(pointerEventFromTouch(event, event.touches[0]), this.tile());
        this.coordinator.registerListeners("touch");
    }
}
