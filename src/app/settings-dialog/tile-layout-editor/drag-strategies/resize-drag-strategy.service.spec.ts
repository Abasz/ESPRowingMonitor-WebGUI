import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TileGridHelper } from "../utils/tile-grid.helper";
import { MOCK_GRID_CONFIG, MOCK_GRID_RECT } from "../utils/tile-layout-editor.test.helpers";
import { PlacedTile, TileDragSession, TilePosition } from "../utils/tile-layout.interfaces";

import { ResizeDragStrategy } from "./resize-drag-strategy.service";

describe("ResizeDragStrategy", (): void => {
    let service: ResizeDragStrategy;

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [ResizeDragStrategy],
        });

        service = TestBed.inject(ResizeDragStrategy);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    describe("as part of component creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });
    });

    describe("handleDragOver method", (): void => {
        it("should return valid result for a valid resize", (): void => {
            const newPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 2 };
            vi.spyOn(TileGridHelper, "calculateCellFromPoint").mockReturnValue({ row: 2, column: 2 });
            vi.spyOn(TileGridHelper, "calculateResizePosition").mockReturnValue(newPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "resize",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                resizeDirections: ["right", "bottom"],
                minRowSpan: 1,
                minColumnSpan: 1,
            };

            const result = service.handleDragOver(
                200,
                150,
                MOCK_GRID_RECT,
                session,
                [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                ],
                MOCK_GRID_CONFIG,
            );

            expect(result).toEqual({
                highlightPosition: newPosition,
                isValid: true,
            });
        });

        it("should return invalid result when resize placement overlaps other tiles", (): void => {
            const newPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 2 };
            vi.spyOn(TileGridHelper, "calculateCellFromPoint").mockReturnValue({ row: 2, column: 2 });
            vi.spyOn(TileGridHelper, "calculateResizePosition").mockReturnValue(newPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(false);

            const session: TileDragSession = {
                actionType: "resize",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                resizeDirections: ["right"],
                minRowSpan: 1,
                minColumnSpan: 1,
            };
            const placedTiles: Array<PlacedTile> = [
                {
                    id: "distance",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "pace",
                    position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDragOver(
                200,
                150,
                MOCK_GRID_RECT,
                session,
                placedTiles,
                MOCK_GRID_CONFIG,
            );

            expect(result?.isValid).toBe(false);
        });

        it("should pass correct parameters to calculateResizePosition", (): void => {
            const originalPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateCellFromPoint").mockReturnValue({ row: 3, column: 4 });
            const resizeSpy = vi
                .spyOn(TileGridHelper, "calculateResizePosition")
                .mockReturnValue(originalPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "resize",
                id: "distance",
                rowSpan: originalPosition.rowSpan,
                columnSpan: originalPosition.columnSpan,
                originalPosition,
                resizeDirections: ["bottom", "right"],
                minRowSpan: 1,
                minColumnSpan: 1,
            };

            service.handleDragOver(
                200,
                150,
                MOCK_GRID_RECT,
                session,
                [{ id: "distance", position: originalPosition }],
                MOCK_GRID_CONFIG,
            );

            expect(resizeSpy).toHaveBeenCalledWith(originalPosition, 3, 4, ["bottom", "right"], 1, 1);
        });

        it("should exclude the resized tile from other positions check", (): void => {
            const newPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateCellFromPoint").mockReturnValue({ row: 2, column: 1 });
            vi.spyOn(TileGridHelper, "calculateResizePosition").mockReturnValue(newPosition);
            const isPlacementValidSpy = vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "resize",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                resizeDirections: ["bottom"],
                minRowSpan: 1,
                minColumnSpan: 1,
            };
            const placedTiles: Array<PlacedTile> = [
                {
                    id: "distance",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "pace",
                    position: { rowStart: 3, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
            ];

            service.handleDragOver(100, 200, MOCK_GRID_RECT, session, placedTiles, MOCK_GRID_CONFIG);

            expect(isPlacementValidSpy).toHaveBeenCalledWith(
                newPosition,
                [{ rowStart: 3, columnStart: 1, rowSpan: 1, columnSpan: 1 }],
                MOCK_GRID_CONFIG.rows,
                MOCK_GRID_CONFIG.columns,
            );
        });
    });

    describe("handleDrop method", (): void => {
        it("should return updated tiles when resize is valid", (): void => {
            const newPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 2 };
            vi.spyOn(TileGridHelper, "calculateCellFromPoint").mockReturnValue({ row: 2, column: 2 });
            vi.spyOn(TileGridHelper, "calculateResizePosition").mockReturnValue(newPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "resize",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                resizeDirections: ["right", "bottom"],
                minRowSpan: 1,
                minColumnSpan: 1,
            };
            const placedTiles: Array<PlacedTile> = [
                {
                    id: "distance",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "pace",
                    position: { rowStart: 3, columnStart: 3, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDrop(
                200,
                150,
                MOCK_GRID_RECT,
                session,
                placedTiles,
                MOCK_GRID_CONFIG,
            );

            expect(result).toBeDefined();
            expect(
                result?.tiles.find((placedTile: PlacedTile): boolean => placedTile.id === "distance")
                    ?.position,
            ).toEqual(newPosition);
            expect(
                result?.tiles.find((placedTile: PlacedTile): boolean => placedTile.id === "pace")?.position,
            ).toEqual({
                rowStart: 3,
                columnStart: 3,
                rowSpan: 1,
                columnSpan: 1,
            });
        });

        it("should return undefined when resize placement is invalid", (): void => {
            vi.spyOn(TileGridHelper, "calculateCellFromPoint").mockReturnValue({ row: 2, column: 2 });
            vi.spyOn(TileGridHelper, "calculateResizePosition").mockReturnValue({
                rowStart: 1,
                columnStart: 1,
                rowSpan: 2,
                columnSpan: 2,
            });
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(false);

            const session: TileDragSession = {
                actionType: "resize",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                resizeDirections: ["right", "bottom"],
                minRowSpan: 1,
                minColumnSpan: 1,
            };

            const result = service.handleDrop(
                200,
                150,
                MOCK_GRID_RECT,
                session,
                [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                ],
                MOCK_GRID_CONFIG,
            );

            expect(result).toBeUndefined();
        });
    });
});
