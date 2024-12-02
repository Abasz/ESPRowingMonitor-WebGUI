import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import {
    catchError,
    concat,
    filter,
    finalize,
    from,
    map,
    Observable,
    of,
    retry,
    switchMap,
    timer,
} from "rxjs";

import {
    DEVICE_INFO_SERVICE,
    FIRMWARE_NUMBER_CHARACTERISTIC,
    IDeviceInformation,
    IOtaCharacteristics,
    MANUFACTURER_NAME_CHARACTERISTIC,
    MODEL_NUMBER_CHARACTERISTIC,
    OTA_RX_CHARACTERISTIC,
    OTA_SERVICE,
    OTA_TX_CHARACTERISTIC,
} from "../../ble.interfaces";
import { observeValue$ } from "../ble.utilities";

import { ErgConnectionService } from "./erg-connection.service";
import { readDeviceInfo } from "./erg.utilities";

@Injectable({
    providedIn: "root",
})
export class ErgGenericDataService {
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

    async readDeviceInfo(): Promise<IDeviceInformation> {
        const deviceInfo: IDeviceInformation = {};

        if (this.ergConnectionService.bluetoothDevice?.gatt === undefined) {
            this.snackBar.open("Ergometer Monitor is not connected", "Dismiss");

            return deviceInfo;
        }

        try {
            const service =
                await this.ergConnectionService.bluetoothDevice.gatt.getPrimaryService(DEVICE_INFO_SERVICE);

            deviceInfo.modelNumber = await readDeviceInfo(service, MODEL_NUMBER_CHARACTERISTIC);
            deviceInfo.firmwareNumber = await readDeviceInfo(service, FIRMWARE_NUMBER_CHARACTERISTIC);
            deviceInfo.manufacturerName = await readDeviceInfo(service, MANUFACTURER_NAME_CHARACTERISTIC);
        } catch (error) {
            if (error instanceof Error) {
                this.snackBar.open(error.message, "Dismiss");
            }
            console.error("readDeviceInfo:", error);
        }

        return deviceInfo;
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
        return concat(from(batteryCharacteristic.readValue()), observeValue$(batteryCharacteristic)).pipe(
            map((value: DataView): number => value.getInt8(0)),
            finalize((): void => {
                this.ergConnectionService.resetBatteryCharacteristic();
            }),
        );
    }
}
