import {
    ChangeDetectionStrategy,
    Component,
    input,
    InputSignal,
    linkedSignal,
    output,
    OutputEmitterRef,
    WritableSignal,
} from "@angular/core";
import { MatIcon } from "@angular/material/icon";

import { IDashboardLayoutConfig } from "../../../../common/common.interfaces";
import { DASHBOARD_TILE_DEFINITIONS, DashboardTileId } from "../../../dashboard/dashboard-tile-definitions";
import { DashboardTileDefinition, PlacedDashboardTile } from "../../../dashboard/dashboard.interfaces";

import { DndTileDefDirective, TileGridComponent } from "./directives/tile-grid.component";
import { DndPaletteTileDefDirective, TilePaletteComponent } from "./directives/tile-palette.component";
import { TileDragDropResult } from "./services/dnd-state.service";
import { provideDndServices } from "./services/provide-dnd-services";

@Component({
    selector: "app-tile-layout-editor",
    templateUrl: "./tile-layout-editor.component.html",
    styleUrls: ["./tile-layout-editor.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatIcon,
        TileGridComponent,
        TilePaletteComponent,
        DndTileDefDirective,
        DndPaletteTileDefDirective,
    ],
    providers: [...provideDndServices()],
})
export class TileLayoutEditorComponent {
    readonly TILE_DEFINITIONS: ReadonlyArray<DashboardTileDefinition> = DASHBOARD_TILE_DEFINITIONS;

    readonly dndRows: InputSignal<number> = input<number>(3);
    readonly dndColumns: InputSignal<number> = input<number>(4);

    readonly layout: InputSignal<IDashboardLayoutConfig> = input.required<IDashboardLayoutConfig>();
    readonly layoutChange: OutputEmitterRef<IDashboardLayoutConfig> = output<IDashboardLayoutConfig>();

    readonly placedTiles: WritableSignal<Array<PlacedDashboardTile>> = linkedSignal(
        (): Array<PlacedDashboardTile> => this.layout().tiles,
    );

    readonly availableTiles: WritableSignal<Array<DashboardTileDefinition>> = linkedSignal<
        Array<PlacedDashboardTile>,
        Array<DashboardTileDefinition>
    >({
        source: (): Array<PlacedDashboardTile> => this.layout().tiles,
        computation: (
            newTiles: Array<PlacedDashboardTile>,
            previous: { value: Array<DashboardTileDefinition> } | undefined,
        ): Array<DashboardTileDefinition> => {
            if (previous !== undefined) {
                const prevAvailIds = new Set(
                    previous.value.map(
                        (definition: DashboardTileDefinition): DashboardTileId => definition.id,
                    ),
                );
                const prevPlacedCount = DASHBOARD_TILE_DEFINITIONS.length - previous.value.length;

                if (
                    newTiles.length === prevPlacedCount &&
                    newTiles.every((tile: PlacedDashboardTile): boolean => !prevAvailIds.has(tile.id))
                ) {
                    return previous.value;
                }
            }

            const newPlacedIds = new Set(
                newTiles.map((tile: PlacedDashboardTile): DashboardTileId => tile.id),
            );

            return DASHBOARD_TILE_DEFINITIONS.filter(
                (definition: DashboardTileDefinition): boolean => !newPlacedIds.has(definition.id),
            );
        },
    });

    onTileDrop(result: TileDragDropResult): void {
        const droppedTiles = result.placedTiles as Array<PlacedDashboardTile>;

        this.placedTiles.set(droppedTiles);
        this.layoutChange.emit({ tiles: [...droppedTiles] });

        if (result.placedFromPalette) {
            const placedId = result.placedFromPalette as DashboardTileId;
            this.availableTiles.update(
                (tiles: Array<DashboardTileDefinition>): Array<DashboardTileDefinition> =>
                    tiles.filter(
                        (definition: DashboardTileDefinition): boolean => definition.id !== placedId,
                    ),
            );

            return;
        }

        if (!result.movedToPalette) {
            return;
        }

        const returnedId = result.movedToPalette as DashboardTileId;
        const returnedDef = DASHBOARD_TILE_DEFINITIONS.find(
            (definition: DashboardTileDefinition): boolean => definition.id === returnedId,
        );

        if (!returnedDef) {
            return;
        }

        this.availableTiles.update(
            (tiles: Array<DashboardTileDefinition>): Array<DashboardTileDefinition> => [
                ...tiles,
                returnedDef,
            ],
        );
    }
}
