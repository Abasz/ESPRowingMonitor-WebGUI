import { ISessionData } from "./common.interfaces";

export interface IMetricsEntity
    extends Omit<ISessionData, "activityStartTime" | "peakForce" | "handleForces"> {
    sessionId: number;
    timeStamp: number;
}

export interface IHandleForcesEntity {
    timeStamp: number;
    sessionId: number;
    strokeId: number;
    peakForce: number;
    handleForces: Array<number>;
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

export type ExportSessionData = Omit<ISessionData, "activityStartTime"> & {
    timeStamp: Date;
};
