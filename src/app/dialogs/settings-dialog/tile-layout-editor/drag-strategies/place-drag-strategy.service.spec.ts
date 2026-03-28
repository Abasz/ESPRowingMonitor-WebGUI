import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TileGridHelper } from "../utils/tile-grid.helper";
import { MOCK_GRID_CONFIG, MOCK_GRID_RECT } from "../utils/tile-layout-editor.test.helpers";
import { PlacedTile, TileDragSession, TilePosition } from "../utils/tile-layout.interfaces";

import { PlaceDragStrategy } from "./place-drag-strategy.service";

describe("PlaceDragStrategy", (): void => {
    let service: PlaceDragStrategy;

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [PlaceDragStrategy],
        });

        service = TestBed.inject(PlaceDragStrategy);
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
        it("should return valid result when placement is valid", (): void => {
            const dropPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "place",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
            };

            const result = service.handleDragOver(100, 100, MOCK_GRID_RECT, session, [], MOCK_GRID_CONFIG);

            expect(result).toEqual({
                highlightPosition: dropPosition,
                isValid: true,
            });
        });

        it("should return invalid result when placement overlaps existing tiles", (): void => {
            const dropPosition: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(false);

            const session: TileDragSession = {
                actionType: "place",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
            };
            const placedTiles: Array<PlacedTile> = [
                {
                    id: "pace",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDragOver(
                100,
                100,
                MOCK_GRID_RECT,
                session,
                placedTiles,
                MOCK_GRID_CONFIG,
            );

            expect(result).toEqual({
                highlightPosition: dropPosition,
                isValid: false,
            });
        });

        it("should pass session dimensions and grid constants to calculateDropPosition", (): void => {
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue({
                rowStart: 1,
                columnStart: 1,
                rowSpan: 2,
                columnSpan: 3,
            });
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "place",
                id: "forceCurve",
                rowSpan: 2,
                columnSpan: 3,
            };

            service.handleDragOver(150, 200, MOCK_GRID_RECT, session, [], MOCK_GRID_CONFIG);

            expect(TileGridHelper.calculateDropPosition).toHaveBeenCalledWith(
                150,
                200,
                MOCK_GRID_RECT,
                MOCK_GRID_CONFIG.rows,
                MOCK_GRID_CONFIG.columns,
                2,
                3,
            );
        });
    });

    describe("handleDrop method", (): void => {
        it("should return new tiles array with the placed tile when valid", (): void => {
            const dropPosition: TilePosition = { rowStart: 2, columnStart: 3, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "place",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
            };
            const placedTiles: Array<PlacedTile> = [
                {
                    id: "pace",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDrop(
                100,
                100,
                MOCK_GRID_RECT,
                session,
                placedTiles,
                MOCK_GRID_CONFIG,
            );

            expect(result).toBeDefined();
            expect(result?.tiles).toHaveLength(2);
            expect(result?.tiles[1]).toEqual({ id: "distance", position: dropPosition });
        });

        it("should return undefined when placement is invalid", (): void => {
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue({
                rowStart: 1,
                columnStart: 1,
                rowSpan: 1,
                columnSpan: 1,
            });
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(false);

            const session: TileDragSession = {
                actionType: "place",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
            };

            const result = service.handleDrop(100, 100, MOCK_GRID_RECT, session, [], MOCK_GRID_CONFIG);

            expect(result).toBeUndefined();
        });

        it("should preserve existing tiles in the result", (): void => {
            const dropPosition: TilePosition = { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 };
            vi.spyOn(TileGridHelper, "calculateDropPosition").mockReturnValue(dropPosition);
            vi.spyOn(TileGridHelper, "isPlacementValid").mockReturnValue(true);

            const session: TileDragSession = {
                actionType: "place",
                id: "timer",
                rowSpan: 1,
                columnSpan: 1,
            };
            const existingTiles: Array<PlacedTile> = [
                {
                    id: "pace",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "power",
                    position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
            ];

            const result = service.handleDrop(
                100,
                100,
                MOCK_GRID_RECT,
                session,
                existingTiles,
                MOCK_GRID_CONFIG,
            );

            expect(result?.tiles[0]).toEqual(existingTiles[0]);
            expect(result?.tiles[1]).toEqual(existingTiles[1]);
        });
    });
});
