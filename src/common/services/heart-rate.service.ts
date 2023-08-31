import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { EMPTY, filter, Observable, of, shareReplay, startWith, switchMap } from "rxjs";

import { Config, HeartRateMonitorMode, IHeartRate } from "../common.interfaces";

import { AntHeartRateService } from "./ant-heart-rate.service";
import { BLEHeartRateService } from "./ble-heart-rate.service";
import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class HeartRateService {
    private heartRateMonitor: HeartRateMonitorMode = "off";

    constructor(
        private configManager: ConfigManagerService,
        private ble: BLEHeartRateService,
        private ant: AntHeartRateService,
        private snack: MatSnackBar,
    ) {}

    async discover(): Promise<void> {
        this.ble.disconnectDevice();

        switch (this.configManager.getConfig().heartRateMonitor) {
            case "ble":
                this.ble.discover$().subscribe();
                break;
            case "ant":
                return await this.ant.discover();
            default:
                return;
        }
    }

    streamHeartRate(): Observable<IHeartRate | undefined> {
        if (!isSecureContext) {
            this.snack.open("Heart Rate features are not available, refer to documentation", "Dismiss");

            return EMPTY;
        }

        return this.configManager.config$.pipe(
            filter((config: Config): boolean => config.heartRateMonitor !== this.heartRateMonitor),
            switchMap((config: Config): Observable<IHeartRate | undefined> => {
                this.heartRateMonitor = config.heartRateMonitor;
                this.ble.disconnectDevice();

                switch (config.heartRateMonitor) {
                    case "ble":
                        this.ant.disconnectDevice();

                        return this.ble.streamHeartRate$();
                    case "ant":
                        this.ant.reconnect();

                        return this.ant.streamHeartRate$();
                    default:
                        this.ant.disconnectDevice();

                        return of(undefined);
                }
            }),
            startWith(undefined),
            shareReplay(),
        );
    }
}
