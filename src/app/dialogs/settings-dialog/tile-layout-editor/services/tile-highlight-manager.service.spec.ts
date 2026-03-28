import { TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { TilePosition } from "../utils/tile-layout.interfaces";

import { TileHighlightManager } from "./tile-highlight-manager.service";

describe("TileHighlightManager", (): void => {
    let service: TileHighlightManager;

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [TileHighlightManager],
        });

        service = TestBed.inject(TileHighlightManager);
    });

    describe("as part of component creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });

        it("should have empty highlighted cells initially", (): void => {
            expect(service.highlightedCells()).toEqual([]);
        });

        it("should have isDropInvalid set to false initially", (): void => {
            expect(service.isDropInvalid()).toBe(false);
        });
    });

    describe("isCellHighlighted method", (): void => {
        it("should return false when no cells are highlighted", (): void => {
            expect(service.isCellHighlighted(1, 1)).toBe(false);
        });

        it("should return true when the cell is highlighted", (): void => {
            service.highlightedCells.set([{ row: 1, column: 2 }]);

            expect(service.isCellHighlighted(1, 2)).toBe(true);
        });

        it("should return false when the cell is not in the highlighted set", (): void => {
            service.highlightedCells.set([{ row: 1, column: 2 }]);

            expect(service.isCellHighlighted(2, 3)).toBe(false);
        });

        it("should return true for multiple highlighted cells", (): void => {
            service.highlightedCells.set([
                { row: 1, column: 1 },
                { row: 1, column: 2 },
                { row: 2, column: 1 },
            ]);

            expect(service.isCellHighlighted(1, 1)).toBe(true);
            expect(service.isCellHighlighted(1, 2)).toBe(true);
            expect(service.isCellHighlighted(2, 1)).toBe(true);
            expect(service.isCellHighlighted(2, 2)).toBe(false);
        });
    });

    describe("updateHighlightsForPosition method", (): void => {
        it("should generate cells for a 1x1 tile", (): void => {
            const position: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };

            service.updateHighlightsForPosition(position);

            expect(service.highlightedCells()).toEqual([{ row: 1, column: 1 }]);
        });

        it("should generate cells for a 2x2 tile", (): void => {
            const position: TilePosition = { rowStart: 1, columnStart: 2, rowSpan: 2, columnSpan: 2 };

            service.updateHighlightsForPosition(position);

            expect(service.highlightedCells()).toEqual([
                { row: 1, column: 2 },
                { row: 1, column: 3 },
                { row: 2, column: 2 },
                { row: 2, column: 3 },
            ]);
        });

        it("should generate cells for a 1x3 tile", (): void => {
            const position: TilePosition = { rowStart: 2, columnStart: 1, rowSpan: 1, columnSpan: 3 };

            service.updateHighlightsForPosition(position);

            expect(service.highlightedCells()).toEqual([
                { row: 2, column: 1 },
                { row: 2, column: 2 },
                { row: 2, column: 3 },
            ]);
        });

        it("should replace previous highlights", (): void => {
            service.updateHighlightsForPosition({ rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 });
            service.updateHighlightsForPosition({ rowStart: 3, columnStart: 4, rowSpan: 1, columnSpan: 1 });

            expect(service.highlightedCells()).toEqual([{ row: 3, column: 4 }]);
        });
    });

    describe("clearAll method", (): void => {
        it("should clear highlighted cells", (): void => {
            service.highlightedCells.set([{ row: 1, column: 1 }]);

            service.clearAll();

            expect(service.highlightedCells()).toEqual([]);
        });

        it("should reset isDropInvalid to false", (): void => {
            service.isDropInvalid.set(true);

            service.clearAll();

            expect(service.isDropInvalid()).toBe(false);
        });

        it("should clear both highlighted cells and isDropInvalid simultaneously", (): void => {
            service.highlightedCells.set([
                { row: 1, column: 1 },
                { row: 2, column: 2 },
            ]);
            service.isDropInvalid.set(true);

            service.clearAll();

            expect(service.highlightedCells()).toEqual([]);
            expect(service.isDropInvalid()).toBe(false);
        });
    });
});
