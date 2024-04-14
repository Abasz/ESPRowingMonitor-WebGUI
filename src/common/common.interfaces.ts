import { Observable } from "rxjs";

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

export interface IRowerData {
    revTime: number;
    distance: number;
    strokeTime: number;
    strokeCount: number;
    avgStrokePower: number;
    driveDuration: number;
    recoveryDuration: number;
    dragFactor: number;
    handleForces: Array<number>;
}

export interface IExtendedMetrics {
    avgStrokePower: number;
    driveDuration: number;
    recoveryDuration: number;
    dragFactor: number;
}

export interface IBaseMetrics {
    revTime: number;
    distance: number;
    strokeTime: number;
    strokeCount: number;
}

export interface IRowerSettings {
    logDeltaTimes: boolean | undefined;
    logToSdCard: boolean | undefined;
    bleServiceFlag: BleServiceFlag;
    logLevel: LogLevel;
}

export interface IRowerWebSocketSettings extends Omit<IRowerSettings, "logDeltaTimes"> {
    logToWebSocket: boolean | undefined;
}
export type WebSocketRowerSettings = IRowerSettings & {
    batteryLevel: number;
};

export type MetricsStream = [IBaseMetrics, IExtendedMetrics, Array<number>];

export interface IRowerWebSocketDataDto {
    data: [number, number, number, number, number, number, number, number, Array<number>, Array<number>];
}

export interface ICalculatedMetrics extends Omit<IRowerData, "revTime" | "strokeTime"> {
    speed: number;
    strokeRate: number;
    peakForce: number;
    distPerStroke: number;
}

export interface ISessionData extends ICalculatedMetrics {
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
    discover(): Promise<void>;
    reconnect(): Promise<void>;
    streamHRMonitorBatteryLevel$(): Observable<number | undefined>;
    streamHeartRate$(): Observable<IHeartRate | undefined>;
}

export interface IRowerDataService {
    streamDeltaTimes$(): Observable<Array<number>>;
    streamExtended$(): Observable<IExtendedMetrics>;
    streamHandleForces$(): Observable<Array<number>>;
    streamMeasurement$(): Observable<IBaseMetrics>;
    streamMonitorBatteryLevel$(): Observable<number>;
    streamSettings$(): Observable<IRowerSettings>;
    changeBleServiceType(bleService: BleServiceFlag): Promise<void> | void;
    changeDeltaTimeLogging(shouldEnable: boolean): Promise<void> | void;
    changeLogLevel(logLevel: LogLevel): Promise<void> | void;
    changeLogToSdCard(shouldEnable: boolean): Promise<void> | void;
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
export const CYCLING_POWER_SERVICE = "cycling_power";
export const CYCLING_POWER_CHARACTERISTIC = "cycling_power_measurement";
export const CYCLING_POWER_CONTROL_CHARACTERISTIC = "cycling_power_control_point";
export const CYCLING_SPEED_AND_CADENCE_SERVICE = "cycling_speed_and_cadence";
export const CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC = "csc_measurement";
export const CYCLING_SPEED_AND_CADENCE_CONTROL_CHARACTERISTIC = "sc_control_point";
export const SETTINGS_SERVICE = "56892de1-7068-4b5a-acaa-473d97b02206";
export const SETTINGS_CHARACTERISTIC = "54e15528-73b5-4905-9481-89e5184a3364";
export const SETTINGS_CONTROL_POINT = "51ba0a00-8853-477c-bf43-6a09c36aac9f";
export const EXTENDED_METRICS_SERVICE = "a72a5762-803b-421d-a759-f0314153da97";
export const EXTENDED_CHARACTERISTIC = "808a0d51-efae-4f0c-b2e0-48bc180d65c3";
export const HANDLE_FORCES_CHARACTERISTIC = "3d9c2760-cf91-41ee-87e9-fd99d5f129a4";
export const DELTA_TIMES_CHARACTERISTIC = "ae5d11ea-62f6-4789-b809-6fc93fee92b9";

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
    ergoMonitorBleId: string = "";
    heartRateBleId: string = "";
    heartRateMonitor: HeartRateMonitorMode = "off";
    useBluetooth: string = "true";
    webSocketAddress: string = `ws://${window.location.host}/ws`;
}

export type IConfig = Config;

export enum BleOpCodes {
    SetLogLevel = 17,
    ChangeBleService = 18,
    SetDeltaTimeLogging = 19,
    SetSdCardLogging = 20,
}

export enum BleResponseOpCodes {
    Successful = 1,
    UnsupportedOpCode,
    InvalidParameter,
    OperationFailed,
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

/**
 * A WakeLockSentinel provides a handle to a platform wake lock, and it holds on
 * to it until it is either manually released or until the underlying platform
 * wake lock is released. Its existence keeps a platform wake lock for a given
 * wake lock type active, and releasing all WakeLockSentinel instances of a
 * given wake lock type will cause the underlying platform wake lock to be
 * released.
 */
export interface WakeLockSentinel extends EventTarget {
    /** Whether the WakeLockSentinel's handle has been released. */
    readonly released: boolean;
    /** The WakeLockSentinel's wake lock type. */
    readonly type: WakeLockType;
    /** Releases the WakeLockSentinel's lock on the screen. */
    release(): Promise<undefined>;
    /**
     * Called when the WakeLockSentinel's handle is released. Note that the
     * WakeLockSentinel's handle being released does not necessarily mean that
     * the underlying wake lock has been released.
     */
    onrelease: ((this: WakeLockSentinel, ev: Event) => unknown) | null;
}

/**
 * Allows a document to acquire a screen wake lock.
 */
export interface WakeLock {
    /**
     * The request method will attempt to obtain a wake lock, and will return
     * a promise that will resolve with a sentinel to the obtained lock if
     * successful.
     *
     * If unsuccessful, the promise will reject with a "NotAllowedError"
     * DOMException. There are multiple different situations that may cause the
     * request to be unsucessful, including:
     *
     * 1. The _document_ is not allowed to use the wake lock feature.
     * 2. The _user-agent_ denied the specific type of wake lock.
     * 3. The _document_'s browsing context is `null`.
     * 4. The _document_ is not fully active.
     * 5. The _document_ is hidden.
     * 6. The request was aborted.
     *
     * @param type The type of wake lock to be requested.
     */
    request(type: WakeLockType): Promise<WakeLockSentinel>;
}

export type WakeLockType = "screen";

export interface Navigator {
    readonly wakeLock: WakeLock;
}
