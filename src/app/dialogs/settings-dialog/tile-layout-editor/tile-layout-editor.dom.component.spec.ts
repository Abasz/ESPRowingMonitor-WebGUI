import { ComponentFixture, TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDashboardLayoutConfig } from "../../../../common/common.interfaces";
import { DASHBOARD_TILE_DEFINITIONS } from "../../../dashboard/dashboard-tile-definitions";
import { DashboardTileDefinition, PlacedDashboardTile } from "../../../dashboard/dashboard.interfaces";

import { DragSessionManager } from "./services/drag-session-manager.service";
import { TileHighlightManager } from "./services/tile-highlight-manager.service";
import { TileLayoutEditorComponent } from "./tile-layout-editor.component";
import { multiSpanTwoTileLayout } from "./utils/tile-layout-editor.test.helpers";

describe("TileLayoutEditorComponent DOM contract", (): void => {
    let component: TileLayoutEditorComponent;
    let fixture: ComponentFixture<TileLayoutEditorComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [TileLayoutEditorComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TileLayoutEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("layout", { tiles: multiSpanTwoTileLayout } as IDashboardLayoutConfig);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
        fixture.destroy();
    });

    describe("grid tile positioning via CSS grid", (): void => {
        it("should set grid-row-start matching the tile position", (): void => {
            fixture.detectChanges();

            const tiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag"),
            );

            expect(tiles[0].style.gridRowStart).toBe("1");
            expect(tiles[1].style.gridRowStart).toBe("2");
        });

        it("should set grid-column-start matching the tile position", (): void => {
            fixture.detectChanges();

            const tiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag"),
            );

            expect(tiles[0].style.gridColumnStart).toBe("1");
            expect(tiles[1].style.gridColumnStart).toBe("3");
        });

        it("should set grid-row-end with span matching rowSpan", (): void => {
            fixture.detectChanges();

            const tiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag"),
            );

            expect(tiles[0].style.gridRowEnd).toBe("span 1");
            expect(tiles[1].style.gridRowEnd).toBe("span 1");
        });

        it("should set grid-column-end with span matching columnSpan", (): void => {
            fixture.detectChanges();

            const tiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag"),
            );

            expect(tiles[0].style.gridColumnEnd).toBe("span 1");
            expect(tiles[1].style.gridColumnEnd).toBe("span 2");
        });

        it("should update grid styles when tile positions change", (): void => {
            fixture.detectChanges();

            component.placedTiles.set([
                {
                    id: "distance",
                    position: { rowStart: 3, columnStart: 4, rowSpan: 1, columnSpan: 1 },
                },
            ]);
            fixture.detectChanges();

            const tile: HTMLElement = fixture.nativeElement.querySelector("dnd-tile-grid dnd-tile-drag");
            expect(tile.style.gridRowStart).toBe("3");
            expect(tile.style.gridColumnStart).toBe("4");
        });

        it("should render multi-span tile with correct grid-end spans", (): void => {
            fixture.componentRef.setInput("layout", {
                tiles: [
                    {
                        id: "forceCurve",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 3 },
                    },
                ],
            });
            fixture.detectChanges();

            const tile: HTMLElement = fixture.nativeElement.querySelector("dnd-tile-grid dnd-tile-drag");
            expect(tile.style.gridRowEnd).toBe("span 2");
            expect(tile.style.gridColumnEnd).toBe("span 3");
        });
    });

    describe("grid tile element structure", (): void => {
        it("should contain a .content child with a label span", (): void => {
            fixture.detectChanges();

            const tile: HTMLElement = fixture.nativeElement.querySelector("dnd-tile-grid dnd-tile-drag");
            const content = tile.querySelector(".content");
            expect(content).toBeTruthy();

            const span = content?.querySelector("span");
            expect(span).toBeTruthy();
            expect(span?.textContent?.trim()).toBe("Distance");
        });

        it("should contain a mat-icon inside .content when definition has icon", (): void => {
            fixture.detectChanges();

            const tile: HTMLElement = fixture.nativeElement.querySelector("dnd-tile-grid dnd-tile-drag");
            const icon = tile.querySelector(".content mat-icon");
            expect(icon).toBeTruthy();
            expect(icon?.textContent?.trim()).toBe("distance");
        });

        it("should not contain mat-icon when definition has empty icon", (): void => {
            fixture.componentRef.setInput("layout", {
                tiles: [
                    {
                        label: "Some Label",
                        id: "totalStrokes",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            });
            fixture.detectChanges();

            const tile: HTMLElement = fixture.nativeElement.querySelector("dnd-tile-grid dnd-tile-drag");
            const icon = tile.querySelector(".content mat-icon");
            expect(icon).toBeFalsy();
        });

        it("should contain a .resize-controls sibling to .content", (): void => {
            fixture.detectChanges();

            const tile: HTMLElement = fixture.nativeElement.querySelector("dnd-tile-grid dnd-tile-drag");
            const content = tile.querySelector(".content");
            const resizeControls = tile.querySelector(".resize-controls");
            expect(content).toBeTruthy();
            expect(resizeControls).toBeTruthy();
        });

        it("should render all eight resize handle directions per tile", (): void => {
            fixture.detectChanges();

            const firstTile = fixture.nativeElement.querySelector("dnd-tile-grid dnd-tile-drag");
            expect(firstTile.querySelector(".right")).toBeTruthy();
            expect(firstTile.querySelector(".bottom")).toBeTruthy();
            expect(firstTile.querySelector(".left")).toBeTruthy();
            expect(firstTile.querySelector(".top")).toBeTruthy();
            expect(firstTile.querySelector(".corner-br")).toBeTruthy();
            expect(firstTile.querySelector(".corner-tl")).toBeTruthy();
            expect(firstTile.querySelector(".corner-tr")).toBeTruthy();
            expect(firstTile.querySelector(".corner-bl")).toBeTruthy();
        });
    });

    describe("grid cell DOM structure", (): void => {
        it("should render exactly rows * columns cells", (): void => {
            fixture.detectChanges();

            const cells = fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-grid-cell");
            expect(cells).toHaveLength(component.dndRows() * component.dndColumns());
        });

        it("should set grid-row-start and grid-column-start on each cell", (): void => {
            fixture.detectChanges();

            const cells: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-grid-cell"),
            );

            // first cell should be row 1, col 1
            expect(cells[0].style.gridRowStart).toBe("1");
            expect(cells[0].style.gridColumnStart).toBe("1");

            // second cell should be row 1, col 2
            expect(cells[1].style.gridRowStart).toBe("1");
            expect(cells[1].style.gridColumnStart).toBe("2");

            // fifth cell (first of second row)
            expect(cells[component.dndColumns()].style.gridRowStart).toBe("2");
            expect(cells[component.dndColumns()].style.gridColumnStart).toBe("1");
        });

        it("should render updated number of cells when dndRows input changes", (): void => {
            fixture.detectChanges();

            fixture.componentRef.setInput("dndRows", 2);
            fixture.detectChanges();

            const cells = fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-grid-cell");
            expect(cells).toHaveLength(2 * component.dndColumns());
        });

        it("should render updated number of cells when dndColumns input changes", (): void => {
            fixture.detectChanges();

            fixture.componentRef.setInput("dndColumns", 5);
            fixture.detectChanges();

            const cells = fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-grid-cell");
            expect(cells).toHaveLength(component.dndRows() * 5);
        });
    });

    describe("palette DOM structure", (): void => {
        it("should render palette tiles with .content class", (): void => {
            fixture.detectChanges();

            const paletteTiles = fixture.nativeElement.querySelectorAll("dnd-tile-palette dnd-palette-drag");
            expect(paletteTiles.length).toBe(DASHBOARD_TILE_DEFINITIONS.length - 2);
        });

        it("should render a label span inside each palette tile", (): void => {
            fixture.detectChanges();

            const paletteSpans: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-palette dnd-palette-drag span"),
            );
            expect(paletteSpans.length).toBe(DASHBOARD_TILE_DEFINITIONS.length - 2);

            paletteSpans.forEach((span: HTMLElement): void => {
                expect(span.textContent?.trim().length).toBeGreaterThan(0);
            });
        });

        it("should render mat-icon only for definitions that have an icon", (): void => {
            fixture.detectChanges();

            const availableDefs = DASHBOARD_TILE_DEFINITIONS.filter(
                (def: DashboardTileDefinition): boolean => def.id !== "distance" && def.id !== "pace",
            );
            const defsWithIcon = availableDefs.filter(
                (def: DashboardTileDefinition): boolean => def.icon !== undefined,
            );

            const paletteIcons = fixture.nativeElement.querySelectorAll(
                "dnd-tile-palette dnd-palette-drag mat-icon",
            );
            expect(paletteIcons.length).toBe(defsWithIcon.length);
        });

        it("should render a spacer div when tiles are available", (): void => {
            fixture.detectChanges();

            const spacer = fixture.nativeElement.querySelector("dnd-tile-palette .spacer");
            expect(spacer).toBeTruthy();
        });

        it("should not show empty palette message when tiles are available", (): void => {
            fixture.detectChanges();

            expect(fixture.nativeElement.querySelector("dnd-tile-palette .empty")).toBeFalsy();
        });

        it("should not render spacer when all tiles are placed", (): void => {
            const allPlacedLayout: IDashboardLayoutConfig = {
                tiles: DASHBOARD_TILE_DEFINITIONS.map(
                    (def: DashboardTileDefinition, index: number): PlacedDashboardTile => ({
                        id: def.id,
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

            const spacer = fixture.nativeElement.querySelector("dnd-tile-palette .spacer");
            expect(spacer).toBeFalsy();
        });

        it("should render empty message and no spacer when all tiles are placed", (): void => {
            const allPlacedLayout: IDashboardLayoutConfig = {
                tiles: DASHBOARD_TILE_DEFINITIONS.map(
                    (def: DashboardTileDefinition, index: number): PlacedDashboardTile => ({
                        id: def.id,
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

            const empty = fixture.nativeElement.querySelector("dnd-tile-palette .empty");
            expect(empty).toBeTruthy();
            expect(empty.textContent.trim()).toBe("All tiles placed");

            const spacer = fixture.nativeElement.querySelector("dnd-tile-palette .spacer");
            expect(spacer).toBeFalsy();
        });

        it("should not render palette tiles with .tile class", (): void => {
            fixture.detectChanges();

            const wrongClassTiles = fixture.nativeElement.querySelectorAll("dnd-tile-palette .tile");
            expect(wrongClassTiles.length).toBe(0);
        });
    });

    describe("CSS class bindings during drag", (): void => {
        it("should apply dragging class to matching grid tile during move", (): void => {
            fixture.detectChanges();
            const sessionManager = fixture.debugElement.injector.get(DragSessionManager);

            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });
            fixture.detectChanges();

            const tiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag"),
            );
            expect(tiles[0].classList.contains("dragging")).toBe(true);
            expect(tiles[1].classList.contains("dragging")).toBe(false);
        });

        it("should not apply dragging class to non-matching tile during move", (): void => {
            fixture.detectChanges();
            const sessionManager = fixture.debugElement.injector.get(DragSessionManager);

            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });
            fixture.detectChanges();

            const tiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag"),
            );
            expect(tiles[1].classList.contains("dragging")).toBe(false);
        });

        it("should apply dragging class to palette tile during place drag", (): void => {
            fixture.detectChanges();
            const sessionManager = fixture.debugElement.injector.get(DragSessionManager);

            // power is the first available tile in palette
            sessionManager.dragSession.set({
                actionType: "place",
                id: "power",
                rowSpan: 1,
                columnSpan: 1,
            });
            fixture.detectChanges();

            const paletteTiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-palette dnd-palette-drag"),
            );
            // power is the first in available tiles since Distance and Pace are placed
            const powerTile = paletteTiles[0];
            expect(powerTile.classList.contains("dragging")).toBe(true);
        });

        it("should not apply dragging class to other palette tiles during place drag", (): void => {
            fixture.detectChanges();
            const sessionManager = fixture.debugElement.injector.get(DragSessionManager);

            sessionManager.dragSession.set({
                actionType: "place",
                id: "power",
                rowSpan: 1,
                columnSpan: 1,
            });
            fixture.detectChanges();

            const paletteTiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-palette dnd-palette-drag"),
            );
            // all tiles except Power should not have dragging class
            paletteTiles.slice(1).forEach((tile: HTMLElement): void => {
                expect(tile.classList.contains("dragging")).toBe(false);
            });
        });

        it("should apply resizing class to grid tile during resize", (): void => {
            fixture.detectChanges();
            const sessionManager = fixture.debugElement.injector.get(DragSessionManager);

            sessionManager.dragSession.set({
                actionType: "resize",
                id: "pace",
                rowSpan: 1,
                columnSpan: 2,
                originalPosition: { rowStart: 2, columnStart: 3, rowSpan: 1, columnSpan: 2 },
                resizeDirections: ["right"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });
            fixture.detectChanges();

            const tiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag"),
            );
            // pace is the second tile
            expect(tiles[1].classList.contains("resizing")).toBe(true);
            expect(tiles[0].classList.contains("resizing")).toBe(false);
        });

        it("should apply resize-drag-active class to grid tile during resize", (): void => {
            fixture.detectChanges();
            const sessionManager = fixture.debugElement.injector.get(DragSessionManager);

            sessionManager.dragSession.set({
                actionType: "resize",
                id: "pace",
                rowSpan: 1,
                columnSpan: 2,
                originalPosition: { rowStart: 2, columnStart: 3, rowSpan: 1, columnSpan: 2 },
                resizeDirections: ["right"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });
            fixture.detectChanges();

            const tiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag"),
            );
            expect(tiles[1].classList.contains("resize-drag-active")).toBe(true);
        });

        it("should apply highlighted class to cells in highlightedCells", (): void => {
            fixture.detectChanges();
            const highlightManager = fixture.debugElement.injector.get(TileHighlightManager);

            highlightManager.highlightedCells.set([
                { row: 1, column: 2 },
                { row: 2, column: 2 },
            ]);
            fixture.detectChanges();

            const highlighted = fixture.nativeElement.querySelectorAll(
                "dnd-tile-grid dnd-grid-cell.highlighted",
            );
            expect(highlighted).toHaveLength(2);
        });

        it("should apply invalid-dropzone class to grid when drop is invalid", (): void => {
            fixture.detectChanges();
            const highlightManager = fixture.debugElement.injector.get(TileHighlightManager);

            highlightManager.isDropInvalid.set(true);
            fixture.detectChanges();

            const grid: HTMLElement = fixture.nativeElement.querySelector("dnd-tile-grid");
            expect(grid.classList.contains("invalid-dropzone")).toBe(true);
        });

        it("should remove invalid-dropzone class when drop becomes valid", (): void => {
            fixture.detectChanges();
            const highlightManager = fixture.debugElement.injector.get(TileHighlightManager);

            highlightManager.isDropInvalid.set(true);
            fixture.detectChanges();

            highlightManager.isDropInvalid.set(false);
            fixture.detectChanges();

            const grid: HTMLElement = fixture.nativeElement.querySelector("dnd-tile-grid");
            expect(grid.classList.contains("invalid-dropzone")).toBe(false);
        });

        it("should remove all CSS drag classes when session is cleared", (): void => {
            fixture.detectChanges();
            const sessionManager = fixture.debugElement.injector.get(DragSessionManager);

            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });
            fixture.detectChanges();

            sessionManager.dragSession.set(undefined);
            fixture.detectChanges();

            const dragging = fixture.nativeElement.querySelectorAll(".dragging");
            const resizing = fixture.nativeElement.querySelectorAll(".resizing");
            expect(dragging).toHaveLength(0);
            expect(resizing).toHaveLength(0);
        });
    });

    describe("layout reactivity on tile changes", (): void => {
        it("should increase palette count and decrease grid count when tile removed", (): void => {
            fixture.detectChanges();

            const initialGridCount = fixture.nativeElement.querySelectorAll(
                "dnd-tile-grid dnd-tile-drag",
            ).length;
            const initialPaletteCount = fixture.nativeElement.querySelectorAll(
                "dnd-tile-palette dnd-palette-drag",
            ).length;

            // remove first placed tile via onTileDrop (updates both placedTiles and paletteOrder)
            component.onTileDrop({
                movedToPalette: "distance",
                placedTiles: component
                    .placedTiles()
                    .filter((t: PlacedDashboardTile): boolean => t.id !== "distance"),
            });
            fixture.detectChanges();

            const newGridCount = fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag").length;
            const newPaletteCount = fixture.nativeElement.querySelectorAll(
                "dnd-tile-palette dnd-palette-drag",
            ).length;

            expect(newGridCount).toBe(initialGridCount - 1);
            expect(newPaletteCount).toBe(initialPaletteCount + 1);
        });

        it("should render new tile at correct grid position when placed", (): void => {
            fixture.detectChanges();

            component.placedTiles.set([
                ...component.placedTiles(),
                {
                    id: "power",
                    position: { rowStart: 3, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
            ]);
            fixture.detectChanges();

            const tiles: Array<HTMLElement> = Array.from(
                fixture.nativeElement.querySelectorAll("dnd-tile-grid dnd-tile-drag"),
            );
            const powerTile = tiles[tiles.length - 1];
            expect(powerTile.style.gridRowStart).toBe("3");
            expect(powerTile.style.gridColumnStart).toBe("2");
        });

        it("should update grid styles when tile is moved to new position", (): void => {
            fixture.detectChanges();

            component.placedTiles.set([
                {
                    id: "distance",
                    position: { rowStart: 2, columnStart: 4, rowSpan: 1, columnSpan: 1 },
                },
                component.placedTiles()[1],
            ]);
            fixture.detectChanges();

            const tile: HTMLElement = fixture.nativeElement.querySelector("dnd-tile-grid dnd-tile-drag");
            expect(tile.style.gridRowStart).toBe("2");
            expect(tile.style.gridColumnStart).toBe("4");
        });
    });
});
