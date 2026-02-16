import type {
    PlacedTile,
    TilePosition,
} from "../settings-dialog/tile-layout-editor/utils/tile-layout.interfaces";

import type { DashboardTileDefinition, DashboardTileId } from "./dashboard-tile-definitions";

export type { TilePosition, DashboardTileDefinition };

/**
 * A dashboard tile placed on the grid.
 */
export interface PlacedDashboardTile extends PlacedTile {
    readonly id: DashboardTileId;
}
