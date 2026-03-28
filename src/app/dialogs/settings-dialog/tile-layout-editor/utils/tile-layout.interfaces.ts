export const LONG_PRESS_DELAY = 300;
export const MOVE_THRESHOLD = 10;

export interface TilePosition {
    rowStart: number;
    columnStart: number;
    rowSpan: number;
    columnSpan: number;
}

/** A string key that uniquely identifies a tile type (e.g. "distance"). */
export type TileId = string;

/** A tile instance that has been placed at a position on the grid. */
export interface PlacedTile {
    id: TileId;
    position: TilePosition;
}

/**
 * A tile definition that includes layout constraints and defaults.
 */
export interface TileDefinition {
    id: TileId;
    defaultRowSpan: number;
    defaultColumnSpan: number;
    minRowSpan: number;
    minColumnSpan: number;
}

export interface GridConfig {
    rows: number;
    columns: number;
}

export type GridCells = ReadonlyArray<{ row: number; column: number }>;
export interface GridRect {
    left: number;
    top: number;
    width: number;
    height: number;
}
export type ResizeDirection = "left" | "right" | "top" | "bottom";
export type DragActionType = "place" | "move" | "resize";

interface BaseDragSession {
    id: TileId;
    rowSpan: number;
    columnSpan: number;
    startX?: number;
    startY?: number;
}

export interface MoveDragSession extends BaseDragSession {
    actionType: "move";
    originalPosition: TilePosition;
    grabOffsetRow?: number;
    grabOffsetCol?: number;
}

export interface PlaceDragSession extends BaseDragSession {
    actionType: "place";
}

export interface ResizeDragSession extends BaseDragSession {
    actionType: "resize";
    originalPosition: TilePosition;
    resizeDirections: Array<ResizeDirection>;
    minRowSpan: number;
    minColumnSpan: number;
}

export type TileDragSession = MoveDragSession | PlaceDragSession | ResizeDragSession;
