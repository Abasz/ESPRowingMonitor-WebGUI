import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject, Observable, of, throwError } from "rxjs";
import { take } from "rxjs/operators";

import { HeartRateMonitorMode, IHeartRate, IHRConnectionStatus } from "../../common.interfaces";
import { ConfigManagerService } from "../config-manager.service";

import { AntHeartRateService } from "./ant-heart-rate.service";
import { BLEHeartRateService } from "./ble-heart-rate.service";
import { HeartRateService } from "./heart-rate.service";

describe("HeartRateService", (): void => {
    let service: HeartRateService;
    let mockConfigManager: jasmine.SpyObj<ConfigManagerService>;
    let mockBleHeartRateService: jasmine.SpyObj<BLEHeartRateService>;
    let mockAntHeartRateService: jasmine.SpyObj<AntHeartRateService>;
    let mockSnackBar: jasmine.SpyObj<MatSnackBar>;
    let heartRateMonitorSubject: BehaviorSubject<HeartRateMonitorMode>;
    let isSecureContextSpy: jasmine.Spy<() => boolean>;
    let navigatorBluetoothSpy: jasmine.Spy<() => Bluetooth | undefined>;

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

        mockConfigManager = jasmine.createSpyObj("ConfigManagerService", ["getConfig"], {
            heartRateMonitorChanged$: heartRateMonitorSubject.asObservable(),
        });
        mockConfigManager.getConfig.and.returnValue({
            ergoMonitorBleId: "",
            heartRateBleId: "",
            heartRateMonitor: "off",
        });

        mockBleHeartRateService = jasmine.createSpyObj("BLEHeartRateService", [
            "discover",
            "disconnectDevice",
            "reconnect",
            "connectionStatus$",
            "streamHeartRate$",
        ]);
        mockBleHeartRateService.connectionStatus$.and.returnValue(of({ status: "disconnected" }));
        mockBleHeartRateService.streamHeartRate$.and.returnValue(of(createMockHeartRate(120)));

        mockAntHeartRateService = jasmine.createSpyObj("AntHeartRateService", [
            "discover",
            "disconnectDevice",
            "reconnect",
            "connectionStatus$",
            "streamHeartRate$",
        ]);
        mockAntHeartRateService.connectionStatus$.and.returnValue(of({ status: "disconnected" }));
        mockAntHeartRateService.streamHeartRate$.and.returnValue(of(createMockHeartRate(130)));

        mockSnackBar = jasmine.createSpyObj("MatSnackBar", ["open"]);

        isSecureContextSpy = spyOnProperty(window, "isSecureContext", "get").and.returnValue(true);
        navigatorBluetoothSpy = spyOnProperty(navigator, "bluetooth", "get").and.returnValue(
            {} as unknown as Bluetooth,
        );

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
            isSecureContextSpy.and.returnValue(true);
            navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

            const newService = TestBed.inject(HeartRateService);

            expect(newService.isBleAvailable).toBe(true);
        });

        describe("should detect BLE unavailbaility", (): void => {
            it("when not in secure context", (): void => {
                isSecureContextSpy.and.returnValue(false);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                const newService = new HeartRateService(
                    mockConfigManager,
                    mockBleHeartRateService,
                    mockAntHeartRateService,
                    mockSnackBar,
                );

                expect(newService.isBleAvailable).toBe(false);
            });

            it("when bluetooth is undefined", (): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue(undefined as unknown as Bluetooth);

                const newService = new HeartRateService(
                    mockConfigManager,
                    mockBleHeartRateService,
                    mockAntHeartRateService,
                    mockSnackBar,
                );

                expect(newService.isBleAvailable).toBe(false);
            });
        });
    });

    describe("connectionStatus$ method", (): void => {
        describe("when BLE is not available", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(false);
                navigatorBluetoothSpy.and.returnValue(undefined);

                service = new HeartRateService(
                    mockConfigManager,
                    mockBleHeartRateService,
                    mockAntHeartRateService,
                    mockSnackBar,
                );
            });

            it("should display snack bar message about unavailable features", (): void => {
                service.connectionStatus$().pipe(take(1)).subscribe();

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Heart Rate features are not available, refer to documentation",
                    "Dismiss",
                );
            });

            it("should return EMPTY observable with disconnected status", (done: DoneFn): void => {
                const results: Array<IHRConnectionStatus> = [];

                service.connectionStatus$().subscribe({
                    next: (status: IHRConnectionStatus): void => {
                        results.push(status);
                    },
                    complete: (): void => {
                        expect(results).toHaveSize(1);
                        expect(results[0]).toEqual({ status: "disconnected" });
                        done();
                    },
                });
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
                    mockBleHeartRateService.connectionStatus$.and.returnValue(
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
                    mockBleHeartRateService.connectionStatus$.and.returnValue(of({ status: "searching" }));

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

                    mockBleHeartRateService.connectionStatus$.calls.reset();
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
                    mockAntHeartRateService.connectionStatus$.and.returnValue(
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
                    mockBleHeartRateService.connectionStatus$.and.returnValue(
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
                        jasmine.objectContaining({ status: "searching" }),
                    );
                    expect(mockBleHeartRateService.connectionStatus$).toHaveBeenCalled();
                });

                it("should switch to ANT service when mode changes to ant", (): void => {
                    mockAntHeartRateService.connectionStatus$.and.returnValue(
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
                        jasmine.objectContaining({ status: "connecting" }),
                    );
                    expect(mockAntHeartRateService.connectionStatus$).toHaveBeenCalled();
                });

                it("should switch to disconnected when mode changes to off", (): void => {
                    mockBleHeartRateService.connectionStatus$.and.returnValue(
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
                mockConfigManager.getConfig.and.returnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "ble",
                });
                mockBleHeartRateService.discover.and.resolveTo();
            });

            it("should delegate to BLE heart rate service discover", async (): Promise<void> => {
                await service.discover();

                expect(mockBleHeartRateService.discover).toHaveBeenCalled();
            });

            it("should resolve when BLE service discover resolves", async (): Promise<void> => {
                await expectAsync(service.discover()).toBeResolved();
            });

            it("should reject when BLE service discover rejects", async (): Promise<void> => {
                const error = new Error("BLE discovery failed");
                mockBleHeartRateService.discover.and.rejectWith(error);

                await expectAsync(service.discover()).toBeRejectedWith(error);
            });
        });

        describe("when heart rate monitor mode is ant", (): void => {
            beforeEach((): void => {
                mockConfigManager.getConfig.and.returnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "ant",
                });
                mockAntHeartRateService.discover.and.resolveTo();
            });

            it("should delegate to ANT heart rate service discover", async (): Promise<void> => {
                await service.discover();

                expect(mockAntHeartRateService.discover).toHaveBeenCalled();
            });

            it("should resolve when ANT service discover resolves", async (): Promise<void> => {
                await expectAsync(service.discover()).toBeResolved();
            });

            it("should reject when ANT service discover rejects", async (): Promise<void> => {
                const error = new Error("ANT discovery failed");
                mockAntHeartRateService.discover.and.rejectWith(error);

                await expectAsync(service.discover()).toBeRejectedWith(error);
            });
        });

        describe("when heart rate monitor mode is off", (): void => {
            beforeEach((): void => {
                mockConfigManager.getConfig.and.returnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "off",
                });
            });

            it("should resolve immediately without calling any service", async (): Promise<void> => {
                await expectAsync(service.discover()).toBeResolved();

                expect(mockBleHeartRateService.discover).not.toHaveBeenCalled();
                expect(mockAntHeartRateService.discover).not.toHaveBeenCalled();
            });
        });

        describe("when heart rate monitor mode is invalid", (): void => {
            beforeEach((): void => {
                mockConfigManager.getConfig.and.returnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "invalid" as HeartRateMonitorMode,
                });
            });

            it("should resolve immediately for unknown modes", async (): Promise<void> => {
                await expectAsync(service.discover()).toBeResolved();

                expect(mockBleHeartRateService.discover).not.toHaveBeenCalled();
                expect(mockAntHeartRateService.discover).not.toHaveBeenCalled();
            });
        });
    });

    describe("streamHeartRate$ method", (): void => {
        describe("when BLE is not available", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(false);
                navigatorBluetoothSpy.and.returnValue(undefined);

                service = new HeartRateService(
                    mockConfigManager,
                    mockBleHeartRateService,
                    mockAntHeartRateService,
                    mockSnackBar,
                );
            });

            it("should display snack bar message about unavailable features", (): void => {
                service.streamHeartRate$().pipe(take(1)).subscribe();

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Heart Rate features are not available, refer to documentation",
                    "Dismiss",
                );
            });

            it("should return EMPTY observable with undefined startWith", (done: DoneFn): void => {
                const results: Array<IHeartRate | undefined> = [];

                service.streamHeartRate$().subscribe({
                    next: (heartRate: IHeartRate | undefined): void => {
                        results.push(heartRate);
                    },
                    complete: (): void => {
                        expect(results).toHaveSize(1);
                        expect(results[0]).toBeUndefined();
                        done();
                    },
                });
            });
        });

        describe("when BLE is available", (): void => {
            beforeEach((): void => {
                expect(service.isBleAvailable).toBe(true);
                mockBleHeartRateService.disconnectDevice.and.resolveTo();
                mockAntHeartRateService.disconnectDevice.and.resolveTo();
                mockBleHeartRateService.reconnect.and.resolveTo();
                mockAntHeartRateService.reconnect.and.resolveTo();
            });

            describe("when heart rate monitor mode is ble", (): void => {
                it("should disconnect ANT device", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(120)));

                    heartRateMonitorSubject.next("ble");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockAntHeartRateService.disconnectDevice).toHaveBeenCalled();
                });

                it("should reconnect BLE device", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(120)));

                    heartRateMonitorSubject.next("ble");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockBleHeartRateService.reconnect).toHaveBeenCalled();
                });

                it("should stream heart rate from BLE service", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(120)));

                    heartRateMonitorSubject.next("ble");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockBleHeartRateService.streamHeartRate$).toHaveBeenCalled();
                });

                it("should return BLE heart rate data", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(120)));

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
                        navigatorBluetoothSpy.and.returnValue(undefined);

                        service = new HeartRateService(
                            mockConfigManager,
                            mockBleHeartRateService,
                            mockAntHeartRateService,
                            mockSnackBar,
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

                        expect(results).toHaveSize(1);
                        expect(results[0]).toBeUndefined();
                    });
                });
            });

            describe("when heart rate monitor mode is ant", (): void => {
                it("should disconnect BLE device", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(130)));

                    heartRateMonitorSubject.next("ant");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockBleHeartRateService.disconnectDevice).toHaveBeenCalled();
                });

                it("should reconnect ANT device", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(130)));

                    heartRateMonitorSubject.next("ant");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockAntHeartRateService.reconnect).toHaveBeenCalled();
                });

                it("should stream heart rate from ANT service", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(130)));

                    heartRateMonitorSubject.next("ant");
                    service.streamHeartRate$().pipe(take(2)).subscribe();

                    expect(mockAntHeartRateService.streamHeartRate$).toHaveBeenCalled();
                });

                it("should return ANT heart rate data", (): void => {
                    mockAntHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(130)));

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
                    mockBleHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(120)));
                    mockAntHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(130)));

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
                    mockAntHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(130)));
                    mockBleHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(120)));

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
                    mockBleHeartRateService.disconnectDevice.calls.reset();
                    mockAntHeartRateService.disconnectDevice.calls.reset();

                    const mockStreamHeartRate = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(120)));
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
                    mockBleHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(120)));

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
                    mockAntHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(130)));

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

                    mockBleHeartRateService.streamHeartRate$.calls.reset();
                    const observable$ = service.streamHeartRate$();
                    observable$.pipe(take(1)).subscribe();
                    observable$.pipe(take(1)).subscribe();

                    // due to shareReplay(1), the underlying service should only be called once
                    // regardless of multiple subscriptions
                    expect(mockBleHeartRateService.streamHeartRate$).toHaveBeenCalledTimes(1);
                });

                it("should switch map when heart rate monitor mode changes", (): void => {
                    mockBleHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(120)));
                    mockAntHeartRateService.streamHeartRate$ = jasmine
                        .createSpy("streamHeartRate$")
                        .and.returnValue(of(createMockHeartRate(130)));

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
                mockConfigManager.getConfig.and.throwError(error);

                await expectAsync(service.discover()).toBeRejectedWith(error);
            });

            it("should handle heartRateMonitorChanged$ error gracefully", (done: DoneFn): void => {
                const errorSubject = new BehaviorSubject<HeartRateMonitorMode>("off");

                const errorMockConfigManager = jasmine.createSpyObj("ConfigManagerService", ["getConfig"], {
                    heartRateMonitorChanged$: errorSubject.asObservable(),
                });

                const errorService = new HeartRateService(
                    errorMockConfigManager,
                    mockBleHeartRateService,
                    mockAntHeartRateService,
                    mockSnackBar,
                );

                const results: Array<IHRConnectionStatus> = [];
                errorService.connectionStatus$().subscribe({
                    next: (status: IHRConnectionStatus): void => {
                        results.push(status);
                    },
                    error: (error: Error): void => {
                        expect(error.message).toBe("Config stream error");
                        expect(results.length).toBeGreaterThanOrEqual(1);
                        done();
                    },
                });

                errorSubject.error(new Error("Config stream error"));
            });
        });

        describe("when heart rate services throw errors", (): void => {
            it("should handle BLE service discover error", async (): Promise<void> => {
                const error = new Error("BLE discover failed");
                mockConfigManager.getConfig.and.returnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "ble",
                });
                mockBleHeartRateService.discover.and.rejectWith(error);

                await expectAsync(service.discover()).toBeRejectedWith(error);
            });

            it("should handle ANT service discover error", async (): Promise<void> => {
                const error = new Error("ANT discover failed");
                mockConfigManager.getConfig.and.returnValue({
                    ergoMonitorBleId: "",
                    heartRateBleId: "",
                    heartRateMonitor: "ant",
                });
                mockAntHeartRateService.discover.and.rejectWith(error);

                await expectAsync(service.discover()).toBeRejectedWith(error);
            });

            it("should handle BLE service connectionStatus$ error", (done: DoneFn): void => {
                mockBleHeartRateService.connectionStatus$ = jasmine
                    .createSpy("connectionStatus$")
                    .and.returnValue(throwError((): Error => new Error("BLE connection error")));

                heartRateMonitorSubject.next("ble");

                service.connectionStatus$().subscribe({
                    next: (): void => {
                        // may get initial disconnected status
                    },
                    error: (error: Error): void => {
                        expect(error.message).toBe("BLE connection error");
                        done();
                    },
                });
            });

            it("should handle ANT service connectionStatus$ error", (done: DoneFn): void => {
                mockAntHeartRateService.connectionStatus$ = jasmine
                    .createSpy("connectionStatus$")
                    .and.returnValue(throwError((): Error => new Error("ANT connection error")));

                heartRateMonitorSubject.next("ant");

                service.connectionStatus$().subscribe({
                    next: (): void => {
                        // may get initial disconnected status
                    },
                    error: (error: Error): void => {
                        expect(error.message).toBe("ANT connection error");
                        done();
                    },
                });
            });

            it("should handle BLE service streamHeartRate$ error", (done: DoneFn): void => {
                mockBleHeartRateService.streamHeartRate$ = jasmine
                    .createSpy("streamHeartRate$")
                    .and.returnValue(throwError((): Error => new Error("BLE stream error")));

                heartRateMonitorSubject.next("ble");

                service.streamHeartRate$().subscribe({
                    next: (): void => {
                        // may get initial undefined value
                    },
                    error: (error: Error): void => {
                        expect(error.message).toBe("BLE stream error");
                        done();
                    },
                });
            });

            it("should handle ANT service streamHeartRate$ error", (done: DoneFn): void => {
                mockAntHeartRateService.streamHeartRate$ = jasmine
                    .createSpy("streamHeartRate$")
                    .and.returnValue(throwError((): Error => new Error("ANT stream error")));

                heartRateMonitorSubject.next("ant");

                service.streamHeartRate$().subscribe({
                    next: (): void => {
                        // may get initial undefined value
                    },
                    error: (error: Error): void => {
                        expect(error.message).toBe("ANT stream error");
                        done();
                    },
                });
            });

            it("should handle BLE disconnect error", async (): Promise<void> => {
                const error = new Error("BLE disconnect failed");
                mockBleHeartRateService.disconnectDevice.and.rejectWith(error);

                await expectAsync(mockBleHeartRateService.disconnectDevice()).toBeRejectedWith(error);
            });

            it("should handle ANT disconnect error", async (): Promise<void> => {
                const error = new Error("ANT disconnect failed");
                mockAntHeartRateService.disconnectDevice.and.rejectWith(error);

                await expectAsync(mockAntHeartRateService.disconnectDevice()).toBeRejectedWith(error);
            });

            it("should handle BLE reconnect error", async (): Promise<void> => {
                const error = new Error("BLE reconnect failed");
                mockBleHeartRateService.reconnect.and.rejectWith(error);

                await expectAsync(mockBleHeartRateService.reconnect()).toBeRejectedWith(error);
            });

            it("should handle ANT reconnect error", async (): Promise<void> => {
                const error = new Error("ANT reconnect failed");
                mockAntHeartRateService.reconnect.and.rejectWith(error);

                await expectAsync(mockAntHeartRateService.reconnect()).toBeRejectedWith(error);
            });
        });

        describe("when multiple rapid mode changes occur", (): void => {
            it("should handle rapid successive mode changes", (): void => {
                mockBleHeartRateService.streamHeartRate$ = jasmine
                    .createSpy("streamHeartRate$")
                    .and.returnValue(of(createMockHeartRate(120)));
                mockAntHeartRateService.streamHeartRate$ = jasmine
                    .createSpy("streamHeartRate$")
                    .and.returnValue(of(createMockHeartRate(130)));

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

                mockBleHeartRateService.streamHeartRate$ = jasmine
                    .createSpy("streamHeartRate$")
                    .and.callFake((): Observable<IHeartRate> => {
                        bleSubscriptionCount++;

                        return of(createMockHeartRate(120));
                    });

                mockAntHeartRateService.streamHeartRate$ = jasmine
                    .createSpy("streamHeartRate$")
                    .and.callFake((): Observable<IHeartRate> => {
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
