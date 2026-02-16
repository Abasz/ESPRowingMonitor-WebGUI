import { describe, expect, it } from "vitest";

import { TileGridHelper } from "./tile-grid.helper";
import { GridRect, PlacedTile, TilePosition } from "./tile-layout.interfaces";

describe("TileGridHelper", (): void => {
    describe("isPointInTile method", (): void => {
        const tile: TilePosition = { rowStart: 2, columnStart: 3, rowSpan: 2, columnSpan: 2 };

        it("should return true when point is inside the tile", (): void => {
            expect(TileGridHelper.isPointInTile(2, 3, tile)).toBe(true);
            expect(TileGridHelper.isPointInTile(3, 4, tile)).toBe(true);
            expect(TileGridHelper.isPointInTile(2, 4, tile)).toBe(true);
            expect(TileGridHelper.isPointInTile(3, 3, tile)).toBe(true);
        });

        it("should return false when point is outside the tile", (): void => {
            expect(TileGridHelper.isPointInTile(1, 3, tile)).toBe(false);
            expect(TileGridHelper.isPointInTile(4, 3, tile)).toBe(false);
            expect(TileGridHelper.isPointInTile(2, 2, tile)).toBe(false);
            expect(TileGridHelper.isPointInTile(2, 5, tile)).toBe(false);
        });

        it("should handle a 1x1 tile", (): void => {
            const smallTile: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            expect(TileGridHelper.isPointInTile(1, 1, smallTile)).toBe(true);
            expect(TileGridHelper.isPointInTile(1, 2, smallTile)).toBe(false);
            expect(TileGridHelper.isPointInTile(2, 1, smallTile)).toBe(false);
        });
    });

    describe("doTilesOverlap method", (): void => {
        it("should return true when tiles overlap", (): void => {
            const a: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 2 };
            const b: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.doTilesOverlap(a, b)).toBe(true);
        });

        it("should return false when tiles are adjacent but not overlapping", (): void => {
            const a: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            const b: TilePosition = { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.doTilesOverlap(a, b)).toBe(false);
        });

        it("should return false when tiles are diagonally adjacent", (): void => {
            const a: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            const b: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.doTilesOverlap(a, b)).toBe(false);
        });

        it("should return true when one tile fully contains another", (): void => {
            const outer: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 3, columnSpan: 3 };
            const inner: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.doTilesOverlap(outer, inner)).toBe(true);
        });

        it("should return true when tiles are identical", (): void => {
            const tile: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 2 };

            expect(TileGridHelper.doTilesOverlap(tile, tile)).toBe(true);
        });

        it("should return false when tiles are vertically separated", (): void => {
            const a: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            const b: TilePosition = { rowStart: 3, columnStart: 1, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.doTilesOverlap(a, b)).toBe(false);
        });
    });

    describe("isTileWithinGrid method", (): void => {
        const rowCount = 3;
        const columnCount = 4;

        it("should return true when tile is fully within grid", (): void => {
            const tile: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.isTileWithinGrid(tile, rowCount, columnCount)).toBe(true);
        });

        it("should return true when tile spans to grid boundary", (): void => {
            const tile: TilePosition = { rowStart: 2, columnStart: 3, rowSpan: 2, columnSpan: 2 };

            expect(TileGridHelper.isTileWithinGrid(tile, rowCount, columnCount)).toBe(true);
        });

        it("should return false when tile extends beyond row count", (): void => {
            const tile: TilePosition = { rowStart: 3, columnStart: 1, rowSpan: 2, columnSpan: 1 };

            expect(TileGridHelper.isTileWithinGrid(tile, rowCount, columnCount)).toBe(false);
        });

        it("should return false when tile extends beyond column count", (): void => {
            const tile: TilePosition = { rowStart: 1, columnStart: 4, rowSpan: 1, columnSpan: 2 };

            expect(TileGridHelper.isTileWithinGrid(tile, rowCount, columnCount)).toBe(false);
        });

        it("should return false when tile starts at row 0", (): void => {
            const tile: TilePosition = { rowStart: 0, columnStart: 1, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.isTileWithinGrid(tile, rowCount, columnCount)).toBe(false);
        });

        it("should return false when tile starts at col 0", (): void => {
            const tile: TilePosition = { rowStart: 1, columnStart: 0, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.isTileWithinGrid(tile, rowCount, columnCount)).toBe(false);
        });

        it("should return true when tile fills entire grid", (): void => {
            const tile: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 3, columnSpan: 4 };

            expect(TileGridHelper.isTileWithinGrid(tile, rowCount, columnCount)).toBe(true);
        });
    });

    describe("isPlacementValid method", (): void => {
        const rowCount = 3;
        const columnCount = 4;

        it("should return true for valid placement with no existing tiles", (): void => {
            const tile: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.isPlacementValid(tile, [], rowCount, columnCount)).toBe(true);
        });

        it("should return false when placement overlaps existing tile", (): void => {
            const existing: Array<TilePosition> = [
                { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 2 },
            ];
            const tile: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.isPlacementValid(tile, existing, rowCount, columnCount)).toBe(false);
        });

        it("should return true when placement is adjacent to existing tile", (): void => {
            const existing: Array<TilePosition> = [
                { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            ];
            const tile: TilePosition = { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.isPlacementValid(tile, existing, rowCount, columnCount)).toBe(true);
        });

        it("should return false when placement is out of bounds", (): void => {
            const tile: TilePosition = { rowStart: 3, columnStart: 4, rowSpan: 2, columnSpan: 2 };

            expect(TileGridHelper.isPlacementValid(tile, [], rowCount, columnCount)).toBe(false);
        });

        it("should return false when placement overlaps any of multiple existing tiles", (): void => {
            const existing: Array<TilePosition> = [
                { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
            ];
            const tile: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 };

            expect(TileGridHelper.isPlacementValid(tile, existing, rowCount, columnCount)).toBe(false);
        });
    });

    describe("calculateCellFromPoint method", (): void => {
        const gridRect = { left: 0, top: 0, width: 410, height: 310 };
        const rowCount = 3;
        const columnCount = 4;

        it("should return correct cell for center of first cell", (): void => {
            const result = TileGridHelper.calculateCellFromPoint(60, 60, gridRect, rowCount, columnCount);

            expect(result).toEqual({ row: 1, column: 1 });
        });

        it("should return correct cell for last cell", (): void => {
            const result = TileGridHelper.calculateCellFromPoint(380, 280, gridRect, rowCount, columnCount);

            expect(result).toEqual({ row: 3, column: 4 });
        });

        it("should clamp to first cell when point is before grid", (): void => {
            const result = TileGridHelper.calculateCellFromPoint(-5, -5, gridRect, rowCount, columnCount);

            expect(result).toEqual({ row: 1, column: 1 });
        });

        it("should clamp to last cell when point is past grid", (): void => {
            const result = TileGridHelper.calculateCellFromPoint(500, 400, gridRect, rowCount, columnCount);

            expect(result).toEqual({ row: 3, column: 4 });
        });

        it("should return correct cell for middle position", (): void => {
            const result = TileGridHelper.calculateCellFromPoint(160, 160, gridRect, rowCount, columnCount);
            expect(result).toEqual({ row: 2, column: 2 });
        });
    });

    describe("calculateDropPosition method", (): void => {
        const gridRect = { left: 0, top: 0, width: 410, height: 310 };
        const rowCount = 3;
        const columnCount = 4;

        it("should center a 1x1 tile at the pointed cell", (): void => {
            const result = TileGridHelper.calculateDropPosition(
                60,
                60,
                gridRect,
                rowCount,
                columnCount,
                1,
                1,
            );

            expect(result).toEqual({ rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 });
        });

        it("should clamp a 2x1 tile to stay within grid bounds", (): void => {
            const result = TileGridHelper.calculateDropPosition(
                60,
                280,
                gridRect,
                rowCount,
                columnCount,
                2,
                1,
            );

            expect(result).toEqual({ rowStart: 2, columnStart: 1, rowSpan: 2, columnSpan: 1 });
        });

        it("should clamp a 1x2 tile to column bounds", (): void => {
            const result = TileGridHelper.calculateDropPosition(
                380,
                60,
                gridRect,
                rowCount,
                columnCount,
                1,
                2,
            );

            expect(result).toEqual({ rowStart: 1, columnStart: 3, rowSpan: 1, columnSpan: 2 });
        });

        it("should handle tile that fills entire grid", (): void => {
            const result = TileGridHelper.calculateDropPosition(
                200,
                150,
                gridRect,
                rowCount,
                columnCount,
                3,
                4,
            );

            expect(result).toEqual({ rowStart: 1, columnStart: 1, rowSpan: 3, columnSpan: 4 });
        });

        it("should clamp a 2x2 tile at bottom-right corner", (): void => {
            const result = TileGridHelper.calculateDropPosition(
                390,
                290,
                gridRect,
                rowCount,
                columnCount,
                2,
                2,
            );
            expect(result).toEqual({ rowStart: 2, columnStart: 3, rowSpan: 2, columnSpan: 2 });
        });

        it("should use grab offset to position tile relative to grab point", (): void => {
            // mouse at column 3, grabbing right cell of a 1x2 tile (offset col=1)
            const result = TileGridHelper.calculateDropPosition(
                260,
                60,
                gridRect,
                rowCount,
                columnCount,
                1,
                2,
                0,
                1,
            );

            // rowStart = row 1 - 0 = 1, columnStart = col 3 - 1 = 2
            expect(result).toEqual({ rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 2 });
        });

        it("should use grab offset 0,0 to anchor tile at top-left of mouse cell", (): void => {
            // mouse at column 2, grabbing left cell of a 1x2 tile (offset col=0)
            const result = TileGridHelper.calculateDropPosition(
                160,
                60,
                gridRect,
                rowCount,
                columnCount,
                1,
                2,
                0,
                0,
            );

            // rowStart = 1 - 0 = 1, columnStart = 2 - 0 = 2
            expect(result).toEqual({ rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 2 });
        });

        it("should clamp grab offset result to stay within grid bounds", (): void => {
            // mouse at column 1, grabbing right cell of a 1x2 tile (offset col=1)
            // columnStart = 1 - 1 = 0 → clamped to 1
            const result = TileGridHelper.calculateDropPosition(
                60,
                60,
                gridRect,
                rowCount,
                columnCount,
                1,
                2,
                0,
                1,
            );

            expect(result).toEqual({ rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 });
        });

        it("should fall back to centering when grab offset is undefined", (): void => {
            const withOffset = TileGridHelper.calculateDropPosition(
                260,
                60,
                gridRect,
                rowCount,
                columnCount,
                1,
                2,
                undefined,
                undefined,
            );
            const withoutOffset = TileGridHelper.calculateDropPosition(
                260,
                60,
                gridRect,
                rowCount,
                columnCount,
                1,
                2,
            );

            expect(withOffset).toEqual(withoutOffset);
        });
    });

    describe("generateGridCells method", (): void => {
        it("should generate correct number of cells for a 3x4 grid", (): void => {
            const cells = TileGridHelper.generateGridCells(3, 4);

            expect(cells).toHaveLength(12);
        });

        it("should generate cells with 1-based positions", (): void => {
            const cells = TileGridHelper.generateGridCells(2, 2);

            expect(cells).toEqual([
                { row: 1, column: 1 },
                { row: 1, column: 2 },
                { row: 2, column: 1 },
                { row: 2, column: 2 },
            ]);
        });

        it("should generate correct first and last cells for a 3x4 grid", (): void => {
            const cells = TileGridHelper.generateGridCells(3, 4);

            expect(cells[0]).toEqual({ row: 1, column: 1 });
            expect(cells[cells.length - 1]).toEqual({ row: 3, column: 4 });
        });
    });

    describe("calculateResizePosition method", (): void => {
        const original: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 2, columnSpan: 2 };

        it("should resize to the right", (): void => {
            const result = TileGridHelper.calculateResizePosition(original, 2, 5, ["right"], 1, 1);

            expect(result.columnStart).toBe(2);
            expect(result.columnSpan).toBe(4);
            expect(result.rowStart).toBe(2);
            expect(result.rowSpan).toBe(2);
        });

        it("should resize to the left", (): void => {
            const result = TileGridHelper.calculateResizePosition(original, 2, 1, ["left"], 1, 1);

            expect(result.columnStart).toBe(1);
            expect(result.columnSpan).toBe(3);
            expect(result.rowStart).toBe(2);
            expect(result.rowSpan).toBe(2);
        });

        it("should resize downward", (): void => {
            const result = TileGridHelper.calculateResizePosition(original, 5, 2, ["bottom"], 1, 1);

            expect(result.rowStart).toBe(2);
            expect(result.rowSpan).toBe(4);
            expect(result.columnStart).toBe(2);
            expect(result.columnSpan).toBe(2);
        });

        it("should resize upward", (): void => {
            const result = TileGridHelper.calculateResizePosition(original, 1, 2, ["top"], 1, 1);

            expect(result.rowStart).toBe(1);
            expect(result.rowSpan).toBe(3);
            expect(result.columnStart).toBe(2);
            expect(result.columnSpan).toBe(2);
        });

        it("should resize diagonally (right + bottom)", (): void => {
            const result = TileGridHelper.calculateResizePosition(original, 5, 5, ["right", "bottom"], 1, 1);

            expect(result.columnStart).toBe(2);
            expect(result.columnSpan).toBe(4);
            expect(result.rowStart).toBe(2);
            expect(result.rowSpan).toBe(4);
        });

        it("should clamp to minimum column span when resizing right", (): void => {
            const result = TileGridHelper.calculateResizePosition(original, 2, 1, ["right"], 1, 2);

            expect(result.columnSpan).toBe(2);
        });

        it("should clamp to minimum row span when resizing bottom", (): void => {
            const result = TileGridHelper.calculateResizePosition(original, 1, 2, ["bottom"], 2, 1);

            expect(result.rowSpan).toBe(2);
        });

        it("should clamp to minimum column span when resizing left", (): void => {
            const result = TileGridHelper.calculateResizePosition(original, 2, 4, ["left"], 1, 2);

            expect(result.columnStart).toBe(2);
            expect(result.columnSpan).toBe(2);
        });

        it("should clamp to minimum row span when resizing top", (): void => {
            const result = TileGridHelper.calculateResizePosition(original, 4, 2, ["top"], 2, 1);

            expect(result.rowStart).toBe(2);
            expect(result.rowSpan).toBe(2);
        });

        it("should not modify original position object", (): void => {
            const pos: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 2, columnSpan: 2 };
            TileGridHelper.calculateResizePosition(pos, 5, 5, ["right", "bottom"], 1, 1);

            expect(pos.rowStart).toBe(2);
            expect(pos.columnStart).toBe(2);
            expect(pos.rowSpan).toBe(2);
            expect(pos.columnSpan).toBe(2);
        });
    });

    describe("isPointInRect method", (): void => {
        const rect: GridRect = { left: 100, top: 50, width: 200, height: 150 };

        it("should return true when point is inside the rect", (): void => {
            expect(TileGridHelper.isPointInRect(150, 100, rect)).toBe(true);
        });

        it("should return true when point is on the left edge", (): void => {
            expect(TileGridHelper.isPointInRect(100, 100, rect)).toBe(true);
        });

        it("should return true when point is on the right edge", (): void => {
            expect(TileGridHelper.isPointInRect(300, 100, rect)).toBe(true);
        });

        it("should return true when point is on the top edge", (): void => {
            expect(TileGridHelper.isPointInRect(150, 50, rect)).toBe(true);
        });

        it("should return true when point is on the bottom edge", (): void => {
            expect(TileGridHelper.isPointInRect(150, 200, rect)).toBe(true);
        });

        it("should return false when point is outside left", (): void => {
            expect(TileGridHelper.isPointInRect(99, 100, rect)).toBe(false);
        });

        it("should return false when point is outside right", (): void => {
            expect(TileGridHelper.isPointInRect(301, 100, rect)).toBe(false);
        });

        it("should return false when point is outside top", (): void => {
            expect(TileGridHelper.isPointInRect(150, 49, rect)).toBe(false);
        });

        it("should return false when point is outside bottom", (): void => {
            expect(TileGridHelper.isPointInRect(150, 201, rect)).toBe(false);
        });
    });

    describe("calculateGrabOffset method", (): void => {
        it("should return undefined offsets when element is null", (): void => {
            const result = TileGridHelper.calculateGrabOffset(null, 100, 100, {
                rowStart: 1,
                columnStart: 1,
                rowSpan: 1,
                columnSpan: 1,
            });

            expect(result.grabOffsetRow).toBeUndefined();
            expect(result.grabOffsetCol).toBeUndefined();
        });

        it("should return undefined offsets when element has zero dimensions", (): void => {
            const element = document.createElement("div");
            Object.defineProperty(element, "getBoundingClientRect", {
                value: (): DOMRect =>
                    ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }) as DOMRect,
            });

            const result = TileGridHelper.calculateGrabOffset(element, 100, 100, {
                rowStart: 1,
                columnStart: 1,
                rowSpan: 1,
                columnSpan: 1,
            });

            expect(result.grabOffsetRow).toBeUndefined();
            expect(result.grabOffsetCol).toBeUndefined();
        });

        it("should return zero offsets when clicking top-left of a 1x1 tile", (): void => {
            const element = document.createElement("div");
            Object.defineProperty(element, "getBoundingClientRect", {
                value: (): DOMRect =>
                    ({ left: 100, top: 50, width: 100, height: 80, right: 200, bottom: 130 }) as DOMRect,
            });

            const result = TileGridHelper.calculateGrabOffset(element, 100, 50, {
                rowStart: 1,
                columnStart: 1,
                rowSpan: 1,
                columnSpan: 1,
            });

            expect(result.grabOffsetRow).toBe(0);
            expect(result.grabOffsetCol).toBe(0);
        });

        it("should calculate correct offset for a 2x3 tile clicked in the middle", (): void => {
            const element = document.createElement("div");
            Object.defineProperty(element, "getBoundingClientRect", {
                value: (): DOMRect =>
                    ({ left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200 }) as DOMRect,
            });

            const result = TileGridHelper.calculateGrabOffset(element, 150, 100, {
                rowStart: 1,
                columnStart: 1,
                rowSpan: 2,
                columnSpan: 3,
            });

            expect(result.grabOffsetCol).toBe(1);
            expect(result.grabOffsetRow).toBe(1);
        });
    });

    describe("findSwapPositions method", (): void => {
        it("should return undefined when no tiles overlap", (): void => {
            const targetPosition: TilePosition = { rowStart: 1, columnStart: 3, rowSpan: 1, columnSpan: 1 };
            const allTiles: Array<PlacedTile> = [
                {
                    id: "distance",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "pace",
                    position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = TileGridHelper.findSwapPositions(
                targetPosition,
                "distance",
                { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                allTiles,
                3,
                4,
            );

            expect(result).toBeUndefined();
        });

        it("should swap two 1x1 tiles to each others positions", (): void => {
            const targetPosition: TilePosition = { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 };
            const originalPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            const allTiles: Array<PlacedTile> = [
                { id: "distance", position: originalPosition },
                {
                    id: "pace",
                    position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = TileGridHelper.findSwapPositions(
                targetPosition,
                "distance",
                originalPosition,
                allTiles,
                3,
                4,
            );

            expect(result).toBeDefined();
            expect(result?.get("pace")).toEqual(originalPosition);
        });

        it("should return undefined when overlapping tile cannot fit anywhere", (): void => {
            const targetPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 3, columnSpan: 4 };
            const originalPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 3, columnSpan: 4 };
            const allTiles: Array<PlacedTile> = [
                { id: "distance", position: originalPosition },
                {
                    id: "pace",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 3, columnSpan: 4 },
                },
            ];

            const result = TileGridHelper.findSwapPositions(
                targetPosition,
                "distance",
                originalPosition,
                allTiles,
                3,
                4,
            );

            expect(result).toBeUndefined();
        });

        it("should swap multiple displaced tiles", (): void => {
            const targetPosition: TilePosition = { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 2 };
            const originalPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 };
            const allTiles: Array<PlacedTile> = [
                { id: "distance", position: originalPosition },
                {
                    id: "pace",
                    position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "power",
                    position: { rowStart: 1, columnStart: 3, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = TileGridHelper.findSwapPositions(
                targetPosition,
                "distance",
                originalPosition,
                allTiles,
                3,
                4,
            );

            expect(result).toBeDefined();
            expect(result?.size).toBe(2);
            // pace fits into freed area at (1,1)
            expect(result?.get("pace")?.columnStart).toBe(1);
            // power cannot fit in freed area (only one cell left, already occupied by target),
            // so it falls back to full grid scan and lands at (1,4)
            expect(result?.get("power")?.columnStart).toBe(4);
        });
    });
});
