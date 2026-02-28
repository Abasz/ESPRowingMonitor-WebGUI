import { ComponentFixture, TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDashboardLayoutConfig } from "../../../common/common.interfaces";
import {
    DASHBOARD_TILE_DEFINITIONS,
    DashboardTileId,
    DEFAULT_LANDSCAPE_LAYOUT,
} from "../../dashboard/dashboard-tile-definitions";
import { DashboardTileDefinition, PlacedDashboardTile } from "../../dashboard/dashboard.interfaces";

import { TileLayoutEditorComponent } from "./tile-layout-editor.component";
import { simpleTwoTileLayout } from "./utils/tile-layout-editor.test.helpers";

describe("TileLayoutEditorComponent methods and properties", (): void => {
    let component: TileLayoutEditorComponent;
    let fixture: ComponentFixture<TileLayoutEditorComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [TileLayoutEditorComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TileLayoutEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("layout", { tiles: simpleTwoTileLayout } as IDashboardLayoutConfig);
    });

    afterEach((): void => {
        fixture.destroy();
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            fixture.detectChanges();

            expect(component).toBeTruthy();
        });
    });

    describe("as part of initialization", (): void => {
        it("should populate placedTiles from layout input on init", (): void => {
            fixture.detectChanges();

            expect(component.placedTiles()).toHaveLength(2);
            expect(component.placedTiles()[0].id).toBe("distance");
            expect(component.placedTiles()[1].id).toBe("pace");
        });

        it("should populate placedTiles from default layout", (): void => {
            fixture.componentRef.setInput("layout", DEFAULT_LANDSCAPE_LAYOUT);
            fixture.detectChanges();

            expect(component.placedTiles()).toHaveLength(DEFAULT_LANDSCAPE_LAYOUT.tiles.length);
        });

        it("should populate placedTiles from empty layout", (): void => {
            fixture.componentRef.setInput("layout", { tiles: [] });
            fixture.detectChanges();

            expect(component.placedTiles()).toHaveLength(0);
        });
    });

    describe("availableTiles signal", (): void => {
        it("should initialize available tiles excluding placed ones", (): void => {
            fixture.detectChanges();

            const available = component.availableTiles();
            const placedTypes = component
                .placedTiles()
                .map((placedTile: PlacedDashboardTile): DashboardTileId => placedTile.id);

            available.forEach((def: { id: DashboardTileId }): void => {
                expect(placedTypes.includes(def.id)).toBe(false);
            });
        });

        it("should return all tile definitions when layout is empty", (): void => {
            fixture.componentRef.setInput("layout", { tiles: [] });
            fixture.detectChanges();

            expect(component.availableTiles()).toHaveLength(DASHBOARD_TILE_DEFINITIONS.length);
        });

        it("should return empty array when all tiles are placed", (): void => {
            const allPlacedLayout: IDashboardLayoutConfig = {
                tiles: DASHBOARD_TILE_DEFINITIONS.map(
                    (definition: { id: DashboardTileId }, index: number): PlacedDashboardTile => ({
                        id: definition.id,
                        position: {
                            rowStart: Math.floor(index / component.dndColumns()) + 1,
                            columnStart: (index % component.dndColumns()) + 1,
                            rowSpan: 1,
                            columnSpan: 1,
                        },
                    }),
                ),
            };
            fixture.componentRef.setInput("layout", allPlacedLayout);
            fixture.detectChanges();

            expect(component.availableTiles()).toHaveLength(0);
        });

        it("should maintain FIFO order independently of definitions", (): void => {
            fixture.detectChanges();

            const availableTypes = component
                .availableTiles()
                .map((def: DashboardTileDefinition): DashboardTileId => def.id);
            const expectedTypes = DASHBOARD_TILE_DEFINITIONS.filter(
                (def: DashboardTileDefinition): boolean =>
                    !component
                        .placedTiles()
                        .some((placedTile: PlacedDashboardTile): boolean => placedTile.id === def.id),
            ).map((def: DashboardTileDefinition): DashboardTileId => def.id);

            expect(availableTypes).toEqual(expectedTypes);
        });
    });

    describe("onTileDrop method", (): void => {
        it("should append a tile returned to the palette to the end of availableTiles", (): void => {
            fixture.detectChanges();

            // initial palette has tiles in DASHBOARD_TILE_DEFINITIONS order (minus Distance and Pace)
            const initialPaletteTypes = component
                .availableTiles()
                .map((definition: DashboardTileDefinition): DashboardTileId => definition.id);

            component.onTileDrop({
                movedToPalette: "distance",
                placedTiles: [
                    {
                        id: "pace",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            });

            const paletteTypes = component
                .availableTiles()
                .map((definition: DashboardTileDefinition): DashboardTileId => definition.id);

            expect(paletteTypes[paletteTypes.length - 1]).toBe("distance");
            expect(paletteTypes.slice(0, initialPaletteTypes.length)).toEqual(initialPaletteTypes);
        });

        it("should remove a tile placed on the grid from availableTiles", (): void => {
            fixture.componentRef.setInput("layout", { tiles: [] });
            fixture.detectChanges();

            expect(
                component
                    .availableTiles()
                    .some((tile: DashboardTileDefinition): boolean => tile.id === "distance"),
            ).toBe(true);

            component.onTileDrop({
                placedFromPalette: "distance",
                placedTiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            });

            expect(
                component
                    .availableTiles()
                    .some((tile: DashboardTileDefinition): boolean => tile.id === "distance"),
            ).toBe(false);
        });

        it("should emit layoutChange with the placed tiles on drop", (): void => {
            fixture.detectChanges();
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            component.onTileDrop({
                placedTiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            });

            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy.mock.calls[0][0].tiles).toHaveLength(1);
            expect(emitSpy.mock.calls[0][0].tiles[0].id).toBe("distance");
        });
    });

    describe("layout input change behavior", (): void => {
        it("should reinitialize placedTiles when a new layout reference is provided", (): void => {
            fixture.detectChanges();

            component.onTileDrop({
                placedTiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            });
            expect(component.placedTiles()).toHaveLength(1);

            const freshLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    },
                    {
                        id: "pace",
                        position: { rowStart: 1, columnStart: 3, rowSpan: 1, columnSpan: 2 },
                    },
                ],
            };
            fixture.componentRef.setInput("layout", freshLayout);
            fixture.detectChanges();

            expect(component.placedTiles()).toHaveLength(2);
            expect(component.placedTiles()[0].id).toBe("distance");
            expect(component.placedTiles()[1].id).toBe("pace");
        });

        it("should reinitialize placedTiles and availableTiles when layout with a new tile set is provided", (): void => {
            fixture.detectChanges();

            let emittedLayout: IDashboardLayoutConfig | undefined;
            vi.spyOn(component.layoutChange, "emit").mockImplementation(
                (layout: IDashboardLayoutConfig): void => {
                    emittedLayout = layout;
                },
            );

            component.onTileDrop({
                placedFromPalette: "heartRate",
                placedTiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                    {
                        id: "pace",
                        position: { rowStart: 2, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                    {
                        id: "heartRate",
                        position: { rowStart: 2, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            });

            // parent echoes back the emitted layout (new tile set with heartRate)
            fixture.componentRef.setInput("layout", emittedLayout);
            fixture.detectChanges();

            expect(component.placedTiles()).toHaveLength(3);
            expect(
                component
                    .availableTiles()
                    .some((t: DashboardTileDefinition): boolean => t.id === "heartRate"),
            ).toBe(false);
        });

        it("should preserve availableTiles FIFO order when the same tile set is echoed back", (): void => {
            fixture.detectChanges();

            // manually reorder availableTiles to put heartRate at the end (FIFO simulation)
            component.availableTiles.update(
                (tiles: Array<DashboardTileDefinition>): Array<DashboardTileDefinition> => {
                    const heartRate = tiles.find(
                        (definition: DashboardTileDefinition): boolean => definition.id === "heartRate",
                    );
                    const rest = tiles.filter(
                        (definition: DashboardTileDefinition): boolean => definition.id !== "heartRate",
                    );

                    return heartRate ? [...rest, heartRate] : rest;
                },
            );

            const reorderedIds = component
                .availableTiles()
                .map((def: DashboardTileDefinition): DashboardTileId => def.id);
            expect(reorderedIds[reorderedIds.length - 1]).toBe("heartRate");

            // echo back the exact same placed tile set (distance + pace, same IDs, different reference)
            const echoLayout: IDashboardLayoutConfig = {
                tiles: [...simpleTwoTileLayout] as Array<PlacedDashboardTile>,
            };
            fixture.componentRef.setInput("layout", echoLayout);
            fixture.detectChanges();

            // availableTiles should NOT be reset to definition order; heartRate stays at end
            const afterEchoIds = component
                .availableTiles()
                .map((def: DashboardTileDefinition): DashboardTileId => def.id);
            expect(afterEchoIds[afterEchoIds.length - 1]).toBe("heartRate");
            expect(afterEchoIds).toEqual(reorderedIds);
        });

        it("should reinitialize with empty placedTiles when layout with no tiles is provided", (): void => {
            fixture.detectChanges();
            expect(component.placedTiles()).toHaveLength(2);

            fixture.componentRef.setInput("layout", { tiles: [] });
            fixture.detectChanges();

            expect(component.placedTiles()).toHaveLength(0);
            expect(component.availableTiles()).toHaveLength(DASHBOARD_TILE_DEFINITIONS.length);
        });
    });
});
