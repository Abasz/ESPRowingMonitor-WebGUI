import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    DEFAULT_LANDSCAPE_LAYOUT,
    DEFAULT_PORTRAIT_LAYOUT,
} from "../../app/dashboard/dashboard-tile-definitions";
import { Config, HeartRateMonitorMode } from "../common.interfaces";
import { deepMerge, DeepPartial } from "../utils/utility.functions";

import { ConfigManagerService } from "./config-manager.service";

describe("ConfigManagerService", (): void => {
    let configManagerService: ConfigManagerService;

    const createMockConfig = (overrides?: DeepPartial<Config>): Config =>
        deepMerge(new Config(), overrides ?? {});

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
                general: {
                    device: {
                        heartRateMonitor: "ble",
                        heartRateBleId: "hr-123",
                        ergoMonitorBleId: "erg-456",
                    },
                },
                display: { forceCurve: { showPeakForceInTitle: false } },
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
            expect(cfg.general.device.heartRateMonitor).toBe("ble" as HeartRateMonitorMode);
            expect(cfg.general.device.heartRateBleId).toBe("hr-123");
            expect(cfg.general.device.ergoMonitorBleId).toBe("erg-456");
            expect(cfg.display.forceCurve.showPeakForceInTitle).toBe(false);
        });

        it("should force HR off and clear BLE ids on insecure context and persist them", (): void => {
            withInsecureContext();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();

            expect(cfg.general.device.heartRateMonitor).toBe("off");
            expect(cfg.general.device.heartRateBleId).toBe("");
            expect(cfg.general.device.ergoMonitorBleId).toBe("");
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

            expect(cfg.general.device.heartRateMonitor).toBe("off");
            expect(cfg.general.device.heartRateBleId).toBe("");
            expect(cfg.general.device.ergoMonitorBleId).toBe("");
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"heartRateMonitor":"off"'),
            );
        });

        it("should migrate V0 flat keys through V1 to V2 final config structure", (): void => {
            withSecureContextAndBluetooth();

            localStorage.setItem("heartRateMonitor", "ant");
            localStorage.setItem("heartRateBleId", "hr-999");
            localStorage.setItem("ergoMonitorBleId", "erg-888");
            localStorage.setItem("displayShowPeakForceInTitle", "true");

            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
            const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();
            expect(cfg.general.device.heartRateMonitor).toBe("ant" as HeartRateMonitorMode);
            expect(cfg.general.device.heartRateBleId).toBe("hr-999");
            expect(cfg.general.device.ergoMonitorBleId).toBe("erg-888");
            expect(cfg.display.forceCurve.showPeakForceInTitle).toBe(true);

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

            expect(removeItemSpy).toHaveBeenCalledWith("heartRateMonitor");
            expect(removeItemSpy).toHaveBeenCalledWith("heartRateBleId");
            expect(removeItemSpy).toHaveBeenCalledWith("ergoMonitorBleId");
            expect(removeItemSpy).toHaveBeenCalledWith("displayShowPeakForceInTitle");
            expect(removeItemSpy).toHaveBeenCalledWith("config");
        });

        it("should load stored intervalsIcu config and apply defaults for missing fields", (): void => {
            withSecureContextAndBluetooth();

            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY
                    ? JSON.stringify({
                          general: { intervalsIcu: { apiKey: "key-abc", athleteId: "athlete-123" } },
                      })
                    : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();
            const defaultConfig = new Config();

            expect(cfg.general.intervalsIcu.apiKey).toBe("key-abc");
            expect(cfg.general.intervalsIcu.athleteId).toBe("athlete-123");
            expect(cfg.general.intervalsIcu.autoUploadEnabled).toBe(
                defaultConfig.general.intervalsIcu.autoUploadEnabled,
            );
        });

        it("should apply intervalsIcu defaults when loading a config that predates the field", (): void => {
            withSecureContextAndBluetooth();

            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY
                    ? JSON.stringify({ general: { device: { heartRateMonitor: "ble" } } })
                    : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();
            const defaultConfig = new Config();

            expect(cfg.general.intervalsIcu.apiKey).toBe(defaultConfig.general.intervalsIcu.apiKey);
            expect(cfg.general.intervalsIcu.athleteId).toBe(defaultConfig.general.intervalsIcu.athleteId);
            expect(cfg.general.intervalsIcu.autoUploadEnabled).toBe(
                defaultConfig.general.intervalsIcu.autoUploadEnabled,
            );
        });

        it("should deep merge stored config with defaults so new nested properties get default values", (): void => {
            withSecureContextAndBluetooth();

            const storedConfig = {
                general: {
                    device: { ergoMonitorBleId: "erg-123" },
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

            expect(cfg.general.device.ergoMonitorBleId).toBe("erg-123");
            expect(cfg.general.device.heartRateMonitor).toBe(defaultConfig.general.device.heartRateMonitor);
            expect(cfg.general.device.heartRateBleId).toBe(defaultConfig.general.device.heartRateBleId);
            expect(cfg.display.forceCurve.showPeakForceInTitle).toBe(false);
            expect(cfg.display.layout).toEqual({
                landscape: DEFAULT_LANDSCAPE_LAYOUT,
                portrait: DEFAULT_PORTRAIT_LAYOUT,
                orientationLock: "auto",
            });
        });
    });

    describe("autoStartTimer to autoSession migration", (): void => {
        it("should migrate autoStartTimer true to autoSession autoStart", (): void => {
            withSecureContextAndBluetooth();

            localStorage.setItem(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                JSON.stringify({
                    general: {
                        ergoMonitorBleId: "",
                        heartRateBleId: "",
                        heartRateMonitor: "off",
                        autoStartTimer: true,
                    },
                }),
            );
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const config = configManagerService.getConfig();
            expect(config.general.session.autoSession).toBe("autoStart");
            expect((config.general as unknown as Record<string, unknown>)["autoStartTimer"]).toBeUndefined();
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"autoSession":"autoStart"'),
            );
        });

        it("should migrate autoStartTimer false to autoSession off", (): void => {
            withSecureContextAndBluetooth();

            localStorage.setItem(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                JSON.stringify({
                    general: {
                        ergoMonitorBleId: "",
                        heartRateBleId: "",
                        heartRateMonitor: "off",
                        autoStartTimer: false,
                    },
                }),
            );
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const config = configManagerService.getConfig();
            expect(config.general.session.autoSession).toBe("off");
            expect((config.general as unknown as Record<string, unknown>)["autoStartTimer"]).toBeUndefined();
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"autoSession":"off"'),
            );
        });

        it("should preserve autoSession value when migrating flat config without autoStartTimer", (): void => {
            withSecureContextAndBluetooth();

            localStorage.setItem(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                JSON.stringify({
                    general: {
                        ergoMonitorBleId: "",
                        heartRateBleId: "",
                        heartRateMonitor: "off",
                        autoSession: "autoStartAndPause",
                    },
                }),
            );

            configManagerService = TestBed.inject(ConfigManagerService);

            const config = configManagerService.getConfig();
            expect(config.general.session.autoSession).toBe("autoStartAndPause");
        });

        it("should prefer autoSession over autoStartTimer when both exist in legacy flat config", (): void => {
            withSecureContextAndBluetooth();

            localStorage.setItem(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                JSON.stringify({
                    general: {
                        ergoMonitorBleId: "",
                        heartRateBleId: "",
                        heartRateMonitor: "off",
                        autoStartTimer: true,
                        autoSession: "autoStartAndPause",
                    },
                }),
            );

            configManagerService = TestBed.inject(ConfigManagerService);

            const config = configManagerService.getConfig();
            expect(config.general.session.autoSession).toBe("autoStartAndPause");
        });

        it("should default autoSession to autoStart for fresh installs with no stored config", (): void => {
            withSecureContextAndBluetooth();
            vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().general.session.autoSession).toBe("autoStart");
        });
    });

    describe("V6 flat-to-nested general config migration", (): void => {
        it("should migrate flat general config to nested device and session sub-groups on load", (): void => {
            withSecureContextAndBluetooth();

            localStorage.setItem(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                JSON.stringify({
                    general: {
                        ergoMonitorBleId: "erg-123",
                        heartRateBleId: "hr-456",
                        heartRateMonitor: "ble",
                        autoSession: "autoStart",
                        autoLap: "distance",
                        autoLapValue: 1000,
                    },
                }),
            );

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();
            expect(cfg.general.device.ergoMonitorBleId).toBe("erg-123");
            expect(cfg.general.device.heartRateBleId).toBe("hr-456");
            expect(cfg.general.device.heartRateMonitor).toBe("ble");
            expect(cfg.general.session.autoSession).toBe("autoStart");
            expect(cfg.general.session.autoLap).toBe("distance");
            expect(cfg.general.session.autoLapValue).toBe(1000);
        });

        it("should not trigger a migration save when general config is already in nested format", (): void => {
            withSecureContextAndBluetooth();

            const storedConfig = createMockConfig({
                general: { device: { heartRateMonitor: "ble", ergoMonitorBleId: "erg-123" } },
            });
            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY ? JSON.stringify(storedConfig) : null;
            });
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(setItemSpy).not.toHaveBeenCalled();
            expect(configManagerService.getConfig().general.device.ergoMonitorBleId).toBe("erg-123");
        });
    });

    describe("legacy display format migrations", (): void => {
        it("should migrate V1 'config' key with flat display to nested display groups in rowingMonitorConfig", (): void => {
            withSecureContextAndBluetooth();

            localStorage.setItem(
                "config",
                JSON.stringify({
                    general: { heartRateMonitor: "off", heartRateBleId: "", ergoMonitorBleId: "" },
                    display: { showPeakForceInTitle: false, unitSystem: "imperial" },
                }),
            );
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
            const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().display.general.unitSystem).toBe("imperial");
            expect(configManagerService.getConfig().display.forceCurve.showPeakForceInTitle).toBe(false);
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"unitSystem":"imperial"'),
            );
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"showPeakForceInTitle":false'),
            );
            expect(removeItemSpy).toHaveBeenCalledWith("config");
        });

        it("should migrate flat single layout to per-orientation landscape and portrait layouts", (): void => {
            withSecureContextAndBluetooth();

            const legacyLayout = {
                tiles: [
                    {
                        tileType: "metrics-overview",
                        colSpan: 2,
                        rowSpan: 2,
                        rowStart: 1,
                        colStart: 1,
                    },
                ],
            };

            localStorage.setItem(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                JSON.stringify({
                    general: { heartRateMonitor: "off", heartRateBleId: "", ergoMonitorBleId: "" },
                    display: {
                        general: { unitSystem: "metric" },
                        forceCurve: { showPeakForceInTitle: true, showGridLines: true, showAxisLabels: true },
                        layout: legacyLayout,
                    },
                }),
            );
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().display.layout.landscape).toEqual(legacyLayout);
            expect(configManagerService.getConfig().display.layout.portrait).toEqual(legacyLayout);
            expect(configManagerService.getConfig().display.layout.orientationLock).toBe("auto");
            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"orientationLock":"auto"'),
            );
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
            const storedConfig = createMockConfig({ display: { general: { unitSystem: "imperial" } } });
            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY ? JSON.stringify(storedConfig) : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getConfig().display.general.unitSystem).toBe("imperial");
        });

        it("should return stored boolean false value", (): void => {
            withSecureContextAndBluetooth();
            const storedConfig: Config = createMockConfig({
                display: { forceCurve: { showPeakForceInTitle: false } },
            });
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
            cfg.general.device.heartRateMonitor = "ble";

            expect(configManagerService.getGroup("general").device.heartRateMonitor).toBe("off");
        });
    });

    describe("getGroup method", (): void => {
        it("should return the value for a given group", (): void => {
            withSecureContextAndBluetooth();
            const storedConfig: Config = createMockConfig({
                general: { device: { heartRateMonitor: "ant" } },
            });
            vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string): string | null => {
                return key === ConfigManagerService.CONFIG_STORAGE_KEY ? JSON.stringify(storedConfig) : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getGroup("general").device.heartRateMonitor).toBe("ant");
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
            generalConfig.device.heartRateMonitor = "ble";
            configManagerService.setGroup("general", generalConfig);

            expect(setItemSpy).toHaveBeenCalledWith(
                ConfigManagerService.CONFIG_STORAGE_KEY,
                expect.stringContaining('"heartRateMonitor":"ble"'),
            );
            expect(configManagerService.getGroup("general").device.heartRateMonitor).toBe("ble");

            const generalConfig2 = configManagerService.getGroup("general");
            generalConfig2.device.heartRateMonitor = "ant";
            configManagerService.setGroup("general", generalConfig2);
            expect(configManagerService.getGroup("general").device.heartRateMonitor).toBe("ant");
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
            expect(events[0].general.device.ergoMonitorBleId).toBe("");

            const generalConfig = configManagerService.getGroup("general");
            generalConfig.device.ergoMonitorBleId = "foo";
            configManagerService.setGroup("general", generalConfig);

            expect(events).toHaveLength(2);
            expect(events[1].general.device.ergoMonitorBleId).toBe("foo");
        });
    });
});
