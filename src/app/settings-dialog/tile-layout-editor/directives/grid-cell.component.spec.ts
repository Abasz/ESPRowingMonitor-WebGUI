import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { beforeEach, describe, expect, it } from "vitest";

import { TileHighlightManager } from "../services/tile-highlight-manager.service";

import { GridCellComponent } from "./grid-cell.component";

@Component({
    template: `<dnd-grid-cell [cell]="cell">Cell</dnd-grid-cell>`,
    imports: [GridCellComponent],
})
class TestHostComponent {
    cell: { row: number; column: number } = { row: 2, column: 3 };
}

describe("GridCellComponent", (): void => {
    let fixture: ComponentFixture<TestHostComponent>;
    let cellEl: HTMLElement;
    let cellDebugEl: DebugElement;
    let highlightManager: TileHighlightManager;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [TileHighlightManager],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        highlightManager = TestBed.inject(TileHighlightManager);
        fixture.detectChanges();
        cellDebugEl = fixture.debugElement.query(By.directive(GridCellComponent));
        cellEl = cellDebugEl.nativeElement;
    });

    describe("as part of grid positioning", (): void => {
        it("should set grid-row-start from cell input", (): void => {
            expect(cellEl.style.gridRowStart).toBe("2");
        });

        it("should set grid-column-start from cell input", (): void => {
            expect(cellEl.style.gridColumnStart).toBe("3");
        });

        it("should update grid positioning when cell input changes", (): void => {
            const altFixture = TestBed.createComponent(TestHostComponent);
            altFixture.componentInstance.cell = { row: 4, column: 5 };
            altFixture.detectChanges();
            const altCellEl = altFixture.debugElement.query(By.directive(GridCellComponent)).nativeElement;

            expect(altCellEl.style.gridRowStart).toBe("4");
            expect(altCellEl.style.gridColumnStart).toBe("5");
        });
    });

    describe("as part of highlight state", (): void => {
        it("should not have highlighted class when cell is not highlighted", (): void => {
            expect(cellEl.classList.contains("highlighted")).toBe(false);
        });

        it("should add highlighted class when cell is highlighted", (): void => {
            highlightManager.highlightedCells.set([{ row: 2, column: 3 }]);
            fixture.detectChanges();

            expect(cellEl.classList.contains("highlighted")).toBe(true);
        });

        it("should not add highlighted class when a different cell is highlighted", (): void => {
            highlightManager.highlightedCells.set([{ row: 1, column: 1 }]);
            fixture.detectChanges();

            expect(cellEl.classList.contains("highlighted")).toBe(false);
        });

        it("should remove highlighted class when highlight is cleared", (): void => {
            highlightManager.highlightedCells.set([{ row: 2, column: 3 }]);
            fixture.detectChanges();
            expect(cellEl.classList.contains("highlighted")).toBe(true);

            highlightManager.highlightedCells.set([]);
            fixture.detectChanges();

            expect(cellEl.classList.contains("highlighted")).toBe(false);
        });

        it("should react to cell input changes for highlight computation", (): void => {
            const altFixture = TestBed.createComponent(TestHostComponent);
            altFixture.componentInstance.cell = { row: 4, column: 5 };
            highlightManager.highlightedCells.set([{ row: 4, column: 5 }]);
            altFixture.detectChanges();
            const altCellEl = altFixture.debugElement.query(By.directive(GridCellComponent)).nativeElement;

            expect(altCellEl.classList.contains("highlighted")).toBe(true);
        });
    });
});
