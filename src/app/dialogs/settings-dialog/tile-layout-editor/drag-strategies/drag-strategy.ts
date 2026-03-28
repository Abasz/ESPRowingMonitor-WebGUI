import {
    GridConfig,
    GridRect,
    PlacedTile,
    TileDragSession,
    TilePosition,
} from "../utils/tile-layout.interfaces";

export interface DragOverResult {
    highlightPosition: TilePosition;
    isValid: boolean;
    previewTiles?: Array<PlacedTile>;
}

export interface DropResult {
    tiles: Array<PlacedTile>;
}

export interface DragStrategy {
    handleDragOver(
        clientX: number,
        clientY: number,
        gridRect: GridRect,
        session: TileDragSession,
        placedTiles: Array<PlacedTile>,
        gridConfig: GridConfig,
    ): DragOverResult | undefined;

    handleDrop(
        clientX: number,
        clientY: number,
        gridRect: GridRect,
        session: TileDragSession,
        placedTiles: Array<PlacedTile>,
        gridConfig: GridConfig,
    ): DropResult | undefined;
}
