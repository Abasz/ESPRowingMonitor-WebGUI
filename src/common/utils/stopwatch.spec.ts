import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Stopwatch } from "./stopwatch";

describe("Stopwatch", (): void => {
    beforeEach((): void => {
        vi.useFakeTimers();
    });

    afterEach((): void => {
        vi.useRealTimers();
    });

    describe("as part of initial state", (): void => {
        it("should initialize with zero elapsed time", (): void => {
            const stopwatch = new Stopwatch();
            expect(stopwatch.elapsedMs()).toBe(0);
            expect(stopwatch.elapsedSeconds()).toBe(0);
        });

        it("should be in stopped state", (): void => {
            const stopwatch = new Stopwatch();
            expect(stopwatch.state).toBe("stopped");
        });
    });

    describe("start method", (): void => {
        it("should transition to running state", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            expect(stopwatch.state).toBe("running");
        });

        it("should begin from zero when no offset is given", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            expect(stopwatch.elapsedMs()).toBe(0);
        });

        it("should begin from offsetMs when an offset is provided", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start(500);
            expect(stopwatch.elapsedMs()).toBe(500);
            expect(stopwatch.elapsedSeconds()).toBeCloseTo(0.5, 5);
        });

        it("should accumulate time after the offset as time advances", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start(500);
            vi.advanceTimersByTime(1000);
            expect(stopwatch.elapsedMs()).toBe(1500);
        });

        it("should reset previously accumulated time on a new start call", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(3000);
            stopwatch.stop();

            stopwatch.start();
            expect(stopwatch.elapsedMs()).toBe(0);
        });

        it("should reset accumulated time from a previous stop when restarted", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(5000);
            stopwatch.stop();

            stopwatch.start(200);
            vi.advanceTimersByTime(800);
            expect(stopwatch.elapsedMs()).toBe(1000);
        });

        it("should be a no-op when called while already running", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(1000);

            stopwatch.start();
            vi.advanceTimersByTime(500);
            expect(stopwatch.elapsedMs()).toBe(1500);
        });

        it("should resume a paused stopwatch without resetting accumulated time", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(1000);
            stopwatch.pause();

            stopwatch.start();
            expect(stopwatch.state).toBe("running");
            vi.advanceTimersByTime(500);
            expect(stopwatch.elapsedMs()).toBe(1500);
        });

        it("should apply the offsetMs argument when resuming from pause", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(1000);
            stopwatch.pause();

            stopwatch.start(500);
            vi.advanceTimersByTime(200);
            expect(stopwatch.elapsedMs()).toBe(1700);
        });
    });

    describe("pause method", (): void => {
        it("should transition to paused state", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            stopwatch.pause();
            expect(stopwatch.state).toBe("paused");
        });

        it("should freeze elapsed time at the moment of pause", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(800);
            stopwatch.pause();

            const frozenMs = stopwatch.elapsedMs();
            vi.advanceTimersByTime(5000);
            expect(stopwatch.elapsedMs()).toBe(frozenMs);
        });

        it("should preserve accumulated time so resume continues seamlessly", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(1000);
            stopwatch.pause();
            vi.advanceTimersByTime(9999);
            stopwatch.start();
            vi.advanceTimersByTime(500);
            expect(stopwatch.elapsedMs()).toBe(1500);
        });

        it("should be a no-op when called on a stopped stopwatch", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.pause();
            expect(stopwatch.state).toBe("stopped");
            expect(stopwatch.elapsedMs()).toBe(0);
        });

        it("should be a no-op when called while already paused", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(500);
            stopwatch.pause();
            const msAfterFirstPause = stopwatch.elapsedMs();

            stopwatch.pause();
            expect(stopwatch.elapsedMs()).toBe(msAfterFirstPause);
        });
    });

    describe("stop method", (): void => {
        it("should transition to stopped state", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            stopwatch.stop();
            expect(stopwatch.state).toBe("stopped");
        });

        it("should transition from paused to stopped state", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            stopwatch.pause();
            stopwatch.stop();
            expect(stopwatch.state).toBe("stopped");
        });

        it("should freeze elapsed time at the moment of stop", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(1234);
            stopwatch.stop();

            const frozenMs = stopwatch.elapsedMs();
            vi.advanceTimersByTime(5000);
            expect(stopwatch.elapsedMs()).toBe(frozenMs);
        });

        it("should preserve accumulated time from offset after stop", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start(300);
            vi.advanceTimersByTime(700);
            stopwatch.stop();
            expect(stopwatch.elapsedMs()).toBe(1000);
        });

        it("should be idempotent when called on a non-running stopwatch", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(500);
            stopwatch.stop();
            const msAfterFirstStop = stopwatch.elapsedMs();

            stopwatch.stop();
            expect(stopwatch.elapsedMs()).toBe(msAfterFirstStop);
        });

        it("should stop a paused stopwatch and preserve the frozen time", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(1000);
            stopwatch.pause();
            stopwatch.stop();

            expect(stopwatch.state).toBe("stopped");
            expect(stopwatch.elapsedMs()).toBe(1000);
        });
    });

    describe("reset method", (): void => {
        it("should reset elapsed time to zero", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(2000);
            stopwatch.reset();
            expect(stopwatch.elapsedMs()).toBe(0);
        });

        it("should transition to stopped state after reset", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            stopwatch.reset();
            expect(stopwatch.state).toBe("stopped");
        });

        it("should clear paused state on reset", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            stopwatch.pause();
            stopwatch.reset();
            expect(stopwatch.state).toBe("stopped");
            expect(stopwatch.elapsedMs()).toBe(0);
        });

        it("should reset to zero without having called start", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.reset();
            expect(stopwatch.elapsedMs()).toBe(0);
            expect(stopwatch.state).toBe("stopped");
        });
    });

    describe("elapsedSeconds method", (): void => {
        it("should return elapsed milliseconds divided by 1000", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(2500);
            expect(stopwatch.elapsedSeconds()).toBeCloseTo(2.5, 5);
        });

        it("should reflect offset in seconds", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start(1200);
            expect(stopwatch.elapsedSeconds()).toBeCloseTo(1.2, 5);
        });
    });

    describe("as part of edge cases & robustness handling", (): void => {
        it("should return zero elapsed time before any start call", (): void => {
            const stopwatch = new Stopwatch();
            vi.advanceTimersByTime(5000);
            expect(stopwatch.elapsedMs()).toBe(0);
        });

        it("should work correctly across multiple start-stop cycles", (): void => {
            const stopwatch = new Stopwatch();

            stopwatch.start();
            vi.advanceTimersByTime(1000);
            stopwatch.stop();
            expect(stopwatch.elapsedMs()).toBe(1000);

            stopwatch.start();
            vi.advanceTimersByTime(500);
            stopwatch.stop();
            expect(stopwatch.elapsedMs()).toBe(500);

            stopwatch.start(250);
            vi.advanceTimersByTime(750);
            expect(stopwatch.elapsedMs()).toBe(1000);
        });

        it("should not drift when start is called immediately after stop", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(3000);
            stopwatch.stop();
            stopwatch.start();
            expect(stopwatch.elapsedMs()).toBe(0);
        });

        it("should accumulate time correctly across multiple pause-resume cycles", (): void => {
            const stopwatch = new Stopwatch();

            stopwatch.start();
            vi.advanceTimersByTime(1000);
            stopwatch.pause();
            vi.advanceTimersByTime(9999);
            stopwatch.start();
            vi.advanceTimersByTime(500);
            stopwatch.pause();
            vi.advanceTimersByTime(9999);
            stopwatch.start();
            vi.advanceTimersByTime(300);
            stopwatch.stop();

            expect(stopwatch.elapsedMs()).toBe(1800);
        });
    });
});
