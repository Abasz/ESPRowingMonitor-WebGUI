import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ICalculatedMetrics, IHeartRate, IRawCalculatedMetrics } from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { SessionManagerService } from "./session-manager.service";
import {
    mockRawMetrics,
    SessionManagerTestContext,
    setupSessionManagerTestBed,
} from "./session-manager.test.helpers";

describe("SessionManagerService", (): void => {
    let service: SessionManagerService;
    let rawMetricsSubject: BehaviorSubject<IRawCalculatedMetrics>;
    let heartRateSubject: BehaviorSubject<IHeartRate | undefined>;
    let mockDataRecorderService: Pick<DataRecorderService, "reset" | "addSessionData" | "addLap">;

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
        powerBalance: 0.5,
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
        rawMetricsSubject = context.rawMetricsSubject;
        heartRateSubject = context.heartRateSubject;
        mockDataRecorderService = context.mockDataRecorderService;
    });

    afterEach((): void => {
        vi.useRealTimers();
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
});
