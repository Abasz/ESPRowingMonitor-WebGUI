import { Injectable, signal, WritableSignal } from "@angular/core";

import {
    PlacedTile,
    ResizeDirection,
    TileDefinition,
    TileDragSession,
} from "../utils/tile-layout.interfaces";

/**
 * Manages the current drag session state including session creation and querying.
 */
@Injectable()
export class DragSessionManager {
    readonly dragSession: WritableSignal<TileDragSession | undefined> = signal<TileDragSession | undefined>(
        undefined,
    );

    startMoveSession(
        placedTile: PlacedTile,
        grabOffsetRow?: number,
        grabOffsetCol?: number,
        startX?: number,
        startY?: number,
    ): void {
        this.dragSession.set({
            actionType: "move",
            id: placedTile.id,
            rowSpan: placedTile.position.rowSpan,
            columnSpan: placedTile.position.columnSpan,
            originalPosition: { ...placedTile.position },
            grabOffsetRow,
            grabOffsetCol,
            startX,
            startY,
        });
    }

    startPlaceSession(tileDefinition: TileDefinition, startX?: number, startY?: number): void {
        this.dragSession.set({
            actionType: "place",
            id: tileDefinition.id,
            rowSpan: tileDefinition.defaultRowSpan,
            columnSpan: tileDefinition.defaultColumnSpan,
            startX,
            startY,
        });
    }

    startResizeSession(
        placedTile: PlacedTile,
        directions: Array<ResizeDirection>,
        minRowSpan: number,
        minColumnSpan: number,
    ): void {
        this.dragSession.set({
            actionType: "resize",
            id: placedTile.id,
            rowSpan: placedTile.position.rowSpan,
            columnSpan: placedTile.position.columnSpan,
            originalPosition: { ...placedTile.position },
            resizeDirections: directions,
            minRowSpan,
            minColumnSpan,
        });
    }

    endSession(): void {
        this.dragSession.set(undefined);
    }
}
