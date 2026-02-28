import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    DEFAULT_LANDSCAPE_LAYOUT,
    DEFAULT_PORTRAIT_LAYOUT,
} from "../../app/dashboard/dashboard-tile-definitions";
import { Config, HeartRateMonitorMode, UnitSystem } from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";

describe("ConfigManagerService", (): void => {
    let configManagerService: ConfigManagerService;

    const createMockConfig = (overrides?: {
        heartRateMonitor?: HeartRateMonitorMode;
        heartRateBleId?: string;
        ergoMonitorBleId?: string;
        showPeakForceInTitle?: boolean;
        unitSystem?: UnitSystem;
    }): Config => {
        const defaults = {
            heartRateMonitor: "off" as HeartRateMonitorMode,
            heartRateBleId: "",
            ergoMonitorBleId: "",
            showPeakForceInTitle: true,
            unitSystem: "metric" as UnitSystem,
        };

        const merged = { ...defaults, ...overrides };

        return {
            general: {
                heartRateMonitor: merged.heartRateMonitor,
                heartRateBleId: merged.heartRateBleId,
                ergoMonitorBleId: merged.ergoMonitorBleId,
            },
            display: {
                general: {
                    unitSystem: merged.unitSystem,
                },
                forceCurve: {
                    showPeakForceInTitle: merged.showPeakForceInTitle,
                    showGridLines: true,
                    showAxisLabels: true,
                },
                layout: {
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto" as const,
                },
            },
        };
    };

    const withSecureContextAndBluetooth = (): void => {
        vi.spyOn(globalThis, "isSecureContext", "get").mockReturnValue(true);

        vi.spyOn(globalThis, "navigator", "get").mockReturnValue({
            bluetooth: {},
        } as Navigator);
    };

    const withInsecureContext = (): void => {
        vi.spyOn(globalThis, "isSecureContext", "get").mockReturnValue(false);
        vi.spyOn(globalThis, "navigator", "get").mockReturnValue({
            bluetooth: {},
        } as Navigator);
    };

    const withNoBluetooth = (): void => {
        vi.spyOn(globalThis, "isSecureContext", "get").mockReturnValue(true);
        vi.spyOn(globalThis, "navigator", "get").mockReturnValue({} as Navigator);
    };

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [ConfigManagerService, provideZonelessChangeDetection()],
        });
    });

    afterEach((): void => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it("should be created", (): void => {
        withSecureContextAndBluetooth();
        vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
        configManagerService = TestBed.inject(ConfigManagerService);

        expect(configManagerService).toBeTruthy();
    });

    describe("on service initialization", (): void => {
        it("should initialize config from localStorage when secure and bluetooth is available", (): void => {
            withSecureContextAndBluetooth();

            const storedConfig: Config = createMockConfig({
                heartRateMonitor: "ble",
                heartRateBleId: "hr-123",
                ergoMonitorBleId: "erg-456",
                showPeakForceInTitle: false,
            });

            const getItemSpy = vi
                .spyOn(Storage.prototype, "getItem")
                .mockImplementation((key: string): string | null => {
                    return key === ConfigManagerService.CONFIG_STORAGE_KEY
                        ? JSON.stringify(storedConfig)
                        : null;
                });
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();

            expect(getItemSpy).toHaveBeenCalled();
            expect(setItemSpy).not.toHaveBeenCalled();
            expect(cfg.general.heartRateMonitor).toBe("ble" as HeartRateMonitorMode);
            expect(cfg.general.heartRateBleId).toBe("hr-123");
            expect(cfg.general.ergoMonitorBleId).toBe("erg-456");
            expect(cfg.display.forceCurve.showPeakForceInTitle).toBe(false);
        });

        it("should force HR off and clear BLE ids on insecure context and persist them", (): void => {
            withInsecureContext();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();

            expect(cfg.general.heartRateMonitor).toBe("off");
            expect(cfg.general.heartRateBleId).toBe("");
            expect(cfg.general.ergoMonitorBleId).toBe("");
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"heartRateMonitor":"off"'),
            );
        });

        it("should force HR off and clear BLE ids when bluetooth API is unavailable and persist them", (): void => {
            withNoBluetooth();

            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();

            expect(cfg.general.heartRateMonitor).toBe("off");
            expect(cfg.general.heartRateBleId).toBe("");
            expect(cfg.general.ergoMonitorBleId).toBe("");
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"heartRateMonitor":"off"'),
            );
        });

        it("should migrate old individual localStorage keys to new grouped structure", (): void => {
            withSecureContextAndBluetooth();

            const getItemSpy = vi
                .spyOn(Storage.prototype, "getItem")
                .mockImplementation((key: string): string | null => {
                    switch (key) {
                        case "heartRateMonitor":
                            return "ant";
                        case "heartRateBleId":
                            return "hr-999";
                        case "ergoMonitorBleId":
                            return "erg-888";
                        case "displayShowPeakForceInTitle":
                            return "true";
                        default:
                            return null;
                    }
                });
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
            const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(getItemSpy).toHaveBeenCalledWith("ergoMonitorBleId");
            expect(getItemSpy).toHaveBeenCalledWith("heartRateBleId");
            expect(getItemSpy).toHaveBeenCalledWith("heartRateMonitor");
            expect(getItemSpy).toHaveBeenCalledWith("displayShowPeakForceInTitle");

            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"general"'),
            );
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"display"'),
            );
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"heartRateMonitor":"ant"'),
            );
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"heartRateBleId":"hr-999"'),
            );
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"ergoMonitorBleId":"erg-888"'),
            );
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"showPeakForceInTitle":true'),
            );

            expect(removeItemSpy).toHaveBeenCalledWith("heartRateMonitor");
            expect(removeItemSpy).toHaveBeenCalledWith("heartRateBleId");
            expect(removeItemSpy).toHaveBeenCalledWith("ergoMonitorBleId");
            expect(removeItemSpy).toHaveBeenCalledWith("displayShowPeakForceInTitle");
        });

        it("should deep merge stored config with defaults so new nested properties get default values", (): void => {
            withSecureContextAndBluetooth();

            const storedConfig = {
                general: {
                    ergoMonitorBleId: "erg-123",
                },
                display: {
                    forceCurve: {
                        showPeakForceInTitle: false,
                    },
                },
            };

            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY ? JSON.stringify(storedConfig) : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();
            const defaultConfig = new Config();

            expect(cfg.general.ergoMonitorBleId).toBe("erg-123");
            expect(cfg.general.heartRateMonitor).toBe(defaultConfig.general.heartRateMonitor);
            expect(cfg.general.heartRateBleId).toBe(defaultConfig.general.heartRateBleId);
            expect(cfg.display.forceCurve.showPeakForceInTitle).toBe(false);
            expect(cfg.display.layout).toEqual({
                landscape: DEFAULT_LANDSCAPE_LAYOUT,
                portrait: DEFAULT_PORTRAIT_LAYOUT,
                orientationLock: "auto",
            });
        });
    });

    describe("display.forceCurve.showPeakForceInTitle config", (): void => {
        it("should default to true when no value is stored", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(true);
        });

        it("should default unitSystem to metric when no value is stored", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().display.general.unitSystem).toBe("metric");
        });

        it("should preserve stored unitSystem value via deep merge", (): void => {
            withSecureContextAndBluetooth();
            const storedConfig = createMockConfig({ unitSystem: "imperial" });
            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY ? JSON.stringify(storedConfig) : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().display.general.unitSystem).toBe("imperial");
        });

        it("should return stored boolean false value", (): void => {
            withSecureContextAndBluetooth();
            const storedConfig: Config = createMockConfig({ showPeakForceInTitle: false });
            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY ? JSON.stringify(storedConfig) : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(false);
            expect(typeof configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(
                "boolean",
            );
        });

        it("should return stored boolean true value", (): void => {
            withSecureContextAndBluetooth();
            const storedConfig: Config = createMockConfig();
            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY ? JSON.stringify(storedConfig) : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(true);
            expect(typeof configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(
                "boolean",
            );
        });

        it("should fallback to default value when stored value cannot be parsed", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY ? "invalid-json-{" : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(true);
            expect(typeof configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(
                "boolean",
            );
        });
    });

    describe("getConfig method", (): void => {
        it("should return a copy of the current config", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();
            cfg.general.heartRateMonitor = "ble";

            expect(configManagerService.getGroup("general").heartRateMonitor).toBe("off");
        });
    });

    describe("getGroup method", (): void => {
        it("should return the value for a given group", (): void => {
            withSecureContextAndBluetooth();
            const storedConfig: Config = createMockConfig({ heartRateMonitor: "ant" });
            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY ? JSON.stringify(storedConfig) : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getGroup("general").heartRateMonitor).toBe("ant");
            expect(configManagerService.getGroup("display").forceCurve.showPeakForceInTitle).toBe(true);
        });
    });

    describe("setGroup method", (): void => {
        it("should persist to localStorage and update the in-memory value", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const generalConfig = configManagerService.getGroup("general");
            generalConfig.heartRateMonitor = "ble";
            configManagerService.setGroup("general", generalConfig);

            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"heartRateMonitor":"ble"'),
            );
            expect(configManagerService.getGroup("general").heartRateMonitor).toBe("ble");

            const generalConfig2 = configManagerService.getGroup("general");
            generalConfig2.heartRateMonitor = "ant";
            configManagerService.setGroup("general", generalConfig2);
            expect(configManagerService.getGroup("general").heartRateMonitor).toBe("ant");
        });

        it("should update display settings correctly", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const displayConfig = configManagerService.getGroup("display");
            displayConfig.forceCurve.showPeakForceInTitle = false;
            configManagerService.setGroup("display", displayConfig);

            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"showPeakForceInTitle":false'),
            );
            expect(configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(false);

            const displayConfig2 = configManagerService.getGroup("display");
            displayConfig2.forceCurve.showPeakForceInTitle = true;
            configManagerService.setGroup("display", displayConfig2);
            expect(configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(true);
        });

        it("should update nested display settings", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const displayConfig = configManagerService.getGroup("display");
            displayConfig.general.unitSystem = "imperial";
            configManagerService.setGroup("display", displayConfig);

            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"unitSystem":"imperial"'),
            );
            expect(configManagerService.getConfig().display.general.unitSystem).toBe("imperial");
        });

        it("should handle partial settings", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const displayConfig = configManagerService.getGroup("display");
            displayConfig.general.unitSystem = "imperial";
            configManagerService.setGroup("display", { general: { unitSystem: "imperial" } });

            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"unitSystem":"imperial"'),
            );
            expect(configManagerService.getConfig().display.general.unitSystem).toBe("imperial");
        });
    });

    describe("configChanged$ observable", (): void => {
        it("should emit initial config and updated values", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

            configManagerService = TestBed.inject(ConfigManagerService);

            const events: Array<Config> = [];
            configManagerService.configChanged$.subscribe((config: Config): void => {
                events.push(config);
            });

            expect(events).toHaveLength(1);
            expect(events[0].general.ergoMonitorBleId).toBe("");

            const generalConfig = configManagerService.getGroup("general");
            generalConfig.ergoMonitorBleId = "foo";
            configManagerService.setGroup("general", generalConfig);

            expect(events).toHaveLength(2);
            expect(events[1].general.ergoMonitorBleId).toBe("foo");
        });
    });
});
