import { vi } from "vitest";

export function stubBluetooth(): void {
    if (Object.hasOwn(navigator, "bluetooth") === false) {
        navigator.bluetooth = {} as Bluetooth;

        vi.stubGlobal("BluetoothUUID", {
            getCharacteristic: (uuid: BluetoothCharacteristicUUID): string => uuid.toString(),
        });
    }
}

stubBluetooth();
