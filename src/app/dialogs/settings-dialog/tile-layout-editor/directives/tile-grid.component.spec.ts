import { Component, computed, signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DndStateService, TileDragDropResult } from "../services/dnd-state.service";
import { DragCoordinator } from "../services/drag-coordinator.service";
import { DragSessionManager } from "../services/drag-session-manager.service";
import { TileHighlightManager } from "../services/tile-highlight-manager.service";
import { PlacedTile, TileDefinition } from "../utils/tile-layout.interfaces";

import { DndTileDefDirective, TileGridComponent } from "./tile-grid.component";

const tileDefs: Array<TileDefinition> = [
    {
        id: "distance",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    {
        id: "pace",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
];

const twoTiles: Array<PlacedTile> = [
    {
        id: "distance",
        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 },
    },
    {
        id: "pace",
        position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 },
    },
];

@Component({
    template: `
        <dnd-tile-grid [tiles]="tiles()" [tileDefinitions]="tileDefs">
            <ng-template dndTileDef let-tile let-definition="definition">
                <span class="tile-label">{{ definition?.id }}</span>
            </ng-template>
        </dnd-tile-grid>
    `,
    imports: [TileGridComponent, DndTileDefDirective],
})
class TestHostComponent {
    readonly tiles: WritableSignal<Array<PlacedTile>> = signal<Array<PlacedTile>>(twoTiles);
    readonly tileDefs: Array<TileDefinition> = tileDefs;
}

describe("TileGridComponent", (): void => {
    let fixture: ComponentFixture<TestHostComponent>;
    let gridEl: HTMLElement;
    let mockCoordinator: {
        registerGridContainer: ReturnType<typeof vi.fn>;
        isDropInvalid: ReturnType<typeof vi.fn>;
    };
    let mockCommittedTiles: WritableSignal<Array<PlacedTile>>;
    let mockTileDefinitions: WritableSignal<ReadonlyArray<TileDefinition>>;
    let dropSubject: Subject<TileDragDropResult>;

    beforeEach(async (): Promise<void> => {
        mockCommittedTiles = signal<Array<PlacedTile>>([]);
        mockTileDefinitions = signal<ReadonlyArray<TileDefinition>>([]);
        dropSubject = new Subject<TileDragDropResult>();

        mockCoordinator = {
            registerGridContainer: vi.fn(),
            isDropInvalid: vi.fn().mockReturnValue(false),
        };

        const mockDndState: Pick<
            DndStateService,
            "committedTiles" | "displayTiles" | "tileDefinitions" | "getDefinition" | "drop$"
        > = {
            committedTiles: mockCommittedTiles,
            displayTiles: computed<Array<PlacedTile>>((): Array<PlacedTile> => mockCommittedTiles()),
            tileDefinitions: mockTileDefinitions,
            getDefinition: vi
                .fn()
                .mockImplementation((id: string): TileDefinition | undefined =>
                    tileDefs.find((definition: TileDefinition): boolean => definition.id === id),
                ),
            drop$: dropSubject.asObservable(),
        };

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [
                { provide: DragCoordinator, useValue: mockCoordinator },
                { provide: DndStateService, useValue: mockDndState },
                {
                    provide: TileHighlightManager,
                    useValue: {
                        highlightedCells: signal([]),
                        isCellHighlighted: (): boolean => false,
                    },
                },
                { provide: DragSessionManager, useValue: { dragSession: signal(undefined) } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        gridEl = fixture.debugElement.query(By.directive(TileGridComponent)).nativeElement;
    });

    describe("as part of coordinator registration", (): void => {
        it("should register its element with the coordinator on init", (): void => {
            expect(mockCoordinator.registerGridContainer).toHaveBeenCalledWith(gridEl);
        });
    });

    describe("as part of grid cell rendering", (): void => {
        it("should render rows * columns grid cells", (): void => {
            const cells = gridEl.querySelectorAll("dnd-grid-cell");

            expect(cells).toHaveLength(3 * 4);
        });
    });

    describe("as part of tile rendering with content template", (): void => {
        it("should render tile-drag elements for each display tile", (): void => {
            const tiles = gridEl.querySelectorAll("dnd-tile-drag");

            expect(tiles).toHaveLength(2);
        });

        it("should project the consumer template content into each tile", (): void => {
            const labels = gridEl.querySelectorAll("dnd-tile-drag .tile-label");

            expect(labels).toHaveLength(2);
            expect(labels[0].textContent).toBe("distance");
            expect(labels[1].textContent).toBe("pace");
        });
    });

    describe("tileDrop output", (): void => {
        it("should emit tileDrop when dndState.drop$ emits", (): void => {
            const gridComponent = fixture.debugElement.query(By.directive(TileGridComponent))
                .componentInstance as TileGridComponent;
            const emitSpy = vi.spyOn(gridComponent.tileDrop, "emit");

            const result: TileDragDropResult = { placedTiles: twoTiles };
            dropSubject.next(result);

            expect(emitSpy).toHaveBeenCalledWith(result);
        });
    });

    describe("as part of invalid-dropzone state", (): void => {
        it("should not have invalid-dropzone class when drop is valid", (): void => {
            expect(gridEl.classList.contains("invalid-dropzone")).toBe(false);
        });
    });

    describe("as part of dynamic grid dimensions", (): void => {
        let dimFixture: ComponentFixture<TileGridComponent>;

        beforeEach((): void => {
            dimFixture = TestBed.createComponent(TileGridComponent);
            dimFixture.componentRef.setInput("tiles", []);
            dimFixture.componentRef.setInput("tileDefinitions", []);
            dimFixture.detectChanges();
        });

        it("should set --dnd-grid-cols CSS var to the default input value", (): void => {
            expect(dimFixture.nativeElement.style.getPropertyValue("--dnd-grid-cols")).toBe(
                dimFixture.componentInstance.dndColumns().toString(),
            );
        });

        it("should set --dnd-grid-rows CSS var to the default input value", (): void => {
            expect(dimFixture.nativeElement.style.getPropertyValue("--dnd-grid-rows")).toBe(
                dimFixture.componentInstance.dndRows().toString(),
            );
        });

        it("should update --dnd-grid-cols when dndColumns input changes", (): void => {
            dimFixture.componentRef.setInput("dndColumns", 6);
            dimFixture.detectChanges();

            expect(dimFixture.nativeElement.style.getPropertyValue("--dnd-grid-cols")).toBe("6");
        });

        it("should update --dnd-grid-rows when dndRows input changes", (): void => {
            dimFixture.componentRef.setInput("dndRows", 5);
            dimFixture.detectChanges();

            expect(dimFixture.nativeElement.style.getPropertyValue("--dnd-grid-rows")).toBe("5");
        });
    });
});
