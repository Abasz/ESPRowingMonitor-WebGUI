import { Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
    distinctUntilChanged,
    EMPTY,
    filter,
    interval,
    map,
    pairwise,
    switchMap,
    withLatestFrom,
} from "rxjs";

import { ICalculatedMetrics, IErgConnectionStatus, IHeartRate, SessionState } from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { MetricsService } from "./metrics.service";

@Injectable({
    providedIn: "root",
})
export class SessionManagerService {
    readonly sessionState: Signal<SessionState>;
    readonly elapsedTime: Signal<number>;

    private _sessionState: WritableSignal<SessionState> = signal<SessionState>("stopped");
    private _elapsedTime: WritableSignal<number> = signal<number>(0);

    private connectedDeviceName: Signal<string | undefined> = toSignal(
        this.ergConnectionService.connectionStatus$().pipe(
            filter(
                (status: IErgConnectionStatus): boolean =>
                    status.deviceName !== undefined && status.deviceName.length > 0,
            ),
            map((status: IErgConnectionStatus): string => status.deviceName!),
        ),
        { initialValue: undefined },
    );

    private sessionStartTimestamp: number = 0;

    constructor(
        private metricsService: MetricsService,
        private dataRecorder: DataRecorderService,
        private ergConnectionService: ErgConnectionService,
    ) {
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
        this.setupSessionDataRecording();
        this.setupDistanceRegressionHandler();
    }

    start(): void {
        if (this._sessionState() === "running") {
            return;
        }

        this.dataRecorder.reset(this.connectedDeviceName());
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
                        this._sessionState() !== "running" && metrics.strokeCount > 0,
                ),
                takeUntilDestroyed(),
            )
            .subscribe((metrics: ICalculatedMetrics): void => {
                this.dataRecorder.reset(this.connectedDeviceName());
                this.sessionStartTimestamp = Date.now() - metrics.driveDuration * 1000;
                this._elapsedTime.set(Math.max(0, (Date.now() - this.sessionStartTimestamp) / 1000));
                this._sessionState.set("running");
            });
    }

    private setupSessionDataRecording(): void {
        this.metricsService.allMetrics$
            .pipe(
                withLatestFrom(this.metricsService.heartRateData$),
                filter(
                    ([metrics]: [ICalculatedMetrics, IHeartRate | undefined]): boolean =>
                        this._sessionState() === "running" &&
                        (metrics.strokeCount > 0 || metrics.distance > 0),
                ),
                distinctUntilChanged(
                    (
                        [previousMetrics]: [ICalculatedMetrics, IHeartRate | undefined],
                        [currentMetrics]: [ICalculatedMetrics, IHeartRate | undefined],
                    ): boolean =>
                        previousMetrics.distance === currentMetrics.distance &&
                        previousMetrics.strokeCount === currentMetrics.strokeCount,
                ),
                takeUntilDestroyed(),
            )
            .subscribe(([metrics, heartRate]: [ICalculatedMetrics, IHeartRate | undefined]): void => {
                this.dataRecorder.addSessionData({ ...metrics, heartRate });
            });
    }

    private setupDistanceRegressionHandler(): void {
        this.metricsService.allMetrics$
            .pipe(
                filter((): boolean => this._sessionState() === "running"),
                map((metrics: ICalculatedMetrics): number => metrics.distance),
                pairwise(),
                filter(([previous, current]: [number, number]): boolean => current < previous),
                takeUntilDestroyed(),
            )
            .subscribe((): void => {
                this.metricsService.reset();
                this.dataRecorder.reset(this.connectedDeviceName());
                this._sessionState.set("stopped");
                this._elapsedTime.set(0);
            });
    }
}
