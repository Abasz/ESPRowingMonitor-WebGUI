import { Observable } from "rxjs";

import {
    DEFAULT_LANDSCAPE_LAYOUT,
    DEFAULT_PORTRAIT_LAYOUT,
} from "../app/dashboard/dashboard-tile-definitions";
import { PlacedDashboardTile } from "../app/dashboard/dashboard.interfaces";

import { BleServiceFlag, LogLevel } from "./ble.interfaces";

// general

export interface IMigrationProgress {
    /** Number of records processed so far. */
    processed: number;
    /** Total number of records needing migration. 0 while counting. */
    total: number;
    /** Timestamp (ms) when processing started; 0 until the first record is processed. */
    startedAt: number;
}

export interface FirmwareAsset {
    profileName: string;
    profileId: string;
    hardwareRevision?: string;
    fileName: string;
    size: number;
}

export interface FirmwareRelease {
    version: string;
    name: string;
    publishedAt: string;
    updatedAt: string;
    assets: Array<FirmwareAsset>;
}

export interface VersionInfo {
    timeStamp: string;
    latestFirmwareRelease: FirmwareRelease;
}

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

// configuration

export type HeartRateMonitorMode = "ant" | "ble" | "off";
export type UnitSystem = "metric" | "imperial";
export type AutoSessionMode = "off" | "autoStart" | "autoStartAndPause";
export type AutoLapMode = "off" | "distance" | "time";

export interface IGeneralDeviceConfig {
    ergoMonitorBleId: string;
    heartRateBleId: string;
    heartRateMonitor: HeartRateMonitorMode;
}

export interface IGeneralSessionConfig {
    autoSession: AutoSessionMode;
    autoLap: AutoLapMode;
    autoLapValue: number;
}

export interface IIntervalsIcuConfig {
    apiKey: string;
    athleteId: string;
    autoUploadEnabled: boolean;
}

export interface IGeneralConfig {
    device: IGeneralDeviceConfig;
    session: IGeneralSessionConfig;
    intervalsIcu: IIntervalsIcuConfig;
}

export interface IDisplayGeneralConfig {
    unitSystem: UnitSystem;
}

/**
 * The full layout config passed to / emitted from the tile layout editor.
 */
export interface IDashboardLayoutConfig {
    tiles: Array<PlacedDashboardTile>;
}

export type OrientationLock = "landscape" | "portrait" | "auto";

/**
 * Contains per-orientation layouts and the user's orientation lock preference.
 */
export interface IDisplayLayoutConfig {
    landscape: IDashboardLayoutConfig;
    portrait: IDashboardLayoutConfig;
    orientationLock: OrientationLock;
}

export interface IDisplayForceCurveConfig {
    showPeakForceInTitle: boolean;
    showGridLines: boolean;
    showAxisLabels: boolean;
}

export type AveragingMode = "off" | "all" | "performance";

export interface IDisplayAveragingConfig {
    mode: AveragingMode;
    windowSize: number;
}

export interface IDisplayConfig {
    general: IDisplayGeneralConfig;
    forceCurve: IDisplayForceCurveConfig;
    layout: IDisplayLayoutConfig;
    averaging: IDisplayAveragingConfig;
}

export class Config {
    general: IGeneralConfig = {
        device: {
            ergoMonitorBleId: "",
            heartRateBleId: "",
            heartRateMonitor: "off",
        },
        session: {
            autoSession: "autoStart",
            autoLap: "off",
            autoLapValue: 500,
        },
        intervalsIcu: {
            apiKey: "",
            athleteId: "",
            autoUploadEnabled: false,
        },
    };

    display: IDisplayConfig = {
        general: {
            unitSystem: "metric",
        },
        forceCurve: {
            showPeakForceInTitle: true,
            showGridLines: true,
            showAxisLabels: true,
        },
        layout: {
            landscape: DEFAULT_LANDSCAPE_LAYOUT,
            portrait: DEFAULT_PORTRAIT_LAYOUT,
            orientationLock: "auto",
        },
        averaging: {
            mode: "off",
            windowSize: 3,
        },
    };
}

// metrics and connection

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

export interface ICalculatedMetrics extends Omit<IExtendedMetrics & IBaseMetrics, "revTime" | "strokeTime"> {
    speed: number;
    strokeRate: number;
    peakForce: number;
    peakForcePositionNorm: number;
    distPerStroke: number;
    driveLength: number;
    handleForces: Array<number>;
    totalWork: number;
}

export type SessionState = "running" | "paused" | "stopped";

export interface IRawCalculatedMetrics extends Omit<
    ICalculatedMetrics,
    "distance" | "strokeCount" | "totalWork"
> {
    rawDistance: number;
    rawStrokeCount: number;
}

export interface ISessionData extends ICalculatedMetrics {
    elapsedTime: number;
    heartRate?: IHeartRate;
}

export interface ISessionSummary {
    sessionId: number;
    deviceName?: string;
    startTime: number;
    finishTime: number;
    elapsedTime: number;
    distance: number;
    strokeCount: number;
}

export interface ILogbookDialogData {
    summaries: Array<ISessionSummary>;
    uploadedSessionIds: Array<number>;
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

// rower settings

export interface IGeneralSettings {
    logDeltaTimes: boolean | undefined;
    logToSdCard: boolean | undefined;
    bleServiceFlag: BleServiceFlag;
    logLevel: LogLevel;
    isRuntimeSettingsEnabled: boolean | undefined;
    isCompiledWithDouble: boolean | undefined;
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
    /**
     * @deprecated This setting is deprecated and only used for firmware versions prior to ESPRM v7.0.0.
     * New firmware omits this property. For legacy firmware, only value 0 is allowed.
     */
    minimumRecoverySlopeMargin?: number;
    minimumRecoverySlope: number;
    minimumRecoveryTime: number;
    minimumDriveTime: number;
    driveHandleForcesMaxCapacity: number;
}

export interface IRowerSettings {
    generalSettings: IGeneralSettings;
    rowingSettings: IRowingProfileSettings;
}

export interface IRowingProfileSettings {
    machineSettings: IMachineSettings;
    sensorSignalSettings: ISensorSignalSettings;
    dragFactorSettings: IDragFactorSettings;
    strokeDetectionSettings: Omit<IStrokeDetectionSettings, "isCompiledWithDouble">;
}

export interface ProfileData {
    name: string;
    profileId: string;
    settings: IRowingProfileSettings;
}

export enum StrokeDetectionType {
    Torque = 0,
    Slope = 1,
    Both = 2,
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
