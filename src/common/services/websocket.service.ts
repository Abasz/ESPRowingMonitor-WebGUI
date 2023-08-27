import { Injectable } from "@angular/core";
import { filter, map, merge, Observable, retry, shareReplay, startWith, Subject, switchMap } from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";

import { BleServiceFlag, Config, IRowerDataDto, LogLevel, PSCOpCodes } from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class WebSocketService {
    private address: string = "";

    private closeSubject: Subject<CloseEvent> = new Subject();
    private data$: Observable<IRowerDataDto | string>;
    private isConnected$: Observable<boolean>;
    private openSubject: Subject<Event> = new Subject();
    private webSocketSubject: WebSocketSubject<IRowerDataDto | string> | undefined;

    constructor(private configManager: ConfigManagerService) {
        this.data$ = this.configManager.config$.pipe(
            filter((config: Config): boolean => config.webSocketAddress !== this.address),
            switchMap((config: Config): Observable<IRowerDataDto | string> => {
                this.address = config.webSocketAddress;
                this.webSocketSubject?.complete();
                const socket: WebSocketSubject<IRowerDataDto | string> = webSocket<IRowerDataDto | string>({
                    url: config.webSocketAddress,
                    openObserver: this.openSubject,
                    closeObserver: this.closeSubject,
                });
                this.webSocketSubject = socket;

                return socket.pipe(retry({ delay: 5000 }));
            }),
            shareReplay(),
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
                PSCOpCodes.ChangeBleService,
                bleService,
            ] as unknown as IRowerDataDto);
        }
    }

    changeLogLevel(logLevel: LogLevel): void {
        if (this.webSocketSubject?.closed === false) {
            this.webSocketSubject?.next([PSCOpCodes.SetLogLevel, logLevel] as unknown as IRowerDataDto);
        }
    }

    connectionStatus(): Observable<boolean> {
        return this.isConnected$;
    }

    data(): Observable<IRowerDataDto> {
        return this.data$ as Observable<IRowerDataDto>;
    }
}
