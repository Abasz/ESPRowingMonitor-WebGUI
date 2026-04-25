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
import {
    mockRawMetrics,
    SessionManagerTestContext,
    setupSessionManagerTestBed,
    withSessionConfig,
} from "./session-manager.test.helpers";

describe("SessionManagerService", (): void => {
    let service: SessionManagerService;
    let configSubject: BehaviorSubject<Config>;
    let rawMetricsSubject: BehaviorSubject<IRawCalculatedMetrics>;
    let heartRateSubject: BehaviorSubject<IHeartRate | undefined>;
    let connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let mockDataRecorderService: Pick<DataRecorderService, "reset" | "addSessionData" | "addLap">;
    let mockErgConnectionService: Pick<ErgConnectionService, "connectionStatus$">;
    let mockConfigManagerService: Pick<ConfigManagerService, "configChanged$">;

    const mockSessionMetrics: ICalculatedMetrics = {
        avgStrokePower: 0,
        driveDuration: 0,
        recoveryDuration: 0,
        dragFactor: 0,
        distance: 0,
        strokeCount: 0,
        handleForces: [],
        peakForce: 0,
        peakForcePositionNorm: 0,
        strokeRate: 0,
        speed: 0,
        distPerStroke: 0,
        driveLength: 0,
        totalWork: 0,
    };

    const mockHeartRate: IHeartRate = {
        heartRate: 150,
        rrIntervals: [800],
        contactDetected: true,
    };

    beforeEach((): void => {
        vi.useFakeTimers();

        const context: SessionManagerTestContext = setupSessionManagerTestBed();
        service = context.service;
        configSubject = context.configSubject;
        rawMetricsSubject = context.rawMetricsSubject;
        heartRateSubject = context.heartRateSubject;
        connectionStatusSubject = context.connectionStatusSubject;
        mockDataRecorderService = context.mockDataRecorderService;
        mockErgConnectionService = context.mockErgConnectionService;
        mockConfigManagerService = context.mockConfigManagerService;
    });

    afterEach((): void => {
        vi.useRealTimers();
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

    describe("when autoSession config is disabled", (): void => {
        it("should not auto-start when a new stroke appears in stopped state", (): void => {
            configSubject.next(withSessionConfig({ autoSession: "off" }));

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });

            expect(service.sessionState()).toBe("stopped");
            expect(vi.mocked(mockDataRecorderService.reset)).not.toHaveBeenCalled();
        });

        it("should not auto-resume when a new stroke appears in paused state", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            service.pause();

            configSubject.next(withSessionConfig({ autoSession: "off" }));

            rawMetricsSubject.next({
                ...mockRawMetrics,
                rawStrokeCount: 2,
                rawDistance: 1900,
                driveDuration: 0.5,
            });

            expect(service.sessionState()).toBe("paused");
        });

        it("should auto-start again after re-enabling the config", (): void => {
            configSubject.next(withSessionConfig({ autoSession: "off" }));

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });
            expect(service.sessionState()).toBe("stopped");

            configSubject.next(withSessionConfig({ autoSession: "autoStart" }));

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, driveDuration: 0.5 });
            expect(service.sessionState()).toBe("running");
        });

        it("should still allow manual start when auto-start is disabled", (): void => {
            configSubject.next(withSessionConfig({ autoSession: "off" }));

            service.start();

            expect(service.sessionState()).toBe("running");
        });

        it("should auto-start when autoSession is autoStartAndPause", (): void => {
            configSubject.next(withSessionConfig({ autoSession: "autoStartAndPause" }));

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, driveDuration: 0.5 });

            expect(service.sessionState()).toBe("running");
        });
    });

    describe("auto-pause behaviour", (): void => {
        beforeEach((): void => {
            configSubject.next(withSessionConfig({ autoSession: "autoStartAndPause" }));
        });

        it("should pause when speed drops to zero after non-zero speed", (): void => {
            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 3.5 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 3.2 });

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 0 });

            expect(service.sessionState()).toBe("paused");
        });

        it("should record a pause marker when auto-pausing", (): void => {
            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 3.5 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 0 });

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(1, "manual", true);
        });

        it("should not pause when speed is zero but non-zero speed was never seen", (): void => {
            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 0, rawDistance: 0, speed: 0 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 0, rawDistance: 0, speed: 0 });

            expect(service.sessionState()).toBe("running");
        });

        it("should not pause when autoSession is autoStart (not autoStartAndPause)", (): void => {
            configSubject.next(withSessionConfig({ autoSession: "autoStart" }));

            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 3.5 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 0 });

            expect(service.sessionState()).toBe("running");
        });

        it("should not pause when autoSession is off", (): void => {
            configSubject.next(withSessionConfig({ autoSession: "off" }));

            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 3.5 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 0 });

            expect(service.sessionState()).toBe("running");
        });

        it("should not pause when session is already paused", (): void => {
            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 3.5 });
            service.pause();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 0 });

            expect(mockDataRecorderService.addLap).not.toHaveBeenCalled();
        });

        it("should resume via auto-start after auto-pause when new stroke arrives", (): void => {
            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 3.5 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 0 });

            expect(service.sessionState()).toBe("paused");

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 3.0 });

            expect(service.sessionState()).toBe("running");
        });

        it("should reset hasSeenNonZeroSpeed on new session", (): void => {
            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 3.5 });
            service.stop();

            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 0 });

            expect(service.sessionState()).toBe("running");
        });

        it("should auto-pause again after resume and subsequent speed drop to zero", (): void => {
            service.start();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 3.5 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 0 });
            expect(service.sessionState()).toBe("paused");

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 3.0 });
            expect(service.sessionState()).toBe("running");

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 0 });
            expect(service.sessionState()).toBe("paused");
        });

        it("should not pause on first speed drop after enabling autoStartAndPause mid-session", (): void => {
            configSubject.next(withSessionConfig({ autoSession: "autoStart" }));

            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 3.5 });

            configSubject.next(withSessionConfig({ autoSession: "autoStartAndPause" }));

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 500, speed: 0 });

            expect(service.sessionState()).toBe("running");

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 3.5 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1000, speed: 0 });

            expect(service.sessionState()).toBe("paused");
        });
    });
});
