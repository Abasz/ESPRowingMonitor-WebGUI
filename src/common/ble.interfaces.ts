export enum BleOpCodes {
    SetLogLevel = 17,
    ChangeBleService = 18,
    SetDeltaTimeLogging = 19,
    SetSdCardLogging = 20,
    SetMachineSettings = 21,
    SetSensorSignalSettings = 22,
    SetDragFactorSettings = 23,
    SetStrokeDetectionSettings = 24,
    RestartDevice = 31,
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
    FtmsService,
}

export const BleServiceNames: { [key: string]: string } = {
    CpsService: "Cycling Power",
    CscService: "Cycling Speed and Cadence",
    FtmsService: "Fitness Machine",
};

export interface IOtaCharacteristics {
    responseCharacteristic: BluetoothRemoteGATTCharacteristic;
    sendCharacteristic: BluetoothRemoteGATTCharacteristic;
}

export interface IOtaBeginResponse {
    attr: number;
    buffer: number;
}

export enum OtaResponseOpCodes {
    Ok,
    NotOk,
    IncorrectFormat,
    IncorrectFirmwareSize,
    ChecksumError,
    InternalStorageError,
    TimeOut,
}

export class OtaError extends Error {
    constructor(name: string, message?: string) {
        super(message ?? "OTA error occurred");
        this.name = name;
    }
}

export enum OtaRequestOpCodes {
    Begin,
    Package,
    End,
    Abort,
}

export interface IDeviceInformation {
    modelNumber?: string;
    firmwareNumber?: string;
    manufacturerName?: string;
    hardwareRevision?: string;
}

export const HEART_RATE_CHARACTERISTIC = "00002a37-0000-1000-8000-00805f9b34fb";
export const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
export const BATTERY_LEVEL_CHARACTERISTIC = "00002a19-0000-1000-8000-00805f9b34fb";
export const BATTERY_LEVEL_SERVICE = "0000180f-0000-1000-8000-00805f9b34fb";
export const CYCLING_POWER_SERVICE = "00001818-0000-1000-8000-00805f9b34fb";
export const CYCLING_POWER_CHARACTERISTIC = "00002a63-0000-1000-8000-00805f9b34fb";
export const CYCLING_POWER_CONTROL_CHARACTERISTIC = "00002a66-0000-1000-8000-00805f9b34fb";
export const CYCLING_SPEED_AND_CADENCE_SERVICE = "00001816-0000-1000-8000-00805f9b34fb";
export const CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC = "00002a5b-0000-1000-8000-00805f9b34fb";
export const FITNESS_MACHINE_SERVICE = "00001826-0000-1000-8000-00805f9b34fb";
export const ROWER_DATA_CHARACTERISTIC = "00002ad1-0000-1000-8000-00805f9b34fb";
export const FITNESS_MACHINE_CONTROL_CHARACTERISTIC = "00002ad9-0000-1000-8000-00805f9b34fb";
export const DEVICE_INFO_SERVICE = "0000180a-0000-1000-8000-00805f9b34fb";
export const MODEL_NUMBER_CHARACTERISTIC = "00002a24-0000-1000-8000-00805f9b34fb";
export const FIRMWARE_NUMBER_CHARACTERISTIC = "00002a26-0000-1000-8000-00805f9b34fb";
export const MANUFACTURER_NAME_CHARACTERISTIC = "00002a29-0000-1000-8000-00805f9b34fb";
export const HARDWARE_REVISION_CHARACTERISTIC = "00002a27-0000-1000-8000-00805f9b34fb";
export const SETTINGS_SERVICE = "56892de1-7068-4b5a-acaa-473d97b02206";
export const SETTINGS_CHARACTERISTIC = "54e15528-73b5-4905-9481-89e5184a3364";
export const SETTINGS_CONTROL_POINT = "51ba0a00-8853-477c-bf43-6a09c36aac9f";
export const STROKE_SETTINGS_CHARACTERISTIC = "5d9c04cd-dcec-4551-8169-8c81f14d9d9d";
export const EXTENDED_METRICS_SERVICE = "a72a5762-803b-421d-a759-f0314153da97";
export const EXTENDED_CHARACTERISTIC = "808a0d51-efae-4f0c-b2e0-48bc180d65c3";
export const HANDLE_FORCES_CHARACTERISTIC = "3d9c2760-cf91-41ee-87e9-fd99d5f129a4";
export const DELTA_TIMES_CHARACTERISTIC = "ae5d11ea-62f6-4789-b809-6fc93fee92b9";

export const OTA_SERVICE = "ed249319-32c3-4e9f-83d7-7bb5aa5d5d4b";
export const OTA_RX_CHARACTERISTIC = "fbac1540-698b-40ff-a34e-f39e5b78d1cf";
export const OTA_TX_CHARACTERISTIC = "b31126a7-a29b-450a-b0c2-c0516f46b699";
