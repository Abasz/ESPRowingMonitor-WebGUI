import { BehaviorSubject, Observable } from "rxjs";

import { IErgConnectionStatus } from "../../common.interfaces";

export class ErgConnections {
    readonly batteryCharacteristic$: Observable<BluetoothRemoteGATTCharacteristic | undefined>;

    readonly deltaTimesCharacteristic$: Observable<BluetoothRemoteGATTCharacteristic | undefined>;
    readonly extendedCharacteristic$: Observable<BluetoothRemoteGATTCharacteristic | undefined>;
    readonly handleForceCharacteristic$: Observable<BluetoothRemoteGATTCharacteristic | undefined>;

    readonly measurementCharacteristic$: Observable<BluetoothRemoteGATTCharacteristic | undefined>;

    readonly settingsCharacteristic$: Observable<BluetoothRemoteGATTCharacteristic | undefined>;

    protected batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    protected connectionStatusSubject: BehaviorSubject<IErgConnectionStatus> =
        new BehaviorSubject<IErgConnectionStatus>({ status: "disconnected" });

    protected deltaTimesCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);
    protected extendedCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);
    protected handleForceCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    protected measurementCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    protected settingsCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    constructor() {
        this.batteryCharacteristic$ = this.batteryCharacteristic.asObservable();
        this.deltaTimesCharacteristic$ = this.deltaTimesCharacteristic.asObservable();
        this.extendedCharacteristic$ = this.extendedCharacteristic.asObservable();
        this.handleForceCharacteristic$ = this.handleForceCharacteristic.asObservable();
        this.measurementCharacteristic$ = this.measurementCharacteristic.asObservable();
        this.settingsCharacteristic$ = this.settingsCharacteristic.asObservable();
    }

    readBatteryCharacteristic(): BluetoothRemoteGATTCharacteristic | undefined {
        return this.batteryCharacteristic.value;
    }
    readDeltaTimesCharacteristic(): BluetoothRemoteGATTCharacteristic | undefined {
        return this.deltaTimesCharacteristic.value;
    }
    readExtendedCharacteristic(): BluetoothRemoteGATTCharacteristic | undefined {
        return this.extendedCharacteristic.value;
    }
    readHandleForceCharacteristic(): BluetoothRemoteGATTCharacteristic | undefined {
        return this.handleForceCharacteristic.value;
    }
    readMeasurementCharacteristic(): BluetoothRemoteGATTCharacteristic | undefined {
        return this.measurementCharacteristic.value;
    }
    readSettingsCharacteristic(): BluetoothRemoteGATTCharacteristic | undefined {
        return this.settingsCharacteristic.value;
    }

    resetBatteryCharacteristic(): void {
        return this.batteryCharacteristic.next(undefined);
    }
    resetDeltaTimesCharacteristic(): void {
        return this.deltaTimesCharacteristic.next(undefined);
    }
    resetExtendedCharacteristic(): void {
        return this.extendedCharacteristic.next(undefined);
    }
    resetHandleForceCharacteristic(): void {
        return this.handleForceCharacteristic.next(undefined);
    }
    resetMeasurementCharacteristic(): void {
        return this.measurementCharacteristic.next(undefined);
    }
    resetSettingsCharacteristic(): void {
        return this.settingsCharacteristic.next(undefined);
    }
}
