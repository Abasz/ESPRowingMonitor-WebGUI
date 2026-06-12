import { ISessionData } from "./common.interfaces";

export interface ISessionUploadEntity {
    sessionId: number;
    uploadedAt?: number;
}

export interface IMetricsEntity extends Omit<
    ISessionData,
    | "peakForce"
    | "peakForcePositionNorm"
    | "handleForces"
    | "driveLength"
    | "totalWork"
    | "powerBalance"
    | "powerBalancePairCount"
> {
    sessionId: number;
    timeStamp: number;
}

export interface IHandleForcesEntity {
    timeStamp: number;
    sessionId: number;
    strokeId: number;
    handleForces: Array<number>;
    driveLength: number;
}

export interface IDeltaTimesEntity {
    sessionId: number;
    timeStamp: number;
    deltaTimes: Array<number>;
}

export interface IConnectedDeviceEntity {
    sessionId: number;
    deviceName: string;
}

export type LapType = "manual" | "distance" | "time";

export interface ILapEntity {
    sessionId: number;
    timeStamp: number;
    strokeIndex: number;
    type: LapType;
    isPause: boolean;
}

export type IExportRecord = Omit<
    ISessionData,
    | "peakForce"
    | "peakForcePositionNorm"
    | "handleForces"
    | "driveLength"
    | "powerBalance"
    | "powerBalancePairCount"
> & {
    timeStamp: Date;
};

export interface IExportHandleForces {
    peakForce: number;
    peakForcePositionNorm: number;
    driveLength: number;
    handleForces: Array<number>;
}

export type ILapExport = Omit<ILapEntity, "sessionId">;

export interface IExportSession {
    sessionId: number;
    deviceName?: string;
    records: Array<IExportRecord>;
    handleForces: Record<number, IExportHandleForces>;
    laps: Array<ILapExport>;
}
