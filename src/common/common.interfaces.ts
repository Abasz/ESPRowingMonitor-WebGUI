export interface IValidationErrors {
    [key: string]: Array<{ message: string; validatorKey: string }>;
}

export interface IValidationError {
    message: string;
    validatorKey: string;
}

export interface IMediaQuery {
    0: number;
    1?: "min" | "max";
    2?: "width" | "height";
}

export interface IRowerDataDto {
    batteryLevel: number;
    bleServiceFlag: BleServiceFlag;
    logLevel: LogLevel;
    revTime: number;
    distance: number;
    strokeTime: number;
    strokeCount: number;
    avgStrokePower: number;
    dragFactor: number;
    handleForces: Array<number>;
}
export interface IRowerData extends Omit<IRowerDataDto, "revTime" | "strokeTime"> {
    speed: number;
    strokeRate: number;
    peakForce: number;
    distPerStroke: number;
}

export enum BleServiceFlag {
    CpsService,
    CscService,
}

export class Config {
    webSocketAddress: string = "ws://localhost";
}

export type IConfig = Config;

export enum PSCOpCodes {
    SetLogLevel = 17,
    ChangeBleService = 18,
}

export enum LogLevel {
    Silent = 0,
    Fatal = 1,
    Error = 2,
    Warning = 3,
    Info = 4,
    Notice = 4,
    Trace = 5,
    Verbose = 6,
}
