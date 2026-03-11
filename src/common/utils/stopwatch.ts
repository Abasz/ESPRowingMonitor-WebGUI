/**
 * High-resolution stopwatch that accumulates elapsed time in segments.
 *
 * Each call to `start()` begins a fresh session (resets accumulated time).
 * Time is measured in milliseconds internally;
 */
export class Stopwatch {
    private accumulatedMs: number = 0;
    private segmentStart: number | undefined = undefined;

    get isRunning(): boolean {
        return this.segmentStart !== undefined;
    }

    elapsedMs(): number {
        return this.accumulatedMs + (this.segmentStart !== undefined ? Date.now() - this.segmentStart : 0);
    }

    elapsedSeconds(): number {
        return this.elapsedMs() / 1000;
    }

    /**
     * Begin a new session from `offsetMs` milliseconds (default 0) in the past.
     * Resets any previously accumulated time.
     */
    start(offsetMs: number = 0): void {
        this.accumulatedMs = 0;
        this.segmentStart = Date.now() - offsetMs;
    }

    /**
     * Freeze the current elapsed time.
     */
    stop(): void {
        if (this.segmentStart === undefined) {
            return;
        }

        this.accumulatedMs += Date.now() - this.segmentStart;
        this.segmentStart = undefined;
    }

    reset(): void {
        this.accumulatedMs = 0;
        this.segmentStart = undefined;
    }
}
