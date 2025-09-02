import {
    BleServiceFlag,
    CYCLING_POWER_CHARACTERISTIC,
    CYCLING_POWER_SERVICE,
    CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC,
    CYCLING_SPEED_AND_CADENCE_SERVICE,
    FITNESS_MACHINE_SERVICE,
    ROWER_DATA_CHARACTERISTIC,
} from "../../ble.interfaces";

export function calculateBleServiceFlag(uuid: string | undefined): BleServiceFlag {
    switch (uuid) {
        case BluetoothUUID.getCharacteristic(CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC):
            return BleServiceFlag.CscService;
        case BluetoothUUID.getCharacteristic(CYCLING_POWER_CHARACTERISTIC):
            return BleServiceFlag.CpsService;
        case BluetoothUUID.getCharacteristic(ROWER_DATA_CHARACTERISTIC):
            return BleServiceFlag.FtmsService;
        default:
            return BleServiceFlag.CpsService;
    }
}

export async function getBaseMetricCharacteristic(
    gatt: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
    let characteristic: BluetoothRemoteGATTCharacteristic | undefined = undefined;
    const errorMessages: Array<unknown> = [];
    try {
        characteristic = await (
            await gatt.getPrimaryService(CYCLING_POWER_SERVICE)
        ).getCharacteristic(CYCLING_POWER_CHARACTERISTIC);
    } catch (error) {
        errorMessages?.push(error);
    }

    try {
        characteristic = await (
            await gatt.getPrimaryService(CYCLING_SPEED_AND_CADENCE_SERVICE)
        ).getCharacteristic(CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC);
    } catch (error) {
        errorMessages?.push(error);
    }

    try {
        characteristic = await (
            await gatt.getPrimaryService(FITNESS_MACHINE_SERVICE)
        ).getCharacteristic(ROWER_DATA_CHARACTERISTIC);
    } catch (error) {
        errorMessages?.push(error);
    }

    if (characteristic === undefined) {
        throw errorMessages;
    }

    return characteristic;
}

export async function readDeviceInfo(
    service: BluetoothRemoteGATTService,
    uuid: string,
): Promise<string | undefined> {
    try {
        const deviceInfoCharacteristic = await service.getCharacteristic(uuid);

        return new TextDecoder().decode(await deviceInfoCharacteristic.readValue());
    } catch (e) {
        if (e instanceof Error && !e.name.includes("NotFoundError")) {
            console.error(uuid, e);
        }

        return;
    }
}
