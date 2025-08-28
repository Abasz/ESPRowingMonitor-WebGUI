import {
    CYCLING_POWER_CHARACTERISTIC,
    CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC,
    ROWER_DATA_CHARACTERISTIC,
} from "../../ble.interfaces";
import { IBaseMetrics } from "../../common.interfaces";

export class BaseMetrics {
    private lastDeltaRevTime: number = 0;
    private lastDeltaStrokeTime: number = 0;
    private lastDistance: number = 0;
    private revTime: number = 0;
    private strokeTime: number = 0;
    private lastStrokeCount: number = 0;

    parseMeasurement(uuid: string, value: DataView): IBaseMetrics {
        switch (uuid) {
            case BluetoothUUID.getCharacteristic(CYCLING_POWER_CHARACTERISTIC):
                return this.parseCps(value);

            case BluetoothUUID.getCharacteristic(CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC):
                return this.parseCsc(value);

            case BluetoothUUID.getCharacteristic(ROWER_DATA_CHARACTERISTIC):
                return this.parseFtms(value);

            default:
                return this.parseCps(value);
        }
    }

    private parseCps(value: DataView): IBaseMetrics {
        const revTimeDelta: number =
            value.getUint16(2 + 2 + 4, true) >= this.lastDeltaRevTime
                ? value.getUint16(2 + 2 + 4, true) - this.lastDeltaRevTime
                : 65535 - this.lastDeltaRevTime + value.getUint16(2 + 2 + 4, true);

        this.revTime += Math.round((revTimeDelta / 2048) * 1e6);

        const strokeTimeDelta =
            value.getUint16(2 + 2 + 4 + 2 + 2, true) >= this.lastDeltaStrokeTime
                ? value.getUint16(2 + 2 + 4 + 2 + 2, true) - this.lastDeltaStrokeTime
                : 65535 - this.lastDeltaStrokeTime + value.getUint16(2 + 2 + 4 + 2 + 2, true);

        this.strokeTime += Math.round((strokeTimeDelta / 1024) * 1e6);

        this.lastDeltaRevTime = value.getUint16(2 + 2 + 4, true);
        this.lastDeltaStrokeTime = value.getUint16(2 + 2 + 4 + 2 + 2, true);

        return {
            revTime: this.revTime,
            distance: value.getUint32(2 + 2, true),
            strokeTime: this.strokeTime,
            strokeCount: value.getUint16(2 + 2 + 4 + 2, true),
        };
    }

    private parseCsc(value: DataView): IBaseMetrics {
        const revTimeDelta =
            value.getUint16(1 + 4, true) >= this.lastDeltaRevTime
                ? value.getUint16(1 + 4, true) - this.lastDeltaRevTime
                : 65535 - this.lastDeltaRevTime + value.getUint16(1 + 4, true);
        this.revTime += Math.round((revTimeDelta / 1024) * 1e6);

        const strokeTimeDelta =
            value.getUint16(1 + 4 + 2 + 2, true) >= this.lastDeltaStrokeTime
                ? value.getUint16(1 + 4 + 2 + 2, true) - this.lastDeltaStrokeTime
                : 65535 - this.lastDeltaStrokeTime + value.getUint16(1 + 4 + 2 + 2, true);

        this.strokeTime += Math.round((strokeTimeDelta / 1024) * 1e6);

        this.lastDeltaRevTime = value.getUint16(1 + 4, true);
        this.lastDeltaStrokeTime = value.getUint16(1 + 4 + 2 + 2, true);

        return {
            revTime: this.revTime,
            distance: value.getUint32(1, true),
            strokeTime: this.strokeTime,
            strokeCount: value.getUint16(1 + 4 + 2, true),
        };
    }

    private parseFtms(value: DataView): IBaseMetrics {
        const strokeCount = value.getUint16(2 + 1, true);
        const deltaStrokeTime = (60 / (value.getUint8(2) / 2)) * 1e6 * (strokeCount - this.lastStrokeCount);
        this.strokeTime += deltaStrokeTime;
        this.lastStrokeCount = strokeCount;

        const currentDistance =
            (value.getUint8(2 + 1 + 2) |
                (value.getUint8(2 + 1 + 2 + 1) << 8) |
                (value.getUint8(2 + 1 + 2 + 2) << 16)) *
            100;

        const deltaRevTime =
            (value.getUint16(2 + 1 + 2 + 3, true) / 500) *
            ((currentDistance - this.lastDistance) / 100) *
            1e6;

        this.revTime += deltaRevTime;
        this.lastDistance = currentDistance;

        return {
            revTime: this.revTime,
            distance: currentDistance,
            strokeTime: this.strokeTime,
            strokeCount,
        };
    }
}
