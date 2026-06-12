import { fit_messages } from "@markw65/fit-file-writer";

import { IExportHandleForces, IExportRecord, ILapExport, LapType } from "../../database.interfaces";
import { isKayakErgometer } from "../utility.functions";

// undocumented Garmin fields for split and split_summary messages
// TODO: we may remove these once they are included in the fit-file-writer library
export const SPLIT_USER_MESSAGES = {
    split: {
        fields: {
            lap_index: {
                ...fit_messages.session.fields.first_lap_index,
                name: "lap_index" as const,
                num: 67 as const,
            },
            avg_cadence: {
                ...fit_messages.session.fields.first_lap_index,
                name: "avg_cadence" as const,
                num: 29 as const,
                scale: 128,
                offset: 0,
                units: "rpm",
            },
            max_cadence: {
                ...fit_messages.session.fields.first_lap_index,
                name: "max_cadence" as const,
                num: 30 as const,
                scale: 128,
                offset: 0,
                units: "rpm",
            },
        },
    },
    split_summary: {
        fields: {
            avg_cadence: {
                ...fit_messages.session.fields.first_lap_index,
                name: "avg_cadence" as const,
                num: 14 as const,
                scale: 128,
                offset: 0,
                units: "rpm",
            },
            max_cadence: {
                ...fit_messages.session.fields.first_lap_index,
                name: "max_cadence" as const,
                num: 15 as const,
                scale: 128,
                offset: 0,
                units: "rpm",
            },
        },
    },
};

export const enum DevFieldId {
    DriveLength = 0,
    StrokeDriveTime = 1,
    DragFactor = 2,
    StrokeRecoveryTime = 3,
    AverageDriveForceN = 6,
    PeakDriveForceN = 7,
    PeakForcePositionNorm = 17,
    HandleForceCurve = 60,
    InstrokeAbscissaType = 90,
    InstrokeSampleInterval = 91,
    InstrokePointCount = 92,
}

type FitBaseTypeString = "uint8" | "uint16";

export type FitLapTrigger = "manual" | "distance" | "time" | "sessionEnd";
export type FitEventType = "start" | "stopAll" | "stop";
export type SplitType = "interval_active" | "interval_rest";

export interface DeveloperFieldDef {
    fieldDefinitionNumber: DevFieldId;
    fieldName: string;
    fitBaseTypeId: FitBaseTypeString;
    scale: number;
    units?: string;
    isCurveField?: true;
}

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
    totalElapsedTime: number;
    totalCycles: number;
    totalWork: number;
    avgDragFactor: number;
    force: { avg: number; max: number } | undefined;
}

export interface LapSegment {
    records: Array<IExportRecord>;
    handleForces: Record<number, IExportHandleForces>;
    lapTrigger: FitLapTrigger;
    isPause: boolean;
    startTimeMs: number;
    endTimeMs: number;
}

// random UUID: 395542c3-ad4b-4369-8913-2c3af6d234e1
export const APPLICATION_UUID: Array<number> = [
    0x39, 0x55, 0x42, 0xc3, 0xad, 0x4b, 0x43, 0x69, 0x89, 0x13, 0x2c, 0x3a, 0xf6, 0xd2, 0x34, 0xe1,
];

export const DEVELOPER_FIELD_DEFS: ReadonlyArray<DeveloperFieldDef> = [
    {
        fieldDefinitionNumber: DevFieldId.DriveLength,
        fieldName: "DriveLength",
        fitBaseTypeId: "uint16",
        scale: 100,
        units: "m",
    },
    {
        fieldDefinitionNumber: DevFieldId.StrokeDriveTime,
        fieldName: "StrokeDriveTime",
        fitBaseTypeId: "uint16",
        scale: 1,
        units: "ms",
    },
    {
        fieldDefinitionNumber: DevFieldId.DragFactor,
        fieldName: "DragFactor",
        fitBaseTypeId: "uint16",
        scale: 1,
        units: "10^-6 N*m*s^2",
    },
    {
        fieldDefinitionNumber: DevFieldId.StrokeRecoveryTime,
        fieldName: "StrokeRecoveryTime",
        fitBaseTypeId: "uint16",
        scale: 1,
        units: "ms",
    },
    {
        fieldDefinitionNumber: DevFieldId.AverageDriveForceN,
        fieldName: "AverageDriveForceN",
        fitBaseTypeId: "uint16",
        scale: 10,
        units: "N",
    },
    {
        fieldDefinitionNumber: DevFieldId.PeakDriveForceN,
        fieldName: "PeakDriveForceN",
        fitBaseTypeId: "uint16",
        scale: 10,
        units: "N",
    },
    {
        fieldDefinitionNumber: DevFieldId.PeakForcePositionNorm,
        fieldName: "PeakForcePositionNorm",
        fitBaseTypeId: "uint16",
        scale: 100,
        units: "%",
    },
    {
        fieldDefinitionNumber: DevFieldId.HandleForceCurve,
        fieldName: "HandleForceCurve",
        fitBaseTypeId: "uint16",
        scale: 10,
        units: "N",
        isCurveField: true,
    },
    {
        fieldDefinitionNumber: DevFieldId.InstrokeAbscissaType,
        fieldName: "InstrokeAbscissaType",
        fitBaseTypeId: "uint8",
        scale: 1,
        isCurveField: true,
    },
    {
        fieldDefinitionNumber: DevFieldId.InstrokeSampleInterval,
        fieldName: "InstrokeSampleInterval",
        fitBaseTypeId: "uint16",
        scale: 100,
        units: "cm",
        isCurveField: true,
    },
    {
        fieldDefinitionNumber: DevFieldId.InstrokePointCount,
        fieldName: "InstrokePointCount",
        fitBaseTypeId: "uint8",
        scale: 1,
        isCurveField: true,
    },
];

