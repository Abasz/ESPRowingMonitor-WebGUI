import { IRowerSettings } from "./common.interfaces";

export interface IRowerData {
    revTime: number;
    distance: number;
    strokeTime: number;
    strokeCount: number;
    avgStrokePower: number;
    driveDuration: number;
    recoveryDuration: number;
    dragFactor: number;
    handleForces: Array<number>;
}

export interface IRowerWebSocketSettings extends Omit<IRowerSettings, "logDeltaTimes"> {
    logToWebSocket: boolean | undefined;
}

export type WebSocketRowerSettings = IRowerSettings & {
    batteryLevel: number;
};

export interface IRowerWebSocketDataDto {
    data: [number, number, number, number, number, number, number, number, Array<number>, Array<number>];
}
