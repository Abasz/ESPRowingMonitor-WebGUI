import { TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlacedTile, TileDefinition } from "../utils/tile-layout.interfaces";

import { DndStateService, TileDragDropResult } from "./dnd-state.service";

describe("DndStateService", (): void => {
    let service: DndStateService;

    const distanceTile: PlacedTile = {
        id: "distance",
        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
    };
    const paceTile: PlacedTile = {
        id: "pace",
        position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
    };
    const distanceDef: TileDefinition = {
        id: "distance",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    };
    const paceDef: TileDefinition = {
        id: "pace",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    };

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [DndStateService],
        });
        service = TestBed.inject(DndStateService);
    });

    describe("as part of initial state", (): void => {
        it("should start with empty committed tiles", (): void => {
            expect(service.committedTiles()).toEqual([]);
        });

        it("should start with empty tile definitions", (): void => {
            expect(service.tileDefinitions()).toEqual([]);
        });

        it("should return committed tiles as display tiles when no preview is set", (): void => {
            expect(service.displayTiles()).toEqual([]);
        });
    });

    describe("displayTiles signal", (): void => {
        it("should reflect committed tiles when no preview override is active", (): void => {
            service.committedTiles.set([distanceTile]);

            expect(service.displayTiles()).toEqual([distanceTile]);
        });

        it("should reflect preview override when set", (): void => {
            service.committedTiles.set([distanceTile]);
            const previewTiles = [distanceTile, paceTile];

            service.setPreviewOverride(previewTiles);

            expect(service.displayTiles()).toEqual(previewTiles);
        });

        it("should revert to committed tiles when preview is cleared", (): void => {
            service.committedTiles.set([distanceTile]);
            service.setPreviewOverride([distanceTile, paceTile]);

            service.setPreviewOverride(undefined);

            expect(service.displayTiles()).toEqual([distanceTile]);
        });
    });

    describe("isSwapPreviewActive signal", (): void => {
        it("should be false when no preview override is set", (): void => {
            expect(service.isSwapPreviewActive()).toBe(false);
        });

        it("should be true when a preview override is active", (): void => {
            service.setPreviewOverride([distanceTile]);

            expect(service.isSwapPreviewActive()).toBe(true);
        });

        it("should revert to false when preview is cleared", (): void => {
            service.setPreviewOverride([distanceTile]);
            service.setPreviewOverride(undefined);

            expect(service.isSwapPreviewActive()).toBe(false);
        });

        it("should revert to false when a drop is notified", (): void => {
            service.setPreviewOverride([distanceTile]);

            service.notifyDrop({ placedTiles: [distanceTile] });

            expect(service.isSwapPreviewActive()).toBe(false);
        });
    });

    describe("notifyDrop method", (): void => {
        it("should update committed tiles with the drop result", (): void => {
            service.committedTiles.set([distanceTile]);
            const result: TileDragDropResult = {
                placedTiles: [distanceTile, paceTile],
                placedFromPalette: "pace",
            };

            service.notifyDrop(result);

            expect(service.committedTiles()).toEqual([distanceTile, paceTile]);
        });

        it("should clear preview override on drop", (): void => {
            service.committedTiles.set([distanceTile]);
            service.setPreviewOverride([distanceTile, paceTile]);

            service.notifyDrop({ placedTiles: [distanceTile, paceTile] });

            expect(service.displayTiles()).toEqual([distanceTile, paceTile]);
        });

        it("should emit the drop result on drop$", (): void => {
            const dropSpy = vi.fn();
            service.drop$.subscribe(dropSpy);
            const result: TileDragDropResult = {
                placedTiles: [distanceTile],
                movedToPalette: "pace",
            };

            service.notifyDrop(result);

            expect(dropSpy).toHaveBeenCalledTimes(1);
            expect(dropSpy).toHaveBeenCalledWith(result);
        });

        it("should emit on drop$ for each successive notifyDrop call", (): void => {
            const dropSpy = vi.fn();
            service.drop$.subscribe(dropSpy);

            service.notifyDrop({ placedTiles: [distanceTile] });
            service.notifyDrop({ placedTiles: [paceTile] });

            expect(dropSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("getDefinition method", (): void => {
        it("should return the matching definition for a known type", (): void => {
            service.tileDefinitions.set([distanceDef, paceDef]);

            const result = service.getDefinition("distance");

            expect(result).toBe(distanceDef);
        });

        it("should return undefined for an unknown type", (): void => {
            service.tileDefinitions.set([distanceDef]);

            const result = service.getDefinition("power");

            expect(result).toBeUndefined();
        });

        it("should return undefined when no definitions are set", (): void => {
            const result = service.getDefinition("distance");

            expect(result).toBeUndefined();
        });
    });
});
