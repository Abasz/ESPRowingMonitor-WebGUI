import { IHeartRate } from "../../../common/common.interfaces";

export interface ISessionRecord {
    strokeIndex: number;
    timeStamp: number;
    elapsedTime: number;
    speed: number;
    avgStrokePower: number;
    strokeRate: number;
    distPerStroke: number;
    distance: number;
    driveDuration: number;
    recoveryDuration: number;
    dragFactor: number;
    heartRate: IHeartRate | undefined;
}

export interface ISessionStroke extends ISessionRecord {
    peakForce: number;
    peakForcePositionNorm: number;
    driveLength: number;
    handleForces: Array<number>;
}

export interface ISessionMaximums {
    speed: number;
    strokePower: number;
    strokeRate: number;
    peakForce: number;
    distPerStroke: number;
    driveLength: number;
    driveDuration: number;
    recoveryDuration: number;
}

export interface ISessionAverages {
    speed: number;
    strokePower: number;
    strokeRate: number;
    peakForcePositionNorm: number;
    distPerStroke: number;
    driveLength: number;
    driveDuration: number;
    recoveryDuration: number;
    heartRate: number | undefined;
    dragFactor: number;
}

export interface ISessionStatistics {
    totalDistance: number;
    totalTime: number;
    totalStrokeCount: number;
    max: ISessionMaximums;
    avg: ISessionAverages;
}

export interface ILap {
    lapNumber: number;
    startIndex: number;
    endIndex: number;
    startTime: number;
    endTime: number;
    duration: number;
    avgPower: number;
    avgStrokeRate: number;
    avgSpeed: number;
    avgDistPerStroke: number;
    powerBalance: number | undefined;
}

export interface ISessionAnalysis {
    sessionId: number;
    deviceName: string | undefined;
    records: Array<ISessionRecord>;
    strokes: Array<ISessionStroke>;
    statistics: ISessionStatistics;
    laps: Array<ILap>;
    powerBalance: number | undefined;
    powerBalanceConsistency: number | undefined;
}
