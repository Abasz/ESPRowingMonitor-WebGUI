import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DragCoordinator } from "../services/drag-coordinator.service";
import { DragSessionManager } from "../services/drag-session-manager.service";
import { createTouchEvent } from "../utils/tile-layout-editor.test.helpers";
import { TileDefinition } from "../utils/tile-layout.interfaces";

import { PaletteDragComponent } from "./palette-drag.component";

@Component({
    template: `<dnd-palette-drag [tileDefinition]="tileDefinition"><span>Label</span></dnd-palette-drag>`,

    imports: [PaletteDragComponent],
})
class TestHostComponent {
    tileDefinition: TileDefinition = {
        id: "power",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    };
}

describe("PaletteDragComponent", (): void => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let paletteEl: HTMLElement;
    let paletteDebugEl: DebugElement;
    let sessionManager: DragSessionManager;
    let mockCoordinator: {
        startPaletteDrag: ReturnType<typeof vi.fn>;
        registerListeners: ReturnType<typeof vi.fn>;
    };

    beforeEach(async (): Promise<void> => {
        mockCoordinator = {
            startPaletteDrag: vi.fn(),
            registerListeners: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [DragSessionManager, { provide: DragCoordinator, useValue: mockCoordinator }],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        sessionManager = TestBed.inject(DragSessionManager);
        fixture.detectChanges();
        paletteDebugEl = fixture.debugElement.query(By.directive(PaletteDragComponent));
        paletteEl = paletteDebugEl.nativeElement;
    });

    describe("onMouseDown method", (): void => {
        it("should call coordinator.startPaletteDrag on mousedown", (): void => {
            const event = new MouseEvent("mousedown", { clientX: 10, clientY: 20, cancelable: true });
            paletteEl.dispatchEvent(event);

            expect(mockCoordinator.startPaletteDrag).toHaveBeenCalledWith(
                expect.objectContaining({ clientX: 10, clientY: 20 }),
                host.tileDefinition,
            );
        });

        it("should call coordinator.registerListeners with mouse type on mousedown", (): void => {
            paletteEl.dispatchEvent(new MouseEvent("mousedown", { cancelable: true }));

            expect(mockCoordinator.registerListeners).toHaveBeenCalledWith("mouse");
        });

        it("should call preventDefault on mousedown", (): void => {
            const event = new MouseEvent("mousedown", { cancelable: true });
            const spy = vi.spyOn(event, "preventDefault");
            paletteEl.dispatchEvent(event);

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it("should not call coordinator when a session is already active", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            paletteEl.dispatchEvent(new MouseEvent("mousedown", { cancelable: true }));

            expect(mockCoordinator.startPaletteDrag).not.toHaveBeenCalled();
        });
    });

    describe("onTouchStart method", (): void => {
        it("should call coordinator.startPaletteDrag on single-touch touchstart", (): void => {
            const event = createTouchEvent(15, 25);
            paletteDebugEl.triggerEventHandler("touchstart", event);

            expect(mockCoordinator.startPaletteDrag).toHaveBeenCalledWith(
                expect.objectContaining({ clientX: 15, clientY: 25 }),
                host.tileDefinition,
            );
        });

        it("should call coordinator.registerListeners with touch type on touchstart", (): void => {
            paletteDebugEl.triggerEventHandler("touchstart", createTouchEvent());

            expect(mockCoordinator.registerListeners).toHaveBeenCalledWith("touch");
        });

        it("should call preventDefault on single-touch touchstart", (): void => {
            const event = createTouchEvent();
            paletteDebugEl.triggerEventHandler("touchstart", event);

            expect(event.preventDefault).toHaveBeenCalledTimes(1);
        });

        it("should not call coordinator when touches count is not 1", (): void => {
            const event = createTouchEvent(0, 0, 2);
            paletteDebugEl.triggerEventHandler("touchstart", event);

            expect(mockCoordinator.startPaletteDrag).not.toHaveBeenCalled();
        });

        it("should not call coordinator when a session is already active", (): void => {
            sessionManager.dragSession.set({
                actionType: "move",
                id: "distance",
                rowSpan: 1,
                columnSpan: 1,
                originalPosition: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
            });

            paletteDebugEl.triggerEventHandler("touchstart", createTouchEvent());

            expect(mockCoordinator.startPaletteDrag).not.toHaveBeenCalled();
        });
    });

    describe("as part of CSS state classes", (): void => {
        it("should add dragging class when palette tile is being placed", (): void => {
            sessionManager.dragSession.set({
                actionType: "place",
                id: host.tileDefinition.id,
                rowSpan: 1,
                columnSpan: 1,
            });
            fixture.detectChanges();

            expect(paletteEl.classList.contains("dragging")).toBe(true);
        });

        it("should not add dragging class for a different tile type", (): void => {
            sessionManager.dragSession.set({
                actionType: "place",
                id: "pace",
                rowSpan: 1,
                columnSpan: 1,
            });
            fixture.detectChanges();

            expect(paletteEl.classList.contains("dragging")).toBe(false);
        });

        it("should not add dragging class when no session is active", (): void => {
            fixture.detectChanges();

            expect(paletteEl.classList.contains("dragging")).toBe(false);
        });
    });

    describe("as part of content projection", (): void => {
        it("should project consumer content directly", (): void => {
            const span = paletteEl.querySelector("span");

            expect(span?.textContent).toBe("Label");
        });
    });
});
