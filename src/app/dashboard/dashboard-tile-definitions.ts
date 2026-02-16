import { IDashboardLayoutConfig } from "../../common/common.interfaces";
import { TileDefinition } from "../settings-dialog/tile-layout-editor/utils/tile-layout.interfaces";

/**
 * Internal registry entry shape. Extends DashboardTileDefinition so all metadata fields (id, label, icon, spans) are inherited.
 * The defaultPosition is intentionally omitted — only the dev team manually decides which tiles appear in the default layout.
 *
 * To add a new tile:
 * 1. Create a tile component (in `tiles/`) and add its class to DashboardTileComponent.
 * 2. Add one entry to TILE_REGISTRY below.
 */
export interface TileRegistryEntry extends TileDefinition {
    readonly label: string;
    readonly icon?: string;
}

/**
 * Metadata describing a tile for the dashboard.
 */
export type DashboardTileDefinition = TileRegistryEntry & { id: DashboardTileId };

/**
 * Union of all valid tile type strings, derived from the registry.
 * Automatically updated whenever a new entry is added to TILE_REGISTRY.
 */
export type DashboardTileId = (typeof TILE_REGISTRY)[keyof typeof TILE_REGISTRY]["id"];

const TILE_REGISTRY = {
    Distance: {
        id: "distance" as const,
        label: "Distance",
        icon: "distance",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    Pace: {
        id: "pace" as const,
        label: "Pace",
        icon: "speed",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    Power: {
        id: "power" as const,
        label: "Power",
        icon: "bolt",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    StrokeRate: {
        id: "strokeRate" as const,
        label: "Stroke Rate",
        icon: "rowing",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    Timer: {
        id: "timer" as const,
        label: "Timer",
        icon: "timer",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    ForceCurve: {
        id: "forceCurve" as const,
        label: "Force Curve",
        icon: "show_chart",
        defaultRowSpan: 2,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    DistPerStroke: {
        id: "distPerStroke" as const,
        label: "Dist / Stroke",
        icon: "route",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    TotalStrokes: {
        id: "totalStrokes" as const,
        label: "Total Strokes",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    DragFactor: {
        id: "dragFactor" as const,
        label: "Drag Factor",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    Drive: {
        id: "driveTime" as const,
        label: "Drive Time",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    Recovery: {
        id: "recoveryTime" as const,
        label: "Recovery Time",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
    HeartRate: {
        id: "heartRate" as const,
        label: "Heart Rate",
        icon: "ecg_heart",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
    },
} satisfies Record<string, TileRegistryEntry>;

/**
 * Flat array of all tile definitions (without positions), ordered by registry entry order.
 */
export const DASHBOARD_TILE_DEFINITIONS = Object.values(TILE_REGISTRY) as Array<DashboardTileDefinition>;

/**
 * Default layout. Tiles listed here will appear in the default dashboard layout.
 */
export const DEFAULT_DASHBOARD_LAYOUT: IDashboardLayoutConfig = {
    tiles: [
        { id: "distance", position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 1 } },
        { id: "pace", position: { rowStart: 1, columnStart: 2, rowSpan: 1, columnSpan: 1 } },
        { id: "power", position: { rowStart: 1, columnStart: 3, rowSpan: 1, columnSpan: 1 } },
        { id: "strokeRate", position: { rowStart: 1, columnStart: 4, rowSpan: 1, columnSpan: 1 } },
        { id: "timer", position: { rowStart: 2, columnStart: 1, rowSpan: 1, columnSpan: 1 } },
        { id: "forceCurve", position: { rowStart: 2, columnStart: 2, rowSpan: 2, columnSpan: 1 } },
        { id: "distPerStroke", position: { rowStart: 2, columnStart: 3, rowSpan: 1, columnSpan: 1 } },
        { id: "totalStrokes", position: { rowStart: 2, columnStart: 4, rowSpan: 1, columnSpan: 1 } },
        { id: "dragFactor", position: { rowStart: 3, columnStart: 1, rowSpan: 1, columnSpan: 1 } },
        { id: "driveTime", position: { rowStart: 3, columnStart: 3, rowSpan: 1, columnSpan: 1 } },
        { id: "recoveryTime", position: { rowStart: 3, columnStart: 4, rowSpan: 1, columnSpan: 1 } },
    ],
};
