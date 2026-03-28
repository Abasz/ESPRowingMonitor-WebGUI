import { Injectable } from "@angular/core";

import { TileGridHelper } from "../utils/tile-grid.helper";
import {
    GridConfig,
    GridRect,
    MoveDragSession,
    PlacedTile,
    TileDragSession,
    TileId,
    TilePosition,
} from "../utils/tile-layout.interfaces";

import { DragOverResult, DragStrategy, DropResult } from "./drag-strategy";

interface MoveTarget {
    position: TilePosition;
    otherPositions: Array<TilePosition>;
}

/**
 * Handles move drag operations (moving an existing tile within the grid).
 * Supports direct placement when the target is free, and tile swapping
 * when the target overlaps other tiles.
 */
@Injectable()
export class MoveDragStrategy implements DragStrategy {
    handleDragOver(
        clientX: number,
        clientY: number,
        gridRect: GridRect,
        session: TileDragSession,
        placedTiles: Array<PlacedTile>,
        gridConfig: GridConfig,
    ): DragOverResult | undefined {
        if (session.actionType !== "move") {
            return undefined;
        }

        const { position, otherPositions }: MoveTarget = this.calculateMoveTarget(
            clientX,
            clientY,
            gridRect,
            session,
            placedTiles,
            gridConfig,
        );

        if (TileGridHelper.isPlacementValid(position, otherPositions, gridConfig.rows, gridConfig.columns)) {
            return {
                highlightPosition: position,
                isValid: true,
            };
        }

        const swapPositions = TileGridHelper.findSwapPositions(
            position,
            session.id,
            session.originalPosition,
            placedTiles,
            gridConfig.rows,
            gridConfig.columns,
        );

        if (!swapPositions) {
            return {
                highlightPosition: position,
                isValid: false,
            };
        }

        const previewOtherPlacedTiles = placedTiles
            .filter((placedTile: PlacedTile): boolean => placedTile.id !== session.id)
            .map((placedTile: PlacedTile): PlacedTile => {
                const swapPos = swapPositions.get(placedTile.id);

                return swapPos ? { ...placedTile, position: swapPos } : placedTile;
            });

        // we must include the dragged tile in the target position so we avoid mobiles browsers sending touchcancel event cancelling the drag (and leaving floating tile). The tile is hidden by the `.dragging` CSS class on TileDragComponent to avoid visualization of this.
        const draggedTile = placedTiles.find(
            (placedTile: PlacedTile): boolean => placedTile.id === session.id,
        );
        const previewTiles: Array<PlacedTile> = draggedTile
            ? [{ ...draggedTile, position }, ...previewOtherPlacedTiles]
            : previewOtherPlacedTiles;

        return {
            highlightPosition: position,
            isValid: true,
            previewTiles,
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
        if (session.actionType !== "move") {
            return undefined;
        }

        const { position, otherPositions }: MoveTarget = this.calculateMoveTarget(
            clientX,
            clientY,
            gridRect,
            session,
            placedTiles,
            gridConfig,
        );

        if (TileGridHelper.isPlacementValid(position, otherPositions, gridConfig.rows, gridConfig.columns)) {
            const tiles = placedTiles.map(
                (placedTile: PlacedTile): PlacedTile =>
                    placedTile.id === session.id ? { ...placedTile, position } : placedTile,
            );

            return { tiles };
        }

        const swapPositions = TileGridHelper.findSwapPositions(
            position,
            session.id,
            session.originalPosition,
            placedTiles,
            gridConfig.rows,
            gridConfig.columns,
        );

        if (!swapPositions) {
            return undefined;
        }

        const tiles = this.applySwapToTiles(placedTiles, session, position, swapPositions);

        return { tiles };
    }

    private applySwapToTiles(
        placedTiles: Array<PlacedTile>,
        session: TileDragSession,
        position: TilePosition,
        swapPositions: Map<TileId, TilePosition>,
    ): Array<PlacedTile> {
        return placedTiles.map((placedTile: PlacedTile): PlacedTile => {
            if (placedTile.id === session.id) {
                return { ...placedTile, position };
            }

            const swapPos = swapPositions.get(placedTile.id);

            if (swapPos) {
                return { ...placedTile, position: swapPos };
            }

            return placedTile;
        });
    }

    private calculateMoveTarget(
        clientX: number,
        clientY: number,
        gridRect: GridRect,
        session: MoveDragSession,
        placedTiles: Array<PlacedTile>,
        gridConfig: GridConfig,
    ): MoveTarget {
        const position = TileGridHelper.calculateDropPosition(
            clientX,
            clientY,
            gridRect,
            gridConfig.rows,
            gridConfig.columns,
            session.rowSpan,
            session.columnSpan,
            session.grabOffsetRow,
            session.grabOffsetCol,
        );

        const otherPositions = placedTiles
            .filter((placedTile: PlacedTile): boolean => placedTile.id !== session.id)
            .map((placedTile: PlacedTile): TilePosition => placedTile.position);

        return { position, otherPositions };
    }
}
