import { Injectable, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatSnackBar } from "@angular/material/snack-bar";
import {
    catchError,
    concatWith,
    defer,
    distinctUntilChanged,
    filter,
    finalize,
    from,
    map,
    Observable,
    of,
    retry,
    shareReplay,
    switchMap,
    timer,
} from "rxjs";

import {
    DEVICE_INFO_SERVICE,
    FIRMWARE_NUMBER_CHARACTERISTIC,
    HARDWARE_REVISION_CHARACTERISTIC,
    IDeviceInformation,
    IOtaCharacteristics,
    MANUFACTURER_NAME_CHARACTERISTIC,
    MODEL_NUMBER_CHARACTERISTIC,
    OTA_RX_CHARACTERISTIC,
    OTA_SERVICE,
    OTA_TX_CHARACTERISTIC,
} from "../../ble.interfaces";
import { withDelay } from "../../utils/utility.functions";
import { observeValue$ } from "../ble.utilities";

import { IErgConnectionStatus } from "./../../common.interfaces";
import { ErgConnectionService } from "./erg-connection.service";
import { readDeviceInfo } from "./erg.utilities";

@Injectable({
    providedIn: "root",
})
export class ErgGenericDataService {
    readonly deviceInfo$: Observable<IDeviceInformation> = this.ergConnectionService.connectionStatus$().pipe(
        map(
            (ergConnectionStatus: IErgConnectionStatus): boolean =>
                ergConnectionStatus.status === "connected",
        ),
        distinctUntilChanged(),
        switchMap(
            (isConnected: boolean): Observable<IDeviceInformation> =>
                isConnected ? from(this.readDeviceInfo()) : of({}),
        ),
        shareReplay(1),
    );
    readonly deviceInfo: Signal<IDeviceInformation> = toSignal(this.deviceInfo$, {
        initialValue: {} as IDeviceInformation,
    });

    constructor(
        private snackBar: MatSnackBar,
        private ergConnectionService: ErgConnectionService,
    ) {}

    async getOtaCharacteristics(): Promise<IOtaCharacteristics> {
        const primaryService =
            await this.ergConnectionService.bluetoothDevice?.gatt?.getPrimaryService(OTA_SERVICE);

        const responseCharacteristic = await primaryService?.getCharacteristic(OTA_TX_CHARACTERISTIC);
        const sendCharacteristic = await primaryService?.getCharacteristic(OTA_RX_CHARACTERISTIC);

        if (responseCharacteristic === undefined || sendCharacteristic === undefined) {
            throw new Error("Not able to connect to OTA service");
        }

        return { responseCharacteristic, sendCharacteristic };
    }

    streamMonitorBatteryLevel$(): Observable<number> {
        return this.ergConnectionService.batteryCharacteristic$.pipe(
            filter(
                (
                    batteryCharacteristic: BluetoothRemoteGATTCharacteristic | undefined,
                ): batteryCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    batteryCharacteristic !== undefined,
            ),
            switchMap(
                (batteryCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<number> =>
                    this.observeBattery$(batteryCharacteristic),
            ),
            retry({
                count: 4,
                delay: (error: Error, count: number): Observable<0> => {
                    const gatt = this.ergConnectionService.readBatteryCharacteristic()?.service.device.gatt;
                    if (gatt && error.message.includes("unknown")) {
                        console.warn(`Battery characteristic error: ${error}; retrying: ${count}`);

                        this.ergConnectionService.connectToBattery(gatt);
                    }

                    return timer(5000);
                },
            }),
            catchError((error: string): Observable<number> => {
                console.error("batteryCharacteristics:", error);
                this.snackBar.open("Error while connecting to battery service", "Dismiss");

                return of(0);
            }),
        );
    }

    private observeBattery$(batteryCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<number> {
        return from(batteryCharacteristic.readValue()).pipe(
            concatWith(
                defer((): Observable<DataView<ArrayBufferLike>> => observeValue$(batteryCharacteristic)),
            ),
            map((value: DataView): number => value.getUint8(0)),
            finalize((): void => {
                this.ergConnectionService.resetBatteryCharacteristic();
            }),
        );
    }

    private async readDeviceInfo(): Promise<IDeviceInformation> {
        const deviceInfo: IDeviceInformation = {};

        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return deviceInfo;
        }

        try {
            const service = await withDelay(
                1000,
                this.ergConnectionService.bluetoothDevice.gatt.getPrimaryService(DEVICE_INFO_SERVICE),
            );

            deviceInfo.modelNumber = await readDeviceInfo(service, MODEL_NUMBER_CHARACTERISTIC);
            deviceInfo.firmwareNumber = await readDeviceInfo(service, FIRMWARE_NUMBER_CHARACTERISTIC);
            deviceInfo.manufacturerName = await readDeviceInfo(service, MANUFACTURER_NAME_CHARACTERISTIC);
            deviceInfo.hardwareRevision = await readDeviceInfo(service, HARDWARE_REVISION_CHARACTERISTIC);
        } catch (error) {
            if (error instanceof Error) {
                this.snackBar.open(error.message, "Dismiss");
            }
            console.error("readDeviceInfo:", error);
        }

        return deviceInfo;
    }
}
