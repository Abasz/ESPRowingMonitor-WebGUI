import { ISessionData } from "./common.interfaces";

export interface IMetricsEntity extends Omit<ISessionData, "peakForce" | "handleForces" | "driveLength"> {
    sessionId: number;
    timeStamp: number;
}

export interface IHandleForcesEntity {
    timeStamp: number;
    sessionId: number;
    strokeId: number;
    peakForce: number;
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

export type IExportRecord = Omit<ISessionData, "peakForce" | "handleForces" | "driveLength"> & {
    timeStamp: Date;
};

export interface IExportHandleForces {
    peakForce: number;
    driveLength: number;
    handleForces: Array<number>;
}

export interface IExportSession {
    sessionId: number;
    deviceName?: string;
    records: Array<IExportRecord>;
    handleForces: Record<number, IExportHandleForces>;
}
