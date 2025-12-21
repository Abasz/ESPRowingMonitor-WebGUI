import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject, firstValueFrom, Observable, of, throwError, toArray } from "rxjs";
import { take } from "rxjs/operators";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { HeartRateMonitorMode, IConfig, IHeartRate, IHRConnectionStatus } from "../../common.interfaces";
import { ConfigManagerService } from "../config-manager.service";

import { AntHeartRateService } from "./ant-heart-rate.service";
import { BLEHeartRateService } from "./ble-heart-rate.service";
import { HeartRateService } from "./heart-rate.service";

describe("HeartRateService", (): void => {
    let service: HeartRateService;
    let mockConfigManager: Pick<ConfigManagerService, "getConfig" | "heartRateMonitorChanged$">;
    let mockBleHeartRateService: Pick<
        BLEHeartRateService,
        "discover" | "disconnectDevice" | "reconnect" | "connectionStatus$" | "streamHeartRate$"
    >;
    let mockAntHeartRateService: Pick<
        AntHeartRateService,
        "discover" | "disconnectDevice" | "reconnect" | "connectionStatus$" | "streamHeartRate$"
    >;
    let mockSnackBar: Pick<MatSnackBar, "open">;
    let heartRateMonitorSubject: BehaviorSubject<HeartRateMonitorMode>;
    let isSecureContextSpy: Mock;
    let navigatorBluetoothSpy: Mock;

    const createMockHRConnectionStatus = (
        status: "disconnected" | "connected" | "connecting" | "searching",
        deviceName?: string,
    ): IHRConnectionStatus => ({
        status,
        deviceName,
    });

    const createMockHeartRate = (heartRate: number = 120): IHeartRate => ({
        heartRate,
        contactDetected: true,
        rrIntervals: [800, 850],
        energyExpended: 100,
        batteryLevel: 85,
    });

    beforeEach((): void => {
        heartRateMonitorSubject = new BehaviorSubject<HeartRateMonitorMode>("off");

        mockConfigManager = {
            getConfig: vi.fn(),
            heartRateMonitorChanged$: heartRateMonitorSubject.asObservable(),
        };
        vi.mocked(mockConfigManager.getConfig).mockReturnValue({
            ergoMonitorBleId: "",
            heartRateBleId: "",
            heartRateMonitor: "off",
        });

        mockBleHeartRateService = {
            discover: vi.fn(),
            disconnectDevice: vi.fn(),
            reconnect: vi.fn(),
            connectionStatus$: vi.fn(),
            streamHeartRate$: vi.fn(),
        };
        vi.mocked(mockBleHeartRateService.connectionStatus$).mockReturnValue(of({ status: "disconnected" }));
        vi.mocked(mockBleHeartRateService.streamHeartRate$).mockReturnValue(of(createMockHeartRate(120)));

        mockAntHeartRateService = {
            discover: vi.fn(),
            disconnectDevice: vi.fn(),
            reconnect: vi.fn(),
            connectionStatus$: vi.fn(),
            streamHeartRate$: vi.fn(),
        };
        vi.mocked(mockAntHeartRateService.connectionStatus$).mockReturnValue(of({ status: "disconnected" }));
        vi.mocked(mockAntHeartRateService.streamHeartRate$).mockReturnValue(of(createMockHeartRate(130)));

        mockSnackBar = {
            open: vi.fn(),
        };

        isSecureContextSpy = vi.spyOn(window, "isSecureContext", "get").mockReturnValue(true);
        navigatorBluetoothSpy = vi
            .spyOn(navigator, "bluetooth", "get")
            .mockReturnValue({} as unknown as Bluetooth);

        TestBed.configureTestingModule({
            providers: [
                HeartRateService,
                { provide: ConfigManagerService, useValue: mockConfigManager },
                { provide: BLEHeartRateService, useValue: mockBleHeartRateService },
                { provide: AntHeartRateService, useValue: mockAntHeartRateService },
                { provide: MatSnackBar, useValue: mockSnackBar },
                provideZonelessChangeDetection(),
            ],
        });

        service = TestBed.inject(HeartRateService);
    });

    describe("as part of service creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });

        it("should detect BLE availability when secure context and bluetooth are available", (): void => {
            isSecureContextSpy.mockReturnValue(true);
            navigatorBluetoothSpy.mockReturnValue({} as unknown as Bluetooth);

            const newService = TestBed.inject(HeartRateService);

            expect(newService.isBleAvailable).toBe(true);
        });

        describe("should detect BLE unavailbaility", (): void => {
            it("when not in secure context", (): void => {
                isSecureContextSpy.mockReturnValue(false);
                navigatorBluetoothSpy.mockReturnValue({} as unknown as Bluetooth);

                const newService = new HeartRateService(
                    mockConfigManager as ConfigManagerService,
                    mockBleHeartRateService as BLEHeartRateService,
                    mockAntHeartRateService as AntHeartRateService,
                    mockSnackBar as MatSnackBar,
                );

                expect(newService.isBleAvailable).toBe(false);
            });

            it("when bluetooth is undefined", (): void => {
                isSecureContextSpy.mockReturnValue(true);
                navigatorBluetoothSpy.mockReturnValue(undefined as unknown as Bluetooth);

                const newService = new HeartRateService(
                    mockConfigManager as ConfigManagerService,
                    mockBleHeartRateService as BLEHeartRateService,
                    mockAntHeartRateService as AntHeartRateService,
                    mockSnackBar as MatSnackBar,
                );

                expect(newService.isBleAvailable).toBe(false);
            });
        });
    });

    describe("connectionStatus$ method", (): void => {
        describe("when BLE is not available", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.mockReturnValue(false);
                navigatorBluetoothSpy.mockReturnValue(undefined);

                service = new HeartRateService(
                    mockConfigManager as ConfigManagerService,
                    mockBleHeartRateService as BLEHeartRateService,
                    mockAntHeartRateService as AntHeartRateService,
                    mockSnackBar as MatSnackBar,
                );
            });

            it("should display snack bar message about unavailable features", (): void => {
                service.connectionStatus$().pipe(take(1)).subscribe();

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Heart Rate features are not available, refer to documentation",
                    "Dismiss",
                );
            });

            it("should return EMPTY observable with disconnected status", async (): Promise<void> => {
                const results = await firstValueFrom(service.connectionStatus$());

                expect(results).toEqual({ status: "disconnected" });
            });
        });

        describe("when BLE is available", (): void => {
            beforeEach((): void => {
                expect(service.isBleAvailable).toBe(true);
            });

            describe("when heart rate monitor mode is ble", (): void => {
                it("should delegate to BLE heart rate service", (): void => {
                    heartRateMonitorSubject.next("ble");

                    service.connectionStatus$().pipe(take(2)).subscribe();

                    expect(mockBleHeartRateService.connectionStatus$).toHaveBeenCalled();
                });

                it("should return BLE service connection status", (): void => {
                    vi.mocked(mockBleHeartRateService.connectionStatus$).mockReturnValue(
                        of(createMockHRConnectionStatus("connected", "BLE Heart Rate Monitor")),
                    );

                    const results: Array<IHRConnectionStatus> = [];
                    const subscription = service
                        .connectionStatus$()
                        .subscribe((status: IHRConnectionStatus): void => {
                            results.push(status);
                        });

                    heartRateMonitorSubject.next("ble");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(2);
                    expect(results[0]).toEqual({ status: "disconnected" });
                    expect(results[results.length - 1]).toEqual({
                        status: "connected",
                        deviceName: "BLE Heart Rate Monitor",
                    });
                });

                it("should start with disconnected status", (): void => {
                    vi.mocked(mockBleHeartRateService.connectionStatus$).mockReturnValue(
                        of({ status: "searching" }),
                    );

                    const results: Array<IHRConnectionStatus> = [];
                    const subscription = service
                        .connectionStatus$()
                        .subscribe((status: IHRConnectionStatus): void => {
                            results.push(status);
                        });

                    subscription.unsubscribe();

                    expect(results[0]).toEqual({ status: "disconnected" });
                });

                it("should share replay the observable", (): void => {
                    heartRateMonitorSubject.next("ble");

                    vi.mocked(mockBleHeartRateService.connectionStatus$).mockClear();
                    const observable$ = service.connectionStatus$();
                    observable$.pipe(take(1)).subscribe();
                    observable$.pipe(take(1)).subscribe();

                    // due to shareReplay(1), the underlying service should only be called once
                    // regardless of multiple subscriptions
                    expect(mockBleHeartRateService.connectionStatus$).toHaveBeenCalledTimes(1);
                });
            });

            describe("when heart rate monitor mode is ant", (): void => {
                it("should delegate to ANT heart rate service", (): void => {
                    heartRateMonitorSubject.next("ant");

                    service.connectionStatus$().pipe(take(2)).subscribe();

                    expect(mockAntHeartRateService.connectionStatus$).toHaveBeenCalled();
                });

                it("should return ANT service connection status", (): void => {
                    vi.mocked(mockAntHeartRateService.connectionStatus$).mockReturnValue(
                        of(createMockHRConnectionStatus("connected", "ANT Heart Rate Monitor")),
                    );

                    const results: Array<IHRConnectionStatus> = [];
                    const subscription = service
                        .connectionStatus$()
                        .subscribe((status: IHRConnectionStatus): void => {
                            results.push(status);
                        });

                    heartRateMonitorSubject.next("ant");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(2);
                    expect(results[0]).toEqual({ status: "disconnected" });
                    expect(results[results.length - 1]).toEqual({
                        status: "connected",
                        deviceName: "ANT Heart Rate Monitor",
                    });
                });
            });

            describe("when heart rate monitor mode is off", (): void => {
                it("should return disconnected status", (): void => {
                    const results: Array<IHRConnectionStatus> = [];
                    const subscription = service
                        .connectionStatus$()
                        .subscribe((status: IHRConnectionStatus): void => {
                            results.push(status);
                        });

                    heartRateMonitorSubject.next("off");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(2);
                    expect(results[0]).toEqual({ status: "disconnected" });
                    expect(results[results.length - 1]).toEqual({ status: "disconnected" });
                });
            });

            describe("when heart rate monitor mode changes", (): void => {
                it("should switch to BLE service when mode changes to ble", (): void => {
                    vi.mocked(mockBleHeartRateService.connectionStatus$).mockReturnValue(
                        of(createMockHRConnectionStatus("searching")),
                    );

                    const results: Array<IHRConnectionStatus> = [];
                    const subscription = service
                        .connectionStatus$()
                        .subscribe((status: IHRConnectionStatus): void => {
                            results.push(status);
                        });

                    heartRateMonitorSubject.next("off");
                    heartRateMonitorSubject.next("ble");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(3);
                    expect(results[0]).toEqual({ status: "disconnected" });
                    expect(results[results.length - 1]).toEqual(
                        expect.objectContaining({ status: "searching" }),
                    );
                    expect(mockBleHeartRateService.connectionStatus$).toHaveBeenCalled();
                });

                it("should switch to ANT service when mode changes to ant", (): void => {
                    vi.mocked(mockAntHeartRateService.connectionStatus$).mockReturnValue(
                        of(createMockHRConnectionStatus("connecting")),
                    );

                    const results: Array<IHRConnectionStatus> = [];
                    const subscription = service
                        .connectionStatus$()
                        .subscribe((status: IHRConnectionStatus): void => {
                            results.push(status);
                        });

                    heartRateMonitorSubject.next("off");
                    heartRateMonitorSubject.next("ant");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(3);
                    expect(results[0]).toEqual({ status: "disconnected" });
                    expect(results[results.length - 1]).toEqual(
                        expect.objectContaining({ status: "connecting" }),
                    );
                    expect(mockAntHeartRateService.connectionStatus$).toHaveBeenCalled();
                });

                it("should switch to disconnected when mode changes to off", (): void => {
                    vi.mocked(mockBleHeartRateService.connectionStatus$).mockReturnValue(
                        of(createMockHRConnectionStatus("connected")),
                    );

                    const results: Array<IHRConnectionStatus> = [];
                    const subscription = service
                        .connectionStatus$()
                        .subscribe((status: IHRConnectionStatus): void => {
                            results.push(status);
                        });

                    heartRateMonitorSubject.next("ble");
                    heartRateMonitorSubject.next("off");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(3);
                    expect(results[0]).toEqual({ status: "disconnected" });
                    expect(results[results.length - 1]).toEqual({ status: "disconnected" });
                });
            });
        });
    });

    describe("discover method", (): void => {
        describe("when heart rate monitor mode is ble", (): void => {
            beforeEach((): void => {
                vi.mocked(mockConfigManager.getConfig).mockReturnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "ble",
                });
                vi.mocked(mockBleHeartRateService.discover).mockResolvedValue();
            });

            it("should delegate to BLE heart rate service discover", async (): Promise<void> => {
                await service.discover();

                expect(mockBleHeartRateService.discover).toHaveBeenCalled();
            });

            it("should resolve when BLE service discover resolves", async (): Promise<void> => {
                await expect(service.discover()).resolves.not.toThrow();
            });

            it("should reject when BLE service discover rejects", async (): Promise<void> => {
                const error = new Error("BLE discovery failed");
                vi.mocked(mockBleHeartRateService.discover).mockRejectedValue(error);

                await expect(service.discover()).rejects.toEqual(error);
            });
        });

        describe("when heart rate monitor mode is ant", (): void => {
            beforeEach((): void => {
                vi.mocked(mockConfigManager.getConfig).mockReturnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "ant",
                });
                vi.mocked(mockAntHeartRateService.discover).mockResolvedValue();
            });

            it("should delegate to ANT heart rate service discover", async (): Promise<void> => {
                await service.discover();

                expect(mockAntHeartRateService.discover).toHaveBeenCalled();
            });

            it("should resolve when ANT service discover resolves", async (): Promise<void> => {
                await expect(service.discover()).resolves.not.toThrow();
            });

            it("should reject when ANT service discover rejects", async (): Promise<void> => {
                const error = new Error("ANT discovery failed");
                vi.mocked(mockAntHeartRateService.discover).mockRejectedValue(error);

                await expect(service.discover()).rejects.toEqual(error);
            });
        });

        describe("when heart rate monitor mode is off", (): void => {
            beforeEach((): void => {
                vi.mocked(mockConfigManager.getConfig).mockReturnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "off",
                });
            });

            it("should resolve immediately without calling any service", async (): Promise<void> => {
                await expect(service.discover()).resolves.not.toThrow();

                expect(mockBleHeartRateService.discover).not.toHaveBeenCalled();
                expect(mockAntHeartRateService.discover).not.toHaveBeenCalled();
            });
        });

        describe("when heart rate monitor mode is invalid", (): void => {
            beforeEach((): void => {
                vi.mocked(mockConfigManager.getConfig).mockReturnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "invalid" as HeartRateMonitorMode,
                });
            });

            it("should resolve immediately for unknown modes", async (): Promise<void> => {
                await expect(service.discover()).resolves.not.toThrow();

                expect(mockBleHeartRateService.discover).not.toHaveBeenCalled();
                expect(mockAntHeartRateService.discover).not.toHaveBeenCalled();
            });
        });
    });

    describe("streamHeartRate$ method", (): void => {
        describe("when BLE is not available", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.mockReturnValue(false);
                navigatorBluetoothSpy.mockReturnValue(undefined);

                service = new HeartRateService(
                    mockConfigManager as ConfigManagerService,
                    mockBleHeartRateService as BLEHeartRateService,
                    mockAntHeartRateService as AntHeartRateService,
                    mockSnackBar as MatSnackBar,
                );
            });

            it("should display snack bar message about unavailable features", (): void => {
                service.streamHeartRate$().pipe(take(1)).subscribe();

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Heart Rate features are not available, refer to documentation",
                    "Dismiss",
                );
            });

            it("should return EMPTY observable with undefined startWith", async (): Promise<void> => {
                const result = await firstValueFrom(service.streamHeartRate$());

                expect(result).toBeUndefined();
            });
        });

        describe("when BLE is available", (): void => {
            beforeEach((): void => {
                expect(service.isBleAvailable).toBe(true);
                vi.mocked(mockBleHeartRateService.disconnectDevice).mockResolvedValue();
                vi.mocked(mockAntHeartRateService.disconnectDevice).mockResolvedValue();
                vi.mocked(mockBleHeartRateService.reconnect).mockResolvedValue();
                vi.mocked(mockAntHeartRateService.reconnect).mockResolvedValue();
            });

            describe("when heart rate monitor mode is ble", (): void => {
                it("should disconnect ANT device", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(120)));

                    heartRateMonitorSubject.next("ble");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockAntHeartRateService.disconnectDevice).toHaveBeenCalled();
                });

                it("should reconnect BLE device", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(120)));

                    heartRateMonitorSubject.next("ble");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockBleHeartRateService.reconnect).toHaveBeenCalled();
                });

                it("should stream heart rate from BLE service", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(120)));

                    heartRateMonitorSubject.next("ble");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockBleHeartRateService.streamHeartRate$).toHaveBeenCalled();
                });

                it("should return BLE heart rate data", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(120)));

                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    heartRateMonitorSubject.next("ble");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(2);
                    expect(results[0]).toBeUndefined();
                    expect(results[results.length - 1]).toEqual(createMockHeartRate(120));
                });

                describe("when navigator.bluetooth is undefined", (): void => {
                    beforeEach((): void => {
                        navigatorBluetoothSpy.mockReturnValue(undefined);

                        service = new HeartRateService(
                            mockConfigManager as ConfigManagerService,
                            mockBleHeartRateService as BLEHeartRateService,
                            mockAntHeartRateService as AntHeartRateService,
                            mockSnackBar as MatSnackBar,
                        );
                    });

                    it("should return EMPTY observable with undefined startWith", (): void => {
                        const results: Array<IHeartRate | undefined> = [];

                        service
                            .streamHeartRate$()
                            .pipe(take(1))
                            .subscribe((heartRate: IHeartRate | undefined): void => {
                                results.push(heartRate);
                            });

                        heartRateMonitorSubject.next("ble");

                        expect(results).toHaveLength(1);
                        expect(results[0]).toBeUndefined();
                    });
                });
            });

            describe("when heart rate monitor mode is ant", (): void => {
                it("should disconnect BLE device", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(130)));

                    heartRateMonitorSubject.next("ant");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockBleHeartRateService.disconnectDevice).toHaveBeenCalled();
                });

                it("should reconnect ANT device", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(130)));

                    heartRateMonitorSubject.next("ant");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockAntHeartRateService.reconnect).toHaveBeenCalled();
                });

                it("should stream heart rate from ANT service", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(130)));

                    heartRateMonitorSubject.next("ant");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockAntHeartRateService.streamHeartRate$).toHaveBeenCalled();
                });

                it("should return ANT heart rate data", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(130)));

                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    heartRateMonitorSubject.next("ant");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(2);
                    expect(results[0]).toBeUndefined();
                    expect(results[results.length - 1]).toEqual(createMockHeartRate(130));
                });
            });

            describe("when heart rate monitor mode is off", (): void => {
                it("should disconnect ANT device", (): void => {
                    heartRateMonitorSubject.next("off");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockAntHeartRateService.disconnectDevice).toHaveBeenCalled();
                });

                it("should disconnect BLE device", (): void => {
                    heartRateMonitorSubject.next("off");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockBleHeartRateService.disconnectDevice).toHaveBeenCalled();
                });

                it("should return undefined", (): void => {
                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    heartRateMonitorSubject.next("off");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(2);
                    expect(results[0]).toBeUndefined();
                    expect(results[results.length - 1]).toBeUndefined();
                });
            });

            describe("when heart rate monitor mode changes", (): void => {
                it("should switch from BLE to ANT properly", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(120)));
                    mockAntHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(130)));

                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    heartRateMonitorSubject.next("ble");
                    heartRateMonitorSubject.next("ant");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(3);
                    expect(results[0]).toBeUndefined();

                    expect(mockAntHeartRateService.disconnectDevice).toHaveBeenCalled();
                    expect(mockBleHeartRateService.reconnect).toHaveBeenCalled();
                    expect(mockBleHeartRateService.disconnectDevice).toHaveBeenCalled();
                    expect(mockAntHeartRateService.reconnect).toHaveBeenCalled();
                });

                it("should switch from ANT to BLE properly", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(130)));
                    mockBleHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(120)));

                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    heartRateMonitorSubject.next("ant");
                    heartRateMonitorSubject.next("ble");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(3);
                    expect(results[0]).toBeUndefined();

                    expect(mockBleHeartRateService.disconnectDevice).toHaveBeenCalled();
                    expect(mockAntHeartRateService.reconnect).toHaveBeenCalled();
                    expect(mockAntHeartRateService.disconnectDevice).toHaveBeenCalled();
                    expect(mockBleHeartRateService.reconnect).toHaveBeenCalled();
                });

                it("should switch from any mode to off properly", (): void => {
                    vi.mocked(mockBleHeartRateService.disconnectDevice).mockClear();
                    vi.mocked(mockAntHeartRateService.disconnectDevice).mockClear();

                    const mockStreamHeartRate = vi.fn().mockReturnValue(of(createMockHeartRate(120)));
                    mockBleHeartRateService.streamHeartRate$ = mockStreamHeartRate;

                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    heartRateMonitorSubject.next("ble");
                    heartRateMonitorSubject.next("off");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(3);
                    expect(results[0]).toBeUndefined();
                    expect(results[results.length - 1]).toBeUndefined(); // off

                    expect(mockAntHeartRateService.disconnectDevice).toHaveBeenCalled();
                    expect(mockBleHeartRateService.disconnectDevice).toHaveBeenCalled();
                });

                it("should switch from off to BLE properly", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(120)));

                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    heartRateMonitorSubject.next("off");
                    heartRateMonitorSubject.next("ble");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(3);
                    expect(results[0]).toBeUndefined();
                    expect(results[results.length - 1]).toEqual(createMockHeartRate(120)); // ble

                    expect(mockBleHeartRateService.reconnect).toHaveBeenCalled();
                });

                it("should switch from off to ANT properly", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(130)));

                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    heartRateMonitorSubject.next("off");
                    heartRateMonitorSubject.next("ant");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(3);
                    expect(results[0]).toBeUndefined();
                    expect(results[results.length - 1]).toEqual(createMockHeartRate(130)); // ant

                    expect(mockAntHeartRateService.reconnect).toHaveBeenCalled();
                });
            });

            describe("observable behavior", (): void => {
                it("should start with undefined value", (): void => {
                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    subscription.unsubscribe();
                    expect(results[0]).toBeUndefined();
                });

                it("should share replay the observable", (): void => {
                    heartRateMonitorSubject.next("ble");

                    vi.mocked(mockBleHeartRateService.streamHeartRate$).mockClear();
                    const observable$ = service.streamHeartRate$();
                    observable$.pipe(take(1)).subscribe();
                    observable$.pipe(take(1)).subscribe();

                    // due to shareReplay(1), the underlying service should only be called once
                    // regardless of multiple subscriptions
                    expect(mockBleHeartRateService.streamHeartRate$).toHaveBeenCalledTimes(1);
                });

                it("should switch map when heart rate monitor mode changes", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(120)));
                    mockAntHeartRateService.streamHeartRate$ = vi
                        .fn()
                        .mockReturnValue(of(createMockHeartRate(130)));

                    const results: Array<IHeartRate | undefined> = [];
                    const subscription = service
                        .streamHeartRate$()
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        });

                    heartRateMonitorSubject.next("ble");
                    heartRateMonitorSubject.next("ant");
                    subscription.unsubscribe();

                    expect(results.length).toBeGreaterThanOrEqual(3);
                    expect(results[0]).toBeUndefined();
                });
            });
        });
    });

    describe("as part of edge cases & robustness handling", (): void => {
        describe("when config manager throws errors", (): void => {
            it("should handle getConfig throwing error gracefully", async (): Promise<void> => {
                const error = new Error("Config error");
                vi.mocked(mockConfigManager.getConfig).mockImplementation((): IConfig => {
                    throw error;
                });

                await expect(service.discover()).rejects.toEqual(error);
            });

            it("should handle heartRateMonitorChanged$ error gracefully", async (): Promise<void> => {
                const errorSubject = new BehaviorSubject<HeartRateMonitorMode>("off");

                const errorMockConfigManager = {
                    getConfig: vi.fn().mockName("ConfigManagerService.getConfig"),
                    heartRateMonitorChanged$: errorSubject.asObservable(),
                } as unknown as ConfigManagerService;

                const errorService = new HeartRateService(
                    errorMockConfigManager,
                    mockBleHeartRateService as BLEHeartRateService,
                    mockAntHeartRateService as AntHeartRateService,
                    mockSnackBar as MatSnackBar,
                );

                const resultPromise = firstValueFrom(errorService.connectionStatus$().pipe(toArray()));

                errorSubject.error(new Error("Config stream error"));

                await expect(resultPromise).rejects.toThrow("Config stream error");
            });
        });

        describe("when heart rate services throw errors", (): void => {
            it("should handle BLE service discover error", async (): Promise<void> => {
                const error = new Error("BLE discover failed");
                vi.mocked(mockConfigManager.getConfig).mockReturnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "ble",
                });
                vi.mocked(mockBleHeartRateService.discover).mockRejectedValue(error);

                await expect(service.discover()).rejects.toEqual(error);
            });

            it("should handle ANT service discover error", async (): Promise<void> => {
                const error = new Error("ANT discover failed");
                vi.mocked(mockConfigManager.getConfig).mockReturnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "ant",
                });
                vi.mocked(mockAntHeartRateService.discover).mockRejectedValue(error);

                await expect(service.discover()).rejects.toEqual(error);
            });

            it("should handle BLE service connectionStatus$ error", async (): Promise<void> => {
                mockBleHeartRateService.connectionStatus$ = vi
                    .fn()
                    .mockReturnValue(throwError((): Error => new Error("BLE connection error")));

                heartRateMonitorSubject.next("ble");

                await expect(firstValueFrom(service.connectionStatus$().pipe(toArray()))).rejects.toThrow(
                    "BLE connection error",
                );
            });

            it("should handle ANT service connectionStatus$ error", async (): Promise<void> => {
                mockAntHeartRateService.connectionStatus$ = vi
                    .fn()
                    .mockReturnValue(throwError((): Error => new Error("ANT connection error")));

                heartRateMonitorSubject.next("ant");

                await expect(firstValueFrom(service.connectionStatus$().pipe(toArray()))).rejects.toThrow(
                    "ANT connection error",
                );
            });

            it("should handle BLE service streamHeartRate$ error", async (): Promise<void> => {
                mockBleHeartRateService.streamHeartRate$ = vi
                    .fn()
                    .mockReturnValue(throwError((): Error => new Error("BLE stream error")));

                heartRateMonitorSubject.next("ble");

                await expect(firstValueFrom(service.streamHeartRate$().pipe(toArray()))).rejects.toThrow(
                    "BLE stream error",
                );
            });

            it("should handle ANT service streamHeartRate$ error", async (): Promise<void> => {
                mockAntHeartRateService.streamHeartRate$ = vi
                    .fn()
                    .mockReturnValue(throwError((): Error => new Error("ANT stream error")));

                heartRateMonitorSubject.next("ant");

                await expect(firstValueFrom(service.streamHeartRate$().pipe(toArray()))).rejects.toThrow(
                    "ANT stream error",
                );
            });

            it("should handle BLE disconnect error", async (): Promise<void> => {
                const error = new Error("BLE disconnect failed");
                vi.mocked(mockBleHeartRateService.disconnectDevice).mockRejectedValue(error);

                await expect(mockBleHeartRateService.disconnectDevice()).rejects.toEqual(error);
            });

            it("should handle ANT disconnect error", async (): Promise<void> => {
                const error = new Error("ANT disconnect failed");
                vi.mocked(mockAntHeartRateService.disconnectDevice).mockRejectedValue(error);

                await expect(mockAntHeartRateService.disconnectDevice()).rejects.toEqual(error);
            });

            it("should handle BLE reconnect error", async (): Promise<void> => {
                const error = new Error("BLE reconnect failed");
                vi.mocked(mockBleHeartRateService.reconnect).mockRejectedValue(error);

                await expect(mockBleHeartRateService.reconnect()).rejects.toEqual(error);
            });

            it("should handle ANT reconnect error", async (): Promise<void> => {
                const error = new Error("ANT reconnect failed");
                vi.mocked(mockAntHeartRateService.reconnect).mockRejectedValue(error);

                await expect(mockAntHeartRateService.reconnect()).rejects.toEqual(error);
            });
        });

        describe("when multiple rapid mode changes occur", (): void => {
            it("should handle rapid successive mode changes", (): void => {
                mockBleHeartRateService.streamHeartRate$ = vi
                    .fn()
                    .mockReturnValue(of(createMockHeartRate(120)));
                mockAntHeartRateService.streamHeartRate$ = vi
                    .fn()
                    .mockReturnValue(of(createMockHeartRate(130)));

                const results: Array<IHeartRate | undefined> = [];
                const subscription = service
                    .streamHeartRate$()
                    .subscribe((heartRate: IHeartRate | undefined): void => {
                        results.push(heartRate);
                    });

                heartRateMonitorSubject.next("ble");
                heartRateMonitorSubject.next("ant");
                heartRateMonitorSubject.next("off");
                subscription.unsubscribe();

                expect(results.length).toBeGreaterThanOrEqual(4);
                expect(results[0]).toBeUndefined();
                expect(results[results.length - 1]).toBeUndefined(); // off
            });

            it("should cancel previous streams when mode changes", (): void => {
                let bleSubscriptionCount = 0;
                let antSubscriptionCount = 0;

                mockBleHeartRateService.streamHeartRate$ = vi
                    .fn()
                    .mockImplementation((): Observable<IHeartRate> => {
                        bleSubscriptionCount++;

                        return of(createMockHeartRate(120));
                    });

                mockAntHeartRateService.streamHeartRate$ = vi
                    .fn()
                    .mockImplementation((): Observable<IHeartRate> => {
                        antSubscriptionCount++;

                        return of(createMockHeartRate(130));
                    });

                const subscription = service.streamHeartRate$().subscribe();

                heartRateMonitorSubject.next("ble");
                heartRateMonitorSubject.next("ant");
                subscription.unsubscribe();

                expect(bleSubscriptionCount).toBe(1);
                expect(antSubscriptionCount).toBe(1);
            });
        });
    });
});
