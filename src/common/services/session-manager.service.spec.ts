import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    ICalculatedMetrics,
    IErgConnectionStatus,
    IHeartRate,
    IRawCalculatedMetrics,
} from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { MetricsService } from "./metrics.service";
import { SessionManagerService } from "./session-manager.service";

describe("SessionManagerService", (): void => {
    let service: SessionManagerService;

    let mockMetricsService: Pick<MetricsService, "rawMetrics$" | "heartRateData$">;
    let mockDataRecorderService: Pick<DataRecorderService, "reset" | "addSessionData">;
    let mockErgConnectionService: Pick<ErgConnectionService, "connectionStatus$">;
    let rawMetricsSubject: BehaviorSubject<IRawCalculatedMetrics>;
    let heartRateSubject: BehaviorSubject<IHeartRate | undefined>;
    let connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;

    const mockRawMetrics: IRawCalculatedMetrics = {
        avgStrokePower: 0,
        driveDuration: 0,
        recoveryDuration: 0,
        dragFactor: 0,
        rawDistance: 0,
        rawStrokeCount: 0,
        handleForces: [],
        peakForce: 0,
        strokeRate: 0,
        speed: 0,
        distPerStroke: 0,
        driveLength: 0,
    };

    const mockSessionMetrics: ICalculatedMetrics = {
        avgStrokePower: 0,
        driveDuration: 0,
        recoveryDuration: 0,
        dragFactor: 0,
        distance: 0,
        strokeCount: 0,
        handleForces: [],
        peakForce: 0,
        strokeRate: 0,
        speed: 0,
        distPerStroke: 0,
        driveLength: 0,
    };

    const mockHeartRate: IHeartRate = {
        heartRate: 150,
        rrIntervals: [800],
        contactDetected: true,
    };

    beforeEach((): void => {
        vi.useFakeTimers();

        rawMetricsSubject = new BehaviorSubject<IRawCalculatedMetrics>(mockRawMetrics);
        heartRateSubject = new BehaviorSubject<IHeartRate | undefined>(undefined);
        connectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>({ status: "disconnected" });

        mockMetricsService = {
            rawMetrics$: rawMetricsSubject.asObservable(),
            heartRateData$: heartRateSubject.asObservable(),
        };

        mockDataRecorderService = {
            reset: vi.fn().mockResolvedValue(undefined),
            addSessionData: vi.fn().mockResolvedValue(undefined),
        };

        mockErgConnectionService = {
            connectionStatus$: vi.fn().mockReturnValue(connectionStatusSubject.asObservable()),
        };

        TestBed.configureTestingModule({
            providers: [
                SessionManagerService,
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
            ],
        });

        service = TestBed.inject(SessionManagerService);
    });

    afterEach((): void => {
        vi.useRealTimers();
    });

    describe("as part of service creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });

        it("should initialize with stopped state", (): void => {
            expect(service.sessionState()).toBe("stopped");
        });

        it("should initialize with zero elapsed time", (): void => {
            expect(service.elapsedTime()).toBe(0);
        });
    });

    describe("start method", (): void => {
        it("should transition from stopped to running", (): void => {
            service.start();
            service.stop();
            expect(service.sessionState()).toBe("stopped");

            service.start();
            expect(service.sessionState()).toBe("running");
        });

        it("should not change state if already running", (): void => {
            service.start();

            service.start();
            expect(service.sessionState()).toBe("running");
        });

        it("should call dataRecorder.reset with connectedDeviceName on start", (): void => {
            connectionStatusSubject.next({ status: "connected", deviceName: "ESP Rowing Monitor" });

            service.start();

            expect(mockDataRecorderService.reset).toHaveBeenCalledWith("ESP Rowing Monitor");
        });

        it("should reset elapsed time to zero when starting a new session", (): void => {
            service.start();
            vi.advanceTimersByTime(3000);
            service.stop();

            service.start();
            expect(service.elapsedTime()).toBe(0);
        });
    });

    describe("stop method", (): void => {
        it("should transition from running to stopped", (): void => {
            service.start();

            service.stop();
            expect(service.sessionState()).toBe("stopped");
        });

        it("should not call dataRecorder.reset when stopping", (): void => {
            connectionStatusSubject.next({ status: "connected", deviceName: "ESP Rowing Monitor" });
            service.start();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            service.stop();

            expect(mockDataRecorderService.reset).not.toHaveBeenCalled();
        });

        it("should not change state if already stopped", (): void => {
            service.start();
            service.stop();

            service.stop();
            expect(service.sessionState()).toBe("stopped");
        });
    });

    describe("elapsedTime signal", (): void => {
        it("should advance while running", (): void => {
            service.start();

            vi.advanceTimersByTime(3000);
            expect(service.elapsedTime()).toBeCloseTo(3, 0);
        });

        it("should stop advancing after stop is called", async (): Promise<void> => {
            service.start();

            vi.advanceTimersByTime(3000);
            service.stop();
            const timeAtStop: number = service.elapsedTime();

            await vi.advanceTimersByTimeAsync(5000);
            expect(service.elapsedTime()).toBe(timeAtStop);
        });

        it("should not advance while stopped", (): void => {
            vi.advanceTimersByTime(5000);
            expect(service.elapsedTime()).toBe(0);
        });
    });

    describe("auto-start on first stroke", (): void => {
        it("should trigger start when first stroke arrives in stopped state", (): void => {
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });

            expect(service.sessionState()).toBe("running");
            expect(vi.mocked(mockDataRecorderService.reset)).toHaveBeenCalledTimes(1);
        });

        it("should call dataRecorder.reset on auto-start from stopped", (): void => {
            connectionStatusSubject.next({ status: "connected", deviceName: "ESP Rowing Monitor" });
            vi.mocked(mockDataRecorderService.reset).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });

            expect(mockDataRecorderService.reset).toHaveBeenCalledWith("ESP Rowing Monitor");
        });

        it("should call dataRecorder.reset on auto-start from stopped state", (): void => {
            connectionStatusSubject.next({ status: "connected", deviceName: "ESP Rowing Monitor" });
            service.start();
            service.stop();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            // so rawStrokeCount: 1 > 0 triggers auto-start.
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });

            expect(mockDataRecorderService.reset).toHaveBeenCalledWith("ESP Rowing Monitor");
        });

        it("should not trigger start when already running", (): void => {
            service.start();
            vi.advanceTimersByTime(3000);
            const elapsedBefore: number = service.elapsedTime();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });

            expect(service.sessionState()).toBe("running");
            expect(service.elapsedTime()).toBe(elapsedBefore); // timer not reset
            expect(vi.mocked(mockDataRecorderService.reset)).toHaveBeenCalledTimes(1); // only the initial start()
        });

        it("should trigger start when stroke arrives in stopped state", (): void => {
            service.start();
            service.stop();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });

            expect(service.sessionState()).toBe("running");
            expect(vi.mocked(mockDataRecorderService.reset)).toHaveBeenCalledTimes(1);
        });

        it("should correct session start timestamp using driveDuration", (): void => {
            const now: number = Date.now();
            const driveDuration = 1.2;

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration });

            vi.advanceTimersByTime(2000);
            const expectedElapsed: number = (Date.now() - (now - driveDuration * 1000)) / 1000;
            expect(service.elapsedTime()).toBeCloseTo(expectedElapsed, 0);
        });

        it("should start the timer after auto-start", (): void => {
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0 });

            vi.advanceTimersByTime(3000);
            expect(service.elapsedTime()).toBeCloseTo(3, 0);
        });

        it("should not auto-start even when rawStrokeCount has not increased above previous value", (): void => {
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 0 });

            expect(service.sessionState()).toBe("stopped");
            expect(vi.mocked(mockDataRecorderService.reset)).not.toHaveBeenCalled();
        });

        it("should not re-trigger auto-start when the same stroke count is emitted again", (): void => {
            // first emission (rawStrokeCount: 1) triggers auto-start
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1 });
            service.stop();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            // same rawStrokeCount emitted again after stop — pairwise [1, 1] → 1 > 1 = false
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1 });

            expect(service.sessionState()).toBe("stopped");
            expect(vi.mocked(mockDataRecorderService.reset)).not.toHaveBeenCalled();
        });

        it("should auto-start on the very first rawMetrics emission when no prior value was buffered", (): void => {
            TestBed.resetTestingModule();

            const coldRawSubject = new Subject<IRawCalculatedMetrics>();

            TestBed.configureTestingModule({
                providers: [
                    SessionManagerService,
                    {
                        provide: MetricsService,
                        useValue: {
                            rawMetrics$: coldRawSubject.asObservable(),
                            heartRateData$: heartRateSubject.asObservable(),
                        },
                    },
                    { provide: DataRecorderService, useValue: mockDataRecorderService },
                    { provide: ErgConnectionService, useValue: mockErgConnectionService },
                ],
            });

            const freshService: SessionManagerService = TestBed.inject(SessionManagerService);

            coldRawSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });

            expect(freshService.sessionState()).toBe("running");
        });

        it("should record the first stroke that triggers auto-start", (): void => {
            heartRateSubject.next(mockHeartRate);

            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 1,
                rawDistance: 100,
                driveDuration: 0.5,
            }); // triggers auto-start; seed.previousRaw=prev={rawStrokeCount:0, rawDistance:0}, so replay delta=1

            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 2,
                rawDistance: 200,
                driveDuration: 0.5,
            }); // second stroke: delta.distance=100, delta.strokeCount=1 → cumulative {strokeCount:2, distance:200}

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(2);
            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...mockSessionMetrics,
                strokeCount: 1,
                distance: 100,
                driveDuration: 0.5,
                elapsedTime: 0.5,
                heartRate: mockHeartRate,
            });
        });

        it("should record the first stroke even without heart rate data", (): void => {
            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 1,
                rawDistance: 100,
                driveDuration: 0.5,
            }); // triggers auto-start; seed.previousRaw=prev={rawStrokeCount:0} → replay delta=1

            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 2,
                rawDistance: 200,
                driveDuration: 0.5,
            }); // second stroke: cumulative {strokeCount:2, distance:200}

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...mockSessionMetrics,
                strokeCount: 1,
                distance: 100,
                driveDuration: 0.5,
                elapsedTime: 0.5,
                heartRate: undefined,
            });
        });

        it("should count all 20 strokes including the first trigger stroke on auto-start", (): void => {
            // feeds 20 strokes
            for (let i = 1; i <= 20; i++) {
                rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: i, rawDistance: i * 950 });
            }

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 20, distance: 19000 }),
            );
        });

        it("should count exactly the strokes after stop when auto-resuming mid-sequence", (): void => {
            // first 3 strokes with manual start
            service.start();
            for (let i = 1; i <= 3; i++) {
                rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: i, rawDistance: i * 950 });
            }
            service.stop();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // strokes 4-20: auto-start fires on stroke 4 (prev={rawStrokeCount:3, rawDistance:2850})
            for (let i = 4; i <= 20; i++) {
                rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: i, rawDistance: i * 950 });
            }

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 17, distance: 16150 }),
            );
        });

        it("should auto-start and count all strokes when reconnecting mid-session after a device reboot", (): void => {
            // record 20 strokes before the stop
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 20, rawDistance: 19000 });
            service.stop();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // app reconnects at stroke 3 of the new device session (skipped zero because connection delay)
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });

            expect(service.sessionState()).toBe("running");
            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 3, distance: 2850 }),
            );
        });

        it("should auto-start normally when reboot during stopped and starting from zero strokes", (): void => {
            // record 20 strokes before the stop
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 20, rawDistance: 19000 });
            service.stop();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 0, rawDistance: 0 }); // reboot at zero
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 }); // first new stroke

            expect(service.sessionState()).toBe("running");
            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 1, distance: 950 }),
            );
        });
    });

    describe("session data recording", (): void => {
        it("should record session data when running and metrics change", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // seed = {0,0} from start(), so session distance=100, strokeCount=1
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...mockSessionMetrics,
                strokeCount: 1,
                distance: 100,
                elapsedTime: 0,
                heartRate: mockHeartRate,
            });
        });

        it("should not record session data when stopped", (): void => {
            service.start();
            service.stop();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 0, rawDistance: 50 });

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });

        it("should not record when strokeCount and distance are both zero", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 0, rawDistance: 0 });

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });

        it("should not record duplicate metrics with same distance and strokeCount", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(1);
        });

        it("should record when speed changes to zero with same distance and strokeCount", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 1,
                rawDistance: 100,
                speed: 2.5,
            });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100, speed: 0 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(1);
            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith(
                expect.objectContaining({ distance: 100, strokeCount: 1, speed: 0 }),
            );
        });

        it("should record when distance or strokeCount increases", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 200 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 200 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(3);
        });

        it("should record after stop and restart with new stroke data", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            service.stop();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // auto-start fires;
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 200 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 300 });

            expect(service.sessionState()).toBe("running");
            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...mockSessionMetrics,
                strokeCount: 2,
                distance: 200,
                elapsedTime: 0,
                heartRate: mockHeartRate,
            });
        });

        it("should apply correct delta when manual start follows accumulated raw values", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 5, rawDistance: 500 });
            service.stop();

            service.start();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 6, rawDistance: 600 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...mockSessionMetrics,
                strokeCount: 1,
                distance: 100,
                elapsedTime: 0,
                heartRate: mockHeartRate,
            });
        });

        it("should not write stale session-1 data into session 2 when the 1Hz timer fires after manual restart", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            service.stop();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            service.start();
            vi.advanceTimersByTime(2000);

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });
    });

    describe("timer-triggered recording (at-least-1Hz heart rate sampling)", (): void => {
        it("should record a timer sample 1s after the last data point", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            vi.advanceTimersByTime(1000);

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...mockSessionMetrics,
                strokeCount: 1,
                distance: 100,
                elapsedTime: 1,
                heartRate: mockHeartRate,
            });
        });

        it("should capture updated heart rate on timer tick without new stroke", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            const updatedHr: IHeartRate = { heartRate: 170, contactDetected: true };
            heartRateSubject.next(updatedHr);
            vi.advanceTimersByTime(1000);

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith(
                expect.objectContaining({ elapsedTime: 1, heartRate: updatedHr }),
            );
        });

        it("should reset the timer when a new data point arrives", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // advance 500ms (no timer tick yet — 1s hasn't elapsed)
            vi.advanceTimersByTime(500);
            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();

            // new stroke arrives at 500ms → switchMap restarts, records immediately via startWith(0)
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 200 });
            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(1);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // 1s after the new stroke (not 500ms from original timer)
            vi.advanceTimersByTime(1000);
            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(1);
        });

        it("should not start timer without data-containing emissions", (): void => {
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            vi.advanceTimersByTime(3000);

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });

        it("should not record via timer when stopped", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            service.stop();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            vi.advanceTimersByTime(3000);

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });

        it("should record multiple timer samples when no new data points arrive", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            vi.advanceTimersByTime(3000);

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(3);
        });
    });

    describe("distance regression handling", (): void => {
        it("should keep session running on distance regression", (): void => {
            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 5000 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 0 });

            expect(service.sessionState()).toBe("running");
        });

        it("should not call dataRecorder.reset on distance regression", (): void => {
            service.start();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 5000 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 0 });

            expect(mockDataRecorderService.reset).not.toHaveBeenCalled();
        });

        it("should preserve elapsed time through a regression", (): void => {
            service.start();
            vi.advanceTimersByTime(3000);

            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 5000 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 0 });

            expect(service.elapsedTime()).toBeCloseTo(3, 0);
        });

        it("should accumulate distance across a device reboot", (): void => {
            // session start: offset = {0, 0}
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 1500, rawStrokeCount: 30 });

            // device reboots: rawDistance drops to 0. accumulated so far = 1500.
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 0, rawStrokeCount: 0 });

            // continue rowing 300m on new segment. session distance = 1500 + 300 = 1800.
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 300, rawStrokeCount: 6 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ distance: 1800, strokeCount: 36 }),
            );
        });

        it("should accumulate stroke count across a device reboot", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 1000, rawStrokeCount: 20 });

            // device reboots
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 0, rawStrokeCount: 0 });

            // 5 more strokes after reboot
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 100, rawStrokeCount: 5 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 25 }),
            );
        });

        it("should count the first stroke when rawStrokeCount resets to non-zero without going through 0", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 1000, rawStrokeCount: 10 });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // regression due to device reboot
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 100, rawStrokeCount: 2 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 12 }),
            );
        });

        it("should count the first distance when rawDistance resets to non-zero without going through 0", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 10000, rawStrokeCount: 10 });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // regression due to device reboot
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 950, rawStrokeCount: 1 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ distance: 10950 }),
            );
        });

        it("should accumulate full stroke count across a manual stop-restart when new stream starts from stroke 1", (): void => {
            // session 1: 10 strokes
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 9500, rawStrokeCount: 10 });
            service.stop();

            // session 2: new stream from stroke 1 (rawStrokeCount never passed through 0)
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 950, rawStrokeCount: 1 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 1900, rawStrokeCount: 2 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 2850, rawStrokeCount: 3 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ distance: 2850, strokeCount: 3 }),
            );
        });

        it("should accumulate correctly across multiple reboots", (): void => {
            service.start();

            // segment 1: 1000m, 20 strokes
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 1000, rawStrokeCount: 20 });

            // reboot 1
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 0, rawStrokeCount: 0 });

            // segment 2: 500m, 10 strokes
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 500, rawStrokeCount: 10 });

            // reboot 2
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 0, rawStrokeCount: 0 });

            // segment 3: 200m, 4 strokes
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 200, rawStrokeCount: 4 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ distance: 1700, strokeCount: 34 }),
            );
        });

        it("should reset accumulated on a new manual session start", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 1000, rawStrokeCount: 20 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 0, rawStrokeCount: 0 }); // reboot
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 200, rawStrokeCount: 4 });
            service.stop();

            // new manual session — accumulated must not carry over
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 300, rawStrokeCount: 6 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ distance: 100, strokeCount: 2 }),
            );
        });

        it("should not trigger on increasing distance", (): void => {
            service.start();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 100 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 200 });

            expect(service.sessionState()).toBe("running");
            expect(vi.mocked(mockDataRecorderService.reset)).not.toHaveBeenCalled();
        });

        it("should not trigger during stop", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 5000 });
            service.stop();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 0, rawDistance: 0 }); // reboot
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 0, rawDistance: 100 }); // coasting while stopped after reboot

            expect(mockDataRecorderService.reset).not.toHaveBeenCalled();
            expect(service.sessionState()).toBe("stopped");
        });

        it("should not trigger during start", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawDistance: 5000 });
            service.stop();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            service.start();

            expect(mockDataRecorderService.reset).toHaveBeenCalledTimes(1);
            expect(service.sessionState()).toBe("running");
        });

        it("should not false-trigger regression on stop and auto-restart with lower raw distance", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 100 });
            service.stop();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            // auto-start with new raw distance lower than the last seen value — not a regression
            // because state was "stopped" when it was emitted, so the filter guards it
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 50 });

            expect(service.sessionState()).toBe("running");
            expect(vi.mocked(mockDataRecorderService.reset)).toHaveBeenCalledTimes(1);
        });
    });

    describe("cleanup on destroy", (): void => {
        it("should stop the timer when service is destroyed", (): void => {
            service.start();

            vi.advanceTimersByTime(2000);

            TestBed.resetTestingModule();
            const timeAtDestroy: number = service.elapsedTime();

            vi.advanceTimersByTime(5000);
            expect(service.elapsedTime()).toBe(timeAtDestroy);
        });
    });
});
