import { computed, Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { Observable, Subject } from "rxjs";

import { PlacedTile, TileDefinition } from "../utils/tile-layout.interfaces";

/**
 * Describes the outcome of a completed drag-and-drop operation.
 */
export interface TileDragDropResult {
    /** The final array of placed tiles after the drop. */
    readonly placedTiles: Array<PlacedTile>;

    /** Set when a tile was dragged from the palette onto the grid (consumer should remove it from available). */
    readonly placedFromPalette?: string;

    /** Set when a tile was dragged from the grid back to the palette (consumer should add it to available). */
    readonly movedToPalette?: string;
}

/**
 * Internal DnD state service — the single source of truth for tile state
 * during drag operations.
 *
 * The grid component syncs its `tiles` and `tileDefinitions` inputs into this
 * service via two effects (with `allowSignalWrites: true`). Both signals are
 * independently writable so `notifyDrop` can commit the result immediately
 * before the parent propagates.
 *
 * `committedTiles` uses a shallow (identity-per-element) equality function so
 * that a spread at the call site does not cause a redundant render cycle.
 *
 * Drop results are emitted via the {@link drop$} observable; the grid
 * subscribes and re-emits via its `tileDrop` output.
 */
@Injectable()
export class DndStateService {
    /**
     * Committed (non-preview) tiles. Kept in sync with the grid's `tiles` input
     * by an effect in `TileGridComponent`; writable so `notifyDrop` can commit
     * the result immediately.
     *
     * Shallow (per-element identity) equality prevents a redundant render when
     * a caller spreads the array before passing it back as an input.
     */
    readonly committedTiles: WritableSignal<Array<PlacedTile>> = signal<Array<PlacedTile>>([]);

    /**
     * Tile type definitions. Kept in sync with the grid's `tileDefinitions` input
     * by an effect in `TileGridComponent`; writable so isolated unit tests can
     * seed definitions without connecting sources.
     */
    readonly tileDefinitions: WritableSignal<ReadonlyArray<TileDefinition>> = signal<
        ReadonlyArray<TileDefinition>
    >([]);

    readonly displayTiles: Signal<Array<PlacedTile>> = computed(
        (): Array<PlacedTile> => this.previewOverride() ?? this.committedTiles(),
    );

    readonly isSwapPreviewActive: Signal<boolean> = computed(
        (): boolean => this.previewOverride() !== undefined,
    );

    /** Emits once per completed drop; consumers subscribe rather than poll state. */
    readonly drop$: Observable<TileDragDropResult>;

    private readonly previewOverride: WritableSignal<Array<PlacedTile> | undefined> = signal<
        Array<PlacedTile> | undefined
    >(undefined);

    private readonly _drop$: Subject<TileDragDropResult> = new Subject<TileDragDropResult>();

    constructor() {
        this.drop$ = this._drop$.asObservable();
    }

    /**
     * Called by the drag engine to set or clear the preview tile layout
     * shown during a drag operation. Pass `undefined` to clear the preview
     * and revert to committed tiles.
     */
    setPreviewOverride(tiles: Array<PlacedTile> | undefined): void {
        this.previewOverride.set(tiles);
    }

    notifyDrop(result: TileDragDropResult): void {
        this.committedTiles.set(result.placedTiles);
        this.previewOverride.set(undefined);
        this._drop$.next(result);
    }

    getDefinition(id: string): TileDefinition | undefined {
        return this.tileDefinitions().find((definition: TileDefinition): boolean => definition.id === id);
    }
}
