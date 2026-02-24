import { Injectable } from "@angular/core";

import { TileGridHelper } from "../utils/tile-grid.helper";
import {
    GridConfig,
    GridRect,
    PlacedTile,
    TileDragSession,
    TilePosition,
} from "../utils/tile-layout.interfaces";

import { DragOverResult, DragStrategy, DropResult } from "./drag-strategy";

interface PlaceTarget {
    position: TilePosition;
    otherPositions: Array<TilePosition>;
}

/**
 * Handles place drag operations (dragging a new tile from palette to grid).
 * No swapping logic — placement must find an empty spot.
 */
@Injectable()
export class PlaceDragStrategy implements DragStrategy {
    handleDragOver(
        clientX: number,
        clientY: number,
        gridRect: GridRect,
        session: TileDragSession,
        placedTiles: Array<PlacedTile>,
        gridConfig: GridConfig,
    ): DragOverResult | undefined {
        const { position, otherPositions }: PlaceTarget = this.calculatePlaceTarget(
            clientX,
            clientY,
            gridRect,
            session,
            placedTiles,
            gridConfig,
        );

        return {
            highlightPosition: position,
            isValid: TileGridHelper.isPlacementValid(
                position,
                otherPositions,
                gridConfig.rows,
                gridConfig.columns,
            ),
        };
    }

    handleDrop(
        clientX: number,
        clientY: number,
        gridRect: GridRect,
        session: TileDragSession,
        placedTiles: Array<PlacedTile>,
        gridConfig: GridConfig,
    ): DropResult | undefined {
        const { position, otherPositions }: PlaceTarget = this.calculatePlaceTarget(
            clientX,
            clientY,
            gridRect,
            session,
            placedTiles,
            gridConfig,
        );

        if (!TileGridHelper.isPlacementValid(position, otherPositions, gridConfig.rows, gridConfig.columns)) {
            return undefined;
        }

        const placedTile: PlacedTile = { id: session.id, position };

        return {
            tiles: [...placedTiles, placedTile],
        };
    }

    private calculatePlaceTarget(
        clientX: number,
        clientY: number,
        gridRect: GridRect,
        session: TileDragSession,
        placedTiles: Array<PlacedTile>,
        gridConfig: GridConfig,
    ): PlaceTarget {
        const position = TileGridHelper.calculateDropPosition(
            clientX,
            clientY,
            gridRect,
            gridConfig.rows,
            gridConfig.columns,
            session.rowSpan,
            session.columnSpan,
        );

        const otherPositions = placedTiles.map((placedTile: PlacedTile): TilePosition => placedTile.position);

        return { position, otherPositions };
    }
}
