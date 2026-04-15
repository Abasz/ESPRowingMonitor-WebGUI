import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Config, IErgConnectionStatus, IHeartRate, IRawCalculatedMetrics } from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";
import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { MetricsService } from "./metrics.service";
import { SessionManagerService } from "./session-manager.service";

describe("SessionManagerService", (): void => {
    let service: SessionManagerService;

    let mockMetricsService: Pick<MetricsService, "rawMetrics$" | "heartRateData$">;
    let mockDataRecorderService: Pick<DataRecorderService, "reset" | "addSessionData" | "addLap">;
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
        peakForcePositionNorm: 0,
        strokeRate: 0,
        speed: 0,
        distPerStroke: 0,
        driveLength: 0,
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
            addLap: vi.fn().mockResolvedValue(1),
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

        it("should record a pause marker when pausing", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 5, rawDistance: 500 });

            service.pause();

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(5, "manual", true);
        });

        it("should record a pause marker with zero stroke index when paused before any metrics", (): void => {
            service.start();

            service.pause();

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(0, "manual", true);
        });

        it("should not record a pause marker when not running", (): void => {
            service.pause();

            expect(mockDataRecorderService.addLap).not.toHaveBeenCalled();
        });
    });

    describe("addLap method", (): void => {
        it("should record a manual lap when running", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 10, rawDistance: 1000 });

            service.addLap();

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(10, "manual");
        });

        it("should not record a lap when stopped", (): void => {
            service.addLap();

            expect(mockDataRecorderService.addLap).not.toHaveBeenCalled();
        });

        it("should not record a lap when paused", (): void => {
            service.start();
            service.pause();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            service.addLap();

            expect(mockDataRecorderService.addLap).not.toHaveBeenCalled();
        });

        it("should use the current stroke count from session metrics", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 300 });
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 7, rawDistance: 700 });

            service.addLap();

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(7, "manual");
        });

        it("should use the accumulated stroke count after pause and resume", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 5, rawDistance: 4750 });
            service.pause();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 8, rawDistance: 7600 });

            service.addLap();

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(8, "manual");
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
