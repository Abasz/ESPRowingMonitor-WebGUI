import { NgTemplateOutlet } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    ContentChild,
    effect,
    ElementRef,
    input,
    InputSignal,
    OnInit,
    output,
    OutputEmitterRef,
    Signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { DndStateService, TileDragDropResult } from "../services/dnd-state.service";
import { DragCoordinator } from "../services/drag-coordinator.service";
import { TileGridHelper } from "../utils/tile-grid.helper";
import { GridCells, PlacedTile, TileDefinition } from "../utils/tile-layout.interfaces";

import { DndTileDefContext, DndTileDefDirective } from "./dnd-tile-def.directive";
import { GridCellComponent } from "./grid-cell.component";
import { TileDragComponent } from "./tile-drag.component";

export type { DndTileDefContext } from "./dnd-tile-def.directive";
export { DndTileDefDirective } from "./dnd-tile-def.directive";

/**
 * Data-driven grid container component for the tile drag-and-drop system.
 *
 * Takes committed tiles and tile definitions as inputs, generates grid
 * cells and tile-drag elements internally, and renders the consumer's
 * content template via `ngTemplateOutlet`.
 *
 * Emits a `tileDrop` output when a drag-and-drop operation completes.
 */
@Component({
    selector: "dnd-tile-grid",
    template: `
        @for (cell of gridCells(); track cell.row + "-" + cell.column) {
            <dnd-grid-cell [cell]="cell"></dnd-grid-cell>
        }
        @for (tile of displayTiles(); track tile.id) {
            <dnd-tile-drag [tile]="tile">
                <ng-container
                    *ngTemplateOutlet="
                        tileDefinitionDirective?.templateRef ?? null;
                        context: tileContext(tile)
                    "
                ></ng-container>
            </dnd-tile-drag>
        }
    `,
    styleUrls: ["./tile-grid.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [GridCellComponent, TileDragComponent, NgTemplateOutlet],
    host: {
        "[class.invalid-dropzone]": "coordinator.isDropInvalid()",
        "[style.--dnd-grid-cols]": "dndColumns()",
        "[style.--dnd-grid-rows]": "dndRows()",
    },
})
export class TileGridComponent implements OnInit {
    readonly dndRows: InputSignal<number> = input<number>(3);
    readonly dndColumns: InputSignal<number> = input<number>(4);

    /** Committed (non-preview) tiles to render. */
    readonly tiles: InputSignal<Array<PlacedTile>> = input.required<Array<PlacedTile>>();

    readonly tileDefinitions: InputSignal<ReadonlyArray<TileDefinition>> =
        input.required<ReadonlyArray<TileDefinition>>();

    readonly tileDrop: OutputEmitterRef<TileDragDropResult> = output<TileDragDropResult>();

    @ContentChild(DndTileDefDirective) readonly tileDefinitionDirective: DndTileDefDirective | undefined;

    readonly gridCells: Signal<GridCells> = computed(
        (): GridCells => TileGridHelper.generateGridCells(this.dndRows(), this.dndColumns()),
    );

    /** Display tiles (preview during drag, otherwise committed). */
    readonly displayTiles: Signal<Array<PlacedTile>> = this.dndState.displayTiles;

    constructor(
        private readonly el: ElementRef<HTMLElement>,
        readonly coordinator: DragCoordinator,
        private readonly dndState: DndStateService,
    ) {
        // sync the grid's committed tiles and definitions into the DnD state service. It has been verified that this does not create circular dependencies and it is safe and appropriate for this purpose.
        effect((): void => dndState.committedTiles.set(this.tiles()));
        effect((): void => dndState.tileDefinitions.set(this.tileDefinitions()));

        this.dndState.drop$.pipe(takeUntilDestroyed()).subscribe((result: TileDragDropResult): void => {
            this.tileDrop.emit(result);
        });
    }

    ngOnInit(): void {
        this.coordinator.registerGridContainer(this.el.nativeElement);
    }

    /** Build the template context for a given tile. */
    tileContext(placedTile: PlacedTile): DndTileDefContext {
        return {
            $implicit: placedTile,
            definition: this.dndState.getDefinition(placedTile.id),
        };
    }
}
