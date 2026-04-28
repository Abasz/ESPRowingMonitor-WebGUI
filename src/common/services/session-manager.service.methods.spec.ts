import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    Config,
    IErgConnectionStatus,
    IIntervalsIcuConfig,
    IRawCalculatedMetrics,
} from "../common.interfaces";

import { ConfigManagerService } from "./config-manager.service";
import { DataRecorderService } from "./data-recorder.service";
import { IntervalsIcuService } from "./intervals-icu.service";
import { SessionManagerService } from "./session-manager.service";
import {
    mockRawMetrics,
    SessionManagerTestContext,
    setupSessionManagerTestBed,
} from "./session-manager.test.helpers";

describe("SessionManagerService", (): void => {
    let service: SessionManagerService;
    let rawMetricsSubject: BehaviorSubject<IRawCalculatedMetrics>;
    let connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let mockDataRecorderService: Pick<
        DataRecorderService,
        "currentSessionId" | "reset" | "addSessionData" | "addLap"
    >;
    let mockConfigManagerService: Pick<ConfigManagerService, "configChanged$" | "getGroup">;
    let mockIntervalsIcuService: Pick<IntervalsIcuService, "uploadSession">;
    let mockSnackBar: Pick<MatSnackBar, "open">;

    beforeEach((): void => {
        vi.useFakeTimers();

        const context: SessionManagerTestContext = setupSessionManagerTestBed();
        service = context.service;
        rawMetricsSubject = context.rawMetricsSubject;
        connectionStatusSubject = context.connectionStatusSubject;
        mockDataRecorderService = context.mockDataRecorderService;
        mockConfigManagerService = context.mockConfigManagerService;
        mockIntervalsIcuService = context.mockIntervalsIcuService;
        mockSnackBar = context.mockSnackBar;
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

        describe("auto-upload triggering", (): void => {
            const enabledConfig: IIntervalsIcuConfig = {
                apiKey: "secret-key",
                athleteId: "123",
                autoUploadEnabled: true,
            };

            it("should call uploadSession with sessionId and config when auto-upload is enabled", (): void => {
                vi.mocked(mockConfigManagerService.getGroup).mockReturnValue({
                    ...new Config().general,
                    intervalsIcu: enabledConfig,
                });
                service.start();

                service.stop();

                expect(mockIntervalsIcuService.uploadSession).toHaveBeenCalledTimes(1);
                expect(mockIntervalsIcuService.uploadSession).toHaveBeenCalledWith(
                    mockDataRecorderService.currentSessionId,
                    enabledConfig,
                );
            });

            it("should not call uploadSession when autoUploadEnabled is false", (): void => {
                service.start();

                service.stop();

                expect(mockIntervalsIcuService.uploadSession).not.toHaveBeenCalled();
            });

            it("should not call uploadSession when apiKey is empty", (): void => {
                vi.mocked(mockConfigManagerService.getGroup).mockReturnValue({
                    ...new Config().general,
                    intervalsIcu: { ...enabledConfig, apiKey: "" },
                });
                service.start();

                service.stop();

                expect(mockIntervalsIcuService.uploadSession).not.toHaveBeenCalled();
            });

            it("should not trigger auto-upload when session is already stopped", (): void => {
                vi.mocked(mockConfigManagerService.getGroup).mockReturnValue({
                    ...new Config().general,
                    intervalsIcu: enabledConfig,
                });

                service.stop();

                expect(mockIntervalsIcuService.uploadSession).not.toHaveBeenCalled();
            });

            it("should call uploadSession when stopping from paused state", (): void => {
                vi.mocked(mockConfigManagerService.getGroup).mockReturnValue({
                    ...new Config().general,
                    intervalsIcu: enabledConfig,
                });
                service.start();
                service.pause();

                service.stop();

                expect(mockIntervalsIcuService.uploadSession).toHaveBeenCalledTimes(1);
                expect(mockIntervalsIcuService.uploadSession).toHaveBeenCalledWith(
                    mockDataRecorderService.currentSessionId,
                    enabledConfig,
                );
            });
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

        it("should show a snackbar with the lap number on the first lap", (): void => {
            service.start();

            service.addLap();

            expect(mockSnackBar.open).toHaveBeenCalledWith("Lap 1", "Dismiss", { duration: 3000 });
        });

        it("should increment the lap number on each subsequent lap", (): void => {
            service.start();

            service.addLap();
            service.addLap();
            service.addLap();

            expect(mockSnackBar.open).toHaveBeenCalledTimes(3);
            expect(mockSnackBar.open).toHaveBeenNthCalledWith(3, "Lap 3", "Dismiss", { duration: 3000 });
        });

        it("should not show a snackbar when stopped", (): void => {
            service.addLap();

            expect(mockSnackBar.open).not.toHaveBeenCalled();
        });

        it("should not show a snackbar when paused", (): void => {
            service.start();
            service.pause();

            service.addLap();

            expect(mockSnackBar.open).not.toHaveBeenCalledWith(
                expect.stringContaining("Lap"),
                "Dismiss",
                expect.anything(),
            );
        });

        it("should restart lap count from 1 after a session is stopped and restarted", (): void => {
            service.start();
            service.addLap();
            service.addLap();
            service.stop();
            vi.mocked(mockSnackBar.open).mockClear();

            service.start();
            service.addLap();

            expect(mockSnackBar.open).toHaveBeenCalledWith("Lap 1", "Dismiss", { duration: 3000 });
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
