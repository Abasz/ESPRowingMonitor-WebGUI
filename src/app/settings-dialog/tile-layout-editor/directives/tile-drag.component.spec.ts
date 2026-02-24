import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DndStateService } from "../services/dnd-state.service";
import { DragCoordinator } from "../services/drag-coordinator.service";
import { DragSessionManager } from "../services/drag-session-manager.service";
import { createTouchEvent } from "../utils/tile-layout-editor.test.helpers";
import { PlacedTile } from "../utils/tile-layout.interfaces";

import { TileDragComponent } from "./tile-drag.component";

@Component({
    template: `<dnd-tile-drag [tile]="placedTile"><span>Label</span></dnd-tile-drag>`,

    imports: [TileDragComponent],
})
class TestHostComponent {
    placedTile: PlacedTile = {
        id: "distance",
        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
    };
}

describe("TileDragComponent", (): void => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let tileEl: HTMLElement;
    let tileDebugEl: DebugElement;
    let sessionManager: DragSessionManager;
    let dndState: DndStateService;
    let mockCoordinator: {
        startTileDrag: ReturnType<typeof vi.fn>;
        registerListeners: ReturnType<typeof vi.fn>;
    };

    beforeEach(async (): Promise<void> => {
        mockCoordinator = {
            startTileDrag: vi.fn(),
            registerListeners: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [
                DragSessionManager,
                DndStateService,
                { provide: DragCoordinator, useValue: mockCoordinator },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        sessionManager = TestBed.inject(DragSessionManager);
        dndState = TestBed.inject(DndStateService);
        fixture.detectChanges();
        tileDebugEl = fixture.debugElement.query(By.directive(TileDragComponent));
        tileEl = tileDebugEl.nativeElement;
    });

    describe("onMouseDown method", (): void => {
        it("should call coordinator.startTileDrag on mousedown", (): void => {
            const event = new MouseEvent("mousedown", { clientX: 10, clientY: 20, cancelable: true });
            tileEl.dispatchEvent(event);

            expect(mockCoordinator.startTileDrag).toHaveBeenCalledWith(
                expect.objectContaining({ clientX: 10, clientY: 20 }),
                host.placedTile,
            );
        });

        it("should call coordinator.registerListeners with mouse type on mousedown", (): void => {
            tileEl.dispatchEvent(new MouseEvent("mousedown", { cancelable: true }));

            expect(mockCoordinator.registerListeners).toHaveBeenCalledWith("mouse");
        });

        it("should call preventDefault on mousedown", (): void => {
            const event = new MouseEvent("mousedown", { cancelable: true });
            const spy = vi.spyOn(event, "preventDefault");
            tileEl.dispatchEvent(event);

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it("should not call coordinator when a session is already active", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "pace",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            tileEl.dispatchEvent(new MouseEvent("mousedown", { cancelable: true }));

            expect(mockCoordinator.startTileDrag).not.toHaveBeenCalled();
        });
    });

    describe("onTouchStart method", (): void => {
        it("should call coordinator.startTileDrag on single-touch touchstart", (): void => {
            const event = createTouchEvent(15, 25);
            tileDebugEl.triggerEventHandler("touchstart", event);

            expect(mockCoordinator.startTileDrag).toHaveBeenCalledWith(
                expect.objectContaining({ clientX: 15, clientY: 25 }),
                host.placedTile,
            );
        });

        it("should call coordinator.registerListeners with touch type on touchstart", (): void => {
            tileDebugEl.triggerEventHandler("touchstart", createTouchEvent());

            expect(mockCoordinator.registerListeners).toHaveBeenCalledWith("touch");
        });

        it("should call preventDefault on single-touch touchstart", (): void => {
            const event = createTouchEvent();
            tileDebugEl.triggerEventHandler("touchstart", event);

            expect(event.preventDefault).toHaveBeenCalledTimes(1);
        });

        it("should not call coordinator when touches count is not 1", (): void => {
            const event = createTouchEvent(0, 0, 2);
            tileDebugEl.triggerEventHandler("touchstart", event);

            expect(mockCoordinator.startTileDrag).not.toHaveBeenCalled();
        });

        it("should not call coordinator when a session is already active", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "pace",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            tileDebugEl.triggerEventHandler("touchstart", createTouchEvent());

            expect(mockCoordinator.startTileDrag).not.toHaveBeenCalled();
        });
    });

    describe("as part of CSS state classes", (): void => {
        it("should add dragging class when tile is being moved", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });
            fixture.detectChanges();

            expect(tileEl.classList.contains("dragging")).toBe(true);
        });

        it("should not add dragging class for a different tile type", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "pace",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });
            fixture.detectChanges();

            expect(tileEl.classList.contains("dragging")).toBe(false);
        });

        it("should add resizing class when tile is being resized", (): void => {
            sessionManager.dragSession.set({
                actionType: "resize",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
                resizeDirections: ["right"],
                minRowSpan: 1,
                minColumnSpan: 1,
            });
            fixture.detectChanges();

            expect(tileEl.classList.contains("resizing")).toBe(true);
            expect(tileEl.classList.contains("resize-drag-active")).toBe(true);
        });

        it("should not have any state class when no session is active", (): void => {
            fixture.detectChanges();

            expect(tileEl.classList.contains("dragging")).toBe(false);
            expect(tileEl.classList.contains("resizing")).toBe(false);
            expect(tileEl.classList.contains("resize-drag-active")).toBe(false);
        });

        it("should add swap-preview class when dragging and swap preview is active", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });
            const mockPreviewTiles = [
                {
                    id: "distance",
                    position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
                },
            ];
            dndState.setPreviewOverride(mockPreviewTiles);
            fixture.detectChanges();

            expect(tileEl.classList.contains("dragging")).toBe(true);
            expect(tileEl.classList.contains("swap-preview")).toBe(true);
        });

        it("should not add swap-preview class when dragging without active swap preview", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });
            fixture.detectChanges();

            expect(tileEl.classList.contains("dragging")).toBe(true);
            expect(tileEl.classList.contains("swap-preview")).toBe(false);
        });
    });

    describe("as part of grid positioning", (): void => {
        it("should set grid-row-start from tile position", (): void => {
            expect(tileEl.style.gridRowStart).toBe("1");
        });

        it("should set grid-column-start from tile position", (): void => {
            expect(tileEl.style.gridColumnStart).toBe("1");
        });

        it("should set grid-row-end with span from tile rowSpan", (): void => {
            expect(tileEl.style.gridRowEnd).toBe("span 1");
        });

        it("should set grid-column-end with span from tile columnSpan", (): void => {
            expect(tileEl.style.gridColumnEnd).toBe("span 1");
        });

        it("should update grid styles when tile input changes", (): void => {
            const altFixture = TestBed.createComponent(TestHostComponent);
            altFixture.componentInstance.placedTile = {
                id: "distance",
                position: { rowStart: 2, columnStart: 3, rowSpan: 2, columnSpan: 3 },
            };
            altFixture.detectChanges();
            const altTileEl = altFixture.debugElement.query(By.directive(TileDragComponent)).nativeElement;

            expect(altTileEl.style.gridRowStart).toBe("2");
            expect(altTileEl.style.gridColumnStart).toBe("3");
            expect(altTileEl.style.gridRowEnd).toBe("span 2");
            expect(altTileEl.style.gridColumnEnd).toBe("span 3");
        });
    });

    describe("as part of content projection", (): void => {
        it("should project consumer content inside the .content wrapper", (): void => {
            const content = tileEl.querySelector(".content span");

            expect(content?.textContent).toBe("Label");
        });

        it("should render resize-controls internally", (): void => {
            const resizeControls = tileEl.querySelector(".resize-controls");

            expect(resizeControls).toBeTruthy();
        });

        it("should render resize handle elements", (): void => {
            const handles = tileEl.querySelectorAll(".resize-controls > div");

            expect(handles.length).toBe(8);
        });
    });
});
