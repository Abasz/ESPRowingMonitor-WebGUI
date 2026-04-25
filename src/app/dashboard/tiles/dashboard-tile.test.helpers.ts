import { ICalculatedMetrics } from "../../../common/common.interfaces";

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
    peakForcePositionNorm: 0,
    strokeRate: 0,
    speed: 0,
    distPerStroke: 0,
    driveLength: 0,
    totalWork: 0,
    ...overrides,
});
