import { Injectable } from "@angular/core";
import { filter, map, merge, Observable, retry, shareReplay, startWith, Subject, switchMap } from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";

import {
    BleOpCodes,
    BleServiceFlag,
    IBaseMetrics,
    IExtendedMetrics,
    IRowerData,
    IRowerDataService,
    IRowerSettings,
    IRowerWebSocketDataDto,
    IRowerWebSocketSettings,
    LogLevel,
    WebSocketRowerSettings,
} from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class WebSocketService implements IRowerDataService {
    private closeSubject: Subject<CloseEvent> = new Subject();
    private data$: Observable<IRowerData | WebSocketRowerSettings>;
    private isConnected$: Observable<boolean>;
    private openSubject: Subject<Event> = new Subject();
    private webSocketSubject: WebSocketSubject<IRowerWebSocketDataDto | IRowerWebSocketSettings> | undefined;

    constructor(private configManager: ConfigManagerService) {
        this.data$ = this.configManager.websocketAddressChanged$.pipe(
            switchMap((webSocketAddress: string): Observable<IRowerData | WebSocketRowerSettings> => {
                this.webSocketSubject?.complete();
                const socket: WebSocketSubject<IRowerWebSocketDataDto | IRowerWebSocketSettings> = webSocket<
                    IRowerWebSocketDataDto | IRowerWebSocketSettings
                >({
                    url: webSocketAddress,
                    openObserver: this.openSubject,
                    closeObserver: this.closeSubject,
                    binaryType: "arraybuffer",
                    deserializer: (
                        msg: MessageEvent<string | ArrayBuffer>,
                    ): IRowerWebSocketDataDto | IRowerWebSocketSettings =>
                        ({
                            ...JSON.parse(new TextDecoder().decode(msg.data as ArrayBuffer)),
                        }) as IRowerWebSocketDataDto | IRowerWebSocketSettings,
                });
                this.webSocketSubject = socket;

                return socket.pipe(
                    map(
                        (
                            rawData: IRowerWebSocketDataDto | IRowerWebSocketSettings,
                        ): IRowerData | WebSocketRowerSettings => {
                            if ("logToWebSocket" in rawData && "batteryLevel" in rawData) {
                                return {
                                    logDeltaTimes: rawData.logToWebSocket,
                                    logToSdCard: rawData.logToSdCard,
                                    bleServiceFlag: rawData.bleServiceFlag,
                                    logLevel: rawData.logLevel,
                                    batteryLevel: rawData.batteryLevel,
                                } as IRowerSettings & { batteryLevel: number };
                            }
                            const { data }: IRowerWebSocketDataDto = rawData as IRowerWebSocketDataDto;

                            return {
                                revTime: data[0],
                                distance: data[1],
                                strokeTime: data[2],
                                strokeCount: data[3],
                                avgStrokePower: data[4],
                                driveDuration: data[5],
                                recoveryDuration: data[6],
                                dragFactor: data[7],
                                handleForces: data[8],
                                deltaTimes: data[9],
                            } as unknown as IRowerData;
                        },
                    ),
                    retry({ delay: 5000 }),
                );
            }),
            startWith({
                logDeltaTimes: undefined,
                logToSdCard: undefined,
                logLevel: 0,
                bleServiceFlag: BleServiceFlag.CpsService,
                batteryLevel: 0,
            }),
            shareReplay({ refCount: true }),
        );

        this.isConnected$ = merge(this.closeSubject, this.openSubject).pipe(
            map((event: Event | CloseEvent): boolean => {
                if (event instanceof CloseEvent) {
                    return false;
                }

                return true;
            }),
            startWith(false),
        );
    }

    changeBleServiceType(bleService: BleServiceFlag): void {
        if (this.webSocketSubject?.closed === false) {
            this.webSocketSubject?.next([
                BleOpCodes.ChangeBleService,
                bleService,
            ] as unknown as IRowerWebSocketDataDto);
        }
    }

    changeDeltaTimeLogging(shouldEnable: boolean): void {
        if (this.webSocketSubject?.closed === false) {
            this.webSocketSubject?.next([
                BleOpCodes.SetDeltaTimeLogging,
                shouldEnable ? 1 : 0,
            ] as unknown as IRowerWebSocketDataDto);
        }
    }

    changeLogLevel(logLevel: LogLevel): void {
        if (this.webSocketSubject?.closed === false) {
            this.webSocketSubject?.next([
                BleOpCodes.SetLogLevel,
                logLevel,
            ] as unknown as IRowerWebSocketDataDto);
        }
    }

    changeLogToSdCard(shouldEnable: boolean): void {
        if (this.webSocketSubject?.closed === false) {
            this.webSocketSubject?.next([
                BleOpCodes.SetSdCardLogging,
                shouldEnable ? 1 : 0,
            ] as unknown as IRowerWebSocketDataDto);
        }
    }

    connectionStatus(): Observable<boolean> {
        return this.isConnected$;
    }

    streamDeltaTimes$(): Observable<Array<number>> {
        return this.data$.pipe(
            filter((data: IRowerData | IRowerSettings): data is IRowerData => "deltaTimes" in data),
            map(
                (data: IRowerData): Array<number> =>
                    (data as unknown as IRowerData & { deltaTimes: Array<number> }).deltaTimes,
            ),
        );
    }

    streamExtended$(): Observable<IExtendedMetrics> {
        return this.data$.pipe(
            filter((data: IRowerData | IRowerSettings): data is IRowerData => "avgStrokePower" in data),
            map(
                (data: IRowerData): IExtendedMetrics => ({
                    avgStrokePower: data.avgStrokePower,
                    dragFactor: data.dragFactor,
                    driveDuration: data.driveDuration,
                    recoveryDuration: data.recoveryDuration,
                }),
            ),
            startWith({
                avgStrokePower: 0,
                dragFactor: 0,
                driveDuration: 0,
                recoveryDuration: 0,
            }),
        );
    }

    streamHandleForces$(): Observable<Array<number>> {
        return this.data$.pipe(
            filter((data: IRowerData | IRowerSettings): data is IRowerData => "avgStrokePower" in data),
            map((data: IRowerData): Array<number> => data.handleForces),
            startWith([]),
        );
    }

    streamMeasurement$(): Observable<IBaseMetrics> {
        return this.data$.pipe(
            filter((data: IRowerData | IRowerSettings): data is IRowerData => "avgStrokePower" in data),
            map(
                (data: IRowerData): IBaseMetrics => ({
                    distance: data.distance,
                    revTime: data.revTime,
                    strokeCount: data.strokeCount,
                    strokeTime: data.strokeTime,
                }),
            ),

            startWith({
                distance: 0,
                revTime: 0,
                strokeCount: 0,
                strokeTime: 0,
            }),
        );
    }

    streamMonitorBatteryLevel$(): Observable<number> {
        return this.data$.pipe(
            filter(
                (data: IRowerData | WebSocketRowerSettings): data is WebSocketRowerSettings =>
                    "batteryLevel" in data,
            ),
            map(({ batteryLevel }: WebSocketRowerSettings): number => batteryLevel),
        );
    }

    streamSettings$(): Observable<IRowerSettings> {
        return this.data$.pipe(
            filter((data: IRowerData | IRowerSettings): data is IRowerSettings => "logDeltaTimes" in data),
        );
    }
}
