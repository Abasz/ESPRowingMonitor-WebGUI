import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { EMPTY, Observable, of, shareReplay, startWith, switchMap } from "rxjs";

import { HeartRateMonitorMode, IHeartRate, IHRConnectionStatus } from "../../common.interfaces";
import { ConfigManagerService } from "../config-manager.service";

import { AntHeartRateService } from "./ant-heart-rate.service";
import { BLEHeartRateService } from "./ble-heart-rate.service";

@Injectable({
    providedIn: "root",
})
export class HeartRateService {
    readonly isBleAvailable: boolean = isSecureContext === true && navigator.bluetooth !== undefined;
    constructor(
        private configManager: ConfigManagerService,
        private ble: BLEHeartRateService,
        private ant: AntHeartRateService,
        private snack: MatSnackBar,
    ) {}

    connectionStatus$(): Observable<IHRConnectionStatus> {
        if (!this.isBleAvailable) {
            this.snack.open("Heart Rate features are not available, refer to documentation", "Dismiss");

            return EMPTY.pipe(startWith({ status: "disconnected" } as IHRConnectionStatus));
        }

        return this.configManager.heartRateMonitorChanged$.pipe(
            switchMap((heartRateMonitorMode: HeartRateMonitorMode): Observable<IHRConnectionStatus> => {
                switch (heartRateMonitorMode) {
                    case "ble":
                        return this.ble.connectionStatus$();
                    case "ant":
                        return this.ant.connectionStatus$();
                    default:
                        return of({ status: "disconnected" });
                }
            }),
            startWith({ status: "disconnected" } as IHRConnectionStatus),
            shareReplay(1),
        );
    }

    async discover(): Promise<void> {
        switch (this.configManager.getConfig().heartRateMonitor) {
            case "ble":
                return await this.ble.discover();
            case "ant":
                return await this.ant.discover();
            default:
                return;
        }
    }

    streamHeartRate$(): Observable<IHeartRate | undefined> {
        if (!this.isBleAvailable) {
            this.snack.open("Heart Rate features are not available, refer to documentation", "Dismiss");

            return EMPTY.pipe(startWith(undefined));
        }

        return this.configManager.heartRateMonitorChanged$.pipe(
            switchMap((heartRateMonitorMode: HeartRateMonitorMode): Observable<IHeartRate | undefined> => {
                switch (heartRateMonitorMode) {
                    case "ble":
                        if (navigator.bluetooth === undefined) {
                            return EMPTY.pipe(startWith(undefined));
                        }

                        this.ant.disconnectDevice();
                        this.ble.reconnect();

                        return this.ble.streamHeartRate$();
                    case "ant":
                        this.ble.disconnectDevice();
                        this.ant.reconnect();

                        return this.ant.streamHeartRate$();
                    default:
                        this.ant.disconnectDevice();
                        this.ble.disconnectDevice();

                        return of(undefined);
                }
            }),
            startWith(undefined),
            shareReplay(1),
        );
    }
}
