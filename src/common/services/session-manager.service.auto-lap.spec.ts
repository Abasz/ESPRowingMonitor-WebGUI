import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Config, IRawCalculatedMetrics } from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
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
    let mockDataRecorderService: Pick<DataRecorderService, "reset" | "addSessionData" | "addLap">;
    let mockSnackBar: Pick<MatSnackBar, "open">;

    beforeEach((): void => {
        vi.useFakeTimers();

        const context: SessionManagerTestContext = setupSessionManagerTestBed();
        service = context.service;
        configSubject = context.configSubject;
        rawMetricsSubject = context.rawMetricsSubject;
        mockDataRecorderService = context.mockDataRecorderService;
        mockSnackBar = context.mockSnackBar;
    });

    afterEach((): void => {
        vi.useRealTimers();
    });

    describe("auto-lap distance mode", (): void => {
        beforeEach((): void => {
            configSubject.next(withSessionConfig({ autoLap: "distance", autoLapValue: 500 }));
        });

        it("should record a distance lap when session distance reaches threshold", (): void => {
            service.start();
            // distance is in cm, autoLapValue 500 = 500m = 50000cm
            for (let strokeNumber = 1; strokeNumber <= 53; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }

            // stroke 53: distance = 50350cm = 503.5m → crosses 500m threshold
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(53, "distance");
        });

        it("should not record a lap before threshold is reached", (): void => {
            service.start();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            for (let strokeNumber = 1; strokeNumber <= 52; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }

            // stroke 52: distance = 49400cm = 494m → below 500m
            expect(mockDataRecorderService.addLap).not.toHaveBeenCalled();
        });

        it("should record multiple laps at each threshold crossing", (): void => {
            service.start();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            for (let strokeNumber = 1; strokeNumber <= 110; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }

            // 110 * 950 = 104500cm = 1045m → should have crossed 500m and 1000m
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(53, "distance"); // 503.5m
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(106, "distance"); // 1007m
            expect(mockDataRecorderService.addLap).toHaveBeenCalledTimes(2);
        });

        it("should reset threshold on new session", (): void => {
            service.start();
            for (let strokeNumber = 1; strokeNumber <= 53; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }
            service.stop();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            service.start();
            // new session: distance resets
            for (let strokeNumber = 54; strokeNumber <= 106; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: (strokeNumber - 53) * 950,
                });
            }

            // stroke 106: session distance = 53 * 950 = 50350cm → crosses 500m again
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(expect.any(Number), "distance");
        });

        it("should not record a lap when autoLap is off", (): void => {
            configSubject.next(withSessionConfig({ autoLap: "off", autoLapValue: 500 }));

            service.start();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            for (let strokeNumber = 1; strokeNumber <= 60; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }

            expect(mockDataRecorderService.addLap).not.toHaveBeenCalled();
        });

        it("should not record a lap while paused", (): void => {
            service.start();
            for (let strokeNumber = 1; strokeNumber <= 30; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }
            service.pause();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 30, rawDistance: 60000 });

            expect(mockDataRecorderService.addLap).not.toHaveBeenCalledWith(expect.any(Number), "distance");
        });

        it("should record only one lap per emission when a single jump crosses multiple thresholds", (): void => {
            service.start();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            // single large jump: 110000cm = 1100m → crosses both 500m and 1000m
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 110000 });

            // only one lap for the 500m crossing; nextThreshold advances to 1000m
            expect(mockDataRecorderService.addLap).toHaveBeenCalledTimes(1);
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(1, "distance");

            // next emission triggers the 1000m lap
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 115000 });

            expect(mockDataRecorderService.addLap).toHaveBeenCalledTimes(2);
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(2, "distance");
        });
    });

    describe("auto-lap time mode", (): void => {
        beforeEach((): void => {
            configSubject.next(withSessionConfig({ autoLap: "time", autoLapValue: 1 }));
        });

        it("should record a time lap when elapsed time reaches threshold", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            vi.advanceTimersByTime(61000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(2, "time");
        });

        it("should record multiple time laps", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            vi.advanceTimersByTime(61000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });

            vi.advanceTimersByTime(60000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(2, "time");
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(3, "time");
            expect(mockDataRecorderService.addLap).toHaveBeenCalledTimes(2);
        });

        it("should not advance time threshold during pause", (): void => {
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            vi.advanceTimersByTime(30000);
            service.pause();

            vi.advanceTimersByTime(120000);

            // resume and emit stroke - should still need ~30 more active seconds
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });

            expect(mockDataRecorderService.addLap).not.toHaveBeenCalledWith(expect.any(Number), "time");

            // advance past 1 minute of actual elapsed time
            vi.advanceTimersByTime(31000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(3, "time");
        });
    });

    describe("auto-lap mode switching mid-session", (): void => {
        it("should reset threshold and switch to time laps when mode changes from distance to time", (): void => {
            configSubject.next(withSessionConfig({ autoLap: "distance", autoLapValue: 500 }));

            service.start();
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            // row 304m (below 500m distance threshold)
            for (let strokeNumber = 1; strokeNumber <= 32; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }
            expect(mockDataRecorderService.addLap).not.toHaveBeenCalled();

            // switch to time mode with 1 minute threshold
            configSubject.next(withSessionConfig({ autoLap: "time", autoLapValue: 1 }));

            // advance past 1 minute and emit a stroke
            vi.advanceTimersByTime(61000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 33, rawDistance: 33 * 950 });

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(33, "time");
        });

        it("should reset threshold and switch to distance laps when mode changes from time to distance", (): void => {
            configSubject.next(withSessionConfig({ autoLap: "time", autoLapValue: 1 }));

            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            // advance past 1 minute and record a time lap
            vi.advanceTimersByTime(61000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(2, "time");
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            // switch to distance mode with 500m threshold
            // reset sets lastLapValue to current distance (19m)
            configSubject.next(withSessionConfig({ autoLap: "distance", autoLapValue: 500 }));

            // emit a stroke at 28.5m — should NOT trigger a lap (well below 500m from switch point)
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });
            expect(mockDataRecorderService.addLap).not.toHaveBeenCalled();

            // row past 500m threshold from switch point (19m + 500m = 519m)
            for (let strokeNumber = 4; strokeNumber <= 57; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }

            // stroke 55: 55 * 950 = 52250cm = 522.5m → crosses 519m (19m + 500m)
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(55, "distance");
        });
    });

    describe("as part of lap feedback", (): void => {
        it("should show a snackbar on a distance auto-lap", (): void => {
            configSubject.next(withSessionConfig({ autoLap: "distance", autoLapValue: 500 }));
            service.start();
            vi.mocked(mockSnackBar.open).mockClear();

            for (let strokeNumber = 1; strokeNumber <= 53; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }

            expect(mockSnackBar.open).toHaveBeenCalledWith("Lap 1", "Dismiss", { duration: 3000 });
        });

        it("should show a snackbar on a time auto-lap", (): void => {
            configSubject.next(withSessionConfig({ autoLap: "time", autoLapValue: 1 }));
            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });
            vi.mocked(mockSnackBar.open).mockClear();

            vi.advanceTimersByTime(61000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });

            expect(mockSnackBar.open).toHaveBeenCalledWith("Lap 1", "Dismiss", { duration: 3000 });
        });

        it("should show correct lap number when manual and auto laps are mixed", (): void => {
            configSubject.next(withSessionConfig({ autoLap: "distance", autoLapValue: 500 }));
            service.start();
            vi.mocked(mockSnackBar.open).mockClear();

            // manual lap first
            service.addLap();
            expect(mockSnackBar.open).toHaveBeenCalledWith("Lap 1", "Dismiss", { duration: 3000 });

            // auto-lap fires next
            for (let strokeNumber = 1; strokeNumber <= 53; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }
            expect(mockSnackBar.open).toHaveBeenCalledWith("Lap 2", "Dismiss", { duration: 3000 });
        });
    });

    describe("manual lap resets auto-lap threshold", (): void => {
        it("should reset distance auto-lap threshold when manual lap is added", (): void => {
            configSubject.next(withSessionConfig({ autoLap: "distance", autoLapValue: 500 }));

            service.start();

            // row to 285m (below 500m threshold)
            for (let strokeNumber = 1; strokeNumber <= 30; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            // add manual lap at 285m — resets auto-lap threshold to current distance
            service.addLap();

            // row another 500m from the manual lap point (285m + 500m = 785m)
            for (let strokeNumber = 31; strokeNumber <= 84; strokeNumber++) {
                rawMetricsSubject.next({
                    ...mockRawMetrics,
                    rawStrokeCount: strokeNumber,
                    rawDistance: strokeNumber * 950,
                });
            }

            // stroke 83: 83 * 950 = 78850cm = 788.5m → crosses 785m (285m + 500m)
            // first call is the manual lap, second is the auto-lap
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(30, "manual");
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(83, "distance");
        });

        it("should reset time auto-lap threshold when manual lap is added", (): void => {
            configSubject.next(withSessionConfig({ autoLap: "time", autoLapValue: 1 }));

            service.start();
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 1, rawDistance: 950 });

            // advance 30 seconds (below 1 minute threshold)
            vi.advanceTimersByTime(30000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 2, rawDistance: 1900 });
            vi.mocked(mockDataRecorderService.addLap).mockClear();

            // add manual lap at ~30 seconds — resets auto-lap threshold
            service.addLap();

            // advance another 30 seconds (total 60s, but only 30s since manual lap)
            vi.advanceTimersByTime(30000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 3, rawDistance: 2850 });

            // should NOT fire auto-lap (only 30s since manual lap reset)
            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(2, "manual");
            expect(mockDataRecorderService.addLap).not.toHaveBeenCalledWith(expect.any(Number), "time");

            // advance another 31 seconds (now 61s since manual lap)
            vi.advanceTimersByTime(31000);
            rawMetricsSubject.next({ ...mockRawMetrics, rawStrokeCount: 4, rawDistance: 3800 });

            expect(mockDataRecorderService.addLap).toHaveBeenCalledWith(4, "time");
        });
    });
});
