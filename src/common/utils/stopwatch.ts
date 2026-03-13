/**
 * High-resolution stopwatch that accumulates elapsed time in segments.
 *
 * Each call to `start()` begins a fresh session (resets accumulated time),
 * unless the stopwatch is paused — in that case `start()` resumes the
 * existing session.
 * Time is measured in milliseconds internally.
 */
type StopwatchState = "stopped" | "running" | "paused";

export class Stopwatch {
    private _state: StopwatchState = "stopped";
    private accumulatedMs: number = 0;
    private segmentStart: number | undefined = undefined;

    get state(): StopwatchState {
        return this._state;
    }

    elapsedMs(): number {
        return this.accumulatedMs + (this.segmentStart !== undefined ? Date.now() - this.segmentStart : 0);
    }

    elapsedSeconds(): number {
        return this.elapsedMs() / 1000;
    }

    /**
     * Start a fresh session or resume if the stopwatch is currently paused from `offsetMs` milliseconds (default 0) in the past.
     */
    start(offsetMs: number = 0): void {
        if (this._state === "running") {
            return;
        }

        if (this._state === "paused") {
            this.segmentStart = Date.now() - offsetMs;
            this._state = "running";

            return;
        }

        this.accumulatedMs = 0;
        this.segmentStart = Date.now() - offsetMs;
        this._state = "running";
    }

    /**
     * Pause the stopwatch
     */
    pause(): void {
        if (this._state !== "running") {
            return;
        }

        this.accumulatedMs += Date.now() - this.segmentStart!;
        this.segmentStart = undefined;
        this._state = "paused";
    }

    /**
     * Stop the stopwatch and end the current session.
     */
    stop(): void {
        if (this._state === "stopped" || this.segmentStart === undefined) {
            this._state = "stopped";

            return;
        }

        this.accumulatedMs += Date.now() - this.segmentStart;
        this.segmentStart = undefined;
        this._state = "stopped";
    }

    reset(): void {
        this.accumulatedMs = 0;
        this.segmentStart = undefined;
        this._state = "stopped";
    }
}
