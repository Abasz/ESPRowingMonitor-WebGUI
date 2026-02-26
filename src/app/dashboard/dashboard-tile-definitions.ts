import { Type } from "@angular/core";

import {
    ICalculatedMetrics,
    IDashboardLayoutConfig,
    IDisplayConfig,
    IHeartRate,
} from "../../common/common.interfaces";
import { TileDefinition } from "../settings-dialog/tile-layout-editor/utils/tile-layout.interfaces";

import { DistPerStrokeTileComponent } from "./tiles/dist-per-stroke-tile.component";
import { DistanceTileComponent } from "./tiles/distance-tile.component";
import { DragFactorTileComponent } from "./tiles/drag-factor-tile.component";
import { DriveTileComponent } from "./tiles/drive-tile.component";
import { ForceCurveTileComponent } from "./tiles/force-curve-tile.component";
import { HeartRateTileComponent } from "./tiles/heart-rate-tile.component";
import { PaceTileComponent } from "./tiles/pace-tile.component";
import { PeakForceTileComponent } from "./tiles/peak-force-tile.component";
import { PowerTileComponent } from "./tiles/power-tile.component";
import { RecoveryTileComponent } from "./tiles/recovery-tile.component";
import { StrokeRateTileComponent } from "./tiles/stroke-rate-tile.component";
import { TimerTileComponent } from "./tiles/timer-tile.component";
import { TotalStrokesTileComponent } from "./tiles/total-strokes-tile.component";

export interface DashboardContext {
    rowingData: ICalculatedMetrics;
    heartRateData: IHeartRate | undefined;
    elapseTime: number;
    displayConfig: IDisplayConfig;
}

/**
 * Valid context key names that can be passed to tile components via ngComponentOutletInputs.
 */
export type DashboardContextKey = keyof DashboardContext;

/**
 * Internal registry entry shape. Extends TileDefinition so all metadata fields (spans) are inherited.
 * The defaultPosition is intentionally omitted — only the dev team manually decides which tiles appear in the default layout.
 *
 * To add a new tile:
 * 1. Create a tile component (in `tiles/`).
 * 2. Add one entry to TILE_REGISTRY below.
 */
export interface TileRegistryEntry extends TileDefinition {
    readonly label: string;
    readonly icon?: string;
    readonly component: Type<unknown>;
    readonly context: ReadonlyArray<DashboardContextKey>;
}

/**
 * The full set of inputs passed to a tile component via ngComponentOutletInputs.
 * Combines the per-tile DashboardContext slice with metadata from the registry.
 */
export type TileComponentInputs = Partial<DashboardContext> & { label: string; icon?: string };

/**
 * Metadata describing a tile for the dashboard.
 */
export type DashboardTileDefinition = TileRegistryEntry & { id: DashboardTileId };

/**
 * Union of all valid tile type strings, derived from the registry.
 * Automatically updated whenever a new entry is added to TILE_REGISTRY.
 */
export type DashboardTileId = (typeof TILE_REGISTRY)[keyof typeof TILE_REGISTRY]["id"];

/**
 * Union of all dashboard tile component classes, derived from the registry.
 */
export type DashboardTileComponent = InstanceType<
    (typeof TILE_REGISTRY)[keyof typeof TILE_REGISTRY]["component"]
>;

const TILE_REGISTRY = {
    Distance: {
        id: "distance" as const,
        label: "Distance",
        icon: "distance",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: DistanceTileComponent,
        context: ["rowingData", "displayConfig"],
    },
    Pace: {
        id: "pace" as const,
        label: "Pace",
        icon: "speed",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: PaceTileComponent,
        context: ["rowingData"],
    },
    Power: {
        id: "power" as const,
        label: "Power",
        icon: "bolt",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: PowerTileComponent,
        context: ["rowingData"],
    },
    StrokeRate: {
        id: "strokeRate" as const,
        label: "Stroke Rate",
        icon: "rowing",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: StrokeRateTileComponent,
        context: ["rowingData"],
    },
    Timer: {
        id: "timer" as const,
        label: "Timer",
        icon: "timer",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: TimerTileComponent,
        context: ["elapseTime"],
    },
    ForceCurve: {
        id: "forceCurve" as const,
        label: "Force Curve",
        icon: "show_chart",
        defaultRowSpan: 2,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: ForceCurveTileComponent,
        context: ["rowingData", "displayConfig"],
    },
    DistPerStroke: {
        id: "distPerStroke" as const,
        label: "Dist / Stroke",
        icon: "route",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: DistPerStrokeTileComponent,
        context: ["rowingData", "displayConfig"],
    },
    TotalStrokes: {
        id: "totalStrokes" as const,
        label: "Total Strokes",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: TotalStrokesTileComponent,
        context: ["rowingData"],
    },
    DragFactor: {
        id: "dragFactor" as const,
        label: "Drag Factor",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: DragFactorTileComponent,
        context: ["rowingData"],
    },
    Drive: {
        id: "driveTime" as const,
        label: "Drive Time",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: DriveTileComponent,
        context: ["rowingData"],
    },
    Recovery: {
        id: "recoveryTime" as const,
        label: "Recovery Time",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: RecoveryTileComponent,
        context: ["rowingData"],
    },
    HeartRate: {
        id: "heartRate" as const,
        label: "Heart Rate",
        icon: "ecg_heart",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: HeartRateTileComponent,
        context: ["heartRateData"],
    },
    PeakForce: {
        id: "peakForce" as const,
        label: "Peak Force",
        icon: "show_chart",
        defaultRowSpan: 1,
        defaultColumnSpan: 1,
        minRowSpan: 1,
        minColumnSpan: 1,
        component: PeakForceTileComponent,
        context: ["rowingData"],
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
