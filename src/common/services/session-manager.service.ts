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
    shareReplay,
    startWith,
    switchMap,
    takeUntil,
    withLatestFrom,
} from "rxjs";

import {
    ICalculatedMetrics,
    IErgConnectionStatus,
    IHeartRate,
    IRawCalculatedMetrics,
    SessionState,
} from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { MetricsService } from "./metrics.service";

@Injectable({
    providedIn: "root",
})
export class SessionManagerService {
    readonly sessionState: Signal<SessionState>;
    readonly elapsedTime: Signal<number>;
    readonly sessionMetrics$: Observable<ICalculatedMetrics>;

    private sessionState$: BehaviorSubject<SessionState> = new BehaviorSubject<SessionState>("stopped");
    private _elapsedTime: WritableSignal<number> = signal<number>(0);
    private sessionRawOffset: { distance: number; strokeCount: number } = { distance: 0, strokeCount: 0 };
    private latestRawMetrics: Signal<IRawCalculatedMetrics> = toSignal(this.metricsService.rawMetrics$, {
        initialValue: {
            avgStrokePower: 0,
            driveDuration: 0,
            recoveryDuration: 0,
            dragFactor: 0,
            rawDistance: 0,
            rawStrokeCount: 0,
            handleForces: [],
            peakForce: 0,
            strokeRate: 0,
            speed: 0,
            distPerStroke: 0,
            driveLength: 0,
        },
    });

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

        this.sessionMetrics$ = this.metricsService.rawMetrics$.pipe(
            filter((): boolean => this.sessionState() === "running"),
            map((raw: IRawCalculatedMetrics): ICalculatedMetrics => {
                const { rawDistance, rawStrokeCount, ...rest }: IRawCalculatedMetrics = raw;

                return {
                    ...rest,
                    distance: Math.max(0, rawDistance - this.sessionRawOffset.distance),
                    strokeCount: Math.max(0, rawStrokeCount - this.sessionRawOffset.strokeCount),
                };
            }),
            distinctUntilChanged(
                (previousMetrics: ICalculatedMetrics, currentMetrics: ICalculatedMetrics): boolean =>
                    previousMetrics.distance === currentMetrics.distance &&
                    previousMetrics.strokeCount === currentMetrics.strokeCount &&
                    previousMetrics.speed === currentMetrics.speed,
            ),
            shareReplay({ bufferSize: 1, refCount: true }),
        );

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
        this.sessionRawOffset = {
            distance: this.latestRawMetrics().rawDistance,
            strokeCount: this.latestRawMetrics().rawStrokeCount,
        };
        this.sessionStartTimestamp = Date.now();
        this._elapsedTime.set(0);

        this.sessionState$.next("running");
    }

    stop(): void {
        if (this.sessionState() !== "running") {
            return;
        }

        this.sessionState$.next("stopped");
    }

    private setupAutoStart(): void {
        this.metricsService.rawMetrics$
            .pipe(
                startWith(this.latestRawMetrics()),
                pairwise(),
                filter(
                    ([prev, curr]: [IRawCalculatedMetrics, IRawCalculatedMetrics]): boolean =>
                        this.sessionState() !== "running" &&
                        (curr.rawStrokeCount > prev.rawStrokeCount ||
                            (curr.rawStrokeCount > 0 && curr.rawStrokeCount < prev.rawStrokeCount)),
                ),
                map(
                    ([, curr]: [IRawCalculatedMetrics, IRawCalculatedMetrics]): IRawCalculatedMetrics => curr,
                ),
                takeUntilDestroyed(),
            )
            .subscribe((raw: IRawCalculatedMetrics): void => {
                this.start();

                this.sessionRawOffset.strokeCount = raw.rawStrokeCount - 1; // this stroke is session stroke #1
                this.sessionStartTimestamp -= raw.driveDuration * 1000;
                this._elapsedTime.set(Math.max(0, raw.driveDuration));
            });
    }

    private setupRecording(): void {
        this.sessionMetrics$
            .pipe(
                filter(
                    (metrics: ICalculatedMetrics): boolean => metrics.strokeCount > 0 || metrics.distance > 0,
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
                this.dataRecorder.addSessionData({ ...metrics, elapsedTime: this._elapsedTime(), heartRate });
            });
    }

    private setupDistanceRegressionHandler(): void {
        this.metricsService.rawMetrics$
            .pipe(
                filter((): boolean => this.sessionState() === "running"),
                map((raw: IRawCalculatedMetrics): number => raw.rawDistance),
                pairwise(),
                filter(([previous, current]: [number, number]): boolean => current < previous),
                takeUntilDestroyed(),
            )
            .subscribe((): void => {
                this.dataRecorder.reset(this.connectedDeviceName());
                this.sessionState$.next("stopped");
                this._elapsedTime.set(0);
            });
    }
}
