import { TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it } from "vitest";

import {
    MoveDragSession,
    PlacedTile,
    ResizeDragSession,
    TileDefinition,
    TilePosition,
} from "../utils/tile-layout.interfaces";

import { DragSessionManager } from "./drag-session-manager.service";

describe("DragSessionManager", (): void => {
    let service: DragSessionManager;

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [DragSessionManager],
        });

        service = TestBed.inject(DragSessionManager);
    });

    describe("as part of component creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });

        it("should have no active drag session initially", (): void => {
            expect(service.dragSession()).toBeUndefined();
        });
    });

    describe("startMoveSession method", (): void => {
        it("should create a move session with tile properties", (): void => {
            const placedTile: PlacedTile = {
                id: "distance",
                position: { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 3 },
            };

            service.startMoveSession(placedTile);

            const session = service.dragSession();
            expect(session).toEqual({
                actionType: "move",
                id: "distance",
                rowSpan: 2,
                columnSpan: 3,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 3 },
                grabOffsetRow: undefined,
                grabOffsetCol: undefined,
            });
        });

        it("should include grab offsets when provided", (): void => {
            const placedTile: PlacedTile = {
                id: "pace",
                position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            };

            service.startMoveSession(placedTile, 1, 2);

            const session = service.dragSession() as MoveDragSession | undefined;
            expect(session?.grabOffsetRow).toBe(1);
            expect(session?.grabOffsetCol).toBe(2);
        });

        it("should copy the original position rather than reference it", (): void => {
            const position: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            const placedTile: PlacedTile = { id: "power", position };

            service.startMoveSession(placedTile);

            position.rowStart = 99;

            expect((service.dragSession() as MoveDragSession | undefined)?.originalPosition?.rowStart).toBe(
                1,
            );
        });
    });

    describe("startPlaceSession method", (): void => {
        it("should create a place session from tile type definition", (): void => {
            const tileDefinition: TileDefinition = {
                id: "distance",
                defaultRowSpan: 1,
                defaultColumnSpan: 1,
                minRowSpan: 1,
                minColumnSpan: 1,
            };

            service.startPlaceSession(tileDefinition);

            const session = service.dragSession();
            expect(session).toEqual({
                actionType: "place",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
            });
        });

        it("should use defaultRowSpan and defaultColumnSpan from definition", (): void => {
            const tileDefinition: TileDefinition = {
                id: "forceCurve",
                defaultRowSpan: 2,
                defaultColumnSpan: 3,
                minRowSpan: 1,
                minColumnSpan: 1,
            };

            service.startPlaceSession(tileDefinition);

            const session = service.dragSession();
            expect(session?.rowSpan).toBe(2);
            expect(session?.columnSpan).toBe(3);
        });
    });

    describe("startResizeSession method", (): void => {
        it("should create a resize session with directions", (): void => {
            const placedTile: PlacedTile = {
                id: "timer",
                position: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 2 },
            };

            service.startResizeSession(placedTile, ["right", "bottom"], 1, 1);

            const session = service.dragSession();
            expect(session).toEqual({
                actionType: "resize",
                id: "timer",
                rowSpan: 1,
                columnSpan: 2,
                originalPosition: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 2 },
                resizeDirections: ["right", "bottom"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });
        });

        it("should copy the original position rather than reference it", (): void => {
            const position: TilePosition = { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 };
            const placedTile: PlacedTile = { id: "strokeRate", position };

            service.startResizeSession(placedTile, ["left"], 1, 1);

            position.rowStart = 99;

            expect((service.dragSession() as ResizeDragSession | undefined)?.originalPosition?.rowStart).toBe(
                1,
            );
        });
    });

    describe("endSession method", (): void => {
        it("should clear the active drag session", (): void => {
            const placedTile: PlacedTile = {
                id: "distance",
                position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            };
            service.startMoveSession(placedTile);

            service.endSession();

            expect(service.dragSession()).toBeUndefined();
        });
    });
});
