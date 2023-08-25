import { Observable } from "rxjs";
import { HeartRateSensor } from "web-ant-plus";

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
    driveDuration: number;
    recoveryDuration: number;
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
    heartRate?: IHeartRate;
}

export interface ISessionData extends IRowerData {
    heartRate?: IHeartRate;
}

export interface IHeartRate {
    heartRate: number;
    contactDetected: boolean;
    rrIntervals?: Array<number>;
    energyExpended?: number;
    batteryLevel?: number;
}

export interface IHeartRateService {
    disconnectDevice(): Promise<void> | void;
    discover$(): Observable<Array<Observable<never> | BluetoothRemoteGATTCharacteristic> | HeartRateSensor>;
    streamHRMonitorBatteryLevel$(): Observable<number | undefined>;
    streamHeartRate$(): Observable<IHeartRate | undefined>;
}

export interface ISupportedVendors {
    vendor: number;
    product: number;
    name: string;
}

export const HEART_RATE_CHARACTERISTIC = "heart_rate_measurement";
export const HEART_RATE_SERVICE = "heart_rate";
export const BATTERY_LEVEL_CHARACTERISTIC = "battery_level";
export const BATTERY_LEVEL_SERVICE = "battery_service";

export interface ServiceOptions<T> {
    characteristic: string;
    service: string;
    decoder(value: DataView): T;
}
export enum BleServiceFlag {
    CpsService,
    CscService,
}

export type HeartRateMonitorMode = "ant" | "ble" | "off";

export class Config {
    heartRateMonitor: HeartRateMonitorMode = "off";
    webSocketAddress: string = `ws://${window.location.host}/ws`;
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
    // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
    Notice = 4,
    Trace = 5,
    Verbose = 6,
}
