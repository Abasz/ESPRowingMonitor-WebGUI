import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

import { Config, HeartRateMonitorMode, IConfig } from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class ConfigManagerService {
    config$: Observable<Config>;

    private config: Config;

    private configSubject: BehaviorSubject<Config>;
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
