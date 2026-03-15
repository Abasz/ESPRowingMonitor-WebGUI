import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    Config,
    ICalculatedMetrics,
    IErgConnectionStatus,
    IHeartRate,
    IRawCalculatedMetrics,
} from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";
import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { MetricsService } from "./metrics.service";
import { SessionManagerService } from "./session-manager.service";

describe("SessionManagerService", (): void => {
    let service: SessionManagerService;

    let mockMetricsService: Pick<MetricsService, "rawMetrics$" | "heartRateData$">;
    let mockDataRecorderService: Pick<DataRecorderService, "reset" | "addSessionData">;
    let mockErgConnectionService: Pick<ErgConnectionService, "connectionStatus$">;
    let mockConfigManagerService: Pick<ConfigManagerService, "configChanged$">;
    let configSubject: BehaviorSubject<Config>;
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

        configSubject = new BehaviorSubject<Config>(new Config());
        mockConfigManagerService = {
            configChanged$: configSubject.asObservable(),
        };

        TestBed.configureTestingModule({
            providers: [
                SessionManagerService,
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
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
        it("should not change state if already running", (): void => {
            service.start();

            service.start();
            expect(service.sessionState()).toBe("running");
        });

        describe("when in stopped state", (): void => {
            it("should transition from stopped to running", (): void => {
                service.start();
                service.stop();
                expect(service.sessionState()).toBe("stopped");

                service.start();
                expect(service.sessionState()).toBe("running");
            });

            it("should call dataRecorder.reset with connectedDeviceName on start", (): void => {
                connectionStatusSubject.next({ status: "connected", deviceName: "ESP Rowing Monitor" });

                service.start();

                expect(mockDataRecorderService.reset).toHaveBeenCalledWith("ESP Rowing Monitor");
            });

            it("should reset elapsed time to zero", (): void => {
                service.start();
                vi.advanceTimersByTime(3000);
                service.stop();

                service.start();
                expect(service.elapsedTime()).toBe(0);
            });
        });

        describe("when in paused state", (): void => {
            it("should transition from paused to running", (): void => {
                service.start();
                service.pause();

                service.start();
                expect(service.sessionState()).toBe("running");
            });

            it("should resume elapsed time from where it stopped after resume", (): void => {
                service.start();
                vi.advanceTimersByTime(3000);

                service.pause();
                vi.advanceTimersByTime(5000);

                service.start();
                vi.advanceTimersByTime(2000);

                expect(service.elapsedTime()).toBeCloseTo(5, 0);
            });

            it("should not call dataRecorder.reset when resuming from paused", (): void => {
                service.start();
                service.pause();
                vi.mocked(mockDataRecorderService.reset).mockClear();

                service.start();

                expect(mockDataRecorderService.reset).not.toHaveBeenCalled();
            });

            it("should preserve accumulated data across pause and resume", (): void => {
                service.start();
                rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
                service.pause();
                vi.mocked(mockDataRecorderService.addSessionData).mockClear();

                service.start();
                rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 4, rawDistance: 3800 });

                expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith(
                    expect.objectContaining({ strokeCount: 4, distance: 3800 }),
                );
            });
        });
    });

    describe("stop method", (): void => {
        it("should transition from running to stopped", (): void => {
            service.start();

            service.stop();
            expect(service.sessionState()).toBe("stopped");
        });

        it("should transition from paused to stopped", (): void => {
            service.start();
            service.pause();

            service.stop();
            expect(service.sessionState()).toBe("stopped");
        });

        it("should allow new session after pause-stop", (): void => {
            service.start();
            service.pause();
            service.stop();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            service.start();

            expect(service.sessionState()).toBe("running");
            expect(mockDataRecorderService.reset).toHaveBeenCalledTimes(1);
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

        it("should freeze when paused", (): void => {
            service.start();
            vi.advanceTimersByTime(3000);
            const timeBeforePause: number = service.elapsedTime();

            service.pause();
            vi.advanceTimersByTime(5000);

            expect(service.elapsedTime()).toBe(timeBeforePause);
        });

        it("should accumulate elapsed time across multiple pause-resume cycles", (): void => {
            service.start();
            vi.advanceTimersByTime(2000);

            service.pause();
            vi.advanceTimersByTime(10000);

            service.start();
            vi.advanceTimersByTime(3000);

            service.pause();
            vi.advanceTimersByTime(10000);

            service.start();
            vi.advanceTimersByTime(1000);

            expect(service.elapsedTime()).toBeCloseTo(6, 0);
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

        it("should call dataRecorder.reset on auto-start from stopped after a prior stop", (): void => {
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

        it("should not auto-start when rawStrokeCount does not increase above previous value", (): void => {
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
                    { provide: ConfigManagerService, useValue: mockConfigManagerService },
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

    describe("pause method", (): void => {
        it("should transition from running to paused", (): void => {
            service.start();

            service.pause();
            expect(service.sessionState()).toBe("paused");
        });

        it("should not change state if already stopped", (): void => {
            service.start();
            service.stop();

            service.pause();
            expect(service.sessionState()).toBe("stopped");
        });

        it("should not change state if already paused", (): void => {
            service.start();
            service.pause();

            service.pause();
            expect(service.sessionState()).toBe("paused");
        });

        it("should not call dataRecorder.reset when pausing", (): void => {
            service.start();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            service.pause();

            expect(mockDataRecorderService.reset).not.toHaveBeenCalled();
        });
    });

    describe("recording during pause", (): void => {
        it("should not record session data while paused", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 1000 });

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });

        it("should not record via 1Hz timer while paused", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            vi.advanceTimersByTime(3000);

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });

        it("should resume recording from paused state when a new stroke arrives", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(1);
            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith(
                expect.objectContaining({ strokeCount: 2, distance: 1900 }),
            );
        });
    });

    describe("auto-resume from paused", (): void => {
        it("should be triggered when stroke arrives", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
            service.pause();

            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 4,
                rawDistance: 3800,
                driveDuration: 0.5,
            });

            expect(service.sessionState()).toBe("running");
        });

        it("should not call dataRecorder.reset", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
            service.pause();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 4,
                rawDistance: 3800,
                driveDuration: 0.5,
            });

            expect(mockDataRecorderService.reset).not.toHaveBeenCalled();
        });

        it("should continue accumulating strokes", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 4,
                rawDistance: 3800,
                driveDuration: 0.5,
            });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 5, rawDistance: 4750 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 5, distance: 4750 }),
            );
        });
    });

    describe("when autoStartTimer config is disabled", (): void => {
        it("should not auto-start when a new stroke appears in stopped state", (): void => {
            configSubject.next({
                ...new Config(),
                general: { ...new Config().general, autoStartTimer: false },
            });

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });

            expect(service.sessionState()).toBe("stopped");
            expect(vi.mocked(mockDataRecorderService.reset)).not.toHaveBeenCalled();
        });

        it("should not auto-resume when a new stroke appears in paused state", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            service.pause();

            configSubject.next({
                ...new Config(),
                general: { ...new Config().general, autoStartTimer: false },
            });

            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 2,
                rawDistance: 1900,
                driveDuration: 0.5,
            });

            expect(service.sessionState()).toBe("paused");
        });

        it("should auto-start again after re-enabling the config", (): void => {
            configSubject.next({
                ...new Config(),
                general: { ...new Config().general, autoStartTimer: false },
            });

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });
            expect(service.sessionState()).toBe("stopped");

            configSubject.next({
                ...new Config(),
                general: { ...new Config().general, autoStartTimer: true },
            });

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, driveDuration: 0.5 });
            expect(service.sessionState()).toBe("running");
        });

        it("should still allow manual start when auto-start is disabled", (): void => {
            configSubject.next({
                ...new Config(),
                general: { ...new Config().general, autoStartTimer: false },
            });

            service.start();

            expect(service.sessionState()).toBe("running");
        });
    });

    describe("while in paused state", (): void => {
        it("should not count distance", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // boat glides 50 m further — no new stroke
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1950 });

            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2900 });

            // delta after resume: 2900 - 1950 = 950 (only the post-resume stroke), total = 1900 + 950 = 2850
            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 3, distance: 2850 }),
            );
        });

        it("should not double-count distance if the same raw value is re-emitted on resume", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // same raw re-emitted (no change during pause)
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });

            // delta: 2850 - 1900 = 950, total = 1900 + 950 = 2850
            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 3, distance: 2850 }),
            );
        });
    });

    describe("when paused while rower is idle (no new strokes or distance)", (): void => {
        it("should resume cleanly and continue accumulating after pause-while-idle then manual resume (S17)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            vi.advanceTimersByTime(1000);
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            service.start();
            vi.advanceTimersByTime(1000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 3, distance: 2850 }),
            );
        });

        it("should auto-resume cleanly after pause-while-idle then new stroke (S18)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            vi.advanceTimersByTime(1000);
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 3,
                rawDistance: 2850,
                driveDuration: 0.5,
            }); // auto-resume

            expect(service.sessionState()).toBe("running");
            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 3, distance: 2850 }),
            );
        });
    });

    describe("when device reconnects while paused", (): void => {
        it("should resume and count reconnect delta when counter is higher than in pause (S19)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // reconnect: device now at count=6, distance=5700 (3 strokes during disconnect)
            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 6,
                rawDistance: 5700,
                driveDuration: 0.5,
            }); // auto-resume

            expect(service.sessionState()).toBe("running");
            // delta: strokes 3→6 = +3, so session total = 3+3 = 6; distance 2850+2850 = 5700
            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 6, distance: 5700 }),
            );
        });

        it("should resume and treat lower counter than in paused as overflow (S20)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // soft reconnect with lower counter = device partially reset
            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 2,
                rawDistance: 1900,
                driveDuration: 0.5,
            }); // auto-resume (regression branch: treat prev as 0)

            expect(service.sessionState()).toBe("running");
            // regression: prevStrokeCount resets to 0, delta = 2 → total = 3+2 = 5; prevDist=0  → 3+1900=4750
            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 5, distance: 4750 }),
            );
        });

        it("should not auto-resume on reconnect with zero strokes", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // hard reboot: first packet is rawStrokeCount=0
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 0, rawDistance: 0 });

            expect(service.sessionState()).toBe("paused");

            // first new stroke after reboot triggers auto-resume
            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 1,
                rawDistance: 950,
                driveDuration: 0.5,
            });

            expect(service.sessionState()).toBe("running");
            // regression in scan: prev was 3 → curr 0 → then curr 1: prev resets to 0, delta=1 → total=3+1=4
            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 4, distance: 3800 }),
            );
        });
    });

    describe("when multiple pause then resume cycles occur", (): void => {
        it("should correctly accumulate strokes across two pause-resume cycles (S24)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            service.pause();

            service.start(); // first resume
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
            service.pause();

            service.start(); // second resume
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 4, rawDistance: 3800 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 5, rawDistance: 4750 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 5, distance: 4750 }),
            );
        });

        it("should correctly accumulate strokes across two auto-resume cycles (S25)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            service.pause();

            // auto-resume 1
            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 3,
                rawDistance: 2850,
                driveDuration: 0.5,
            });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 4, rawDistance: 3800 });
            service.pause();

            // auto-resume 2
            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 5,
                rawDistance: 4750,
                driveDuration: 0.5,
            });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 6, rawDistance: 5700 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 6, distance: 5700 }),
            );
        });
    });

    describe("timer during pause", (): void => {
        it("should resume timer recording immediately after manual resume (S22)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            vi.advanceTimersByTime(1000); // timer tick at (2)
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            service.start(); // resume
            vi.advanceTimersByTime(1000);

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith(
                expect.objectContaining({ strokeCount: 2, distance: 1900 }),
            );
        });

        it("should restart timer after auto-resume from pause-while-idle on new stroke (S23)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            vi.advanceTimersByTime(1000); // timer tick at (2)
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // auto-resume on new stroke
            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 3,
                rawDistance: 2850,
                driveDuration: 0.5,
            });

            expect(service.sessionState()).toBe("running");
            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith(
                expect.objectContaining({ strokeCount: 3, distance: 2850 }),
            );

            vi.mocked(mockDataRecorderService.addSessionData).mockClear();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 4, rawDistance: 3800 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 4, distance: 3800 }),
            );
        });
    });

    describe("as part of the edge case handling", (): void => {
        it("should not emit timer ticks after pause-stop and should record cleanly on new session (S28)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            vi.advanceTimersByTime(1000); // timer tick at (2)
            service.pause();
            service.stop();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            vi.advanceTimersByTime(3000); // stale timer should not fire
            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();

            // new manual session
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 4, rawDistance: 3800 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 2, distance: 1900 }),
            );
        });

        it("should not emit sessionMetrics$ while paused (filter blocks running=false)", (): void => {
            const emittedValues: Array<ICalculatedMetrics> = [];
            service.sessionMetrics$.subscribe((metrics: ICalculatedMetrics): number =>
                emittedValues.push(metrics),
            );

            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            const countAfterRunning = emittedValues.length;

            service.pause();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 1000 }); // glide

            expect(emittedValues.length).toBe(countAfterRunning); // no new emission during pause
        });

        it("should track raw metrics during pause so resume delta is correct (filter running|paused in scan)", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            service.pause();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // (distance grows by 250m total while paused)
            for (let i = 1; i <= 5; i++) {
                rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 + i * 50 });
            }
            // final paused raw: rawDistance=2150

            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 3100 }); // +950 from last paused value

            // previousRaw.rawDistance = 2150 → delta = 3100-2150 = 950, total = 1900+950 = 2850
            expect(mockDataRecorderService.addSessionData).toHaveBeenLastCalledWith(
                expect.objectContaining({ strokeCount: 3, distance: 2850 }),
            );
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
