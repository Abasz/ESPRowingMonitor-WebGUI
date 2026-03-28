import { computed, Directive, ElementRef, input, InputSignal, Signal } from "@angular/core";

import { DragCoordinator } from "../services/drag-coordinator.service";
import { DragSessionManager } from "../services/drag-session-manager.service";
import { PlacedTile, ResizeDirection } from "../utils/tile-layout.interfaces";

/**
 * Configuration for a single resize handle, defining its direction(s), visual symbol, and unique key.
 */
export interface ResizeHandleConfig {
    readonly directions: Array<ResizeDirection>;
    readonly symbol: string;
    readonly key: string;
}

/**
 * All resize handle configurations for a tile.
 * Used by the template to generate resize handles via `@for`.
 */
export const RESIZE_HANDLE_CONFIGS: ReadonlyArray<ResizeHandleConfig> = [
    { directions: ["right"], symbol: "⋮", key: "right" },
    { directions: ["bottom"], symbol: "⋯", key: "bottom" },
    { directions: ["left"], symbol: "⋮", key: "left" },
    { directions: ["top"], symbol: "⋯", key: "top" },
    { directions: ["right", "bottom"], symbol: "↘", key: "corner-br" },
    { directions: ["left", "top"], symbol: "↖", key: "corner-tl" },
    { directions: ["right", "top"], symbol: "↗", key: "corner-tr" },
    { directions: ["left", "bottom"], symbol: "↙", key: "corner-bl" },
];

interface HandlePositionConfig {
    cursor: string;
    styles: Record<string, string>;
}

const EDGE_SIZE = "12px";
const CORNER_SIZE = "16px";

function getHandlePositionConfig(directions: Array<ResizeDirection>): HandlePositionConfig {
    const isCorner = directions.length > 1;
    const hasRight = directions.includes("right");
    const hasLeft = directions.includes("left");
    const hasBottom = directions.includes("bottom");

    if (isCorner) {
        const cursor =
            (hasLeft && !hasRight && !hasBottom) || (hasRight && hasBottom) ? "nwse-resize" : "nesw-resize";

        return {
            cursor,
            styles: {
                width: CORNER_SIZE,
                height: CORNER_SIZE,
                ...(hasRight ? { right: "0" } : { left: "0" }),
                ...(hasBottom ? { bottom: "0" } : { top: "0" }),
                fontSize: "12px",
            },
        };
    }

    if (hasRight || hasLeft) {
        return {
            cursor: "ew-resize",
            styles: {
                [hasRight ? "right" : "left"]: "0",
                top: "0",
                height: "100%",
                width: EDGE_SIZE,
                writingMode: "vertical-lr",
            },
        };
    }

    // top or bottom
    return {
        cursor: "ns-resize",
        styles: {
            [hasBottom ? "bottom" : "top"]: "0",
            left: "0",
            width: "100%",
            height: EDGE_SIZE,
            lineHeight: "0",
        },
    };
}

/**
 * Directive for tile resize handles that encapsulates structural CSS positioning
 * and handles drag initiation for resize operations. Calls the DragCoordinator
 * directly instead of emitting events.
 *
 * Structural CSS (position, dimensions, cursor) and visual defaults (font-size,
 * color, opacity) are applied declaratively via a computed `[style]` host binding
 * based on the resize direction(s). Hover effects (opacity, background highlight)
 * remain in the component stylesheet and can be overridden via `--dnd-*` CSS
 * custom property tokens.
 */
@Directive({
    selector: "[dndTileResizeHandle]",
    host: {
        "(mousedown)": "onMouseDown($event)",
        "(touchstart)": "onTouchStart($event)",
        "[style]": "hostStyles()",
    },
})
export class TileResizeHandleDirective {
    readonly directions: InputSignal<Array<ResizeDirection>> = input.required<Array<ResizeDirection>>({
        alias: "dndTileResizeHandle",
    });
    readonly tile: InputSignal<PlacedTile> = input.required<PlacedTile>();

    readonly hostStyles: Signal<Record<string, string>> = computed((): Record<string, string> => {
        const config = getHandlePositionConfig(this.directions());

        return {
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            touchAction: "none",
            userSelect: "none",
            cursor: config.cursor,
            fontSize: "10px",
            color: "var(--mat-sys-on-primary-container)",
            opacity: "0.5",
            ...config.styles,
        };
    });

    constructor(
        private readonly elementRef: ElementRef<HTMLElement>,
        private readonly sessionManager: DragSessionManager,
        private readonly coordinator: DragCoordinator,
    ) {}

    onMouseDown(event: MouseEvent): void {
        if (this.sessionManager.dragSession()) {
            return;
        }
        event.stopPropagation();
        event.preventDefault();
        this.coordinator.startResizeDrag(
            event,
            this.tile(),
            this.directions(),
            this.elementRef.nativeElement,
            "mouse",
        );
    }

    onTouchStart(event: TouchEvent): void {
        if (event.touches.length !== 1) {
            return;
        }
        if (this.sessionManager.dragSession()) {
            return;
        }
        event.stopPropagation();
        event.preventDefault();
        this.coordinator.startResizeDrag(
            event,
            this.tile(),
            this.directions(),
            this.elementRef.nativeElement,
            "touch",
        );
    }
}