const LAP_TRIGGER_MAP: Record<LapType, FitLapTrigger> = {
    manual: "manual",
    distance: "distance",
    time: "time",
};

export function computeMaxCurvePointCount(handleForces: Record<number, IExportHandleForces>): number {
    let max = 0;
    for (const handleForce of Object.values(handleForces)) {
        max = Math.max(max, handleForce.handleForces.length);
    }

    return Math.min(127, max);
}

export function getSportConfig(deviceName: string | undefined): SportConfig {
    if (isKayakErgometer(deviceName)) {
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
    handleForces: Record<number, IExportHandleForces> = {},
): SessionStats {
    if (records.length === 0) {
        return {
            avgCadence: 0,
            maxCadence: 0,
            avgPower: 0,
            maxPower: 0,
            avgSpeed: 0,
            maxSpeed: 0,
            heartRate: undefined,
            avgStrokeDistance: 0,
            totalDistance: 0,
            totalElapsedTime: 0,
            totalCycles: 0,
            totalWork: 0,
            avgDragFactor: 0,
            force: undefined,
        };
    }

    const firstRecord = records[0];
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

    // drag factor
    let dragFactorSum = 0;
    let dragFactorCount = 0;

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

        if (record.dragFactor > 0) {
            dragFactorSum += record.dragFactor;
            dragFactorCount++;
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
        totalDistance: (lastRecord.distance - firstRecord.distance) / 100,
        totalElapsedTime: lastRecord.elapsedTime - firstRecord.elapsedTime,
        totalCycles: lastRecord.strokeCount - firstRecord.strokeCount,
        totalWork: Math.round(lastRecord.totalWork - firstRecord.totalWork),
        avgDragFactor: dragFactorCount > 0 ? Math.round(dragFactorSum / dragFactorCount) : 0,
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

function findRecordBoundary(records: Array<IExportRecord>, timeMs: number): number {
    const index = records.findIndex((record: IExportRecord): boolean => record.timeStamp.getTime() >= timeMs);

    return index === -1 ? records.length : index;
}

function collectSegmentHandleForces(
    records: Array<IExportRecord>,
    allHandleForces: Record<number, IExportHandleForces>,
): Record<number, IExportHandleForces> {
    const result: Record<number, IExportHandleForces> = {};
    for (const record of records) {
        const forces = allHandleForces[record.strokeCount];
        if (forces !== undefined) {
            result[record.strokeCount] = forces;
        }
    }

    return result;
}

export function buildLapSegments(
    records: Array<IExportRecord>,
    laps: Array<ILapExport>,
    sessionStartMs: number,
    allHandleForces: Record<number, IExportHandleForces> = {},
): Array<LapSegment> {
    const segments: Array<LapSegment> = laps.map((marker: ILapExport, index: number): LapSegment => {
        const isFirst = index === 0;
        const startTimeMs = isFirst ? sessionStartMs : laps[index - 1].timeStamp;
        const isPause = isFirst ? false : laps[index - 1].isPause;
        const startIndex = findRecordBoundary(records, startTimeMs);
        const endIndex = findRecordBoundary(records, marker.timeStamp);
        const segmentRecords = records.slice(startIndex, endIndex + 1);

        return {
            records: segmentRecords,
            handleForces: collectSegmentHandleForces(segmentRecords, allHandleForces),
            lapTrigger: LAP_TRIGGER_MAP[marker.type],
            isPause,
            startTimeMs,
            endTimeMs: marker.timeStamp,
        };
    });

    const lastMarker = laps[laps.length - 1] as ILapExport | undefined;
    const trailingRecords = records.slice(
        lastMarker !== undefined ? findRecordBoundary(records, lastMarker.timeStamp) : 0,
    );

    segments.push({
        records: trailingRecords,
        handleForces: collectSegmentHandleForces(trailingRecords, allHandleForces),
        lapTrigger: "sessionEnd",
        isPause: lastMarker?.isPause ?? false,
        startTimeMs: lastMarker?.timeStamp ?? sessionStartMs,
        endTimeMs: Math.max(
            records[records.length - 1].timeStamp.getTime(),
            lastMarker?.timeStamp ?? sessionStartMs,
        ),
    });

    return segments;
}

export function getSegmentStartDistance(segment: LapSegment): number {
    if (segment.records.length === 0) {
        return 0;
    }

    return segment.records[0].distance / 100;
}
