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

        it("should not be running", (): void => {
            const stopwatch = new Stopwatch();
            expect(stopwatch.isRunning).toBe(false);
        });
    });

    describe("start method", (): void => {
        it("should mark stopwatch as running", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            expect(stopwatch.isRunning).toBe(true);
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
    });

    describe("stop method", (): void => {
        it("should mark stopwatch as not running", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            stopwatch.stop();
            expect(stopwatch.isRunning).toBe(false);
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
    });

    describe("reset method", (): void => {
        it("should reset elapsed time to zero", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            vi.advanceTimersByTime(2000);
            stopwatch.reset();
            expect(stopwatch.elapsedMs()).toBe(0);
        });

        it("should mark stopwatch as not running after reset", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.start();
            stopwatch.reset();
            expect(stopwatch.isRunning).toBe(false);
        });

        it("should reset to zero without having called start", (): void => {
            const stopwatch = new Stopwatch();
            stopwatch.reset();
            expect(stopwatch.elapsedMs()).toBe(0);
            expect(stopwatch.isRunning).toBe(false);
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
    });
});
