import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { EMPTY, Observable, of, shareReplay, startWith, switchMap } from "rxjs";

import { HeartRateMonitorMode, IHeartRate } from "../common.interfaces";

import { AntHeartRateService } from "./ant-heart-rate.service";
import { BLEHeartRateService } from "./ble-heart-rate.service";
import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class HeartRateService {
    constructor(
        private configManager: ConfigManagerService,
        private ble: BLEHeartRateService,
        private ant: AntHeartRateService,
        private snack: MatSnackBar,
    ) {}

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

    streamHeartRate(): Observable<IHeartRate | undefined> {
        if (!isSecureContext) {
            this.snack.open("Heart Rate features are not available, refer to documentation", "Dismiss");

            return EMPTY.pipe(startWith(undefined), shareReplay());
        }

        return this.configManager.heartRateMonitorChanged$.pipe(
            switchMap((heartRateMonitorMode: HeartRateMonitorMode): Observable<IHeartRate | undefined> => {
                switch (heartRateMonitorMode) {
                    case "ble":
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
            shareReplay(),
        );
    }
}
