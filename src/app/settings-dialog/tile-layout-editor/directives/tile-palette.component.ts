import { NgTemplateOutlet } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    ContentChild,
    ElementRef,
    input,
    InputSignal,
    OnInit,
} from "@angular/core";

import { DragCoordinator } from "../services/drag-coordinator.service";
import { TileDefinition } from "../utils/tile-layout.interfaces";

import { DndPaletteTileDefDirective } from "./dnd-palette-tile-def.directive";
import { PaletteDragComponent } from "./palette-drag.component";

export type { DndPaletteTileDefContext } from "./dnd-palette-tile-def.directive";
export { DndPaletteTileDefDirective } from "./dnd-palette-tile-def.directive";

/**
 * Data-driven palette container component for the tile drag-and-drop system.
 *
 * Takes available tile definitions as input, generates palette-drag elements
 * internally, and renders the consumer's content template via `ngTemplateOutlet`.
 * Static content (empty message, spacer, action buttons) is projected via
 * `<ng-content>`.
 */
@Component({
    selector: "dnd-tile-palette",
    template: `
        @for (tileDefinition of availableTiles(); track tileDefinition.id) {
            <dnd-palette-drag [tileDefinition]="tileDefinition">
                <ng-container
                    *ngTemplateOutlet="
                        paletteTileDef?.templateRef ?? null;
                        context: { $implicit: tileDefinition }
                    "
                ></ng-container>
            </dnd-palette-drag>
        }
        <ng-content></ng-content>
    `,
    styleUrls: ["./tile-palette.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PaletteDragComponent, NgTemplateOutlet],
    host: {
        "[style.--dnd-grid-cols]": "dndColumns()",
    },
})
export class TilePaletteComponent implements OnInit {
    readonly dndColumns: InputSignal<number> = input<number>(4);

    readonly availableTiles: InputSignal<Array<TileDefinition>> = input.required<Array<TileDefinition>>();

    @ContentChild(DndPaletteTileDefDirective) readonly paletteTileDef: DndPaletteTileDefDirective | undefined;

    constructor(
        private readonly el: ElementRef<HTMLElement>,
        private readonly coordinator: DragCoordinator,
    ) {}

    ngOnInit(): void {
        this.coordinator.registerPaletteContainer(this.el.nativeElement);
    }
}
