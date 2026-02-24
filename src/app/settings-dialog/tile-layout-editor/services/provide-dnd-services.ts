import { Provider } from "@angular/core";

import { MoveDragStrategy } from "../drag-strategies/move-drag-strategy.service";
import { PlaceDragStrategy } from "../drag-strategies/place-drag-strategy.service";
import { ResizeDragStrategy } from "../drag-strategies/resize-drag-strategy.service";

import { DndStateService } from "./dnd-state.service";
import { DragCoordinator } from "./drag-coordinator.service";
import { DragPreviewRenderer } from "./drag-preview-renderer.service";
import { DragSessionManager } from "./drag-session-manager.service";
import { TileHighlightManager } from "./tile-highlight-manager.service";

/**
 * Bundles all DnD library-internal providers into a single helper.
 *
 * Usage:
 * ```ts
 * providers: [...provideDndServices()]
 * ```
 *
 * This keeps the consumer's providers array clean and decouples it from
 * the internal structure of the DnD library.
 */
export function provideDndServices(): Array<Provider> {
    return [
        DndStateService,
        DragCoordinator,
        DragPreviewRenderer,
        DragSessionManager,
        MoveDragStrategy,
        PlaceDragStrategy,
        ResizeDragStrategy,
        TileHighlightManager,
    ];
}
