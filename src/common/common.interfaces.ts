import { Observable } from "rxjs";

import { BleServiceFlag, LogLevel } from "./ble.interfaces";

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

export type HeartRateMonitorMode = "ant" | "ble" | "off";
export type IConfig = Config;

export class Config {
    ergoMonitorBleId: string = "";
    heartRateBleId: string = "";
    heartRateMonitor: HeartRateMonitorMode = "off";
}

type BleConnectionStatus = "disconnected" | "connected" | "connecting" | "searching";

export interface IErgConnectionStatus {
    deviceName?: string;
    status: BleConnectionStatus;
}

export interface IHRConnectionStatus {
    deviceName?: string;
    status: BleConnectionStatus;
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
    isRuntimeSettingsEnabled: boolean;
    machineSettings: IMachineSettings;
    sensorSignalSettings: ISensorSignalSettings;
    dragFactorSettings: IDragFactorSettings;
}

export interface RowingProfileSettings {
    machineSettings: IMachineSettings;
    sensorSignalSettings: ISensorSignalSettings;
    dragFactorSettings: IDragFactorSettings;
    strokeDetectionSettings: Omit<IStrokeDetectionSettings, "isCompiledWithDouble">;
}

export interface IMachineSettings {
    flywheelInertia: number;
    magicConstant: number;
    sprocketRadius: number;
    impulsePerRevolution: number;
}

export interface ISensorSignalSettings {
    rotationDebounceTime: number;
    rowingStoppedThreshold: number;
}

export interface IDragFactorSettings {
    goodnessOfFitThreshold: number;
    maxDragFactorRecoveryPeriod: number;
    dragFactorLowerThreshold: number;
    dragFactorUpperThreshold: number;
    dragCoefficientsArrayLength: number;
}

export interface IStrokeDetectionSettings {
    strokeDetectionType: StrokeDetectionType;
    impulseDataArrayLength: number;
    minimumPoweredTorque: number;
    minimumDragTorque: number;
    minimumRecoverySlopeMargin: number;
    minimumRecoverySlope: number;
    minimumRecoveryTime: number;
    minimumDriveTime: number;
    driveHandleForcesMaxCapacity: number;
    isCompiledWithDouble: boolean;
}

export enum StrokeDetectionType {
    Torque = 0,
    Slope = 1,
    Both = 2,
}

export interface ICalculatedMetrics extends Omit<IExtendedMetrics & IBaseMetrics, "revTime" | "strokeTime"> {
    activityStartTime: Date;
    speed: number;
    strokeRate: number;
    peakForce: number;
    distPerStroke: number;
    handleForces: Array<number>;
}

export interface ISessionData extends ICalculatedMetrics {
    heartRate?: IHeartRate;
}

export interface ISessionSummary {
    sessionId: number;
    deviceName?: string;
    startTime: number;
    finishTime: number;
    distance: number;
    strokeCount: number;
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
