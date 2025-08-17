import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { HeartRateMonitorMode } from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";

describe("ConfigManagerService", (): void => {
    let configManagerService: ConfigManagerService;

    const withSecureContextAndBluetooth = (): void => {
        spyOnProperty(globalThis, "isSecureContext", "get").and.returnValue(true);
        spyOnProperty(globalThis, "navigator", "get").and.returnValue({
            bluetooth: {},
        } as Navigator);
    };

    const withInsecureContext = (): void => {
        spyOnProperty(globalThis, "isSecureContext", "get").and.returnValue(false);
        spyOnProperty(globalThis, "navigator", "get").and.returnValue({
            bluetooth: {},
        } as Navigator);
    };

    const withNoBluetooth = (): void => {
        spyOnProperty(globalThis, "isSecureContext", "get").and.returnValue(true);
        spyOnProperty(globalThis, "navigator", "get").and.returnValue({} as Navigator);
    };

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [ConfigManagerService, provideZonelessChangeDetection()],
        });
    });

    it("should be created", (): void => {
        withSecureContextAndBluetooth();
        configManagerService = TestBed.inject(ConfigManagerService);

        expect(configManagerService).toBeTruthy();
    });

    describe("on service initialization", (): void => {
        it("should initialize config from localStorage when secure and bluetooth is available", (): void => {
            withSecureContextAndBluetooth();

            const getItemSpy = spyOn(localStorage, "getItem").and.callFake((key: string): string | null => {
                switch (key) {
                    case "heartRateMonitor":
                        return "ble";
                    case "heartRateBleId":
                        return "hr-123";
                    case "ergoMonitorBleId":
                        return "erg-456";
                    default:
                        return null;
                }
            });
            const setItemSpy = spyOn(localStorage, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();

            expect(getItemSpy).toHaveBeenCalled();
            expect(setItemSpy).not.toHaveBeenCalled();
            expect(cfg.heartRateMonitor).toBe("ble" as HeartRateMonitorMode);
            expect(cfg.heartRateBleId).toBe("hr-123");
            expect(cfg.ergoMonitorBleId).toBe("erg-456");
        });

        it("should force HR off and clear BLE ids on insecure context and persist them", (): void => {
            withInsecureContext();

            spyOn(localStorage, "getItem").and.returnValue(null);
            const setItemSpy = spyOn(localStorage, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();

            expect(cfg.heartRateMonitor).toBe("off");
            expect(cfg.heartRateBleId).toBe("");
            expect(cfg.ergoMonitorBleId).toBe("");
            expect(setItemSpy).toHaveBeenCalledWith("heartRateMonitor", "off");
            expect(setItemSpy).toHaveBeenCalledWith("heartRateBleId", "");
            expect(setItemSpy).toHaveBeenCalledWith("ergoMonitorBleId", "");
        });

        it("should force HR off and clear BLE ids when bluetooth API is unavailable and persist them", (): void => {
            withNoBluetooth();

            spyOn(localStorage, "getItem").and.returnValue(null);
            const setItemSpy = spyOn(localStorage, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();

            expect(cfg.heartRateMonitor).toBe("off");
            expect(cfg.heartRateBleId).toBe("");
            expect(cfg.ergoMonitorBleId).toBe("");
            expect(setItemSpy).toHaveBeenCalledWith("heartRateMonitor", "off");
            expect(setItemSpy).toHaveBeenCalledWith("heartRateBleId", "");
            expect(setItemSpy).toHaveBeenCalledWith("ergoMonitorBleId", "");
        });
    });

    describe("getConfig method", (): void => {
        it("should return a copy of the current config", (): void => {
            withSecureContextAndBluetooth();
            spyOn(localStorage, "getItem").and.returnValue(null);

            configManagerService = TestBed.inject(ConfigManagerService);

            const cfg = configManagerService.getConfig();
            cfg.heartRateMonitor = "ble";

            expect(configManagerService.getItem("heartRateMonitor")).toBe("off");
        });
    });

    describe("getItem method", (): void => {
        it("should return the value for a given key", (): void => {
            withSecureContextAndBluetooth();
            spyOn(localStorage, "getItem").and.callFake((key: string): string | null => {
                return key === "heartRateMonitor" ? "ant" : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            expect(configManagerService.getItem("heartRateMonitor")).toBe("ant");
        });
    });

    describe("setItem method", (): void => {
        it("should persist to localStorage and update the in-memory value", (): void => {
            withSecureContextAndBluetooth();
            spyOn(localStorage, "getItem").and.returnValue(null);
            const setItemSpy = spyOn(localStorage, "setItem");

            configManagerService = TestBed.inject(ConfigManagerService);

            configManagerService.setItem("heartRateMonitor", "ble");

            expect(setItemSpy).toHaveBeenCalledWith("heartRateMonitor", "ble");
            expect(configManagerService.getItem("heartRateMonitor")).toBe("ble");

            configManagerService.setItem("heartRateMonitor", "ant");
            expect(configManagerService.getItem("heartRateMonitor")).toBe("ant");
        });
    });

    describe("heartRateMonitorChanged$ observable", (): void => {
        it("should emit initial value and next values only when heartRateMonitor changes", (): void => {
            withSecureContextAndBluetooth();
            spyOn(localStorage, "getItem").and.callFake((key: string): string | null => {
                return key === "heartRateMonitor" ? "off" : null;
            });

            configManagerService = TestBed.inject(ConfigManagerService);

            const events: Array<HeartRateMonitorMode> = [];
            configManagerService.heartRateMonitorChanged$.subscribe((mode: HeartRateMonitorMode): void => {
                events.push(mode);
            });

            expect(events).toHaveSize(1);
            expect(events[0]).toBe("off");

            configManagerService.setItem("ergoMonitorBleId", "foo");
            expect(events).toHaveSize(1);

            configManagerService.setItem("heartRateMonitor", "ble");
            expect(events[events.length - 1]).toBe("ble");
            expect(events).toHaveSize(2);
        });
    });
});
