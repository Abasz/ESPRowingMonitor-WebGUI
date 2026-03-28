import { Directive, TemplateRef } from "@angular/core";

import { PlacedTile, TileDefinition } from "../utils/tile-layout.interfaces";

/**
 * Template context exposed to the consumer's `ng-template[dndTileDef]`.
 *
 * - `$implicit` — the {@link DashboardTileConfig} being rendered.
 * - `definition` — the resolved {@link TileTypeDefinition} (or undefined).
 */
export interface DndTileDefContext {
    $implicit: PlacedTile;
    definition: TileDefinition | undefined;
}

/**
 * Structural-directive marker for the consumer's grid tile template.
 *
 * Usage:
 * ```html
 * <dnd-tile-grid [tiles]="..." [tileDefinitions]="...">
 *     <ng-template dndTileDef let-tile let-definition="definition">
 *         ...
 *     </ng-template>
 * </dnd-tile-grid>
 * ```
 */
@Directive({ selector: "ng-template[dndTileDef]" })
export class DndTileDefDirective {
    constructor(readonly templateRef: TemplateRef<DndTileDefContext>) {}
}
