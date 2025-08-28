import { EMPTY, fromEvent, map, Observable, take, takeUntil } from "rxjs";

import { withDelay } from "../utils/utility.functions";

export async function connectToCharacteristic(
    gatt: BluetoothRemoteGATTServer,
    serviceUUID: string,
    characteristicUUID: string,
): Promise<BluetoothRemoteGATTCharacteristic> {
    const primaryService = await withDelay(1000, gatt.getPrimaryService(serviceUUID));
    const characteristic = await primaryService.getCharacteristic(characteristicUUID);

    return characteristic;
}

export function observeValue$(characteristic: BluetoothRemoteGATTCharacteristic): Observable<DataView> {
    if (characteristic.service === undefined) {
        return EMPTY;
    }

    characteristic.startNotifications();
    const disconnected = fromEvent(characteristic.service.device, "gattserverdisconnected").pipe(take(1));

    return fromEvent(characteristic, "characteristicvaluechanged").pipe(
        map(
            (event: Event): DataView => (event.target as BluetoothRemoteGATTCharacteristic).value as DataView,
        ),

        takeUntil(disconnected),
    );
}
