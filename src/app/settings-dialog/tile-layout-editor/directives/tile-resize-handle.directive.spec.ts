import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DragCoordinator } from "../services/drag-coordinator.service";
import { DragSessionManager } from "../services/drag-session-manager.service";
import { createTouchEvent } from "../utils/tile-layout-editor.test.helpers";
import { PlacedTile, ResizeDirection } from "../utils/tile-layout.interfaces";

import {
    RESIZE_HANDLE_CONFIGS,
    ResizeHandleConfig,
    TileResizeHandleDirective,
} from "./tile-resize-handle.directive";

@Component({
    template: `
        <div class="tile" style="position: relative; width: 200px; height: 100px;">
            <div [dndTileResizeHandle]="directions" [tile]="placedTile">⋮</div>
        </div>
    `,
    imports: [TileResizeHandleDirective],
})
class TestHostComponent {
    placedTile: PlacedTile = {
        id: "distance",
        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
    };

    directions: Array<ResizeDirection> = ["right"];
}

describe("TileResizeHandleDirective", (): void => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let handleEl: HTMLElement;
    let handleDebugEl: DebugElement;
    let sessionManager: DragSessionManager;
    let mockCoordinator: {
        startResizeDrag: ReturnType<typeof vi.fn>;
        registerListeners: ReturnType<typeof vi.fn>;
    };

    const createFixture = (directions: Array<ResizeDirection> = ["right"]): void => {
        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        host.directions = directions;
        fixture.detectChanges();
        handleDebugEl = fixture.debugElement.query(By.directive(TileResizeHandleDirective));
        handleEl = handleDebugEl.nativeElement;
    };

    beforeEach(async (): Promise<void> => {
        mockCoordinator = {
            startResizeDrag: vi.fn(),
            registerListeners: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [DragSessionManager, { provide: DragCoordinator, useValue: mockCoordinator }],
        }).compileComponents();

        sessionManager = TestBed.inject(DragSessionManager);
        createFixture();
    });

    describe("as part of structural style application", (): void => {
        it("should apply position absolute and display flex", (): void => {
            expect(handleEl.style.position).toBe("absolute");
            expect(handleEl.style.display).toBe("flex");
            expect(handleEl.style.alignItems).toBe("center");
            expect(handleEl.style.justifyContent).toBe("center");
        });

        it("should apply pointer-events and touch-action", (): void => {
            expect(handleEl.style.pointerEvents).toBe("auto");
            expect(handleEl.style.touchAction).toBe("none");
            expect(handleEl.style.userSelect).toBe("none");
        });

        it("should apply ew-resize cursor for right direction", (): void => {
            expect(handleEl.style.cursor).toBe("ew-resize");
            expect(handleEl.style.right).toBe("0px");
            expect(handleEl.style.top).toBe("0px");
            expect(handleEl.style.height).toBe("100%");
        });

        it("should apply ew-resize cursor for left direction", (): void => {
            createFixture(["left"]);

            expect(handleEl.style.cursor).toBe("ew-resize");
            expect(handleEl.style.left).toBe("0px");
        });

        it("should apply ns-resize cursor for bottom direction", (): void => {
            createFixture(["bottom"]);

            expect(handleEl.style.cursor).toBe("ns-resize");
            expect(handleEl.style.bottom).toBe("0px");
            expect(handleEl.style.width).toBe("100%");
        });

        it("should apply nwse-resize cursor for right-bottom corner", (): void => {
            createFixture(["right", "bottom"]);

            expect(handleEl.style.cursor).toBe("nwse-resize");
            expect(handleEl.style.right).toBe("0px");
            expect(handleEl.style.bottom).toBe("0px");
        });

        it("should apply nwse-resize cursor for left-top corner", (): void => {
            createFixture(["left", "top"]);

            expect(handleEl.style.cursor).toBe("nwse-resize");
            expect(handleEl.style.left).toBe("0px");
            expect(handleEl.style.top).toBe("0px");
        });

        it("should apply nesw-resize cursor for right-top corner", (): void => {
            createFixture(["right", "top"]);

            expect(handleEl.style.cursor).toBe("nesw-resize");
        });
    });

    describe("onMouseDown method", (): void => {
        it("should call coordinator.startResizeDrag on mousedown", (): void => {
            const event = new MouseEvent("mousedown", {
                clientX: 10,
                clientY: 20,
                cancelable: true,
                bubbles: true,
            });
            handleEl.dispatchEvent(event);

            expect(mockCoordinator.startResizeDrag).toHaveBeenCalledWith(
                expect.objectContaining({ clientX: 10, clientY: 20 }),
                host.placedTile,
                ["right"],
                handleEl,
                "mouse",
            );
        });

        it("should not call registerListeners because startResizeDrag registers internally", (): void => {
            handleEl.dispatchEvent(new MouseEvent("mousedown", { cancelable: true, bubbles: true }));

            expect(mockCoordinator.registerListeners).not.toHaveBeenCalled();
        });

        it("should call stopPropagation and preventDefault on mousedown", (): void => {
            const event = new MouseEvent("mousedown", { cancelable: true, bubbles: true });
            const stopSpy = vi.spyOn(event, "stopPropagation");
            const preventSpy = vi.spyOn(event, "preventDefault");
            handleEl.dispatchEvent(event);

            expect(stopSpy).toHaveBeenCalledTimes(1);
            expect(preventSpy).toHaveBeenCalledTimes(1);
        });

        it("should not call coordinator when a session is already active", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "pace",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            handleEl.dispatchEvent(new MouseEvent("mousedown", { cancelable: true, bubbles: true }));

            expect(mockCoordinator.startResizeDrag).not.toHaveBeenCalled();
        });
    });

    describe("onTouchStart method", (): void => {
        it("should call coordinator.startResizeDrag on single-touch touchstart", (): void => {
            const event = createTouchEvent(15, 25);
            handleDebugEl.triggerEventHandler("touchstart", event);

            expect(mockCoordinator.startResizeDrag).toHaveBeenCalledWith(
                event,
                host.placedTile,
                ["right"],
                handleEl,
                "touch",
            );
        });

        it("should not call registerListeners because startResizeDrag registers internally", (): void => {
            handleDebugEl.triggerEventHandler("touchstart", createTouchEvent());

            expect(mockCoordinator.registerListeners).not.toHaveBeenCalled();
        });

        it("should call stopPropagation and preventDefault on touchstart", (): void => {
            const event = createTouchEvent();
            handleDebugEl.triggerEventHandler("touchstart", event);

            expect(event.stopPropagation).toHaveBeenCalledTimes(1);
            expect(event.preventDefault).toHaveBeenCalledTimes(1);
        });

        it("should not call coordinator when touches count is not 1", (): void => {
            const event = createTouchEvent(0, 0, 2);
            handleDebugEl.triggerEventHandler("touchstart", event);

            expect(mockCoordinator.startResizeDrag).not.toHaveBeenCalled();
        });

        it("should not call coordinator when a session is already active", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            handleDebugEl.triggerEventHandler("touchstart", createTouchEvent());

            expect(mockCoordinator.startResizeDrag).not.toHaveBeenCalled();
        });
    });

    describe("RESIZE_HANDLE_CONFIGS constant", (): void => {
        it("should have 8 handle configurations", (): void => {
            expect(RESIZE_HANDLE_CONFIGS).toHaveLength(8);
        });

        it("should have 4 edge handles and 4 corner handles", (): void => {
            const edges = RESIZE_HANDLE_CONFIGS.filter(
                (config: ResizeHandleConfig): boolean => config.directions.length === 1,
            );
            const corners = RESIZE_HANDLE_CONFIGS.filter(
                (config: ResizeHandleConfig): boolean => config.directions.length === 2,
            );

            expect(edges).toHaveLength(4);
            expect(corners).toHaveLength(4);
        });

        it("should have unique keys for all handles", (): void => {
            const keys = RESIZE_HANDLE_CONFIGS.map((config: ResizeHandleConfig): string => config.key);
            const uniqueKeys = new Set(keys);

            expect(uniqueKeys.size).toBe(keys.length);
        });
    });
});
