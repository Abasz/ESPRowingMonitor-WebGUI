import { Injectable } from "@angular/core";
import { map, merge, Observable, retry, shareReplay, startWith, Subject, switchMap } from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";

import { BleServiceFlag, IRowerDataDto, IRowerSettings, LogLevel, BleOpCodes } from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class WebSocketService {
    private closeSubject: Subject<CloseEvent> = new Subject();
    private data$: Observable<IRowerDataDto | IRowerSettings>;
    private isConnected$: Observable<boolean>;
    private openSubject: Subject<Event> = new Subject();
    private webSocketSubject: WebSocketSubject<IRowerDataDto | IRowerSettings> | undefined;

    constructor(private configManager: ConfigManagerService) {
        this.data$ = this.configManager.websocketAddressChanged$.pipe(
            switchMap((webSocketAddress: string): Observable<IRowerDataDto | IRowerSettings> => {
                this.webSocketSubject?.complete();
                const socket: WebSocketSubject<IRowerDataDto | IRowerSettings> = webSocket<
                    IRowerDataDto | IRowerSettings
                >({
                    url: webSocketAddress,
                    openObserver: this.openSubject,
                    closeObserver: this.closeSubject,
                    binaryType: "arraybuffer",
                    deserializer: (msg: MessageEvent<string | ArrayBuffer>): IRowerDataDto | IRowerSettings =>
                        ({
                            ...JSON.parse(new TextDecoder().decode(msg.data as ArrayBuffer)),
                            timeStamp: new Date(),
                        }) as IRowerDataDto | IRowerSettings,
                });
                this.webSocketSubject = socket;

                return socket.pipe(retry({ delay: 5000 }));
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
            ] as unknown as IRowerDataDto);
        }
    }

    changeLogLevel(logLevel: LogLevel): void {
        if (this.webSocketSubject?.closed === false) {
            this.webSocketSubject?.next([BleOpCodes.SetLogLevel, logLevel] as unknown as IRowerDataDto);
        }
    }

    changeLogToSdCard(shouldEnable: boolean): void {
        if (this.webSocketSubject?.closed === false) {
            this.webSocketSubject?.next([
                BleOpCodes.SetSdCardLogging,
                shouldEnable ? 1 : 0,
            ] as unknown as IRowerDataDto);
        }
    }

    changeLogToWebSocket(shouldEnable: boolean): void {
        if (this.webSocketSubject?.closed === false) {
            this.webSocketSubject?.next([
                BleOpCodes.SetWebSocketDeltaTimeLogging,
                shouldEnable ? 1 : 0,
            ] as unknown as IRowerDataDto);
        }
    }

    connectionStatus(): Observable<boolean> {
        return this.isConnected$;
    }

    data(): Observable<IRowerDataDto | IRowerSettings> {
        return this.data$;
    }
}
