import { Injectable } from "@angular/core";
import { BehaviorSubject, filter, map, Observable, pairwise, startWith } from "rxjs";

import { Config, HeartRateMonitorMode, IConfig } from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class ConfigManagerService {
    readonly heartRateMonitorChanged$: Observable<HeartRateMonitorMode>;

    private configSubject: BehaviorSubject<Config>;

    constructor() {
        let config = Object.fromEntries(
            (Object.keys(new Config()) as Array<keyof Config>).map(
                (key: keyof Config): [keyof Config, string] => [
                    key,
                    localStorage.getItem(key) ?? new Config()[key],
                ],
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

        this.heartRateMonitorChanged$ = this.configSubject.pipe(
            pairwise(),
            filter(
                ([previous, current]: [Config, Config]): boolean =>
                    previous.heartRateMonitor !== current.heartRateMonitor,
            ),
            map(([_, current]: [Config, Config]): HeartRateMonitorMode => current.heartRateMonitor),
            startWith(this.configSubject.value.heartRateMonitor),
        );
    }

    getConfig(): IConfig {
        return { ...this.configSubject.value };
    }

    getItem(name: keyof Config): Config[keyof Config] {
        return this.configSubject.value[name];
    }

    setItem(name: keyof Config, value: Config[keyof Config]): void {
        localStorage.setItem(name, value);
        this.configSubject.next({ ...this.configSubject.value, [name]: value });
    }
}
