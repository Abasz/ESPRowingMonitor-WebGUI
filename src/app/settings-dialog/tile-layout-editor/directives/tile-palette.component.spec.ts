import { Component, signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DragCoordinator } from "../services/drag-coordinator.service";
import { DragSessionManager } from "../services/drag-session-manager.service";
import { TileDefinition } from "../utils/tile-layout.interfaces";

import { DndPaletteTileDefDirective, TilePaletteComponent } from "./tile-palette.component";

const tileDefs: Array<TileDefinition> = [
    {
        id: "power",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    {
        id: "strokeRate",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
];

@Component({
    template: `
        <dnd-tile-palette [availableTiles]="availableTiles()">
            <ng-template dndPaletteTileDef let-tileDefinition>
                <span class="palette-label">{{ tileDefinition.id }}</span>
            </ng-template>
            <span class="static-content">Static content</span>
        </dnd-tile-palette>
    `,
    imports: [TilePaletteComponent, DndPaletteTileDefDirective],
})
class TestHostComponent {
    readonly availableTiles: WritableSignal<Array<TileDefinition>> = signal<Array<TileDefinition>>(tileDefs);
}

describe("TilePaletteComponent", (): void => {
    let fixture: ComponentFixture<TestHostComponent>;
    let paletteEl: HTMLElement;
    let mockCoordinator: {
        registerPaletteContainer: ReturnType<typeof vi.fn>;
    };

    beforeEach(async (): Promise<void> => {
        mockCoordinator = {
            registerPaletteContainer: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [
                { provide: DragCoordinator, useValue: mockCoordinator },
                { provide: DragSessionManager, useValue: { dragSession: signal(undefined) } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        paletteEl = fixture.debugElement.query(By.directive(TilePaletteComponent)).nativeElement;
    });

    describe("as part of coordinator registration", (): void => {
        it("should register its element with the coordinator on init", (): void => {
            expect(mockCoordinator.registerPaletteContainer).toHaveBeenCalledWith(paletteEl);
        });
    });

    describe("as part of palette tile rendering", (): void => {
        it("should render palette-drag elements for each available tile", (): void => {
            const items = paletteEl.querySelectorAll("dnd-palette-drag");

            expect(items).toHaveLength(2);
        });

        it("should project the consumer template content into each palette tile", (): void => {
            const labels = paletteEl.querySelectorAll("dnd-palette-drag .palette-label");

            expect(labels).toHaveLength(2);
            expect(labels[0].textContent).toBe("power");
            expect(labels[1].textContent).toBe("strokeRate");
        });
    });

    describe("as part of static content projection", (): void => {
        it("should project static ng-content alongside palette items", (): void => {
            const staticContent = paletteEl.querySelector(".static-content");

            expect(staticContent?.textContent).toBe("Static content");
        });
    });

    describe("as part of dynamic column count", (): void => {
        let dimFixture: ComponentFixture<TilePaletteComponent>;

        beforeEach((): void => {
            dimFixture = TestBed.createComponent(TilePaletteComponent);
            dimFixture.componentRef.setInput("availableTiles", []);
            dimFixture.detectChanges();
        });

        it("should set --dnd-grid-cols CSS var to the default GRID_COLS value", (): void => {
            expect(dimFixture.nativeElement.style.getPropertyValue("--dnd-grid-cols")).toBe(
                dimFixture.componentInstance.dndColumns().toString(),
            );
        });

        it("should update --dnd-grid-cols when dndColumns input changes", (): void => {
            dimFixture.componentRef.setInput("dndColumns", 6);
            dimFixture.detectChanges();

            expect(dimFixture.nativeElement.style.getPropertyValue("--dnd-grid-cols")).toBe("6");
        });
    });
});
