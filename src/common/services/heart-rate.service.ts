import { Injectable } from "@angular/core";
import { EMPTY, filter, Observable, of, shareReplay, startWith, switchMap } from "rxjs";
import { HeartRateSensor } from "web-ant-plus";

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
    ) {}

    discover$(): Observable<Array<Observable<never> | BluetoothRemoteGATTCharacteristic> | HeartRateSensor> {
        switch (this.configManager.getConfig().heartRateMonitor) {
            case "ble":
                return this.ble.discover$();
            case "ant":
                return this.ant.discover$();
            default:
                return EMPTY;
        }
    }

    streamHeartRate(): Observable<IHeartRate | undefined> {
        return this.configManager.config$.pipe(
            filter((config: Config): boolean => config.heartRateMonitor !== this.heartRateMonitor),
            switchMap((config: Config): Observable<IHeartRate | undefined> => {
                this.heartRateMonitor = config.heartRateMonitor;
                this.ble.disconnectDevice();
                this.ant.disconnectDevice();
                switch (config.heartRateMonitor) {
                    case "ble":
                        return this.ble.streamHeartRate$();
                    case "ant":
                        return this.ant.streamHeartRate$();
                    default:
                        return of(undefined);
                }
            }),
            startWith(undefined),
            shareReplay(),
        );
    }
}
