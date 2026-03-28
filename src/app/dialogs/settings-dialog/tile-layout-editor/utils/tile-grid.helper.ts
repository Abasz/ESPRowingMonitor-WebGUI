import { GridRect, PlacedTile, ResizeDirection, TilePosition } from "./tile-layout.interfaces";

export class TileGridHelper {
    static isPointInTile(row: number, column: number, tile: TilePosition): boolean {
        return (
            row >= tile.rowStart &&
            row <= tile.rowStart + tile.rowSpan - 1 &&
            column >= tile.columnStart &&
            column <= tile.columnStart + tile.columnSpan - 1
        );
    }

    static doTilesOverlap(tileA: TilePosition, tileB: TilePosition): boolean {
        return (
            TileGridHelper.doIntervalsIntersect(
                tileA.columnStart,
                tileA.columnStart + tileA.columnSpan - 1,
                tileB.columnStart,
                tileB.columnStart + tileB.columnSpan - 1,
            ) &&
            TileGridHelper.doIntervalsIntersect(
                tileA.rowStart,
                tileA.rowStart + tileA.rowSpan - 1,
                tileB.rowStart,
                tileB.rowStart + tileB.rowSpan - 1,
            )
        );
    }

    static isTileWithinGrid(tile: TilePosition, rowCount: number, colCount: number): boolean {
        return (
            tile.rowStart >= 1 &&
            tile.columnStart >= 1 &&
            tile.rowStart + tile.rowSpan - 1 <= rowCount &&
            tile.columnStart + tile.columnSpan - 1 <= colCount
        );
    }

    static isPlacementValid(
        tile: TilePosition,
        existingTiles: Array<TilePosition>,
        rowCount: number,
        colCount: number,
    ): boolean {
        return (
            TileGridHelper.isTileWithinGrid(tile, rowCount, colCount) &&
            !existingTiles.some((existing: TilePosition): boolean =>
                TileGridHelper.doTilesOverlap(tile, existing),
            )
        );
    }

    static calculateCellFromPoint(
        x: number,
        y: number,
        gridRect: GridRect,
        rowCount: number,
        columnCount: number,
    ): { row: number; column: number } {
        const cellWidth = gridRect.width / columnCount;
        const cellHeight = gridRect.height / rowCount;

        const relativeX = x - gridRect.left;
        const relativeY = y - gridRect.top;

        const column = Math.max(1, Math.min(Math.floor(relativeX / cellWidth) + 1, columnCount));
        const row = Math.max(1, Math.min(Math.floor(relativeY / cellHeight) + 1, rowCount));

        return { row, column };
    }

    static calculateDropPosition(
        pointerX: number,
        pointerY: number,
        gridRect: GridRect,
        rowCount: number,
        columnCount: number,
        rowSpan: number,
        columnSpan: number,
        grabOffsetRow?: number,
        grabOffsetCol?: number,
    ): TilePosition {
        const { row: mouseRow, column: mouseCol }: { row: number; column: number } =
            TileGridHelper.calculateCellFromPoint(pointerX, pointerY, gridRect, rowCount, columnCount);

        let rowStart = mouseRow - (grabOffsetRow ?? Math.floor((rowSpan - 1) / 2));
        let columnStart = mouseCol - (grabOffsetCol ?? Math.floor((columnSpan - 1) / 2));

        rowStart = Math.max(1, Math.min(rowStart, rowCount - rowSpan + 1));
        columnStart = Math.max(1, Math.min(columnStart, columnCount - columnSpan + 1));

        return { rowStart, columnStart, rowSpan, columnSpan };
    }

    static generateGridCells(rowCount: number, columnCount: number): Array<{ row: number; column: number }> {
        return TileGridHelper.generateGrid(1, 1, rowCount, columnCount);
    }

    static calculateResizePosition(
        originalPosition: TilePosition,
        mouseRow: number,
        mouseColumn: number,
        directions: Array<ResizeDirection>,
        minRowSpan: number,
        minColumnSpan: number,
    ): TilePosition {
        let rowStart: number = originalPosition.rowStart;
        let columnStart: number = originalPosition.columnStart;
        let rowSpan: number = originalPosition.rowSpan;
        let columnSpan: number = originalPosition.columnSpan;

        const originalRowEnd = rowStart + rowSpan - 1;
        const originalColumnEnd = columnStart + columnSpan - 1;

        for (const direction of directions) {
            switch (direction) {
                case "right":
                    columnSpan = Math.max(minColumnSpan, mouseColumn - columnStart + 1);
                    break;
                case "left": {
                    const newColumnStart = Math.min(mouseColumn, originalColumnEnd - minColumnSpan + 1);
                    columnSpan = originalColumnEnd - newColumnStart + 1;
                    columnStart = newColumnStart;
                    break;
                }
                case "bottom":
                    rowSpan = Math.max(minRowSpan, mouseRow - rowStart + 1);
                    break;
                case "top": {
                    const newRowStart = Math.min(mouseRow, originalRowEnd - minRowSpan + 1);
                    rowSpan = originalRowEnd - newRowStart + 1;
                    rowStart = newRowStart;
                    break;
                }
                default:
                    break;
            }
        }

        return { rowStart, columnStart, rowSpan, columnSpan };
    }

