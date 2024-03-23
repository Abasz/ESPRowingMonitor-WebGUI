import { Injectable } from "@angular/core";
import { BehaviorSubject, filter, map, Observable, shareReplay } from "rxjs";

import { Config, HeartRateMonitorMode, IConfig } from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class ConfigManagerService {
    heartRateMonitorChanged$: Observable<HeartRateMonitorMode>;
    websocketAddressChanged$: Observable<string>;

    private address: string = "";

    private config: Config;
    private config$: Observable<Config>;

    private configSubject: BehaviorSubject<Config>;

    private heartRateMonitor: HeartRateMonitorMode = "off";

    constructor() {
        this.config = new Config();
        (Object.keys(this.config) as Array<keyof Config>).forEach((key: keyof Config): void => {
            this.config[key] = (localStorage.getItem(key) as HeartRateMonitorMode) ?? this.config[key];
        });
        if (!isSecureContext) {
            this.config.heartRateMonitor = "off";
            this.config.bleDeviceId = "";
            localStorage.setItem("heartRateMonitor", "off");
            localStorage.setItem("bleDeviceId", "");
        }

        this.configSubject = new BehaviorSubject(this.config);
        this.config$ = this.configSubject.asObservable();

        this.heartRateMonitorChanged$ = this.config$.pipe(
            filter((config: Config): boolean => {
                if (config.heartRateMonitor !== this.heartRateMonitor) {
                    this.heartRateMonitor = config.heartRateMonitor;

                    return true;
                }

                return false;
            }),
            map((config: Config): HeartRateMonitorMode => config.heartRateMonitor),
            shareReplay(1),
        );

        this.websocketAddressChanged$ = this.config$.pipe(
            filter((config: Config): boolean => {
                if (config.webSocketAddress !== this.address) {
                    this.address = config.webSocketAddress;

                    return true;
                }

                return false;
            }),
            map((config: Config): string => config.webSocketAddress),
            shareReplay(1),
        );
    }

    getConfig(): IConfig {
        return { ...this.config };
    }

    getItem(name: keyof Config): Config[keyof Config] {
        return this.config[name];
    }

    setItem(name: keyof Config, value: Config[keyof Config]): void {
        this.config[name] = value as HeartRateMonitorMode;
        localStorage.setItem(name, value);
        this.configSubject.next(this.config);
    }
}
