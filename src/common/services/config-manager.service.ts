import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, shareReplay } from "rxjs";

import {
    DEFAULT_LANDSCAPE_LAYOUT,
    DEFAULT_PORTRAIT_LAYOUT,
} from "../../app/dashboard/dashboard-tile-definitions";
import { Config, HeartRateMonitorMode } from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class ConfigManagerService {
    static readonly CONFIG_STORAGE_KEY: string = "rowingMonitorConfig";

    readonly configChanged$: Observable<Config>;

    private configSubject: BehaviorSubject<Config>;

    constructor() {
        const defaultConfig = new Config();
        let config = this.loadConfig(defaultConfig);

        if (!isSecureContext || navigator.bluetooth === undefined) {
            config = {
                ...config,
                general: {
                    ...config.general,
                    heartRateMonitor: "off",
                    heartRateBleId: "",
                    ergoMonitorBleId: "",
                },
            };
            this.saveConfig(config);
        }

        this.configSubject = new BehaviorSubject(config);

        this.configChanged$ = this.configSubject.asObservable().pipe(shareReplay(1));
    }

    getConfig(): Config {
        return structuredClone(this.configSubject.value);
    }

    getGroup<G extends keyof Config>(group: G): Config[G] {
        return structuredClone(this.configSubject.value[group]);
    }

    setGroup<G extends keyof Config>(group: G, value: Partial<Config[G]>): void {
        const updatedConfig = {
            ...this.configSubject.value,
            [group]: {
                ...this.configSubject.value[group],
                ...structuredClone(value),
            },
        };
        this.saveConfig(updatedConfig);
        this.configSubject.next(updatedConfig);
    }

    private loadConfig(defaultConfig: Config): Config {
        this.migrateOldConfig();

        const storedConfig = localStorage.getItem(ConfigManagerService.CONFIG_STORAGE_KEY);

        if (storedConfig !== null) {
            try {
                const parsedConfig = JSON.parse(storedConfig);

                return {
                    general: { ...defaultConfig.general, ...parsedConfig.general },
                    display: {
                        general: { ...defaultConfig.display.general, ...parsedConfig.display?.general },
                        forceCurve: {
                            ...defaultConfig.display.forceCurve,
                            ...parsedConfig.display?.forceCurve,
                        },
                        layout: {
                            landscape: parsedConfig.display?.layout?.landscape ?? DEFAULT_LANDSCAPE_LAYOUT,
                            portrait: parsedConfig.display?.layout?.portrait ?? DEFAULT_PORTRAIT_LAYOUT,
                            orientationLock: parsedConfig.display?.layout?.orientationLock ?? "auto",
                        },
                    },
                };
            } catch {
                console.warn(`Failed to parse localStorage config. Using default value.`, { storedConfig });
            }
        }

        return defaultConfig;
    }

    private migrateOldConfig(): void {
        const oldKeys = [
            "ergoMonitorBleId",
            "heartRateBleId",
            "heartRateMonitor",
            "displayShowPeakForceInTitle",
        ];
        const foundOldKeys = oldKeys.filter((key: string): boolean => localStorage.getItem(key) !== null);

        if (foundOldKeys.length === 0) {
            return;
        }

        const migratedConfig = new Config();

        const ergoMonitorBleId = localStorage.getItem("ergoMonitorBleId");
        const heartRateBleId = localStorage.getItem("heartRateBleId");
        const heartRateMonitor = localStorage.getItem("heartRateMonitor");
        const displayShowPeakForceInTitle = localStorage.getItem("displayShowPeakForceInTitle");

        if (ergoMonitorBleId !== null) {
            try {
                migratedConfig.general.ergoMonitorBleId = ergoMonitorBleId;
            } catch {
                console.warn(`Failed to parse old ergoMonitorBleId value`);
            }
            localStorage.removeItem("ergoMonitorBleId");
        }

        if (heartRateBleId !== null) {
            try {
                migratedConfig.general.heartRateBleId = heartRateBleId;
            } catch {
                console.warn(`Failed to parse old heartRateBleId value`);
            }
            localStorage.removeItem("heartRateBleId");
        }

        if (heartRateMonitor !== null) {
            try {
                migratedConfig.general.heartRateMonitor = heartRateMonitor as HeartRateMonitorMode;
            } catch {
                console.warn(`Failed to parse old heartRateMonitor value`);
            }
            localStorage.removeItem("heartRateMonitor");
        }

        if (displayShowPeakForceInTitle !== null) {
            try {
                migratedConfig.display.forceCurve.showPeakForceInTitle =
                    JSON.parse(displayShowPeakForceInTitle);
            } catch {
                console.warn(`Failed to parse old displayShowPeakForceInTitle value`);
            }
            localStorage.removeItem("displayShowPeakForceInTitle");
        }

        this.saveConfig(migratedConfig);
    }

    private saveConfig(config: Config): void {
        localStorage.setItem(ConfigManagerService.CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
}
