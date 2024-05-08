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

export enum BleServiceFlag {
    CpsService,
    CscService,
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
