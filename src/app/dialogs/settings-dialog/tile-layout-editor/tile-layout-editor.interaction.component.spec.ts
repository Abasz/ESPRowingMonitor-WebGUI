import { ComponentFixture, TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDashboardLayoutConfig } from "../../../../common/common.interfaces";
import { DASHBOARD_TILE_DEFINITIONS, DashboardTileId } from "../../../dashboard/dashboard-tile-definitions";
import { DashboardTileDefinition, PlacedDashboardTile } from "../../../dashboard/dashboard.interfaces";

import { DndStateService } from "./services/dnd-state.service";
import { DragCoordinator } from "./services/drag-coordinator.service";
import { DragPreviewRenderer } from "./services/drag-preview-renderer.service";
import { DragSessionManager } from "./services/drag-session-manager.service";
import { TileHighlightManager } from "./services/tile-highlight-manager.service";
import { TileLayoutEditorComponent } from "./tile-layout-editor.component";
import { simpleTwoTileLayout } from "./utils/tile-layout-editor.test.helpers";
import { PlacedTile } from "./utils/tile-layout.interfaces";

describe("TileLayoutEditorComponent interaction behavior", (): void => {
    let component: TileLayoutEditorComponent;
    let fixture: ComponentFixture<TileLayoutEditorComponent>;
    let sessionManager: DragSessionManager;
    let highlightManager: TileHighlightManager;
    let coordinator: DragCoordinator;
    let dndState: DndStateService;
    let dragPreview: DragPreviewRenderer;

    const mockGridRect = {
        left: 0,
        top: 0,
        width: 416,
        height: 160,
    };

    const registerMouseListeners = (): void => {
        coordinator.registerListeners("mouse");
    };

    const dispatchMouseMove = (clientX: number, clientY: number): void => {
        document.dispatchEvent(new MouseEvent("mousemove", { clientX, clientY }));
    };

    const dispatchMouseUp = (clientX: number, clientY: number): void => {
        document.dispatchEvent(new MouseEvent("mouseup", { clientX, clientY }));
    };

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [TileLayoutEditorComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TileLayoutEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("layout", { tiles: simpleTwoTileLayout } as IDashboardLayoutConfig);

        sessionManager = fixture.debugElement.injector.get(DragSessionManager);
        highlightManager = fixture.debugElement.injector.get(TileHighlightManager);
        coordinator = fixture.debugElement.injector.get(DragCoordinator);
        dndState = fixture.debugElement.injector.get(DndStateService);
        dragPreview = fixture.debugElement.injector.get(DragPreviewRenderer);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
        fixture.destroy();
    });

    describe("mouse move during drag", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);
        });

        it("should highlight cells under dragged tile", (): void => {
            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "place",
                id: "power",
                rowSpan: 1,
                columnSpan: 1,
            });

            dispatchMouseMove(50, 30);

            expect(highlightManager.highlightedCells().length).toBeGreaterThan(0);
        });

        it("should highlight multiple cells for multi-span tile", (): void => {
            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "place",
                id: "power",
                rowSpan: 2,
                columnSpan: 2,
            });

            dispatchMouseMove(50, 30);

            expect(highlightManager.highlightedCells()).toHaveLength(4);
        });

        it("should set isDropInvalid to false when placement is valid", (): void => {
            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            dispatchMouseMove(250, 80);

            expect(coordinator.isDropInvalid()).toBe(false);
        });

        it("should exclude current tile from collision detection when moving", (): void => {
            const currentTile = component.placedTiles()[0];

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: currentTile.id,
                rowSpan: currentTile.position.rowSpan,
                columnSpan: currentTile.position.columnSpan,
                originalPosition: { ...currentTile.position },
            });

            dispatchMouseMove(50, 30);

            expect(coordinator.isDropInvalid()).toBe(false);
        });

        it("should not exclude tiles when placing from palette", (): void => {
            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "place",
                id: "power",
                rowSpan: 1,
                columnSpan: 1,
            });

            dispatchMouseMove(50, 30);

            expect(coordinator.isDropInvalid()).toBe(true);
        });

        it("should allow swap when moving tile over another same-sized tile", (): void => {
            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            dispatchMouseMove(150, 30);

            expect(coordinator.isDropInvalid()).toBe(false);
        });

        it("should clear highlights when pointer leaves grid area", (): void => {
            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            dispatchMouseMove(50, 30);
            expect(highlightManager.highlightedCells().length).toBeGreaterThan(0);

            dispatchMouseMove(50, 300);
            expect(highlightManager.highlightedCells()).toHaveLength(0);
        });
    });

    describe("mouse up during move and place", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);
        });

        describe("when dropping from palette to grid", (): void => {
            it("should add tile when placement is valid", async (): Promise<void> => {
                const initialCount = component.placedTiles().length;
                const tileDefinition = DASHBOARD_TILE_DEFINITIONS.find(
                    (definition: DashboardTileDefinition): boolean => definition.id === "power",
                ) as DashboardTileDefinition;
                const emitSpy = vi.spyOn(component.layoutChange, "emit");

                registerMouseListeners();
                sessionManager.dragSession.set({
                    actionType: "place",
                    id: tileDefinition.id,
                    rowSpan: tileDefinition.defaultRowSpan,
                    columnSpan: tileDefinition.defaultColumnSpan,
                });

                dispatchMouseUp(250, 80);
                await fixture.whenStable();

                expect(component.placedTiles()).toHaveLength(initialCount + 1);
                expect(
                    component.placedTiles().some((tile: PlacedDashboardTile): boolean => tile.id === "power"),
                ).toBe(true);
                expect(emitSpy).toHaveBeenCalledTimes(1);
            });

            it("should not add tile when placement is invalid (overlap)", async (): Promise<void> => {
                const initialCount = component.placedTiles().length;
                const emitSpy = vi.spyOn(component.layoutChange, "emit");

                registerMouseListeners();
                sessionManager.dragSession.set({
                    actionType: "place",
                    id: "power",
                    rowSpan: 1,
                    columnSpan: 1,
                });

                dispatchMouseUp(50, 30);
                await fixture.whenStable();

                expect(component.placedTiles()).toHaveLength(initialCount);
                expect(emitSpy).not.toHaveBeenCalled();
            });

            it("should clear highlights and session after drop", async (): Promise<void> => {
                highlightManager.highlightedCells.set([{ row: 1, column: 1 }]);
                highlightManager.isDropInvalid.set(true);

                registerMouseListeners();
                sessionManager.dragSession.set({
                    actionType: "place",
                    id: "power",
                    rowSpan: 1,
                    columnSpan: 1,
                });

                dispatchMouseUp(250, 80);
                await fixture.whenStable();

                expect(highlightManager.highlightedCells()).toHaveLength(0);
                expect(coordinator.isDropInvalid()).toBe(false);
            });
        });

        describe("when moving existing tile within grid", (): void => {
            it("should update tile position when new position is valid", async (): Promise<void> => {
                const tileToMove = component.placedTiles()[0];
                const emitSpy = vi.spyOn(component.layoutChange, "emit");

                registerMouseListeners();
                sessionManager.dragSession.set({
                    actionType: "move",
                    id: tileToMove.id,
                    rowSpan: tileToMove.position.rowSpan,
                    columnSpan: tileToMove.position.columnSpan,
                    originalPosition: { ...tileToMove.position },
                });

                dispatchMouseUp(250, 80);
                await fixture.whenStable();

                const movedTile = component
                    .placedTiles()
                    .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
                expect(movedTile?.position.rowStart).not.toBe(1);
                expect(emitSpy).toHaveBeenCalledTimes(1);
            });

            it("should swap tiles when moving one tile over another of same size", async (): Promise<void> => {
                const tileToMove = component.placedTiles()[0]; // distance at (1,1)
                const targetTile = component.placedTiles()[1]; // pace at (1,2)
                const emitSpy = vi.spyOn(component.layoutChange, "emit");

                registerMouseListeners();
                sessionManager.dragSession.set({
                    actionType: "move",
                    id: tileToMove.id,
                    rowSpan: tileToMove.position.rowSpan,
                    columnSpan: tileToMove.position.columnSpan,
                    originalPosition: { ...tileToMove.position },
                });

                dispatchMouseUp(150, 30);
                await fixture.whenStable();

                const distance = component
                    .placedTiles()
                    .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
                const pace = component
                    .placedTiles()
                    .find((tile: PlacedDashboardTile): boolean => tile.id === "pace");

                expect(distance?.position.columnStart).toBe(targetTile.position.columnStart);
                expect(pace?.position.columnStart).toBe(tileToMove.position.columnStart);
                expect(emitSpy).toHaveBeenCalledTimes(1);
            });

            it("should use grab offset for tile positioning when provided", async (): Promise<void> => {
                const wideLayout: IDashboardLayoutConfig = {
                    tiles: [
                        {
                            id: "distance",
                            position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                        },
                    ],
                };
                component.placedTiles.set([...wideLayout.tiles]);
                fixture.detectChanges();
                const emitSpy = vi.spyOn(component.layoutChange, "emit");

                registerMouseListeners();
                sessionManager.dragSession.set({
                    actionType: "move",
                    id: "distance",
                    rowSpan: 1,
                    columnSpan: 2,
                    originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    grabOffsetRow: 0,
                    grabOffsetCol: 1,
                });

                dispatchMouseUp(380, 30);
                await fixture.whenStable();

                expect(emitSpy).toHaveBeenCalledTimes(1);
                const movedTile = component
                    .placedTiles()
                    .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
                expect(movedTile?.position.columnStart).toBe(3);
            });
        });

        describe("when mouse up occurs with no session", (): void => {
            it("should not modify tiles", (): void => {
                const emitSpy = vi.spyOn(component.layoutChange, "emit");

                registerMouseListeners();
                sessionManager.dragSession.set(undefined);

                dispatchMouseUp(250, 80);

                expect(emitSpy).not.toHaveBeenCalled();
            });
        });
    });

    describe("mouse up during resize", (): void => {
        const spacedLayout: IDashboardLayoutConfig = {
            tiles: [
                {
                    id: "distance",
                    position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                },
                {
                    id: "pace",
                    position: { rowStart: 1, columnStart: 4, rowSpan: 1, columnSpan: 1 },
                },
            ],
        };

        beforeEach((): void => {
            fixture.componentRef.setInput("layout", spacedLayout);
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);
        });

        it("should resize tile horizontally to the right when placement is valid", async (): Promise<void> => {
            const tileToResize = component.placedTiles()[0];
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "resize",
                id: tileToResize.id,
                rowSpan: tileToResize.position.rowSpan,
                columnSpan: tileToResize.position.columnSpan,
                originalPosition: { ...tileToResize.position },
                resizeDirections: ["right"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });

            dispatchMouseUp(200, 30);
            await fixture.whenStable();

            const resizedTile = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            expect(resizedTile?.position.columnSpan).toBeGreaterThan(1);
            expect(emitSpy).toHaveBeenCalledTimes(1);
        });

        it("should resize tile vertically downward when placement is valid", async (): Promise<void> => {
            const tileToResize = component.placedTiles()[0];
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "resize",
                id: tileToResize.id,
                rowSpan: tileToResize.position.rowSpan,
                columnSpan: tileToResize.position.columnSpan,
                originalPosition: { ...tileToResize.position },
                resizeDirections: ["bottom"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });

            dispatchMouseUp(50, 80);
            await fixture.whenStable();

            const resizedTile = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            expect(resizedTile?.position.rowSpan).toBeGreaterThan(1);
            expect(emitSpy).toHaveBeenCalledTimes(1);
        });

        it("should resize tile diagonally when placement is valid", async (): Promise<void> => {
            const tileToResize = component.placedTiles()[0];
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "resize",
                id: tileToResize.id,
                rowSpan: tileToResize.position.rowSpan,
                columnSpan: tileToResize.position.columnSpan,
                originalPosition: { ...tileToResize.position },
                resizeDirections: ["right", "bottom"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });

            dispatchMouseUp(200, 80);
            await fixture.whenStable();

            const resizedTile = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            expect(resizedTile?.position.rowSpan).toBeGreaterThan(1);
            expect(resizedTile?.position.columnSpan).toBeGreaterThan(1);
            expect(emitSpy).toHaveBeenCalledTimes(1);
        });

        it("should not resize when placement would overlap another tile", async (): Promise<void> => {
            const tileToResize = component.placedTiles()[0];
            const emitSpy = vi.spyOn(component.layoutChange, "emit");
            const originalColumnSpan = tileToResize.position.columnSpan;

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "resize",
                id: tileToResize.id,
                rowSpan: tileToResize.position.rowSpan,
                columnSpan: tileToResize.position.columnSpan,
                originalPosition: { ...tileToResize.position },
                resizeDirections: ["right"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });

            dispatchMouseUp(400, 30);
            await fixture.whenStable();

            const tile = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            expect(tile?.position.columnSpan).toBe(originalColumnSpan);
            expect(emitSpy).not.toHaveBeenCalled();
        });

        it("should not resize when placement goes outside the grid", async (): Promise<void> => {
            const farTile: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 3, columnStart: 4, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            };
            component.placedTiles.set([...farTile.tiles]);
            fixture.detectChanges();
            const tileToResize = component.placedTiles()[0];
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "resize",
                id: tileToResize.id,
                rowSpan: tileToResize.position.rowSpan,
                columnSpan: tileToResize.position.columnSpan,
                originalPosition: { ...tileToResize.position },
                resizeDirections: ["right"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });

            dispatchMouseUp(500, 140);
            await fixture.whenStable();

            expect(emitSpy).not.toHaveBeenCalled();
        });

        it("should not resize when tile type definition is not found", async (): Promise<void> => {
            const tileToResize = component.placedTiles()[0];
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "resize",
                id: 999 as unknown as DashboardTileId, // invalid type
                rowSpan: tileToResize.position.rowSpan,
                columnSpan: tileToResize.position.columnSpan,
                originalPosition: { ...tileToResize.position },
                resizeDirections: ["right"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });

            dispatchMouseUp(200, 30);
            await fixture.whenStable();

            expect(emitSpy).not.toHaveBeenCalled();
        });

        it("should resize tile from the left direction", async (): Promise<void> => {
            const widerLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 2 },
                    },
                ],
            };
            component.placedTiles.set([...widerLayout.tiles]);
            fixture.detectChanges();
            const tileToResize = component.placedTiles()[0];
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "resize",
                id: tileToResize.id,
                rowSpan: tileToResize.position.rowSpan,
                columnSpan: tileToResize.position.columnSpan,
                originalPosition: { ...tileToResize.position },
                resizeDirections: ["left"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });

            dispatchMouseUp(50, 30);
            await fixture.whenStable();

            const resizedTile = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            expect(resizedTile?.position.columnStart).toBe(1);
            expect(resizedTile?.position.columnSpan).toBe(3);
            expect(emitSpy).toHaveBeenCalledTimes(1);
        });

        it("should resize tile from the top direction", async (): Promise<void> => {
            const tallerLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 2, columnStart: 1, rowSpan: 2, columnSpan: 1 },
                    },
                ],
            };
            component.placedTiles.set([...tallerLayout.tiles]);
            fixture.detectChanges();
            const tileToResize = component.placedTiles()[0];
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "resize",
                id: tileToResize.id,
                rowSpan: tileToResize.position.rowSpan,
                columnSpan: tileToResize.position.columnSpan,
                originalPosition: { ...tileToResize.position },
                resizeDirections: ["top"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });

            dispatchMouseUp(50, 30);
            await fixture.whenStable();

            const resizedTile = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            expect(resizedTile?.position.rowStart).toBe(1);
            expect(resizedTile?.position.rowSpan).toBe(3);
            expect(emitSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("palette drop via mouse up", (): void => {
        const mockPaletteRect = { left: 0, top: 200, width: 416, height: 100 };

        it("should remove tile when moved to palette area", async (): Promise<void> => {
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-palette")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockPaletteRect as DOMRect);

            const tileToRemove = component.placedTiles()[0];
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: tileToRemove.id,
                rowSpan: tileToRemove.position.rowSpan,
                columnSpan: tileToRemove.position.columnSpan,
                originalPosition: { ...tileToRemove.position },
            });

            dispatchMouseUp(50, 250);
            await fixture.whenStable();

            expect(
                component.placedTiles().some((tile: PlacedDashboardTile): boolean => tile.id === "distance"),
            ).toBe(false);
            expect(emitSpy).toHaveBeenCalledTimes(1);
        });

        it("should not remove tile when session is place action", async (): Promise<void> => {
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-palette")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockPaletteRect as DOMRect);

            const initialCount = component.placedTiles().length;

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "place",
                id: "power",
                rowSpan: 1,
                columnSpan: 1,
            });

            dispatchMouseUp(50, 250);
            await fixture.whenStable();

            expect(component.placedTiles()).toHaveLength(initialCount);
        });
    });

    describe("tile swapping", (): void => {
        it("should swap tiles of same size when moved to each others position", async (): Promise<void> => {
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);

            const tileToMove = component.placedTiles()[0]; // distance at (1,1)
            const targetTile = component.placedTiles()[1]; // pace at (1,2)
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: tileToMove.id,
                rowSpan: tileToMove.position.rowSpan,
                columnSpan: tileToMove.position.columnSpan,
                originalPosition: { ...tileToMove.position },
            });

            dispatchMouseUp(150, 30);
            await fixture.whenStable();

            const distance = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            const pace = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "pace");

            expect(distance?.position.columnStart).toBe(targetTile.position.columnStart);
            expect(pace?.position.columnStart).toBe(tileToMove.position.columnStart);
            expect(emitSpy).toHaveBeenCalledTimes(1);
        });

        it("should swap displaced tiles to grid fallback when freed area overlaps target", async (): Promise<void> => {
            const overlappingLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    },
                    {
                        id: "pace",
                        position: { rowStart: 1, columnStart: 3, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            };
            fixture.componentRef.setInput("layout", overlappingLayout);
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);

            const tileToMove = component.placedTiles()[0]; // distance 1x2 at (1,1)
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: tileToMove.id,
                rowSpan: tileToMove.position.rowSpan,
                columnSpan: tileToMove.position.columnSpan,
                originalPosition: { ...tileToMove.position },
            });

            dispatchMouseUp(250, 30);
            await fixture.whenStable();

            expect(emitSpy).toHaveBeenCalledTimes(1);

            const distance = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            const pace = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "pace");

            expect(distance?.position.columnStart).toBe(3);
            expect(pace?.position.columnStart).toBe(1);
        });

        it("should multi-swap when larger tile moves over multiple smaller tiles to non-overlapping area", async (): Promise<void> => {
            const complexLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    },
                    {
                        id: "pace",
                        position: { rowStart: 1, columnStart: 3, rowSpan: 1, columnSpan: 1 },
                    },
                    {
                        id: "power",
                        position: { rowStart: 1, columnStart: 4, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            };
            fixture.componentRef.setInput("layout", complexLayout);
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);

            const tileToMove = component.placedTiles()[0]; // distance 1x2 at (1,1)
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: tileToMove.id,
                rowSpan: tileToMove.position.rowSpan,
                columnSpan: tileToMove.position.columnSpan,
                originalPosition: { ...tileToMove.position },
            });

            dispatchMouseUp(250, 30);
            await fixture.whenStable();

            expect(emitSpy).toHaveBeenCalledTimes(1);

            const distance = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            const pace = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "pace");
            const power = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "power");

            expect(distance?.position.columnStart).toBe(3);
            expect(pace?.position.columnStart).toBe(1);
            expect(power?.position.columnStart).toBe(2);
        });

        it("should show valid drop zone when multi-swap is possible during drag over", (): void => {
            const threeLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    },
                    {
                        id: "pace",
                        position: { rowStart: 1, columnStart: 3, rowSpan: 1, columnSpan: 1 },
                    },
                    {
                        id: "power",
                        position: { rowStart: 1, columnStart: 4, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            };
            fixture.componentRef.setInput("layout", threeLayout);
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);

            const tileToMove = component.placedTiles()[0]; // distance 1x2 at (1,1)

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: tileToMove.id,
                rowSpan: tileToMove.position.rowSpan,
                columnSpan: tileToMove.position.columnSpan,
                originalPosition: { ...tileToMove.position },
            });

            dispatchMouseMove(250, 30);

            expect(coordinator.isDropInvalid()).toBe(false);
            expect(highlightManager.highlightedCells()).toHaveLength(2);
        });

        it("should swap when displaced tile fits on grid outside the freed area", async (): Promise<void> => {
            const edgeLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                    {
                        id: "pace",
                        position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                    },
                    {
                        id: "power",
                        position: { rowStart: 1, columnStart: 3, rowSpan: 1, columnSpan: 1 },
                    },
                    {
                        id: "strokeRate",
                        position: { rowStart: 1, columnStart: 4, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            };
            fixture.componentRef.setInput("layout", edgeLayout);
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);

            const tileToMove = component.placedTiles()[0]; // distance 1x1 at (1,1)
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: tileToMove.id,
                rowSpan: tileToMove.position.rowSpan,
                columnSpan: tileToMove.position.columnSpan,
                originalPosition: { ...tileToMove.position },
            });

            dispatchMouseUp(150, 30);
            await fixture.whenStable();

            expect(emitSpy).toHaveBeenCalledTimes(1);
        });

        it("should swap two same-size 2x2 tiles", async (): Promise<void> => {
            const twoLargeTileLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 2 },
                    },
                    {
                        id: "pace",
                        position: { rowStart: 1, columnStart: 3, rowSpan: 2, columnSpan: 2 },
                    },
                ],
            };
            fixture.componentRef.setInput("layout", twoLargeTileLayout);
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);

            const tileToMove = component.placedTiles()[0]; // distance 2x2 at (1,1)
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: tileToMove.id,
                rowSpan: tileToMove.position.rowSpan,
                columnSpan: tileToMove.position.columnSpan,
                originalPosition: { ...tileToMove.position },
            });

            dispatchMouseUp(320, 30);
            await fixture.whenStable();

            expect(emitSpy).toHaveBeenCalledTimes(1);
            const distance = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            const pace = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "pace");
            expect(distance?.position.columnStart).toBe(3);
            expect(pace?.position.columnStart).toBe(1);
        });

        it("should show valid drop zone when 2x2 swap is possible during drag over", (): void => {
            const twoLargeTileLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 2, columnSpan: 2 },
                    },
                    {
                        id: "pace",
                        position: { rowStart: 1, columnStart: 3, rowSpan: 2, columnSpan: 2 },
                    },
                ],
            };
            fixture.componentRef.setInput("layout", twoLargeTileLayout);
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);

            const tileToMove = component.placedTiles()[0]; // distance 2x2 at (1,1)

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: tileToMove.id,
                rowSpan: tileToMove.position.rowSpan,
                columnSpan: tileToMove.position.columnSpan,
                originalPosition: { ...tileToMove.position },
            });

            dispatchMouseMove(320, 30);

            expect(coordinator.isDropInvalid()).toBe(false);
        });

        it("should swap 1x1 tile with 1x2 tile using grid fallback", async (): Promise<void> => {
            const mixedSizeLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                    },
                    {
                        id: "pace",
                        position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 2 },
                    },
                ],
            };
            fixture.componentRef.setInput("layout", mixedSizeLayout);
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);

            const tileToMove = component.placedTiles()[0]; // distance 1x1 at (1,1)
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            registerMouseListeners();
            sessionManager.dragSession.set({
                actionType: "move",
                id: tileToMove.id,
                rowSpan: tileToMove.position.rowSpan,
                columnSpan: tileToMove.position.columnSpan,
                originalPosition: { ...tileToMove.position },
            });

            dispatchMouseUp(150, 30);
            await fixture.whenStable();

            expect(emitSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("touch drag events", (): void => {
        const createTouch = (target: EventTarget, clientX: number, clientY: number): Touch =>
            new Touch({
                identifier: 1,
                target,
                clientX,
                clientY,
                radiusX: 1,
                radiusY: 1,
                rotationAngle: 0,
                force: 1,
            });

        const startTouchDrag = (element: HTMLElement, clientX: number, clientY: number): void => {
            const touch = createTouch(element, clientX, clientY);
            element.dispatchEvent(
                new TouchEvent("touchstart", {
                    touches: [touch],
                    changedTouches: [touch],
                    bubbles: true,
                    cancelable: true,
                }),
            );
        };

        const dispatchTouchMove = (target: EventTarget, clientX: number, clientY: number): void => {
            const touch = createTouch(target, clientX, clientY);
            document.dispatchEvent(
                new TouchEvent("touchmove", {
                    touches: [touch],
                    changedTouches: [touch],
                    bubbles: true,
                    cancelable: true,
                }),
            );
        };

        const dispatchTouchEnd = (target: EventTarget, clientX: number, clientY: number): void => {
            const touch = createTouch(target, clientX, clientY);
            document.dispatchEvent(
                new TouchEvent("touchend", {
                    touches: [],
                    changedTouches: [touch],
                    bubbles: true,
                    cancelable: true,
                }),
            );
        };

        beforeEach((): void => {
            fixture.detectChanges();
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-grid")!,
                "getBoundingClientRect",
            ).mockReturnValue(mockGridRect as DOMRect);
            vi.spyOn(dragPreview, "animateToPosition").mockResolvedValue(undefined);
        });

        it("should start a move drag session on touchstart", (): void => {
            const firstTileDrag = fixture.nativeElement.querySelector(
                "dnd-tile-grid dnd-tile-drag",
            ) as HTMLElement;
            startTouchDrag(firstTileDrag, 50, 30);

            expect(sessionManager.dragSession()).toBeTruthy();
            expect(sessionManager.dragSession()?.actionType).toBe("move");
            expect(sessionManager.dragSession()?.id).toBe("distance");
        });

        it("should highlight cells under dragged tile on touch move", (): void => {
            const firstTileDrag = fixture.nativeElement.querySelector(
                "dnd-tile-grid dnd-tile-drag",
            ) as HTMLElement;
            startTouchDrag(firstTileDrag, 50, 30);
            dispatchTouchMove(firstTileDrag, 250, 80);

            expect(highlightManager.highlightedCells().length).toBeGreaterThan(0);
        });

        it("should keep drag session active while touch moves over another tile", (): void => {
            const firstTileDrag = fixture.nativeElement.querySelector(
                "dnd-tile-grid dnd-tile-drag",
            ) as HTMLElement;
            // start drag from Distance tile (col 1, row 1)
            startTouchDrag(firstTileDrag, 50, 30);
            expect(sessionManager.dragSession()).toBeTruthy();

            // move over Pace tile (col 2, row 1) — triggers swap preview
            dispatchTouchMove(firstTileDrag, 150, 30);

            expect(sessionManager.dragSession()).toBeTruthy();
            expect(sessionManager.dragSession()?.id).toBe("distance");
        });

        it("should preserve the dragged tile in displayTiles during a swap preview", (): void => {
            const firstTileDrag = fixture.nativeElement.querySelector(
                "dnd-tile-grid dnd-tile-drag",
            ) as HTMLElement;
            startTouchDrag(firstTileDrag, 50, 30);
            // move over Pace tile — triggers swap preview
            dispatchTouchMove(firstTileDrag, 150, 30);
            fixture.detectChanges();

            const hasDistanceInDisplay: boolean = dndState
                .displayTiles()
                .some((placedTile: PlacedTile): boolean => placedTile.id === "distance");
            expect(hasDistanceInDisplay).toBe(true);

            const draggedEl = fixture.nativeElement.querySelector("dnd-tile-grid dnd-tile-drag.dragging");
            expect(draggedEl).not.toBeNull();
            expect(draggedEl.classList.contains("swap-preview")).toBe(true);
        });

        it("should swap tiles when touch is released at another tile position", async (): Promise<void> => {
            const tileToMove = component.placedTiles()[0]; // distance at (1,1)
            const targetTile = component.placedTiles()[1]; // pace at (1,2)
            const emitSpy = vi.spyOn(component.layoutChange, "emit");

            const firstTileDrag = fixture.nativeElement.querySelector(
                "dnd-tile-grid dnd-tile-drag",
            ) as HTMLElement;
            startTouchDrag(firstTileDrag, 50, 30);
            dispatchTouchMove(firstTileDrag, 150, 30);
            dispatchTouchEnd(firstTileDrag, 150, 30);
            await fixture.whenStable();

            const distance = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "distance");
            const pace = component
                .placedTiles()
                .find((tile: PlacedDashboardTile): boolean => tile.id === "pace");

            expect(distance?.position.columnStart).toBe(targetTile.position.columnStart);
            expect(pace?.position.columnStart).toBe(tileToMove.position.columnStart);
            expect(emitSpy).toHaveBeenCalledTimes(1);
        });

        it("should place a tile via palette touchstart and drop on grid", async (): Promise<void> => {
            const initialCount = component.placedTiles().length;
            const emitSpy = vi.spyOn(component.layoutChange, "emit");
            vi.spyOn(
                fixture.nativeElement.querySelector("dnd-tile-palette")!,
                "getBoundingClientRect",
            ).mockReturnValue({ left: 0, top: 200, width: 416, height: 100 } as DOMRect);

            // first palette tile is the first available (not Distance, not Pace)
            const paletteDragEl = fixture.nativeElement.querySelector(
                "dnd-tile-palette dnd-palette-drag",
            ) as HTMLElement;
            startTouchDrag(paletteDragEl, 50, 250);
            dispatchTouchMove(paletteDragEl, 250, 80);
            dispatchTouchEnd(paletteDragEl, 250, 80);
            await fixture.whenStable();

            expect(component.placedTiles()).toHaveLength(initialCount + 1);
            expect(emitSpy).toHaveBeenCalledTimes(1);
        });
    });
});
