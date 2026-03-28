import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LONG_PRESS_DELAY, MOVE_THRESHOLD } from "./tile-layout.interfaces";
import { TouchGestureRecognizer } from "./touch-gesture-recognizer";

describe("TouchGestureRecognizer", (): void => {
    let recognizer: TouchGestureRecognizer<string>;

    beforeEach((): void => {
        vi.useFakeTimers();
        recognizer = new TouchGestureRecognizer<string>();
    });

    afterEach((): void => {
        vi.useRealTimers();
    });

    describe("as part of initial state", (): void => {
        it("should not be pending initially", (): void => {
            expect(recognizer.isPending).toBe(false);
        });
    });

    describe("startGesture method", (): void => {
        it("should set isPending to true", (): void => {
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, vi.fn());

            expect(recognizer.isPending).toBe(true);
        });

        it("should call onLongPress after LONG_PRESS_DELAY", (): void => {
            const onLongPress = vi.fn();
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, onLongPress);

            vi.advanceTimersByTime(LONG_PRESS_DELAY);

            expect(onLongPress).toHaveBeenCalledTimes(1);
        });

        it("should clear pending state after long press fires", (): void => {
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, vi.fn());

            vi.advanceTimersByTime(LONG_PRESS_DELAY);

            expect(recognizer.isPending).toBe(false);
        });

        it("should cancel previous gesture when starting a new one", (): void => {
            const firstCallback = vi.fn();
            const secondCallback = vi.fn();

            recognizer.startGesture("first", { clientX: 0, clientY: 0 }, firstCallback);
            recognizer.startGesture("second", { clientX: 50, clientY: 50 }, secondCallback);

            vi.advanceTimersByTime(LONG_PRESS_DELAY);

            expect(firstCallback).not.toHaveBeenCalled();
            expect(secondCallback).toHaveBeenCalledTimes(1);
        });
    });

    describe("evaluateMove method", (): void => {
        it("should return undefined when no gesture is pending", (): void => {
            const result = recognizer.evaluateMove(100, 100);

            expect(result).toBeUndefined();
        });

        it("should return undefined when movement is below threshold", (): void => {
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, vi.fn());

            const result = recognizer.evaluateMove(100 + MOVE_THRESHOLD, 100);

            expect(result).toBeUndefined();
        });

        it("should return move result when horizontal movement exceeds threshold", (): void => {
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, vi.fn());

            const result = recognizer.evaluateMove(100 + MOVE_THRESHOLD + 1, 100);

            expect(result).toEqual({
                gesture: "move",
                data: "test",
                touchStart: { clientX: 100, clientY: 100 },
            });
        });

        it("should return move result when vertical movement exceeds threshold", (): void => {
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, vi.fn());

            const result = recognizer.evaluateMove(100, 100 + MOVE_THRESHOLD + 1);

            expect(result).toEqual({
                gesture: "move",
                data: "test",
                touchStart: { clientX: 100, clientY: 100 },
            });
        });

        it("should clear pending state after recognizing a move", (): void => {
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, vi.fn());

            recognizer.evaluateMove(100 + MOVE_THRESHOLD + 1, 100);

            expect(recognizer.isPending).toBe(false);
        });

        it("should prevent long press callback after recognizing a move", (): void => {
            const onLongPress = vi.fn();
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, onLongPress);

            recognizer.evaluateMove(100 + MOVE_THRESHOLD + 1, 100);
            vi.advanceTimersByTime(LONG_PRESS_DELAY);

            expect(onLongPress).not.toHaveBeenCalled();
        });
    });

    describe("cancelGesture method", (): void => {
        it("should set isPending to false", (): void => {
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, vi.fn());

            recognizer.cancelGesture();

            expect(recognizer.isPending).toBe(false);
        });

        it("should prevent long press callback from firing", (): void => {
            const onLongPress = vi.fn();
            recognizer.startGesture("test", { clientX: 100, clientY: 100 }, onLongPress);

            recognizer.cancelGesture();
            vi.advanceTimersByTime(LONG_PRESS_DELAY);

            expect(onLongPress).not.toHaveBeenCalled();
        });
    });
});
