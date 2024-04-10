import { Injectable } from "@angular/core";
import { filter, map, merge, Observable, retry, shareReplay, startWith, Subject, switchMap } from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";

import {
    BleOpCodes,
    BleServiceFlag,
    IRowerDataDto,
    IRowerSettings,
    IRowerWebSocketDataDto,
    IRowerWebSocketSettings,
    LogLevel,
} from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class WebSocketService {
    private closeSubject: Subject<CloseEvent> = new Subject();
    private data$: Observable<IRowerDataDto | IRowerSettings>;
    private deltaTimes$: Observable<Array<number>>;
    private isConnected$: Observable<boolean>;
    private openSubject: Subject<Event> = new Subject();
    private webSocketSubject: WebSocketSubject<IRowerWebSocketDataDto | IRowerWebSocketSettings> | undefined;

    constructor(private configManager: ConfigManagerService) {
        this.data$ = this.configManager.websocketAddressChanged$.pipe(
            switchMap((webSocketAddress: string): Observable<IRowerDataDto | IRowerSettings> => {
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
                            timeStamp: new Date(),
                        }) as IRowerWebSocketDataDto | IRowerWebSocketSettings,
                });
                this.webSocketSubject = socket;

                return socket.pipe(
                    map(
                        (
                            data: IRowerWebSocketDataDto | IRowerWebSocketSettings,
                        ): IRowerDataDto | IRowerSettings => {
                            if ("logToWebSocket" in data) {
                                return {
                                    timeStamp: data.timeStamp,
                                    logDeltaTimes: data.logToWebSocket,
                                    logToSdCard: data.logToSdCard,
                                    bleServiceFlag: data.bleServiceFlag,
                                    logLevel: data.logLevel,
                                    batteryLevel: data.batteryLevel,
                                } as IRowerSettings;
                            }

                            return data as unknown as IRowerDataDto;
                        },
                    ),
                    retry({ delay: 5000 }),
                );
            }),
            shareReplay({ refCount: true }),
        );

        this.deltaTimes$ = (
            this.data$ as unknown as Observable<IRowerWebSocketDataDto | IRowerSettings>
        ).pipe(
            filter(
                (data: IRowerWebSocketDataDto | IRowerSettings): data is IRowerWebSocketDataDto =>
                    "data" in data,
            ),
            map(({ data }: IRowerWebSocketDataDto): Array<number> => data[9]),
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

    data(): Observable<IRowerDataDto | IRowerSettings> {
        return this.data$;
    }

    streamDeltaTimes$(): Observable<Array<number>> {
        return this.deltaTimes$;
    }
}
