import { computed, signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MoveDragStrategy } from "../drag-strategies/move-drag-strategy.service";
import { PlaceDragStrategy } from "../drag-strategies/place-drag-strategy.service";
import { ResizeDragStrategy } from "../drag-strategies/resize-drag-strategy.service";
import { PointerEventData } from "../utils/pointer-event-data";
import { PlacedTile, TileDefinition, TileDragSession } from "../utils/tile-layout.interfaces";

import { DndStateService, TileDragDropResult } from "./dnd-state.service";
import { DragCoordinator } from "./drag-coordinator.service";
import { DragPreviewRenderer } from "./drag-preview-renderer.service";
import { DragSessionManager } from "./drag-session-manager.service";
import { TileHighlightManager } from "./tile-highlight-manager.service";

describe("DragCoordinator", (): void => {
    let coordinator: DragCoordinator;

    let mockSessionManager: Pick<
        DragSessionManager,
        "dragSession" | "startMoveSession" | "startPlaceSession" | "startResizeSession" | "endSession"
    >;
    let mockPreview: Pick<DragPreviewRenderer, "create" | "move" | "destroy" | "animateToPosition">;
    let mockHighlightManager: Pick<
        TileHighlightManager,
        | "clearAll"
        | "highlightedCells"
        | "isDropInvalid"
        | "updateHighlightsForPosition"
        | "isCellHighlighted"
    >;
    let mockDndState: Pick<
        DndStateService,
        | "committedTiles"
        | "displayTiles"
        | "tileDefinitions"
        | "setPreviewOverride"
        | "notifyDrop"
        | "getDefinition"
        | "drop$"
    >;
    let mockMoveStrategy: Pick<MoveDragStrategy, "handleDragOver" | "handleDrop">;
    let mockPlaceStrategy: Pick<PlaceDragStrategy, "handleDragOver" | "handleDrop">;
    let mockResizeStrategy: Pick<ResizeDragStrategy, "handleDragOver" | "handleDrop">;

    let mockDragSession: WritableSignal<TileDragSession | undefined>;
    let mockCommittedTiles: WritableSignal<Array<PlacedTile>>;

    let gridContainer: HTMLElement;
    let paletteContainer: HTMLElement;

    const createPointer = (
        clientX: number = 0,
        clientY: number = 0,
        sourceElement: HTMLElement | null = null,
    ): PointerEventData => ({
        clientX,
        clientY,
        sourceElement,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    });

    const placedTile: PlacedTile = {
        id: "distance",
        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
    };

    const tileDefinition: TileDefinition = {
        id: "power",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    };

    beforeEach((): void => {
        mockDragSession = signal<TileDragSession | undefined>(undefined);
        mockCommittedTiles = signal<Array<PlacedTile>>([]);

        mockSessionManager = {
            dragSession: mockDragSession,
            startMoveSession: vi.fn(),
            startPlaceSession: vi.fn(),
            startResizeSession: vi.fn(),
            endSession: vi.fn(),
        };

        mockPreview = {
            create: vi.fn(),
            move: vi.fn(),
            destroy: vi.fn(),
            animateToPosition: vi.fn(),
        };

        mockHighlightManager = {
            clearAll: vi.fn(),
            highlightedCells: signal([]),
            isDropInvalid: signal(false),
            updateHighlightsForPosition: vi.fn(),
            isCellHighlighted: vi.fn(),
        };

        const mockPreviewOverride = signal<Array<PlacedTile> | undefined>(undefined);
        const dropSubject = new Subject<TileDragDropResult>();
        mockDndState = {
            committedTiles: mockCommittedTiles,
            displayTiles: computed((): Array<PlacedTile> => mockPreviewOverride() ?? mockCommittedTiles()),
            tileDefinitions: signal<ReadonlyArray<TileDefinition>>([]),
            setPreviewOverride: vi.fn().mockImplementation((tiles: Array<PlacedTile> | undefined): void => {
                mockPreviewOverride.set(tiles);
            }),
            notifyDrop: vi.fn().mockImplementation((result: TileDragDropResult): void => {
                mockCommittedTiles.set(result.placedTiles);
                mockPreviewOverride.set(undefined);
                dropSubject.next(result);
            }),
            getDefinition: vi.fn().mockReturnValue(undefined),
            drop$: dropSubject.asObservable(),
        };

        mockMoveStrategy = {
            handleDragOver: vi.fn(),
            handleDrop: vi.fn(),
        };

        mockPlaceStrategy = {
            handleDragOver: vi.fn(),
            handleDrop: vi.fn(),
        };

        mockResizeStrategy = {
            handleDragOver: vi.fn(),
            handleDrop: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                DragCoordinator,
                { provide: DragSessionManager, useValue: mockSessionManager },
                { provide: DragPreviewRenderer, useValue: mockPreview },
                { provide: TileHighlightManager, useValue: mockHighlightManager },
                { provide: DndStateService, useValue: mockDndState },
                { provide: MoveDragStrategy, useValue: mockMoveStrategy },
                { provide: PlaceDragStrategy, useValue: mockPlaceStrategy },
                { provide: ResizeDragStrategy, useValue: mockResizeStrategy },
            ],
        });

        coordinator = TestBed.inject(DragCoordinator);

        gridContainer = document.createElement("div");
        paletteContainer = document.createElement("div");

        coordinator.registerGridContainer(gridContainer);
        coordinator.registerPaletteContainer(paletteContainer);
    });

    afterEach((): void => {
        coordinator.ngOnDestroy();
    });

    describe("as part of service creation", (): void => {
        it("should create the service", (): void => {
            expect(coordinator).toBeTruthy();
        });
    });

    describe("startTileDrag method", (): void => {
        it("should start a move session with tile data", (): void => {
            coordinator.startTileDrag(createPointer(), placedTile);

            expect(mockSessionManager.startMoveSession).toHaveBeenCalledWith(
                placedTile,
                undefined,
                undefined,
                undefined,
                undefined,
            );
        });

        it("should create drag preview when source element is provided", (): void => {
            const element = document.createElement("div");
            vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
                left: 10,
                top: 20,
                width: 100,
                height: 50,
            } as DOMRect);

            coordinator.startTileDrag(createPointer(50, 30, element), placedTile);

            expect(mockPreview.create).toHaveBeenCalledWith(element, 50, 30, "6px", gridContainer);
        });

        it("should not create drag preview when source element is null", (): void => {
            coordinator.startTileDrag(createPointer(), placedTile);

            expect(mockPreview.create).not.toHaveBeenCalled();
        });

        it("should calculate grab offset from source element", (): void => {
            const element = document.createElement("div");
            vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
                left: 0,
                top: 0,
                width: 200,
                height: 48,
            } as DOMRect);

            const wideTile: PlacedTile = {
                id: "distance",
                position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
            };

            coordinator.startTileDrag(createPointer(150, 24, element), wideTile);

            expect(mockSessionManager.startMoveSession).toHaveBeenCalledWith(
                wideTile,
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
            );
        });
    });

    describe("startPaletteDrag method", (): void => {
        it("should start a place session with tile definition", (): void => {
            coordinator.startPaletteDrag(createPointer(), tileDefinition);

            expect(mockSessionManager.startPlaceSession).toHaveBeenCalledWith(
                tileDefinition,
                undefined,
                undefined,
            );
        });

        it("should create drag preview in palette container when source element is provided", (): void => {
            const element = document.createElement("div");
            vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
                left: 10,
                top: 20,
                width: 80,
                height: 40,
            } as DOMRect);

            coordinator.startPaletteDrag(createPointer(50, 40, element), tileDefinition);

            expect(mockPreview.create).toHaveBeenCalledWith(element, 50, 40, "16px", paletteContainer);
        });
    });

    describe("startResizeDrag method", (): void => {
        it("should start a resize session immediately with mouse input", (): void => {
            const mouseEvent = new MouseEvent("mousedown", { clientX: 50, clientY: 30 });

            coordinator.startResizeDrag(
                mouseEvent,
                placedTile,
                ["right"],
                document.createElement("div"),
                "mouse",
            );

            expect(mockSessionManager.startResizeSession).toHaveBeenCalledWith(placedTile, ["right"], 1, 1);
        });

        it("should not start a resize session immediately with touch input", (): void => {
            vi.useFakeTimers();
            const handleEl = document.createElement("div");
            const tileEl = document.createElement("div");
            tileEl.classList.add("tile");
            tileEl.appendChild(handleEl);

            const touchEvent = {
                touches: [{ clientX: 50, clientY: 30 }],
            } as unknown as TouchEvent;

            coordinator.startResizeDrag(touchEvent, placedTile, ["right", "bottom"], handleEl, "touch");

            expect(mockSessionManager.startResizeSession).not.toHaveBeenCalled();

            vi.useRealTimers();
        });

        it("should start a resize session after long-press delay with touch input", (): void => {
            vi.useFakeTimers();
            const handleEl = document.createElement("div");
            const tileEl = document.createElement("div");
            tileEl.classList.add("tile");
            tileEl.appendChild(handleEl);

            const touchEvent = {
                touches: [{ clientX: 50, clientY: 30 }],
            } as unknown as TouchEvent;

            coordinator.startResizeDrag(touchEvent, placedTile, ["right", "bottom"], handleEl, "touch");

            vi.advanceTimersByTime(300);

            expect(mockSessionManager.startResizeSession).toHaveBeenCalledWith(
                placedTile,
                ["right", "bottom"],
                1,
                1,
            );

            vi.useRealTimers();
        });
    });

    describe("registerListeners method", (): void => {
        it("should register mouse listeners for mouse input type", (): void => {
            const addEventListenerSpy = vi.spyOn(document, "addEventListener");

            coordinator.registerListeners("mouse");

            expect(addEventListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));

            addEventListenerSpy.mockRestore();
        });

        it("should register touch listeners for touch input type", (): void => {
            const addEventListenerSpy = vi.spyOn(document, "addEventListener");

            coordinator.registerListeners("touch");

            expect(addEventListenerSpy).toHaveBeenCalledWith("touchmove", expect.any(Function), {
                passive: false,
            });
            expect(addEventListenerSpy).toHaveBeenCalledWith("touchend", expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith("touchcancel", expect.any(Function));

            addEventListenerSpy.mockRestore();
        });
    });

    describe("ngOnDestroy method", (): void => {
        it("should restore preview and clear highlights", (): void => {
            coordinator.ngOnDestroy();

            expect(mockDndState.setPreviewOverride).toHaveBeenCalledWith(undefined);
            expect(mockHighlightManager.clearAll).toHaveBeenCalled();
        });

        it("should end the drag session", (): void => {
            coordinator.ngOnDestroy();

            expect(mockSessionManager.endSession).toHaveBeenCalled();
        });

        it("should destroy the drag preview element", (): void => {
            coordinator.ngOnDestroy();

            expect(mockPreview.destroy).toHaveBeenCalled();
        });

        it("should remove registered mouse listeners", (): void => {
            const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

            coordinator.registerListeners("mouse");
            coordinator.ngOnDestroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));

            removeEventListenerSpy.mockRestore();
        });

        it("should remove registered touch listeners", (): void => {
            const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

            coordinator.registerListeners("touch");
            coordinator.ngOnDestroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith("touchmove", expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith("touchend", expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith("touchcancel", expect.any(Function));

            removeEventListenerSpy.mockRestore();
        });
    });

    describe("drag over handling via mouse listeners", (): void => {
        const mockGridRect = { left: 0, top: 0, width: 416, height: 160 } as DOMRect;

        beforeEach((): void => {
            vi.spyOn(gridContainer, "getBoundingClientRect").mockReturnValue(mockGridRect);
        });

        it("should move preview and call strategy on mouse move within grid", (): void => {
            mockDragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            vi.mocked(mockMoveStrategy.handleDragOver).mockReturnValue({
                highlightPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                isValid: true,
            });

            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 30 }));

            expect(mockPreview.move).toHaveBeenCalledWith(50, 30);
            expect(mockMoveStrategy.handleDragOver).toHaveBeenCalled();
        });

        it("should clear highlights when pointer leaves grid area", (): void => {
            mockDragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 300 }));

            expect(mockDndState.displayTiles()).toEqual(mockCommittedTiles());
            expect(mockHighlightManager.clearAll).toHaveBeenCalled();
        });

        it("should not process drag over when no session is active", (): void => {
            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 30 }));

            expect(mockPreview.move).not.toHaveBeenCalled();
        });
    });

    describe("drop handling via mouse listeners", (): void => {
        const mockGridRect = { left: 0, top: 0, width: 416, height: 160 } as DOMRect;

        beforeEach((): void => {
            vi.spyOn(gridContainer, "getBoundingClientRect").mockReturnValue(mockGridRect);
        });

        it("should call strategy handleDrop on mouse up within grid", async (): Promise<void> => {
            mockDragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            vi.mocked(mockMoveStrategy.handleDrop).mockReturnValue({
                tiles: [placedTile],
            });

            vi.mocked(mockPreview.animateToPosition).mockResolvedValue(undefined);

            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 30 }));

            await vi.waitUntil((): boolean => vi.mocked(mockDndState.notifyDrop).mock.calls.length > 0);
            expect(mockDndState.notifyDrop).toHaveBeenCalledWith(
                expect.objectContaining({ placedTiles: [placedTile] }),
            );
            expect(mockMoveStrategy.handleDrop).toHaveBeenCalled();
        });

        it("should not modify state when no session is active on mouse up", (): void => {
            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 30 }));

            expect(mockDndState.notifyDrop).not.toHaveBeenCalled();
        });

        it("should cleanup session after drop", async (): Promise<void> => {
            mockDragSession.set({
                actionType: "place",
                id: "power",
                rowSpan: 1,
                columnSpan: 1,
            });

            vi.mocked(mockPlaceStrategy.handleDrop).mockReturnValue({
                tiles: [placedTile],
            });

            vi.mocked(mockPreview.animateToPosition).mockResolvedValue(undefined);

            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 30 }));

            await vi.waitUntil((): boolean => vi.mocked(mockDndState.notifyDrop).mock.calls.length > 0);
            expect(mockSessionManager.endSession).toHaveBeenCalled();
            expect(mockHighlightManager.clearAll).toHaveBeenCalled();
            expect(mockPreview.destroy).toHaveBeenCalled();
        });

        it("should report placedFromPalette when place action completes", async (): Promise<void> => {
            mockDragSession.set({
                actionType: "place",
                id: "power",
                rowSpan: 1,
                columnSpan: 1,
            });

            vi.mocked(mockPlaceStrategy.handleDrop).mockReturnValue({
                tiles: [
                    {
                        id: "power",
                        position: { rowStart: 2, columnStart: 3, rowSpan: 1, columnSpan: 1 },
                    },
                ],
            });

            vi.mocked(mockPreview.animateToPosition).mockResolvedValue(undefined);

            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mouseup", { clientX: 250, clientY: 80 }));

            await vi.waitUntil((): boolean => vi.mocked(mockDndState.notifyDrop).mock.calls.length > 0);
            expect(mockDndState.notifyDrop).toHaveBeenCalledWith(
                expect.objectContaining({ placedFromPalette: "power" }),
            );
        });

        it("should animate to the tile cell rect when grid cells are present in the container", async (): Promise<void> => {
            mockDragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            vi.mocked(mockMoveStrategy.handleDrop).mockReturnValue({
                tiles: [placedTile],
            });

            vi.mocked(mockPreview.animateToPosition).mockResolvedValue(undefined);

            const cell = document.createElement("dnd-grid-cell");
            cell.style.gridRowStart = "1";
            cell.style.gridColumnStart = "1";
            vi.spyOn(cell, "getBoundingClientRect").mockReturnValue({
                left: 10,
                top: 20,
                right: 110,
                bottom: 70,
            } as DOMRect);
            gridContainer.appendChild(cell);

            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 30 }));

            await vi.waitUntil((): boolean => vi.mocked(mockDndState.notifyDrop).mock.calls.length > 0);

            // x = (10 + 110) / 2 = 60,  y = (20 + 70) / 2 = 45,  w = 100,  h = 50
            expect(mockPreview.animateToPosition).toHaveBeenCalledWith(60, 45, 100, 50, "grid");
        });
    });

    describe("palette drop handling", (): void => {
        const mockGridRect = { left: 0, top: 0, width: 416, height: 160 } as DOMRect;
        const mockPaletteRect = { left: 0, top: 200, width: 416, height: 100 } as DOMRect;

        beforeEach((): void => {
            vi.spyOn(gridContainer, "getBoundingClientRect").mockReturnValue(mockGridRect);
            vi.spyOn(paletteContainer, "getBoundingClientRect").mockReturnValue(mockPaletteRect);
        });

        it("should report movedToPalette when tile is moved to palette area", async (): Promise<void> => {
            mockCommittedTiles.set([placedTile]);
            mockDragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            vi.mocked(mockPreview.animateToPosition).mockResolvedValue(undefined);

            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 250 }));

            await vi.waitUntil((): boolean => vi.mocked(mockDndState.notifyDrop).mock.calls.length > 0);
            expect(mockDndState.notifyDrop).toHaveBeenCalledWith(
                expect.objectContaining({
                    movedToPalette: "distance",
                    placedTiles: [],
                }),
            );
        });

        it("should not remove tile when session is place action", async (): Promise<void> => {
            mockDragSession.set({
                actionType: "place",
                id: "power",
                rowSpan: 1,
                columnSpan: 1,
            });

            vi.mocked(mockPreview.animateToPosition).mockResolvedValue(undefined);

            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 250 }));

            await vi.waitUntil((): boolean => vi.mocked(mockPreview.destroy).mock.calls.length > 0);
            expect(mockSessionManager.endSession).toHaveBeenCalled();
            expect(mockDndState.notifyDrop).not.toHaveBeenCalled();
        });

        it("should animate to the palette item rect when palette items are rendered", async (): Promise<void> => {
            mockCommittedTiles.set([placedTile]);
            mockDragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            vi.mocked(mockPreview.animateToPosition).mockResolvedValue(undefined);

            const item = document.createElement("dnd-palette-drag");
            vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
                left: 8,
                top: 8,
                right: 108,
                bottom: 88,
                width: 100,
                height: 80,
            } as DOMRect);
            paletteContainer.appendChild(item);

            coordinator.registerListeners("mouse");
            document.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 250 }));

            await vi.waitUntil((): boolean => vi.mocked(mockDndState.notifyDrop).mock.calls.length > 0);

            // availableCount = 1 (one dnd-palette-drag element in DOM) → column = 1, row = 0
            // x = 8 + 1*(100+0) + 100/2 = 158,  y = 8 + 0 + 80/2 = 48
            expect(mockPreview.animateToPosition).toHaveBeenCalledWith(158, 48, 100, 80, "palette");
        });
    });
});
