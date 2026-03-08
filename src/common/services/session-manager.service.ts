import { Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { EMPTY, filter, interval, map, pairwise, switchMap } from "rxjs";

import { ICalculatedMetrics, SessionState } from "../common.interfaces";

import { MetricsService } from "./metrics.service";

@Injectable({
    providedIn: "root",
})
export class SessionManagerService {
    readonly sessionState: Signal<SessionState>;
    readonly elapsedTime: Signal<number>;

    private _sessionState: WritableSignal<SessionState> = signal<SessionState>("stopped");
    private _elapsedTime: WritableSignal<number> = signal<number>(0);

    private sessionStartTimestamp: number = 0;

    constructor(private metricsService: MetricsService) {
        this.sessionState = this._sessionState.asReadonly();
        this.elapsedTime = this._elapsedTime.asReadonly();

        toObservable(this._sessionState)
            .pipe(
                switchMap((state: SessionState): typeof EMPTY | ReturnType<typeof interval> =>
                    state === "running" ? interval(1000) : EMPTY,
                ),
                takeUntilDestroyed(),
            )
            .subscribe((): void => {
                this._elapsedTime.set((Date.now() - this.sessionStartTimestamp) / 1000);
            });

        this.setupAutoStart();
        this.setupDistanceRegressionHandler();
    }

    start(): void {
        if (this._sessionState() === "running") {
            return;
        }

        this.metricsService.reset();
        this.sessionStartTimestamp = Date.now();
        this._elapsedTime.set(0);

        this._sessionState.set("running");
    }

    stop(): void {
        if (this._sessionState() !== "running") {
            return;
        }

        this._sessionState.set("stopped");
        this.metricsService.reset();
    }

    private setupAutoStart(): void {
        this.metricsService.allMetrics$
            .pipe(
                filter(
                    (metrics: ICalculatedMetrics): boolean =>
                        this._sessionState() === "stopped" && metrics.strokeCount > 0,
                ),
                takeUntilDestroyed(),
            )
            .subscribe((metrics: ICalculatedMetrics): void => {
                this.sessionStartTimestamp = Date.now() - metrics.driveDuration * 1000;
                this._elapsedTime.set(Math.max(0, (Date.now() - this.sessionStartTimestamp) / 1000));
                this._sessionState.set("running");
            });
    }

    private setupDistanceRegressionHandler(): void {
        this.metricsService.allMetrics$
            .pipe(
                map((metrics: ICalculatedMetrics): number => metrics.distance),
                pairwise(),
                filter(([previous, current]: [number, number]): boolean => current < previous),
                takeUntilDestroyed(),
            )
            .subscribe((): void => {
                this.metricsService.reset();
                this._sessionState.set("stopped");
                this._elapsedTime.set(0);
            });
    }
}
