import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ICalculatedMetrics, IErgConnectionStatus, IHeartRate } from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { MetricsService } from "./metrics.service";
import { SessionManagerService } from "./session-manager.service";

describe("SessionManagerService", (): void => {
    let service: SessionManagerService;

    let mockMetricsService: Pick<MetricsService, "reset" | "allMetrics$" | "heartRateData$">;
    let mockDataRecorderService: Pick<DataRecorderService, "reset" | "addSessionData">;
    let mockErgConnectionService: Pick<ErgConnectionService, "connectionStatus$">;
    let allMetricsSubject: BehaviorSubject<ICalculatedMetrics>;
    let heartRateSubject: BehaviorSubject<IHeartRate | undefined>;
    let connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;

    const mockMetrics: ICalculatedMetrics = {
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

        allMetricsSubject = new BehaviorSubject<ICalculatedMetrics>(mockMetrics);
        heartRateSubject = new BehaviorSubject<IHeartRate | undefined>(undefined);
        connectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>({ status: "disconnected" });

        mockMetricsService = {
            reset: vi.fn(),
            allMetrics$: allMetricsSubject.asObservable(),
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

        it("should call metricsService.reset on start", (): void => {
            vi.mocked(mockMetricsService.reset).mockClear();

            service.start();
            expect(mockMetricsService.reset).toHaveBeenCalled();
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

        it("should call metricsService.reset when stopping", (): void => {
            service.start();
            vi.mocked(mockMetricsService.reset).mockClear();

            service.stop();
            expect(mockMetricsService.reset).toHaveBeenCalled();
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
        it("should auto-start when first stroke arrives in stopped state", (): void => {
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, driveDuration: 0.5 });

            expect(service.sessionState()).toBe("running");
        });

        it("should call dataRecorder.reset on auto-start from stopped", (): void => {
            connectionStatusSubject.next({ status: "connected", deviceName: "ESP Rowing Monitor" });
            vi.mocked(mockDataRecorderService.reset).mockClear();

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, driveDuration: 0.5 });

            expect(mockDataRecorderService.reset).toHaveBeenCalledWith("ESP Rowing Monitor");
        });

        it("should call dataRecorder.reset on auto-start from stopped state", (): void => {
            connectionStatusSubject.next({ status: "connected", deviceName: "ESP Rowing Monitor" });
            service.start();
            service.stop();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, driveDuration: 0.5 });

            expect(mockDataRecorderService.reset).toHaveBeenCalledWith("ESP Rowing Monitor");
        });

        it("should not auto-start when already running", (): void => {
            service.start();
            vi.mocked(mockMetricsService.reset).mockClear();

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, driveDuration: 0.5 });

            expect(service.sessionState()).toBe("running");
            expect(mockMetricsService.reset).not.toHaveBeenCalled();
        });

        it("should auto-start when stroke arrives in stopped state", (): void => {
            service.start();
            service.stop();

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, driveDuration: 0.5 });

            expect(service.sessionState()).toBe("running");
        });

        it("should correct session start timestamp using driveDuration", (): void => {
            const now: number = Date.now();
            const driveDuration = 1.2;

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, driveDuration });

            vi.advanceTimersByTime(2000);
            const expectedElapsed: number = (Date.now() - (now - driveDuration * 1000)) / 1000;
            expect(service.elapsedTime()).toBeCloseTo(expectedElapsed, 0);
        });

        it("should start the timer after auto-start", (): void => {
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, driveDuration: 0 });

            vi.advanceTimersByTime(3000);
            expect(service.elapsedTime()).toBeCloseTo(3, 0);
        });

        it("should not auto-start when strokeCount is zero", (): void => {
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 0 });

            expect(service.sessionState()).toBe("stopped");
        });

        it("should record the first stroke that triggers auto-start", (): void => {
            const firstStroke: ICalculatedMetrics = {
                ...mockMetrics,
                strokeCount: 1,
                driveDuration: 0.5,
                distance: 100,
            };
            heartRateSubject.next(mockHeartRate);

            allMetricsSubject.next(firstStroke);

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...firstStroke,
                elapsedTime: 0.5,
                heartRate: mockHeartRate,
            });
        });

        it("should record the first stroke even without heart rate data", (): void => {
            const firstStroke: ICalculatedMetrics = {
                ...mockMetrics,
                strokeCount: 1,
                driveDuration: 0.5,
                distance: 100,
            };

            allMetricsSubject.next(firstStroke);

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...firstStroke,
                elapsedTime: 0.5,
                heartRate: undefined,
            });
        });
    });

    describe("session data recording", (): void => {
        it("should record session data when running and metrics change", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...mockMetrics,
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

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 0, distance: 50 });

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });

        it("should not record when strokeCount and distance are both zero", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 0, distance: 0 });

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });

        it("should not record duplicate metrics with same distance and strokeCount", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(1);
        });

        it("should record when speed changes to zero with same distance and strokeCount", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            allMetricsSubject.next({
                ...mockMetrics,
                strokeCount: 1,
                distance: 100,
                speed: 2.5,
            });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100, speed: 0 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(1);
            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith(
                expect.objectContaining({ distance: 100, strokeCount: 1, speed: 0 }),
            );
        });

        it("should record when distance or strokeCount increases", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 200 });
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 2, distance: 200 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(3);
        });

        it("should record after stop and restart with new stroke data", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });
            service.stop();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // new session: auto-start fires on strokeCount > 0, setupRecording also records
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 2, distance: 200 });

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...mockMetrics,
                strokeCount: 2,
                distance: 200,
                elapsedTime: 0,
                heartRate: mockHeartRate,
            });
        });

        it("should not write stale session-1 data into session 2 when the 1Hz timer fires after manual restart", (): void => {
            service.start();
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });
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
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            vi.advanceTimersByTime(1000);

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledWith({
                ...mockMetrics,
                strokeCount: 1,
                distance: 100,
                elapsedTime: 1,
                heartRate: mockHeartRate,
            });
        });

        it("should capture updated heart rate on timer tick without new stroke", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });
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
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            // advance 500ms (no timer tick yet — 1s hasn't elapsed)
            vi.advanceTimersByTime(500);
            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();

            // new stroke arrives at 500ms → switchMap restarts, records immediately via startWith(0)
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 2, distance: 200 });
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
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });
            service.stop();
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            vi.advanceTimersByTime(3000);

            expect(mockDataRecorderService.addSessionData).not.toHaveBeenCalled();
        });

        it("should record multiple timer samples when no new data points arrive", (): void => {
            service.start();
            heartRateSubject.next(mockHeartRate);
            allMetricsSubject.next({ ...mockMetrics, strokeCount: 1, distance: 100 });
            vi.mocked(mockDataRecorderService.addSessionData).mockClear();

            vi.advanceTimersByTime(3000);

            expect(mockDataRecorderService.addSessionData).toHaveBeenCalledTimes(3);
        });
    });

    describe("distance regression handling", (): void => {
        it("should call metricsService.reset on distance regression", (): void => {
            service.start();
            vi.mocked(mockMetricsService.reset).mockClear();

            allMetricsSubject.next({ ...mockMetrics, distance: 5000 });
            allMetricsSubject.next({ ...mockMetrics, distance: 0 });

            expect(mockMetricsService.reset).toHaveBeenCalled();
        });

        it("should call dataRecorder.reset on distance regression", (): void => {
            connectionStatusSubject.next({ status: "connected", deviceName: "ESP Rowing Monitor" });
            service.start();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            allMetricsSubject.next({ ...mockMetrics, distance: 5000 });
            allMetricsSubject.next({ ...mockMetrics, distance: 0 });

            expect(mockDataRecorderService.reset).toHaveBeenCalledWith("ESP Rowing Monitor");
        });

        it("should transition to stopped on distance regression", (): void => {
            service.start();

            allMetricsSubject.next({ ...mockMetrics, distance: 5000 });
            allMetricsSubject.next({ ...mockMetrics, distance: 0 });

            expect(service.sessionState()).toBe("stopped");
        });

        it("should reset elapsed time to zero on distance regression", (): void => {
            service.start();
            vi.advanceTimersByTime(3000);

            allMetricsSubject.next({ ...mockMetrics, distance: 5000 });
            allMetricsSubject.next({ ...mockMetrics, distance: 0 });

            expect(service.elapsedTime()).toBe(0);
        });

        it("should not trigger on increasing distance", (): void => {
            service.start();
            vi.mocked(mockMetricsService.reset).mockClear();

            allMetricsSubject.next({ ...mockMetrics, distance: 100 });
            allMetricsSubject.next({ ...mockMetrics, distance: 200 });

            expect(mockMetricsService.reset).not.toHaveBeenCalled();
            expect(service.sessionState()).toBe("running");
        });

        it("should not trigger during stop", (): void => {
            service.start();
            allMetricsSubject.next({ ...mockMetrics, distance: 5000 });
            vi.mocked(mockMetricsService.reset).mockClear();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            service.stop();

            // stop() resets metrics but not dataRecorder; regression handler does not fire
            expect(mockMetricsService.reset).toHaveBeenCalledTimes(1);
            expect(mockDataRecorderService.reset).not.toHaveBeenCalled();
            expect(service.sessionState()).toBe("stopped");
        });

        it("should not trigger during start", (): void => {
            service.start();
            allMetricsSubject.next({ ...mockMetrics, distance: 5000 });
            service.stop();
            vi.mocked(mockMetricsService.reset).mockClear();
            vi.mocked(mockDataRecorderService.reset).mockClear();

            service.start();

            expect(mockMetricsService.reset).toHaveBeenCalledTimes(1);
            expect(mockDataRecorderService.reset).toHaveBeenCalledTimes(1);
            expect(service.sessionState()).toBe("running");
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
