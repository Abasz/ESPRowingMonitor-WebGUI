import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";

import { TileHighlightManager } from "../services/tile-highlight-manager.service";

/**
 * Lightweight wrapper component for grid cells that handles grid positioning
 * and highlight state. Applies border, border-radius, transition, and highlight
 * colors via its own stylesheet so consumers get sensible defaults.
 * Override via `--dnd-*` CSS custom property tokens.
 */
@Component({
    selector: "dnd-grid-cell",
    template: "<ng-content></ng-content>",
    styleUrls: ["./grid-cell.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        "[style.grid-row-start]": "cell().row",
        "[style.grid-column-start]": "cell().column",
        "[class.highlighted]": "isHighlighted()",
    },
})
export class GridCellComponent {
    readonly cell: InputSignal<{ row: number; column: number }> = input.required<{
        row: number;
        column: number;
    }>();

    readonly isHighlighted: Signal<boolean> = computed((): boolean =>
        this.highlightManager.isCellHighlighted(this.cell().row, this.cell().column),
    );

    constructor(private readonly highlightManager: TileHighlightManager) {}
}
