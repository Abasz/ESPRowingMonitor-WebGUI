import { Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
    BehaviorSubject,
    combineLatest,
    distinctUntilChanged,
    EMPTY,
    filter,
    interval,
    map,
    Observable,
    of,
    pairwise,
    startWith,
    switchMap,
    takeUntil,
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

    private sessionState$: BehaviorSubject<SessionState> = new BehaviorSubject<SessionState>("stopped");
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
        this.sessionState = toSignal(this.sessionState$, { requireSync: true });
        this.elapsedTime = this._elapsedTime.asReadonly();

        this.sessionState$
            .pipe(
                switchMap((state: SessionState): typeof EMPTY | ReturnType<typeof interval> =>
                    state === "running" ? interval(1000) : EMPTY,
                ),
                takeUntilDestroyed(),
            )
            .subscribe((): void => {
                this._elapsedTime.set((Date.now() - this.sessionStartTimestamp) / 1000);
            });

        // setupAutoStart must subscribe before setupRecording so that the state
        // is "running" by the time setupRecording's end-filter evaluates synchronously
        this.setupAutoStart();
        this.setupRecording();
        this.setupDistanceRegressionHandler();
    }

    start(): void {
        if (this.sessionState() === "running") {
            return;
        }

        this.dataRecorder.reset(this.connectedDeviceName());
        this.metricsService.reset();
        this.sessionStartTimestamp = Date.now();
        this._elapsedTime.set(0);

        this.sessionState$.next("running");
    }

    stop(): void {
        if (this.sessionState() !== "running") {
            return;
        }

        this.sessionState$.next("stopped");
        this.metricsService.reset();
    }

    private setupAutoStart(): void {
        this.metricsService.allMetrics$
            .pipe(
                filter(
                    (metrics: ICalculatedMetrics): boolean =>
                        this.sessionState() !== "running" && metrics.strokeCount > 0,
                ),
                takeUntilDestroyed(),
            )
            .subscribe((metrics: ICalculatedMetrics): void => {
                this.dataRecorder.reset(this.connectedDeviceName());
                this.sessionStartTimestamp = Date.now() - metrics.driveDuration * 1000;
                this._elapsedTime.set(Math.max(0, (Date.now() - this.sessionStartTimestamp) / 1000));
                this.sessionState$.next("running");
            });
    }

    private setupRecording(): void {
        this.metricsService.allMetrics$
            .pipe(
                filter(
                    (metrics: ICalculatedMetrics): boolean => metrics.strokeCount > 0 || metrics.distance > 0,
                ),
                distinctUntilChanged(
                    (previousMetrics: ICalculatedMetrics, currentMetrics: ICalculatedMetrics): boolean =>
                        previousMetrics.distance === currentMetrics.distance &&
                        previousMetrics.strokeCount === currentMetrics.strokeCount &&
                        previousMetrics.speed === currentMetrics.speed,
                ),
                switchMap(
                    (metrics: ICalculatedMetrics): Observable<[ICalculatedMetrics, number]> =>
                        combineLatest([of(metrics), interval(1000).pipe(startWith(0))]).pipe(
                            takeUntil(
                                this.sessionState$.pipe(
                                    filter(
                                        (sessionState: SessionState): boolean => sessionState === "stopped",
                                    ),
                                ),
                            ),
                        ),
                ),
                map(([metrics]: [ICalculatedMetrics, number]): ICalculatedMetrics => metrics),
                withLatestFrom(this.metricsService.heartRateData$),
                filter((): boolean => this.sessionState() === "running"),
                takeUntilDestroyed(),
            )
            .subscribe(([metrics, heartRate]: [ICalculatedMetrics, IHeartRate | undefined]): void => {
                this.dataRecorder.addSessionData({ ...metrics, heartRate });
            });
    }

    private setupDistanceRegressionHandler(): void {
        this.metricsService.allMetrics$
            .pipe(
                filter((): boolean => this.sessionState() === "running"),
                map((metrics: ICalculatedMetrics): number => metrics.distance),
                pairwise(),
                filter(([previous, current]: [number, number]): boolean => current < previous),
                takeUntilDestroyed(),
            )
            .subscribe((): void => {
                this.metricsService.reset();
                this.dataRecorder.reset(this.connectedDeviceName());
                this.sessionState$.next("stopped");
                this._elapsedTime.set(0);
            });
    }
}
