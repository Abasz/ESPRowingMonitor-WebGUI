import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ICalculatedMetrics } from "../common.interfaces";

import { MetricsService } from "./metrics.service";
import { SessionManagerService } from "./session-manager.service";

describe("SessionManagerService", (): void => {
    let service: SessionManagerService;

    let mockMetricsService: Pick<MetricsService, "reset" | "allMetrics$">;
    let allMetricsSubject: BehaviorSubject<ICalculatedMetrics>;

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

    beforeEach((): void => {
        vi.useFakeTimers();

        allMetricsSubject = new BehaviorSubject<ICalculatedMetrics>(mockMetrics);

        mockMetricsService = {
            reset: vi.fn(),
            allMetrics$: allMetricsSubject.asObservable(),
        };

        TestBed.configureTestingModule({
            providers: [SessionManagerService, { provide: MetricsService, useValue: mockMetricsService }],
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
    });

    describe("distance regression handling", (): void => {
        it("should call metricsService.reset on distance regression", (): void => {
            vi.mocked(mockMetricsService.reset).mockClear();

            allMetricsSubject.next({ ...mockMetrics, distance: 5000 });
            allMetricsSubject.next({ ...mockMetrics, distance: 0 });

            expect(mockMetricsService.reset).toHaveBeenCalled();
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
