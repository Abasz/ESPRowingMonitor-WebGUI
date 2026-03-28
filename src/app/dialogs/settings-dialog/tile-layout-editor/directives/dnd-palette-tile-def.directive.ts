import { Directive, TemplateRef } from "@angular/core";

import { TileDefinition } from "../utils/tile-layout.interfaces";

/**
 * Template context exposed to the consumer's `ng-template[dndPaletteTileDef]`.
 *
 * - `$implicit` — the {@link TileTypeDefinition} being rendered.
 */
export interface DndPaletteTileDefContext {
    $implicit: TileDefinition;
}

/**
 * Structural-directive marker for the consumer's palette tile template.
 *
 * Usage:
 * ```html
 * <dnd-tile-palette [availableTiles]="...">
 *     <ng-template dndPaletteTileDef let-tileDef>
 *         ...
 *     </ng-template>
 *     <!-- static content projected via ng-content -->
 * </dnd-tile-palette>
 * ```
 */
@Directive({ selector: "ng-template[dndPaletteTileDef]" })
export class DndPaletteTileDefDirective {
    constructor(readonly templateRef: TemplateRef<DndPaletteTileDefContext>) {}
}
