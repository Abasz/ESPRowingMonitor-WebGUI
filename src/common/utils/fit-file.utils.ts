import { IExportHandleForces, IExportRecord } from "../database.interfaces";

export interface SportConfig {
    sport: "rowing" | "kayaking";
    subSport: "indoorRowing" | "generic";
    name: string;
    sportProfileName: string;
}

export interface SessionStats {
    avgCadence: number;
    maxCadence: number;
    avgPower: number;
    maxPower: number;
    avgSpeed: number;
    maxSpeed: number;
    heartRate: { avg: number; max: number } | undefined;
    avgStrokeDistance: number;
    totalDistance: number;
    totalCycles: number;
    totalWork: number;
    force: { avg: number; max: number } | undefined;
}

const KAYAK_DEVICE_PATTERNS: Array<string> = ["kayak", "olddanube"];

const isKayakDevice = (deviceName: string | undefined): boolean => {
    const name = deviceName?.toLowerCase() ?? "";

    return KAYAK_DEVICE_PATTERNS.some((pattern: string): boolean => name.includes(pattern));
};

export function getSportConfig(deviceName: string | undefined): SportConfig {
    if (isKayakDevice(deviceName)) {
        return {
            sport: "kayaking",
            subSport: "generic",
            name: "Indoor Kayaking",
            sportProfileName: "Kayak Indoor",
        };
    }

    return {
        sport: "rowing",
        subSport: "indoorRowing",
        name: "Indoor Rowing",
        sportProfileName: "Row Indoor",
    };
}

export function computeStats(
    records: Array<IExportRecord>,
    handleForces: Record<number, IExportHandleForces>,
): SessionStats {
    const lastRecord = records[records.length - 1];

    // cadence (strokes/min)
    let cadenceSum = 0;
    let cadenceCount = 0;
    let maxCadence = 0;

    // power (watts)
    let powerSum = 0;
    let powerCount = 0;
    let maxPower = 0;

    // heart rate (bpm)
    let heartRateSum = 0;
    let heartRateCount = 0;
    let maxHeartRate = 0;

    // speed (m/s)
    let speedSum = 0;
    let speedCount = 0;
    let maxSpeed = 0;

    // stroke distance (m)
    let strokeDistanceSum = 0;
    let strokeDistanceCount = 0;

    for (const record of records) {
        if (record.strokeRate > 0) {
            cadenceSum += record.strokeRate;
            cadenceCount++;
            maxCadence = Math.max(maxCadence, record.strokeRate);
        }

        if (record.avgStrokePower > 0) {
            powerSum += record.avgStrokePower;
            powerCount++;
            maxPower = Math.max(maxPower, record.avgStrokePower);
        }

        if (record.speed > 0) {
            speedSum += record.speed;
            speedCount++;
            maxSpeed = Math.max(maxSpeed, record.speed);
        }

        if (record.heartRate !== undefined) {
            heartRateSum += record.heartRate.heartRate;
            heartRateCount++;
            maxHeartRate = Math.max(maxHeartRate, record.heartRate.heartRate);
        }

        if (record.distPerStroke > 0) {
            strokeDistanceSum += record.distPerStroke;
            strokeDistanceCount++;
        }
    }

    return {
        avgCadence: cadenceCount > 0 ? Math.round(cadenceSum / cadenceCount) : 0,
        maxCadence: Math.round(maxCadence),
        avgPower: powerCount > 0 ? Math.round(powerSum / powerCount) : 0,
        maxPower: Math.round(maxPower),
        avgSpeed: speedCount > 0 ? speedSum / speedCount : 0,
        maxSpeed,
        heartRate:
            heartRateCount > 0
                ? { avg: Math.round(heartRateSum / heartRateCount), max: maxHeartRate }
                : undefined,
        avgStrokeDistance: strokeDistanceCount > 0 ? strokeDistanceSum / strokeDistanceCount : 0,
        totalDistance: lastRecord.distance / 100,
        totalCycles: lastRecord.strokeCount,
        totalWork: Math.round(lastRecord.totalWork),
        force: computeForceStats(handleForces),
    };
}

export function computeMeanForce(forces: Array<number>): number {
    if (forces.length === 0) {
        return 0;
    }

    return forces.reduce((sum: number, force: number): number => sum + force, 0) / forces.length;
}

export function computeForceStats(
    handleForces: Record<number, IExportHandleForces>,
): { avg: number; max: number } | undefined {
    const entries = Object.values(handleForces);
    if (entries.length === 0) {
        return undefined;
    }

    let forceSum = 0;
    let forceCount = 0;
    let maxForce = 0;

    for (const handleForce of entries) {
        if (handleForce.handleForces.length > 0) {
            const meanForce = computeMeanForce(handleForce.handleForces);
            forceSum += meanForce;
            forceCount++;
            maxForce = Math.max(maxForce, meanForce);
        }
    }

    if (forceCount === 0) {
        return undefined;
    }

    return {
        avg: Math.round(forceSum / forceCount),
        max: Math.round(maxForce),
    };
}
