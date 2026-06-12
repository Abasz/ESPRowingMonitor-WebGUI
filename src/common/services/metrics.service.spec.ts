import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, firstValueFrom, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import {
    IBaseMetrics,
    IErgConnectionStatus,
    IExtendedMetrics,
    IHeartRate,
    IHRConnectionStatus,
    IRawCalculatedMetrics,
    IRowerSettings,
} from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { ErgMetricsService } from "./ergometer/erg-metric-data.service";
import { ErgSettingsService } from "./ergometer/erg-settings.service";
import { createMockRowerSettings } from "./ergometer/erg-settings.test.helpers";
import { HeartRateService } from "./heart-rate/heart-rate.service";
import { MetricsService } from "./metrics.service";

describe("MetricsService", (): void => {
    let service: MetricsService;
    let mockErgConnectionService: Pick<ErgConnectionService, "reconnect" | "connectionStatus$">;
    let mockErgMetricsService: Pick<
        ErgMetricsService,
        "streamMeasurement$" | "streamExtended$" | "streamHandleForces$" | "streamDeltaTimes$"
    >;
    let mockDataRecorderService: Pick<DataRecorderService, "addDeltaTimes" | "addConnectedDevice">;
    let mockHeartRateService: Pick<HeartRateService, "streamHeartRate$" | "connectionStatus$">;
    let mockErgSettingsService: Pick<ErgSettingsService, "rowerSettings">;
    let mockRowerSettingsSignal: WritableSignal<IRowerSettings>;

    let connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let measurementSubject: Subject<IBaseMetrics>;
    let extendedSubject: Subject<IExtendedMetrics>;
    let handleForcesSubject: Subject<Array<number>>;
    let deltaTimesSubject: Subject<Array<number>>;
    let heartRateSubject: Subject<IHeartRate | undefined>;
    let hrConnectionStatusSubject: Subject<IHRConnectionStatus>;

    const mockBaseMetrics: IBaseMetrics = {
        revTime: 1000000,
        distance: 1000,
        strokeTime: 2000000,
        strokeCount: 10,
    };

    const mockExtendedMetrics: IExtendedMetrics = {
        avgStrokePower: 100,
        driveDuration: 1000000,
        recoveryDuration: 2000000,
        dragFactor: 120,
    };

    const mockConnectionStatus: IErgConnectionStatus = {
        status: "connected",
        deviceName: "Test Device",
    };

    const mockHeartRate: IHeartRate = {
        heartRate: 150,
        rrIntervals: [800],
        contactDetected: true,
    };

    const mockHRConnectionStatus: IHRConnectionStatus = {
        status: "connected",
        deviceName: "HR Monitor",
    };

    let isSecureContextSpy: Mock;
    let navigatorSpy: Mock;

    beforeEach((): void => {
        isSecureContextSpy = vi.spyOn(globalThis, "isSecureContext", "get").mockReturnValue(false);
        navigatorSpy = vi.spyOn(globalThis, "navigator", "get").mockReturnValue({} as Navigator);

        connectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>({ status: "disconnected" });
        measurementSubject = new Subject<IBaseMetrics>();
        extendedSubject = new Subject<IExtendedMetrics>();
        handleForcesSubject = new Subject<Array<number>>();
        deltaTimesSubject = new Subject<Array<number>>();
        heartRateSubject = new Subject<IHeartRate | undefined>();
        hrConnectionStatusSubject = new Subject<IHRConnectionStatus>();

        mockErgConnectionService = {
            reconnect: vi.fn(),
            connectionStatus$: vi.fn().mockReturnValue(connectionStatusSubject.asObservable()),
        };

        mockErgMetricsService = {
            streamMeasurement$: vi.fn().mockReturnValue(measurementSubject.asObservable()),
            streamExtended$: vi.fn().mockReturnValue(extendedSubject.asObservable()),
            streamHandleForces$: vi.fn().mockReturnValue(handleForcesSubject.asObservable()),
            streamDeltaTimes$: vi.fn().mockReturnValue(deltaTimesSubject.asObservable()),
        };

        mockDataRecorderService = {
            addDeltaTimes: vi.fn(),
            addConnectedDevice: vi.fn(),
        };

        mockHeartRateService = {
            streamHeartRate$: vi.fn().mockReturnValue(heartRateSubject.asObservable()),
            connectionStatus$: vi.fn().mockReturnValue(hrConnectionStatusSubject.asObservable()),
        };

        mockRowerSettingsSignal = signal<IRowerSettings>(createMockRowerSettings());

        mockErgSettingsService = {
            rowerSettings: mockRowerSettingsSignal,
        };

        TestBed.configureTestingModule({
            providers: [
                MetricsService,
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                { provide: ErgMetricsService, useValue: mockErgMetricsService },
                { provide: ErgSettingsService, useValue: mockErgSettingsService },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                { provide: HeartRateService, useValue: mockHeartRateService },
            ],
        });
    });

    afterEach((): void => {
        vi.resetAllMocks();
    });

    describe("Service Initialization", (): void => {
        it("should instantiate the service and initialize all observables", (): void => {
            service = TestBed.inject(MetricsService);

            expect(service).toBeTruthy();
            expect(service.rawMetrics$).toBeDefined();
            expect(service.heartRateData$).toBeDefined();
            expect(service.hrConnectionStatus$).toBeDefined();
        });

        it("should call ergConnectionService.reconnect() if running in a secure context with Bluetooth available", (): void => {
            isSecureContextSpy.mockReturnValue(true);
            navigatorSpy.mockReturnValue({ bluetooth: {} } as Navigator);

            service = TestBed.inject(MetricsService);

            expect(mockErgConnectionService.reconnect).toHaveBeenCalled();
        });

        it("should not call ergConnectionService.reconnect() if not in a secure context", (): void => {
            isSecureContextSpy.mockReturnValue(false);
            navigatorSpy.mockReturnValue({ bluetooth: {} } as Navigator);

            service = TestBed.inject(MetricsService);

            expect(mockErgConnectionService.reconnect).not.toHaveBeenCalled();
        });

        it("should not call ergConnectionService.reconnect() if Bluetooth is unavailable", (): void => {
            isSecureContextSpy.mockReturnValue(true);
            navigatorSpy.mockReturnValue({} as Navigator);

            service = TestBed.inject(MetricsService);

            expect(mockErgConnectionService.reconnect).not.toHaveBeenCalled();
        });
    });

    describe("Calculation Methods", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should calculate speed correctly based on distance and time changes", async (): Promise<void> => {
            const baseMetrics1: IBaseMetrics = {
                revTime: 1000000,
                distance: 1000,
                strokeTime: 0,
                strokeCount: 0,
            };
            const baseMetrics2: IBaseMetrics = {
                revTime: 2000000,
                distance: 2000,
                strokeTime: 0,
                strokeCount: 0,
            };

            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                // speed = (distance_diff / 100) / (time_diff / 1e6)
                // expected: (1000 / 100) / ((2000000 - 1000000) / 1e6) = 10 / 1 = 10 m/s
                expect(metrics.speed).toBe(10);
            });

            measurementSubject.next(baseMetrics1);
            measurementSubject.next(baseMetrics2);
        });

        it("should calculate stroke distance correctly", async (): Promise<void> => {
            const baseMetrics1: IBaseMetrics = { revTime: 0, distance: 1000, strokeTime: 0, strokeCount: 1 };
            const baseMetrics2: IBaseMetrics = { revTime: 0, distance: 2000, strokeTime: 0, strokeCount: 2 };

            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                // distPerStroke = (distance_diff / 100) / stroke_diff
                // expected: (1000 / 100) / 1 = 10 m/stroke
                expect(metrics.distPerStroke).toBe(10);
            });

            measurementSubject.next(baseMetrics1);
            measurementSubject.next(baseMetrics2);
        });

        it("should calculate stroke rate correctly", async (): Promise<void> => {
            const baseMetrics1: IBaseMetrics = {
                revTime: 0,
                distance: 0,
                strokeTime: 1000000,
                strokeCount: 1,
            };
            const baseMetrics2: IBaseMetrics = {
                revTime: 0,
                distance: 0,
                strokeTime: 2000000,
                strokeCount: 2,
            };

            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                // strokeRate = (stroke_diff / (time_diff / 1e6)) * 60
                // expected: (1 / ((2000000 - 1000000) / 1e6)) * 60 = (1 / 1) * 60 = 60 strokes/min
                expect(metrics.strokeRate).toBe(60);
            });

            measurementSubject.next(baseMetrics1);
            measurementSubject.next(baseMetrics2);
        });

        it("should return 0 for calculations when values haven't changed", async (): Promise<void> => {
            const baseMetrics = { ...mockBaseMetrics };

            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                expect(metrics.speed).toBe(0);
                expect(metrics.strokeRate).toBe(0);
                expect(metrics.distPerStroke).toBe(0);
            });

            measurementSubject.next(baseMetrics);
            measurementSubject.next(baseMetrics);
        });
    });

    describe("peakForce and peakForcePositionNorm Calculation", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should compute peakForce and peakForcePositionNorm for a typical force curve", async (): Promise<void> => {
            const metricsPromise = firstValueFrom(service.rawMetrics$);

            measurementSubject.next(mockBaseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([10, 50, 30]);
            measurementSubject.next({
                revTime: mockBaseMetrics.revTime + 1000,
                distance: mockBaseMetrics.distance + 100,
                strokeTime: mockBaseMetrics.strokeTime + 1000,
                strokeCount: mockBaseMetrics.strokeCount + 1,
            });

            const metrics = await metricsPromise;

            expect(metrics.peakForce).toBe(50);
            // peakForceIndex = 1, length = 3 → (1 / 2) * 100 = 50
            expect(metrics.peakForcePositionNorm).toBe(50);
        });

        it("should return peakForcePositionNorm of 0 when peak is at start", async (): Promise<void> => {
            const metricsPromise = firstValueFrom(service.rawMetrics$);

            measurementSubject.next(mockBaseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([100, 50, 10]);
            measurementSubject.next({
                revTime: mockBaseMetrics.revTime + 1000,
                distance: mockBaseMetrics.distance + 100,
                strokeTime: mockBaseMetrics.strokeTime + 1000,
                strokeCount: mockBaseMetrics.strokeCount + 1,
            });

            const metrics = await metricsPromise;

            expect(metrics.peakForce).toBe(100);
            // peakForceIndex = 0 → (0 / 2) * 100 = 0
            expect(metrics.peakForcePositionNorm).toBe(0);
        });

        it("should return peakForcePositionNorm of 100 when peak is at end", async (): Promise<void> => {
            const metricsPromise = firstValueFrom(service.rawMetrics$);

            measurementSubject.next(mockBaseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([10, 50, 100]);
            measurementSubject.next({
                revTime: mockBaseMetrics.revTime + 1000,
                distance: mockBaseMetrics.distance + 100,
                strokeTime: mockBaseMetrics.strokeTime + 1000,
                strokeCount: mockBaseMetrics.strokeCount + 1,
            });

            const metrics = await metricsPromise;

            expect(metrics.peakForce).toBe(100);
            // peakForceIndex = 2, length = 3 → (2 / 2) * 100 = 100
            expect(metrics.peakForcePositionNorm).toBe(100);
        });

        it("should return 0 for peakForcePositionNorm when handleForces has a single element", async (): Promise<void> => {
            const metricsPromise = firstValueFrom(service.rawMetrics$);

            measurementSubject.next(mockBaseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([42]);
            measurementSubject.next({
                revTime: mockBaseMetrics.revTime + 1000,
                distance: mockBaseMetrics.distance + 100,
                strokeTime: mockBaseMetrics.strokeTime + 1000,
                strokeCount: mockBaseMetrics.strokeCount + 1,
            });

            const metrics = await metricsPromise;

            expect(metrics.peakForce).toBe(42);
            // length <= 1 → 0
            expect(metrics.peakForcePositionNorm).toBe(0);
        });

        it("should return 0 for peakForce and peakForcePositionNorm when handleForces is empty", async (): Promise<void> => {
            const metricsPromise = firstValueFrom(service.rawMetrics$);

            measurementSubject.next(mockBaseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([]);
            measurementSubject.next({
                revTime: mockBaseMetrics.revTime + 1000,
                distance: mockBaseMetrics.distance + 100,
                strokeTime: mockBaseMetrics.strokeTime + 1000,
                strokeCount: mockBaseMetrics.strokeCount + 1,
            });

            const metrics = await metricsPromise;

            expect(metrics.peakForce).toBe(0);
            expect(metrics.peakForcePositionNorm).toBe(0);
        });

        it("should use the first occurrence when multiple elements are tied for peak", async (): Promise<void> => {
            const metricsPromise = firstValueFrom(service.rawMetrics$);

            measurementSubject.next(mockBaseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([50, 50, 50]);
            measurementSubject.next({
                revTime: mockBaseMetrics.revTime + 1000,
                distance: mockBaseMetrics.distance + 100,
                strokeTime: mockBaseMetrics.strokeTime + 1000,
                strokeCount: mockBaseMetrics.strokeCount + 1,
            });

            const metrics = await metricsPromise;

            expect(metrics.peakForce).toBe(50);
            // reduce keeps first max → peakForceIndex = 0 → (0 / 2) * 100 = 0
            expect(metrics.peakForcePositionNorm).toBe(0);
        });
    });

    describe("Data Recording Integration", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should add delta times to dataRecorder when ergMetricService.streamDeltaTimes$() emits", (): void => {
            const deltaTimes = [100, 200, 300];
            deltaTimesSubject.next(deltaTimes);

            expect(mockDataRecorderService.addDeltaTimes).toHaveBeenCalledWith(deltaTimes);
        });

        it("should not add empty delta times to dataRecorder", (): void => {
            const emptyDeltaTimes: Array<number> = [];
            deltaTimesSubject.next(emptyDeltaTimes);

            expect(mockDataRecorderService.addDeltaTimes).not.toHaveBeenCalled();
        });

        it("should add connected device to dataRecorder if connectionStatus.deviceName is defined", (): void => {
            connectionStatusSubject.next(mockConnectionStatus);

            expect(mockDataRecorderService.addConnectedDevice).toHaveBeenCalledWith("Test Device");
        });

        it("should not add connected device if connectionStatus.deviceName is undefined", (): void => {
            const connectionStatusWithoutDevice = { ...mockConnectionStatus, deviceName: undefined };

            connectionStatusSubject.next(connectionStatusWithoutDevice);

            expect(mockDataRecorderService.addConnectedDevice).not.toHaveBeenCalled();
        });
    });

    describe("Observable Streams", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should emit values from heartRateService.streamHeartRate$() via heartRateData$", async (): Promise<void> => {
            const heartRatePromise = firstValueFrom(service.heartRateData$);
            heartRateSubject.next(mockHeartRate);

            const heartRate = await heartRatePromise;

            expect(heartRate).toEqual(mockHeartRate);
        });

        it("should emit values from heartRateService.connectionStatus$() via hrConnectionStatus$", async (): Promise<void> => {
            const statusPromise = firstValueFrom(service.hrConnectionStatus$);
            hrConnectionStatusSubject.next(mockHRConnectionStatus);

            const status = await statusPromise;

            expect(status).toEqual(mockHRConnectionStatus);
        });
    });

    describe("driveLength Calculation", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should calculate driveLength correctly", async (): Promise<void> => {
            mockRowerSettingsSignal.set(
                createMockRowerSettings({
                    sprocketRadius: 150,
                    impulsePerRevolution: 3,
                }),
            );

            const metricsPromise = firstValueFrom(service.rawMetrics$);

            measurementSubject.next(mockBaseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([10, 20, 30, 40, 50]);
            measurementSubject.next({
                revTime: mockBaseMetrics.revTime + 1000,
                distance: mockBaseMetrics.distance + 100,
                strokeTime: mockBaseMetrics.strokeTime + 1000,
                strokeCount: mockBaseMetrics.strokeCount + 1,
            });

            const metrics = await metricsPromise;

            // driveLength = ((2 * PI * 150) / 3) * 5 / 100 = (942.4778 / 3) * 5 / 100 = 15.708
            const expected = (((2 * Math.PI * 150) / 3) * 5) / 100;
            expect(metrics.driveLength).toBeCloseTo(expected, 5);
        });

        describe("should return 0 for driveLength ", (): void => {
            it("when impulsePerRevolution is 0", async (): Promise<void> => {
                mockRowerSettingsSignal.set(
                    createMockRowerSettings({
                        sprocketRadius: 150,
                        impulsePerRevolution: 0,
                    }),
                );

                const metricsPromise = firstValueFrom(service.rawMetrics$);

                measurementSubject.next(mockBaseMetrics);
                extendedSubject.next(mockExtendedMetrics);
                handleForcesSubject.next([10, 20, 30]);
                measurementSubject.next({
                    revTime: mockBaseMetrics.revTime + 1000,
                    distance: mockBaseMetrics.distance + 100,
                    strokeTime: mockBaseMetrics.strokeTime + 1000,
                    strokeCount: mockBaseMetrics.strokeCount + 1,
                });

                const metrics = await metricsPromise;

                expect(metrics.driveLength).toBe(0);
            });

            it("when sprocketRadius is 0", async (): Promise<void> => {
                mockRowerSettingsSignal.set(
                    createMockRowerSettings({
                        sprocketRadius: 0,
                        impulsePerRevolution: 3,
                    }),
                );

                const metricsPromise = firstValueFrom(service.rawMetrics$);

                measurementSubject.next(mockBaseMetrics);
                extendedSubject.next(mockExtendedMetrics);
                handleForcesSubject.next([10, 20, 30]);
                measurementSubject.next({
                    revTime: mockBaseMetrics.revTime + 1000,
                    distance: mockBaseMetrics.distance + 100,
                    strokeTime: mockBaseMetrics.strokeTime + 1000,
                    strokeCount: mockBaseMetrics.strokeCount + 1,
                });

                const metrics = await metricsPromise;

                expect(metrics.driveLength).toBe(0);
            });

            it("when handleForces is empty", async (): Promise<void> => {
                mockRowerSettingsSignal.set(
                    createMockRowerSettings({
                        sprocketRadius: 150,
                        impulsePerRevolution: 3,
                    }),
                );

                const metricsPromise = firstValueFrom(service.rawMetrics$);

                measurementSubject.next(mockBaseMetrics);
                extendedSubject.next(mockExtendedMetrics);
                handleForcesSubject.next([]);
                measurementSubject.next({
                    revTime: mockBaseMetrics.revTime + 1000,
                    distance: mockBaseMetrics.distance + 100,
                    strokeTime: mockBaseMetrics.strokeTime + 1000,
                    strokeCount: mockBaseMetrics.strokeCount + 1,
                });

                const metrics = await metricsPromise;

                expect(metrics.driveLength).toBe(0);
            });
        });
    });

    describe("Edge Cases and Error Handling", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should handle null or empty string deviceName gracefully", (): void => {
            const baseMetrics = { ...mockBaseMetrics, strokeCount: 1 };
            const connectionWithNullDevice = { status: "connected" as const, deviceName: null };

            service.rawMetrics$.subscribe((): void => {
                expect(mockDataRecorderService.addConnectedDevice).not.toHaveBeenCalled();
            });

            measurementSubject.next(baseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([]);
            heartRateSubject.next(mockHeartRate);
            connectionStatusSubject.next(connectionWithNullDevice as unknown as IErgConnectionStatus);
            measurementSubject.next(baseMetrics);
        });

        it("should handle NaN or Infinity values in metrics calculations", async (): Promise<void> => {
            const baseMetrics1: IBaseMetrics = { revTime: 0, distance: 0, strokeTime: 0, strokeCount: 0 };
            const baseMetrics2: IBaseMetrics = { revTime: 0, distance: 1000, strokeTime: 0, strokeCount: 1 };

            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                expect(isNaN(metrics.speed)).toBe(false);
                expect(isFinite(metrics.speed)).toBe(true);
                expect(isNaN(metrics.strokeRate)).toBe(false);
                expect(isFinite(metrics.strokeRate)).toBe(true);
                expect(isNaN(metrics.distPerStroke)).toBe(false);
                expect(isFinite(metrics.distPerStroke)).toBe(true);
            });

            measurementSubject.next(baseMetrics1);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([]);
            measurementSubject.next(baseMetrics2);
        });
    });

    describe("powerBalance computation", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should default powerBalance to 0.5 before any valid side pair is formed", (): void => {
            const emitted: Array<IRawCalculatedMetrics> = [];
            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                emitted.push(metrics);
            });

            // seed the pairwise and emit a side-A stroke (odd strokeCount)
            measurementSubject.next({ revTime: 0, distance: 0, strokeTime: 0, strokeCount: 0 });
            handleForcesSubject.next([100]);
            measurementSubject.next({ revTime: 1000, distance: 100, strokeTime: 1000, strokeCount: 1 });

            expect(emitted).toHaveLength(1);
            expect(emitted[0].powerBalance).toBe(0.5);
        });

        it("should emit rawMetrics$ exactly once per stroke", (): void => {
            let emissionCount = 0;
            service.rawMetrics$.subscribe((): void => {
                emissionCount++;
            });

            measurementSubject.next({ revTime: 0, distance: 0, strokeTime: 0, strokeCount: 0 });
            handleForcesSubject.next([100]);
            measurementSubject.next({ revTime: 1000, distance: 100, strokeTime: 1000, strokeCount: 1 });

            expect(emissionCount).toBe(1);
        });

        it("should compute powerBalance when consecutive odd+even strokes pair up", (): void => {
            const emitted: Array<IRawCalculatedMetrics> = [];
            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                emitted.push(metrics);
            });

            // side A: stronger (120 N mean force)
            handleForcesSubject.next([120, 120]);
            measurementSubject.next({ revTime: 0, distance: 0, strokeTime: 0, strokeCount: 0 });
            measurementSubject.next({ revTime: 1000, distance: 100, strokeTime: 1000, strokeCount: 1 });

            // side B: weaker (80 N mean force)
            handleForcesSubject.next([80, 80]);
            measurementSubject.next({ revTime: 2000, distance: 200, strokeTime: 2000, strokeCount: 2 });

            // first emission (stroke 1) still has the default balance.
            expect(emitted[0].powerBalance).toBe(0.5);
            const lastEmitted: IRawCalculatedMetrics = emitted[emitted.length - 1];
            expect(lastEmitted.powerBalance).toBeCloseTo(120 / (120 + 80));
        });

        it("should retain the previous balance when force updates arrive mid-stroke (same strokeCount)", (): void => {
            const emitted: Array<IRawCalculatedMetrics> = [];
            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                emitted.push(metrics);
            });

            handleForcesSubject.next([120, 120]); // side A forces
            measurementSubject.next({ revTime: 0, distance: 0, strokeTime: 0, strokeCount: 0 });
            measurementSubject.next({ revTime: 1000, distance: 100, strokeTime: 1000, strokeCount: 1 });

            handleForcesSubject.next([999, 999]);

            handleForcesSubject.next([80, 80]); // side B forces
            measurementSubject.next({ revTime: 2000, distance: 200, strokeTime: 2000, strokeCount: 2 });

            const lastEmitted: IRawCalculatedMetrics = emitted[emitted.length - 1];
            expect(lastEmitted.powerBalance).toBeCloseTo(120 / (120 + 80));
        });

        it("should retain the last balance when an even stroke is not consecutive with the preceding odd stroke", (): void => {
            const emitted: Array<IRawCalculatedMetrics> = [];
            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                emitted.push(metrics);
            });

            // set forces once before pairwise fires — no updates between strokes
            handleForcesSubject.next([100]);

            // stroke 1 (odd, side A)
            measurementSubject.next({ revTime: 0, distance: 0, strokeTime: 0, strokeCount: 0 });
            measurementSubject.next({ revTime: 1000, distance: 100, strokeTime: 1000, strokeCount: 1 });

            // strokeCount = 4 (even, not consecutive with 1) — no force update between strokes
            measurementSubject.next({ revTime: 2000, distance: 200, strokeTime: 2000, strokeCount: 4 });

            expect(emitted).toHaveLength(2);
            expect(emitted[0].powerBalance).toBe(0.5);
            expect(emitted[1].powerBalance).toBe(0.5);
        });

        it("should return 0.5 balance when both sides have zero force", (): void => {
            const emitted: Array<IRawCalculatedMetrics> = [];
            service.rawMetrics$.subscribe((metrics: IRawCalculatedMetrics): void => {
                emitted.push(metrics);
            });

            measurementSubject.next({ revTime: 0, distance: 0, strokeTime: 0, strokeCount: 0 });
            handleForcesSubject.next([0]);
            measurementSubject.next({ revTime: 1000, distance: 100, strokeTime: 1000, strokeCount: 1 });

            handleForcesSubject.next([0]);
            measurementSubject.next({ revTime: 2000, distance: 200, strokeTime: 2000, strokeCount: 2 });

            expect(emitted[1].powerBalance).toBe(0.5);
        });
    });
});
