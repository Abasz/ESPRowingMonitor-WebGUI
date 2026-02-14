import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, shareReplay } from "rxjs";

import { Config, IConfig } from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class ConfigManagerService {
    readonly configChanged$: Observable<Config>;

    private configSubject: BehaviorSubject<Config>;

    constructor() {
        let config = Object.fromEntries(
            (Object.keys(new Config()) as Array<keyof Config>).map(
                (key: keyof Config): [keyof Config, Config[keyof Config]] => {
                    const value = localStorage.getItem(key);
                    const defaultConfig = new Config();

                    if (value === null) {
                        return [key, defaultConfig[key]];
                    }

                    if (key === "displayShowPeakForceInTitle") {
                        try {
                            return [key, JSON.parse(value)];
                        } catch {
                            return [key, defaultConfig[key]];
                        }
                    }

                    return [key, value];
                },
            ),
        ) as unknown as Config;

        if (!isSecureContext || navigator.bluetooth === undefined) {
            config = {
                ...config,
                heartRateMonitor: "off",
                heartRateBleId: "",
                ergoMonitorBleId: "",
            };

            localStorage.setItem("heartRateMonitor", "off");
            localStorage.setItem("heartRateBleId", "");
            localStorage.setItem("ergoMonitorBleId", "");
        }

        this.configSubject = new BehaviorSubject(config);

        this.configChanged$ = this.configSubject.asObservable().pipe(shareReplay(1));
    }

    getConfig(): IConfig {
        return { ...this.configSubject.value };
    }

    getItem<K extends keyof Config>(name: K): Config[K] {
        return this.configSubject.value[name];
    }

    setItem<K extends keyof Config>(name: K, value: Config[K]): void {
        localStorage.setItem(name, value.toString());
        this.configSubject.next({ ...this.configSubject.value, [name]: value });
    }
}
