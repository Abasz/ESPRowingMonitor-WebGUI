import { LONG_PRESS_DELAY, MOVE_THRESHOLD } from "./tile-layout.interfaces";

export interface GestureMoveResult<T> {
    gesture: "move";
    data: T;
    touchStart: { clientX: number; clientY: number };
}

export interface PendingGestureInfo<T> {
    data: T;
    touchStart: { clientX: number; clientY: number };
    timer: ReturnType<typeof setTimeout>;
}

/**
 * Manages touch gesture recognition for distinguishing between
 * long-press (resize) and move (drag) gestures.
 *
 * On touch devices, a resize handle tap can be either:
 * - A long press → starts resize
 * - A quick drag → converts to move
 * - A tap-and-release → cancels
 */
export class TouchGestureRecognizer<T> {
    private pendingGesture: PendingGestureInfo<T> | undefined;

    get isPending(): boolean {
        return this.pendingGesture !== undefined;
    }

    startGesture(data: T, touchStart: { clientX: number; clientY: number }, onLongPress: () => void): void {
        this.cancelGesture();

        const timer = setTimeout((): void => {
            if (!this.pendingGesture) {
                return;
            }
            this.pendingGesture = undefined;
            onLongPress();
        }, LONG_PRESS_DELAY);

        this.pendingGesture = { data, touchStart, timer };
    }

    evaluateMove(clientX: number, clientY: number): GestureMoveResult<T> | undefined {
        if (!this.pendingGesture) {
            return undefined;
        }

        const dx = clientX - this.pendingGesture.touchStart.clientX;
        const dy = clientY - this.pendingGesture.touchStart.clientY;

        if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
            const data = this.pendingGesture.data;
            const touchStart = this.pendingGesture.touchStart;
            this.clearTimer();
            this.pendingGesture = undefined;

            return { gesture: "move", data, touchStart };
        }

        return undefined;
    }

    cancelGesture(): void {
        this.clearTimer();
        this.pendingGesture = undefined;
    }

    private clearTimer(): void {
        if (this.pendingGesture) {
            clearTimeout(this.pendingGesture.timer);
        }
    }
}
