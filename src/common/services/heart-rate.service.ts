import { Injectable } from "@angular/core";
import { EMPTY, filter, Observable, of, shareReplay, startWith, switchMap } from "rxjs";

import { Config, HeartRateMonitorMode, IHeartRate } from "../common.interfaces";

import { BLEHeartRateService } from "./ble-heart-rate.service";
import { ConfigManagerService } from "./config-manager.service";

@Injectable({
    providedIn: "root",
})
export class HeartRateService {
    private heartRateMonitor: HeartRateMonitorMode = "off";

    constructor(private configManager: ConfigManagerService, private ble: BLEHeartRateService) {}

    streamHeartRate(): Observable<IHeartRate | undefined> {
        return this.configManager.config$.pipe(
            filter((config: Config): boolean => config.heartRateMonitor !== this.heartRateMonitor),
            switchMap((config: Config): Observable<IHeartRate | undefined> => {
                this.heartRateMonitor = config.heartRateMonitor;
                this.ble.disconnectDevice();
                switch (config.heartRateMonitor) {
                    case "off":
                        return of(undefined);
                    case "ble":
                        return this.ble.streamHeartRate$();
                    case "ant":
                        return of(undefined);
                    default:
                        return EMPTY;
                }
            }),
            startWith(undefined),
            shareReplay()
        );
    }
}
