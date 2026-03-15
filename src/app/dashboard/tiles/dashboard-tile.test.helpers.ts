import { ICalculatedMetrics, IDisplayConfig } from "../../../common/common.interfaces";

/**
 * Creates a mock ICalculatedMetrics object with sensible defaults.
 * Override any property by passing a partial object.
 */
export const createMockMetrics = (overrides?: Partial<ICalculatedMetrics>): ICalculatedMetrics => ({
    avgStrokePower: 0,
    driveDuration: 0,
    recoveryDuration: 0,
    dragFactor: 0,
    distance: 0,
    strokeCount: 0,
    handleForces: [],
    peakForce: 0,
    strokeRate: 0,
    speed: 0,
    distPerStroke: 0,
    driveLength: 0,
    ...overrides,
});

/**
 * Creates a mock IDisplayConfig object with sensible defaults.
 * Override any top-level property by passing a partial object.
 */
export const createMockDisplayConfig = (overrides?: Partial<IDisplayConfig>): IDisplayConfig => ({
    general: {
        unitSystem: "metric",
    },
    forceCurve: {
        showPeakForceInTitle: true,
        showGridLines: true,
        showAxisLabels: true,
    },
    layout: {
        landscape: { tiles: [] },
        portrait: { tiles: [] },
        orientationLock: "auto",
    },
    averaging: {
        mode: "off",
        windowSize: 3,
    },
    ...overrides,
});