    static isPointInRect(x: number, y: number, rect: GridRect): boolean {
        return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
    }

    static calculateGrabOffset(
        element: HTMLElement | null,
        clientX: number,
        clientY: number,
        position: TilePosition,
    ): { grabOffsetRow: number | undefined; grabOffsetCol: number | undefined } {
        if (!element?.getBoundingClientRect) {
            return { grabOffsetRow: undefined, grabOffsetCol: undefined };
        }
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return { grabOffsetRow: undefined, grabOffsetCol: undefined };
        }
        const cellWidth = rect.width / position.columnSpan;
        const cellHeight = rect.height / position.rowSpan;

        return {
            grabOffsetCol: Math.max(
                0,
                Math.min(Math.floor((clientX - rect.left) / cellWidth), position.columnSpan - 1),
            ),
            grabOffsetRow: Math.max(
                0,
                Math.min(Math.floor((clientY - rect.top) / cellHeight), position.rowSpan - 1),
            ),
        };
    }

    static findSwapPositions(
        targetPosition: TilePosition,
        draggedTileType: string,
        originalPosition: TilePosition,
        allTiles: Array<PlacedTile>,
        rowCount: number,
        colCount: number,
    ): Map<string, TilePosition> | undefined {
        const overlapping = allTiles.filter(
            (placedTile: PlacedTile): boolean =>
                placedTile.id !== draggedTileType &&
                TileGridHelper.doTilesOverlap(targetPosition, placedTile.position),
        );

        if (overlapping.length === 0) {
            return undefined;
        }

        const overlappingTypes = new Set(overlapping.map((placedTile: PlacedTile): string => placedTile.id));

        const remainingPositions = allTiles
            .filter(
                (placedTile: PlacedTile): boolean =>
                    placedTile.id !== draggedTileType && !overlappingTypes.has(placedTile.id),
            )
            .map((placedTile: PlacedTile): TilePosition => placedTile.position);

        const occupiedCells = new Set<string>(
            [targetPosition, ...remainingPositions].flatMap(
                (pos: TilePosition): Array<string> => TileGridHelper.cellKeysForPosition(pos),
            ),
        );

        const swapPositions = new Map<string, TilePosition>();

        for (const tile of overlapping) {
            const pos =
                TileGridHelper.findPositionInArea(
                    tile.position.rowSpan,
                    tile.position.columnSpan,
                    originalPosition,
                    occupiedCells,
                ) ??
                TileGridHelper.findPositionInArea(
                    tile.position.rowSpan,
                    tile.position.columnSpan,
                    {
                        rowStart: 1,
                        columnStart: 1,
                        rowSpan: rowCount,
                        columnSpan: colCount,
                    },
                    occupiedCells,
                );
            if (!pos) {
                return undefined;
            }

            TileGridHelper.cellKeysForPosition(pos).forEach((key: string): void => {
                occupiedCells.add(key);
            });
            swapPositions.set(tile.id, pos);
        }

        return swapPositions;
    }

    static generateGrid(
        rowStart: number,
        columnStart: number,
        rowCount: number,
        columnCount: number,
    ): Array<{ row: number; column: number }> {
        return Array.from(
            { length: rowCount * columnCount },
            (_: undefined, index: number): { row: number; column: number } => ({
                row: rowStart + Math.floor(index / columnCount),
                column: columnStart + (index % columnCount),
            }),
        );
    }

    private static findPositionInArea(
        rowSpan: number,
        columnSpan: number,
        area: TilePosition,
        occupiedCells: Set<string>,
    ): TilePosition | undefined {
        const found = TileGridHelper.generateGrid(
            area.rowStart,
            area.columnStart,
            area.rowSpan - rowSpan + 1,
            area.columnSpan - columnSpan + 1,
        ).find(
            ({ row: rowStart, column: columnStart }: { row: number; column: number }): boolean =>
                !TileGridHelper.cellKeysForPosition({ rowStart, columnStart, rowSpan, columnSpan }).some(
                    (key: string): boolean => occupiedCells.has(key),
                ),
        );

        return found ? { rowStart: found.row, columnStart: found.column, rowSpan, columnSpan } : undefined;
    }

    private static cellKeysForPosition(pos: TilePosition): Array<string> {
        return TileGridHelper.generateGrid(pos.rowStart, pos.columnStart, pos.rowSpan, pos.columnSpan).map(
            ({ row, column }: { row: number; column: number }): string => `${row}-${column}`,
        );
    }

    private static doIntervalsIntersect(
        tileAMin: number,
        tileAMax: number,
        tileBMin: number,
        tileBMax: number,
    ): boolean {
        return tileAMin <= tileBMax && tileBMin <= tileAMax;
    }
}
