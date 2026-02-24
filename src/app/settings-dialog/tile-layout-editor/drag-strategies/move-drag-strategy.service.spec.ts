import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TileGridHelper } from "../utils/tile-grid.helper";
import { MOCK_GRID_CONFIG, MOCK_GRID_RECT } from "../utils/tile-layout-editor.test.helpers";
import { PlacedTile, TileDragSession, TileId, TilePosition } from "../utils/tile-layout.interfaces";

import { MoveDragStrategy } from "./move-drag-strategy.service";

describe("MoveDragStrategy", (): void => {
    let service: MoveDragStrategy;

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [MoveDragStrategy],
        });

        service = TestBed.inject(MoveDragStrategy);
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
        it("should return valid result when target position is free", (): void => {
            const dropPosition: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "move",
                id: "Distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                grabOffsetRow: 0,
                grabOffsetCol: 0,
            };
            const baseTiles: Array<PlacedTile> = [
                {
                    id: "Distance",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDragOver(
                100,
                100,
                MOCK_GRID_RECT,
                session,
                baseTiles,
                MOCK_GRID_CONFIG,
            );

            expect(result).toEqual({ highlightPosition: dropPosition, isValid: true });
        });

        it("should pass grab offsets and grid constants to calculateDropPosition", (): void => {
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue({
                rowStart: 1,
                columnStart: 1,
                rowSpan: 1,
                columnSpan: 1,
            });
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "move",
                id: "Distance",
                rowSpan: 2,
                columnSpan: 3,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 3 },
                grabOffsetRow: 1,
                grabOffsetCol: 2,
            };

            service.handleDragOver(
                200,
                150,
                MOCK_GRID_RECT,
                session,
                [
                    {
                        id: "Distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 3 },
                    },
                ],
                MOCK_GRID_CONFIG,
            );

            expect(TileGridHelper.calculateDropPosition).toHaveBeenCalledWith(
                200,
                150,
                MOCK_GRID_RECT,
                MOCK_GRID_CONFIG.rows,
                MOCK_GRID_CONFIG.columns,
                2,
                3,
                1,
                2,
            );
        });

        it("should return valid result with preview tiles showing the dragged tile at target and displaced tiles at swapped positions", (): void => {
            const dropPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(false);

            const swapPositions = new Map<TileId, TilePosition>([
                ["Pace", { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 }],
            ]);
            vi.spyOn(TileGridHelper, "findSwapPositions").mockReturnValue(swapPositions);

            const session: TileDragSession = {
                actionType: "move",
                id: "Distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
            };
            const baseTiles: Array<PlacedTile> = [
                {
                    id: "Distance",
                    position: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "Pace",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDragOver(
                100,
                100,
                MOCK_GRID_RECT,
                session,
                baseTiles,
                MOCK_GRID_CONFIG,
            );

            expect(result?.isValid).toBe(true);
            expect(result?.previewTiles).toBeDefined();
            // dragged tile IS included at the drop position (this is necessary to prevent touchcancel on mobile)
            expect(
                result?.previewTiles?.find((placedTile: PlacedTile): boolean => placedTile.id === "Distance")
                    ?.position,
            ).toEqual(dropPosition);
            // displaced tile is at its swapped position
            expect(
                result?.previewTiles?.find((placedTile: PlacedTile): boolean => placedTile.id === "Pace")
                    ?.position,
            ).toEqual({ rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 });
        });

        it("should return invalid result when no swap is possible", (): void => {
            const dropPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(false);
            vi.spyOn(TileGridHelper, "findSwapPositions").mockReturnValue(undefined);

            const session: TileDragSession = {
                actionType: "move",
                id: "Distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
            };
            const baseTiles: Array<PlacedTile> = [
                {
                    id: "Distance",
                    position: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "Pace",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDragOver(
                100,
                100,
                MOCK_GRID_RECT,
                session,
                baseTiles,
                MOCK_GRID_CONFIG,
            );

            expect(result).toEqual({ highlightPosition: dropPosition, isValid: false });
        });

        it("should exclude the dragged tile from other positions check", (): void => {
            const dropPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            const isPlacementValidSpy = vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "move",
                id: "Distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
            };
            const placedTiles: Array<PlacedTile> = [
                {
                    id: "Distance",
                    position: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "Pace",
                    position: { rowStart: 3, columnStart: 3, rowSpan: 1, columnSpan: 1 },
                },
            ];

            service.handleDragOver(100, 100, MOCK_GRID_RECT, session, placedTiles, MOCK_GRID_CONFIG);

            expect(isPlacementValidSpy).toHaveBeenCalledWith(
                dropPosition,
                [{ rowStart: 3, columnStart: 3, rowSpan: 1, columnSpan: 1 }],
                MOCK_GRID_CONFIG.rows,
                MOCK_GRID_CONFIG.columns,
            );
        });
    });

    describe("handleDrop method", (): void => {
        it("should update tile position when target is free", (): void => {
            const dropPosition: TilePosition = { rowStart: 2, columnStart: 3, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "move",
                id: "Distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            };
            const baseTiles: Array<PlacedTile> = [
                {
                    id: "Distance",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDrop(100, 100, MOCK_GRID_RECT, session, baseTiles, MOCK_GRID_CONFIG);

            expect(result?.tiles).toHaveLength(1);
            expect(result?.tiles[0].position).toEqual(dropPosition);
        });

        it("should apply swap positions when swap is available", (): void => {
            const dropPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(false);

            const swapPosition: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 };
            const swapPositions = new Map<TileId, TilePosition>([["Pace", swapPosition]]);
            vi.spyOn(TileGridHelper, "findSwapPositions").mockReturnValue(swapPositions);

            const session: TileDragSession = {
                actionType: "move",
                id: "Distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
            };
            const baseTiles: Array<PlacedTile> = [
                {
                    id: "Distance",
                    position: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "Pace",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDrop(100, 100, MOCK_GRID_RECT, session, baseTiles, MOCK_GRID_CONFIG);

            expect(
                result?.tiles.find((placedTile: PlacedTile): boolean => placedTile.id === "Distance")
                    ?.position,
            ).toEqual(dropPosition);
            expect(
                result?.tiles.find((placedTile: PlacedTile): boolean => placedTile.id === "Pace")?.position,
            ).toEqual(swapPosition);
        });

        it("should return undefined when placement is invalid and no swap is possible", (): void => {
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue({
                rowStart: 1,
                columnStart: 1,
                rowSpan: 1,
                columnSpan: 1,
            });
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(false);
            vi.spyOn(TileGridHelper, "findSwapPositions").mockReturnValue(undefined);

            const session: TileDragSession = {
                actionType: "move",
                id: "Distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
            };

            const result = service.handleDrop(
                100,
                100,
                MOCK_GRID_RECT,
                session,
                [
                    {
                        id: "Distance",
                        position: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                    },
                ],
                MOCK_GRID_CONFIG,
            );

            expect(result).toBeUndefined();
        });
    });
});
