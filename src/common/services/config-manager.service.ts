import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, shareReplay } from "rxjs";

import {
    DEFAULT_LANDSCAPE_LAYOUT,
    DEFAULT_PORTRAIT_LAYOUT,
} from "../../app/dashboard/dashboard-tile-definitions";
import { AutoSessionMode, Config, HeartRateMonitorMode } from "../common.interfaces";

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
                    device: {
                        ...config.general.device,
                        heartRateMonitor: "off",
                        heartRateBleId: "",
                        ergoMonitorBleId: "",
                    },
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
        this.migrateToV2();
        this.migrateToV3();
        this.migrateToV4();
        this.migrateToV5();
        this.migrateToV6();

        const storedConfig = localStorage.getItem(ConfigManagerService.CONFIG_STORAGE_KEY);

        if (storedConfig === null) {
            return defaultConfig;
        }

        try {
            const parsedConfig = JSON.parse(storedConfig) as Partial<Config>;

            return {
                general: {
                    device: {
                        ...defaultConfig.general.device,
                        ...parsedConfig.general?.device,
                    },
                    session: {
                        ...defaultConfig.general.session,
                        ...parsedConfig.general?.session,
                    },
                    intervalsIcu: {
                        ...defaultConfig.general.intervalsIcu,
                        ...parsedConfig.general?.intervalsIcu,
                    },
                },
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
                    averaging: {
                        ...defaultConfig.display.averaging,
                        ...parsedConfig.display?.averaging,
                    },
                },
            };
        } catch {
            console.warn(`Failed to parse localStorage config. Using default value.`, { storedConfig });
        }

        return defaultConfig;
    }

    private migrateToV2(): void {
        const configKeys = [
            "ergoMonitorBleId",
            "heartRateBleId",
            "heartRateMonitor",
            "displayShowPeakForceInTitle",
        ];
        const hasKeys = configKeys.some((key: string): boolean => localStorage.getItem(key) !== null);

        if (!hasKeys) {
            return;
        }

        const ergoMonitorBleId = localStorage.getItem("ergoMonitorBleId") ?? "";
        const heartRateBleId = localStorage.getItem("heartRateBleId") ?? "";
        const heartRateMonitor = (localStorage.getItem("heartRateMonitor") ?? "off") as HeartRateMonitorMode;
        let isPeakForceInTitle = true;

        try {
            const rawShowPeak = localStorage.getItem("displayShowPeakForceInTitle");
            if (rawShowPeak !== null) {
                isPeakForceInTitle = JSON.parse(rawShowPeak) as boolean;
            }
        } catch {
            console.warn(`Failed to parse old displayShowPeakForceInTitle value`);
        }

        localStorage.setItem(
            "config",
            JSON.stringify({
                general: { ergoMonitorBleId, heartRateBleId, heartRateMonitor },
                display: { showPeakForceInTitle: isPeakForceInTitle },
            }),
        );
        configKeys.forEach((key: string): void => localStorage.removeItem(key));
    }

    private migrateToV3(): void {
        const config = localStorage.getItem("config");

        if (config === null) {
            return;
        }

        try {
            const parsed = JSON.parse(config) as Partial<Config> | undefined;
            const parsedGeneral = parsed?.general as Record<string, unknown> | undefined;
            const parsedDisplay = parsed?.display as Record<string, unknown> | undefined;

            const isPeakForceInTitle =
                typeof parsedDisplay?.showPeakForceInTitle === "boolean"
                    ? parsedDisplay.showPeakForceInTitle
                    : true;
            const unitSystem = parsedDisplay?.unitSystem ?? "metric";

            localStorage.setItem(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                JSON.stringify({
                    general: {
                        ergoMonitorBleId: parsedGeneral?.ergoMonitorBleId ?? "",
                        heartRateBleId: parsedGeneral?.heartRateBleId ?? "",
                        heartRateMonitor: parsedGeneral?.heartRateMonitor ?? "off",
                    },
                    display: {
                        general: { unitSystem },
                        forceCurve: { showPeakForceInTitle: isPeakForceInTitle },
                    },
                }),
            );
        } catch {
            console.warn(`Failed to migrate V2 config to V3.`);
        }

        localStorage.removeItem("config");
    }

    private migrateToV4(): void {
        const config = localStorage.getItem(ConfigManagerService.CONFIG_STORAGE_KEY);

        if (config === null) {
            return;
        }

        try {
            const parsed = JSON.parse(config) as Partial<Config> | undefined;

            if (!parsed) {
                return;
            }

            if (!parsed.display) {
                return;
            }

            if (!("layout" in parsed.display)) {
                return;
            }

            if (!parsed.display.layout) {
                return;
            }

            if ("landscape" in parsed.display.layout || "portrait" in parsed.display.layout) {
                return;
            }

            parsed.display.layout = {
                landscape: structuredClone(parsed.display.layout),
                portrait: structuredClone(parsed.display.layout),
                orientationLock: "auto",
            };

            localStorage.setItem(ConfigManagerService.CONFIG_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
            console.warn(`Failed to migrate V3 config to V4.`);
        }
    }

    private migrateToV5(): void {
        const config = localStorage.getItem(ConfigManagerService.CONFIG_STORAGE_KEY);

        if (config === null) {
            return;
        }

        try {
            const parsed = JSON.parse(config) as Partial<Config> | undefined;
            const parsedGeneral = parsed?.general as Record<string, unknown> | undefined;

            if (!parsedGeneral || !("autoStartTimer" in parsedGeneral) || "autoSession" in parsedGeneral) {
                return;
            }

            const autoSession: AutoSessionMode = parsedGeneral.autoStartTimer ? "autoStart" : "off";
            parsedGeneral.autoSession = autoSession;
            delete parsedGeneral.autoStartTimer;

            localStorage.setItem(ConfigManagerService.CONFIG_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
            console.warn(`Failed to migrate V4 config to V5.`);
        }
    }

    private migrateToV6(): void {
        const config = localStorage.getItem(ConfigManagerService.CONFIG_STORAGE_KEY);

        if (config === null) {
            return;
        }

        try {
            const parsed = JSON.parse(config) as Partial<Config> | undefined;
            const general = parsed?.general as Record<string, unknown> | undefined;

            if (!general || "device" in general || "session" in general) {
                return;
            }

            const autoSession: AutoSessionMode =
                "autoSession" in general ? (general.autoSession as AutoSessionMode) : "autoStart";

            general.device = {
                ergoMonitorBleId: general.ergoMonitorBleId ?? "",
                heartRateBleId: general.heartRateBleId ?? "",
                heartRateMonitor: general.heartRateMonitor ?? "off",
            };
            general.session = {
                autoSession,
                autoLap: general.autoLap ?? "off",
                autoLapValue: general.autoLapValue ?? 500,
            };

            localStorage.setItem(ConfigManagerService.CONFIG_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
            console.warn(`Failed to migrate V5 config to V6.`);
        }
    }

    private saveConfig(config: Config): void {
        localStorage.setItem(ConfigManagerService.CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
}
