import { DestroyRef, provideZonelessChangeDetection } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { BehaviorSubject, skip, Subject } from "rxjs";

import {
    IBaseMetrics,
    ICalculatedMetrics,
    IErgConnectionStatus,
    IExtendedMetrics,
    IHeartRate,
    IHRConnectionStatus,
} from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { ErgMetricsService } from "./ergometer/erg-metric-data.service";
import { HeartRateService } from "./heart-rate/heart-rate.service";
import { MetricsService } from "./metrics.service";

describe("MetricsService", (): void => {
    let service: MetricsService;
    let mockErgConnectionService: jasmine.SpyObj<ErgConnectionService>;
    let mockErgMetricsService: jasmine.SpyObj<ErgMetricsService>;
    let mockDataRecorderService: jasmine.SpyObj<DataRecorderService>;
    let mockHeartRateService: jasmine.SpyObj<HeartRateService>;
    let mockDestroyRef: jasmine.SpyObj<DestroyRef>;

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

    let isSecureContextSpy: jasmine.Spy<() => boolean>;
    let navigatorSpy: jasmine.Spy<() => Navigator | undefined>;

    beforeEach((): void => {
        isSecureContextSpy = spyOnProperty(globalThis, "isSecureContext", "get").and.returnValue(false);
        navigatorSpy = spyOnProperty(globalThis, "navigator", "get").and.returnValue({} as Navigator);

        connectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>({ status: "disconnected" });
        measurementSubject = new Subject<IBaseMetrics>();
        extendedSubject = new Subject<IExtendedMetrics>();
        handleForcesSubject = new Subject<Array<number>>();
        deltaTimesSubject = new Subject<Array<number>>();
        heartRateSubject = new Subject<IHeartRate | undefined>();
        hrConnectionStatusSubject = new Subject<IHRConnectionStatus>();

        mockErgConnectionService = jasmine.createSpyObj<ErgConnectionService>(
            "ErgConnectionService",
            ["reconnect"],
            {
                connectionStatus$: jasmine
                    .createSpy()
                    .and.returnValue(connectionStatusSubject.asObservable()),
            },
        );

        mockErgMetricsService = jasmine.createSpyObj<ErgMetricsService>("ErgMetricsService", [], {
            streamMeasurement$: jasmine.createSpy().and.returnValue(measurementSubject.asObservable()),
            streamExtended$: jasmine.createSpy().and.returnValue(extendedSubject.asObservable()),
            streamHandleForces$: jasmine.createSpy().and.returnValue(handleForcesSubject.asObservable()),
            streamDeltaTimes$: jasmine.createSpy().and.returnValue(deltaTimesSubject.asObservable()),
        });

        mockDataRecorderService = jasmine.createSpyObj<DataRecorderService>("DataRecorderService", [
            "addDeltaTimes",
            "addSessionData",
            "addConnectedDevice",
            "reset",
        ]);

        mockHeartRateService = jasmine.createSpyObj<HeartRateService>("HeartRateService", [], {
            streamHeartRate$: jasmine.createSpy().and.returnValue(heartRateSubject.asObservable()),
            connectionStatus$: jasmine.createSpy().and.returnValue(hrConnectionStatusSubject.asObservable()),
        });

        mockDestroyRef = jasmine.createSpyObj<DestroyRef>("DestroyRef", ["onDestroy"]);

        TestBed.configureTestingModule({
            providers: [
                MetricsService,
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                { provide: ErgMetricsService, useValue: mockErgMetricsService },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                { provide: HeartRateService, useValue: mockHeartRateService },
                { provide: DestroyRef, useValue: mockDestroyRef },
                provideZonelessChangeDetection(),
            ],
        });
    });

    describe("Service Initialization", (): void => {
        it("should instantiate the service and initialize all observables", (): void => {
            service = TestBed.inject(MetricsService);

            expect(service).toBeTruthy();
            expect(service.allMetrics$).toBeDefined();
            expect(service.heartRateData$).toBeDefined();
            expect(service.hrConnectionStatus$).toBeDefined();
        });

        it("should call ergConnectionService.reconnect() if running in a secure context with Bluetooth available", (): void => {
            isSecureContextSpy.and.returnValue(true);
            navigatorSpy.and.returnValue({ bluetooth: {} } as Navigator);

            service = TestBed.inject(MetricsService);

            expect(mockErgConnectionService.reconnect).toHaveBeenCalled();
        });

        it("should not call ergConnectionService.reconnect() if not in a secure context", (): void => {
            isSecureContextSpy.and.returnValue(false);
            navigatorSpy.and.returnValue({ bluetooth: {} } as Navigator);

            service = TestBed.inject(MetricsService);

            expect(mockErgConnectionService.reconnect).not.toHaveBeenCalled();
        });

        it("should not call ergConnectionService.reconnect() if Bluetooth is unavailable", (): void => {
            isSecureContextSpy.and.returnValue(true);
            navigatorSpy.and.returnValue({} as Navigator);

            service = TestBed.inject(MetricsService);

            expect(mockErgConnectionService.reconnect).not.toHaveBeenCalled();
        });
    });

    describe("Activity Management", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should set activityStartTime to the current date when erg connection status becomes 'connected'", fakeAsync((): void => {
            const beforeConnection = new Date();

            tick(100);
            const atConnection = new Date();
            connectionStatusSubject.next(mockConnectionStatus);

            expect(service.getActivityStartTime().getTime()).toBeGreaterThan(beforeConnection.getTime());
            expect(service.getActivityStartTime().getTime()).toEqual(atConnection.getTime());
        }));

        it("should update activityStartDistance, activityStartStrokeCount, and activityStartTime on reset()", fakeAsync((): void => {
            const beforeReset = new Date();
            const baseMetrics = { ...mockBaseMetrics };
            measurementSubject.next(baseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([10, 20, 30]);
            tick(100);

            service.reset();
            const afterReset = service.getActivityStartTime();

            expect(afterReset.getTime()).toBeGreaterThan(beforeReset.getTime());
            expect(mockDataRecorderService.reset).toHaveBeenCalled();
        }));

        it("should emit a reset event on resetSubject with the correct base metrics on reset()", (done: DoneFn): void => {
            service.allMetrics$.pipe(skip(4)).subscribe((metrics: ICalculatedMetrics): void => {
                expect(metrics.distance).toBe(0);
                expect(metrics.strokeCount).toBe(0);
                expect(metrics.avgStrokePower).toBe(0);
                expect(metrics.handleForces).toHaveSize(0);
                expect(metrics.strokeCount).toBe(0);
                expect(metrics.strokeRate).toBe(0);
                expect(metrics.distPerStroke).toBe(0);
                expect(metrics.peakForce).toBe(0);
                expect(metrics.dragFactor).toBe(0);
                expect(metrics.recoveryDuration).toBe(0);
                expect(metrics.driveDuration).toBe(0);

                done();
            });

            service.reset();
            measurementSubject.next(mockBaseMetrics);
            measurementSubject.next({
                revTime: mockBaseMetrics.revTime + 1000,
                distance: mockBaseMetrics.distance + 100,
                strokeTime: mockBaseMetrics.strokeTime + 1000,
                strokeCount: mockBaseMetrics.strokeCount + 1,
            });
            service.reset();
        });
    });

    describe("Calculation Methods", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should calculate speed correctly based on distance and time changes", (done: DoneFn): void => {
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

            service.allMetrics$.subscribe((metrics: ICalculatedMetrics): void => {
                // speed = (distance_diff / 100) / (time_diff / 1e6)
                // expected: (1000 / 100) / ((2000000 - 1000000) / 1e6) = 10 / 1 = 10 m/s
                expect(metrics.speed).toBe(10);
                done();
            });

            measurementSubject.next(baseMetrics1);
            measurementSubject.next(baseMetrics2);
        });

        it("should calculate stroke distance correctly", (done: DoneFn): void => {
            const baseMetrics1: IBaseMetrics = { revTime: 0, distance: 1000, strokeTime: 0, strokeCount: 1 };
            const baseMetrics2: IBaseMetrics = { revTime: 0, distance: 2000, strokeTime: 0, strokeCount: 2 };

            service.allMetrics$.subscribe((metrics: ICalculatedMetrics): void => {
                // distPerStroke = (distance_diff / 100) / stroke_diff
                // expected: (1000 / 100) / 1 = 10 m/stroke
                expect(metrics.distPerStroke).toBe(10);

                done();
            });

            measurementSubject.next(baseMetrics1);
            measurementSubject.next(baseMetrics2);
        });

        it("should calculate stroke rate correctly", (done: DoneFn): void => {
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

            service.allMetrics$.subscribe((metrics: ICalculatedMetrics): void => {
                // strokeRate = (stroke_diff / (time_diff / 1e6)) * 60
                // expected: (1 / ((2000000 - 1000000) / 1e6)) * 60 = (1 / 1) * 60 = 60 strokes/min
                expect(metrics.strokeRate).toBe(60);

                done();
            });

            measurementSubject.next(baseMetrics1);
            measurementSubject.next(baseMetrics2);
        });

        it("should return 0 for calculations when values haven't changed", (done: DoneFn): void => {
            const baseMetrics = { ...mockBaseMetrics };

            service.allMetrics$.subscribe((metrics: ICalculatedMetrics): void => {
                expect(metrics.speed).toBe(0);
                expect(metrics.strokeRate).toBe(0);
                expect(metrics.distPerStroke).toBe(0);

                done();
            });

            measurementSubject.next(baseMetrics);
            measurementSubject.next(baseMetrics);
        });
    });

    describe("Data Recording Integration", (): void => {
        const baseMetrics = { ...mockBaseMetrics, strokeCount: 5, distance: 500 };
        const baseMetrics2 = {
            revTime: baseMetrics.revTime + 1000,
            distance: baseMetrics.distance + 100,
            strokeTime: baseMetrics.strokeTime + 1000,
            strokeCount: baseMetrics.strokeCount + 1,
        };

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

        it("should add session data to dataRecorder when valid metrics are emitted", (done: DoneFn): void => {
            service.allMetrics$.subscribe((): void => {
                expect(mockDataRecorderService.addSessionData).toHaveBeenCalled();
                const callArgs = mockDataRecorderService.addSessionData.calls.mostRecent().args[0];
                expect(callArgs.strokeCount).toBeGreaterThan(0);

                done();
            });

            measurementSubject.next(baseMetrics);
            heartRateSubject.next(mockHeartRate);
            measurementSubject.next(baseMetrics2);
        });

        it("should add connected device to dataRecorder if connectionStatus.deviceName is defined", (done: DoneFn): void => {
            service.allMetrics$.subscribe((): void => {
                expect(mockDataRecorderService.addConnectedDevice).toHaveBeenCalledWith("Test Device");

                done();
            });

            connectionStatusSubject.next(mockConnectionStatus);
            measurementSubject.next(baseMetrics);
            heartRateSubject.next(mockHeartRate);
            measurementSubject.next(baseMetrics2);
        });

        it("should not add connected device if connectionStatus.deviceName is undefined", (done: DoneFn): void => {
            const connectionStatusWithoutDevice = { ...mockConnectionStatus, deviceName: undefined };

            service.allMetrics$.subscribe((): void => {
                expect(mockDataRecorderService.addConnectedDevice).not.toHaveBeenCalled();

                done();
            });

            connectionStatusSubject.next(connectionStatusWithoutDevice);
            measurementSubject.next(baseMetrics);
            heartRateSubject.next(mockHeartRate);
            measurementSubject.next(baseMetrics2);
        });

        it("should not emit session data if strokeCount and distance are both zero", (done: DoneFn): void => {
            service.allMetrics$.subscribe((): void => {
                expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();

                done();
            });

            connectionStatusSubject.next(mockConnectionStatus);
            measurementSubject.next({ ...mockBaseMetrics, strokeCount: 0, distance: 0 });
            heartRateSubject.next(mockHeartRate);
            measurementSubject.next({ ...mockBaseMetrics, strokeCount: 0, distance: 0 });
        });

        it("should reset dataRecorder if baseMetrics.distance decreases", (done: DoneFn): void => {
            const baseMetrics1 = { ...mockBaseMetrics, distance: baseMetrics2.distance + 100 };

            service.allMetrics$.subscribe((): void => {
                expect(mockDataRecorderService.reset).toHaveBeenCalled();
                done();
            });

            measurementSubject.next(baseMetrics1);
            measurementSubject.next(baseMetrics2);
        });

        it("should not call dataRecorder.reset() if baseMetrics.distance does not decrease", (done: DoneFn): void => {
            service.allMetrics$.subscribe((): void => {
                expect(mockDataRecorderService.reset).not.toHaveBeenCalled();

                done();
            });

            measurementSubject.next(baseMetrics);
            measurementSubject.next(baseMetrics2);
        });
    });

    describe("Observable Streams", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should emit values from heartRateService.streamHeartRate$() via heartRateData$", (done: DoneFn): void => {
            service.heartRateData$.subscribe((heartRate: IHeartRate | undefined): void => {
                if (heartRate) {
                    expect(heartRate).toEqual(mockHeartRate);

                    done();
                }
            });

            heartRateSubject.next(mockHeartRate);
        });

        it("should emit values from heartRateService.connectionStatus$() via hrConnectionStatus$", (done: DoneFn): void => {
            service.hrConnectionStatus$.subscribe((status: IHRConnectionStatus): void => {
                expect(status).toEqual(mockHRConnectionStatus);

                done();
            });

            hrConnectionStatusSubject.next(mockHRConnectionStatus);
        });

        it("should emit default values from streamExtended$ and streamHandleForces$ after reset", (done: DoneFn): void => {
            service.allMetrics$.pipe(skip(2)).subscribe((metrics: ICalculatedMetrics): void => {
                expect(metrics.avgStrokePower).toBe(0);
                expect(metrics.dragFactor).toBe(0);
                expect(metrics.driveDuration).toBe(0);
                expect(metrics.recoveryDuration).toBe(0);
                expect(metrics.handleForces).toEqual([]);
                expect(metrics.distance).toBe(0);
                expect(metrics.strokeCount).toBe(0);
                expect(metrics.strokeRate).toBe(0);
                expect(metrics.distPerStroke).toBe(0);
                expect(metrics.peakForce).toBe(0);

                done();
            });

            measurementSubject.next(mockBaseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([10, 20, 30]);
            service.reset();
        });
    });

    describe("Edge Cases and Error Handling", (): void => {
        beforeEach((): void => {
            service = TestBed.inject(MetricsService);
        });

        it("should handle multiple rapid reset() calls gracefully", (): void => {
            expect((): void => {
                service.reset();
                service.reset();
                service.reset();
            }).not.toThrow();

            expect(mockDataRecorderService.reset).toHaveBeenCalledTimes(3);
        });

        it("should handle null or empty string deviceName gracefully", (): void => {
            const baseMetrics = { ...mockBaseMetrics, strokeCount: 1 };
            const connectionWithNullDevice = { status: "connected" as const, deviceName: null };

            service.allMetrics$.subscribe((): void => {
                expect(mockDataRecorderService.addConnectedDevice).not.toHaveBeenCalled();
            });

            measurementSubject.next(baseMetrics);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([]);
            heartRateSubject.next(mockHeartRate);
            connectionStatusSubject.next(connectionWithNullDevice as unknown as IErgConnectionStatus);
            measurementSubject.next(baseMetrics);
        });

        it("should handle NaN or Infinity values in metrics calculations", (done: DoneFn): void => {
            const baseMetrics1: IBaseMetrics = { revTime: 0, distance: 0, strokeTime: 0, strokeCount: 0 };
            const baseMetrics2: IBaseMetrics = { revTime: 0, distance: 1000, strokeTime: 0, strokeCount: 1 };

            service.allMetrics$.subscribe((metrics: ICalculatedMetrics): void => {
                expect(isNaN(metrics.speed)).toBe(false);
                expect(isFinite(metrics.speed)).toBe(true);
                expect(isNaN(metrics.strokeRate)).toBe(false);
                expect(isFinite(metrics.strokeRate)).toBe(true);
                expect(isNaN(metrics.distPerStroke)).toBe(false);
                expect(isFinite(metrics.distPerStroke)).toBe(true);

                done();
            });

            measurementSubject.next(baseMetrics1);
            extendedSubject.next(mockExtendedMetrics);
            handleForcesSubject.next([]);
            measurementSubject.next(baseMetrics2);
        });
    });
});
