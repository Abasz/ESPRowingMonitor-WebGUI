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
    merge,
    Observable,
    of,
    pairwise,
    scan,
    shareReplay,
    startWith,
    Subject,
    switchMap,
    takeUntil,
    withLatestFrom,
} from "rxjs";

import {
    Config,
    ICalculatedMetrics,
    IErgConnectionStatus,
    IHeartRate,
    IRawCalculatedMetrics,
    SessionState,
} from "../common.interfaces";
import { Stopwatch } from "../utils/stopwatch";

import { ConfigManagerService } from "./config-manager.service";
import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { MetricsService } from "./metrics.service";

const ZERO_RAW_METRICS: IRawCalculatedMetrics = {
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
};

interface SessionAccumulator {
    sessionMetrics: ICalculatedMetrics;
    previousRawMetrics: IRawCalculatedMetrics;
}

@Injectable({
    providedIn: "root",
})
export class SessionManagerService {
    readonly sessionState: Signal<SessionState>;
    readonly elapsedTime: Signal<number>;
    readonly sessionMetrics$: Observable<ICalculatedMetrics>;

    private sessionState$: BehaviorSubject<SessionState> = new BehaviorSubject<SessionState>("stopped");
    private _elapsedTime: WritableSignal<number> = signal<number>(0);

    private readonly autoStartSeed$: Subject<IRawCalculatedMetrics> = new Subject<IRawCalculatedMetrics>();
    private readonly sessionSeed: Observable<IRawCalculatedMetrics> = merge(
        this.metricsService.rawMetrics$,
        this.autoStartSeed$,
    ).pipe(startWith(ZERO_RAW_METRICS), shareReplay({ bufferSize: 1, refCount: true }));

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

    private readonly stopwatch: Stopwatch = new Stopwatch();

    private readonly autoStartEnabled: Signal<boolean> = toSignal(
        this.configManager.configChanged$.pipe(
            map((config: Config): boolean => config.general.autoStartTimer),
        ),
        { initialValue: true },
    );

    private indicateStop$: Observable<SessionState> = this.sessionState$.pipe(
        filter((sessionState: SessionState): boolean => sessionState === "stopped"),
    );

    constructor(
        private metricsService: MetricsService,
        private dataRecorder: DataRecorderService,
        private ergConnectionService: ErgConnectionService,
        private configManager: ConfigManagerService,
    ) {
        this.sessionState = toSignal(this.sessionState$, { requireSync: true });
        this.elapsedTime = this._elapsedTime.asReadonly();

        this.sessionMetrics$ = this.sessionState$.pipe(
            // suppress paused→running so the existing scan accumulator survives resume
            distinctUntilChanged(
                (prev: SessionState, curr: SessionState): boolean =>
                    prev === curr || (prev === "paused" && curr === "running"),
            ),
            filter((state: SessionState): boolean => state === "running"),
            withLatestFrom(this.sessionSeed),
            map(
                ([, seedRaw]: [SessionState, IRawCalculatedMetrics]): SessionAccumulator => ({
                    sessionMetrics: { ...seedRaw, distance: 0, strokeCount: 0 },
                    previousRawMetrics: seedRaw,
                }),
            ),
            switchMap(
                (seed: SessionAccumulator): Observable<ICalculatedMetrics> =>
                    this.metricsService.rawMetrics$.pipe(
                        filter(
                            (): boolean =>
                                this.sessionState() === "running" || this.sessionState() === "paused",
                        ),
                        scan(
                            (acc: SessionAccumulator, curr: IRawCalculatedMetrics): SessionAccumulator =>
                                this.sessionState() === "paused"
                                    ? { ...acc, previousRawMetrics: curr }
                                    : SessionManagerService.accumulateSessionMetrics(acc, curr),
                            seed,
                        ),
                        filter((): boolean => this.sessionState() === "running"),
                        map(({ sessionMetrics }: SessionAccumulator): ICalculatedMetrics => sessionMetrics),
                        distinctUntilChanged(
                            (
                                previousMetrics: ICalculatedMetrics,
                                currentMetrics: ICalculatedMetrics,
                            ): boolean =>
                                previousMetrics.distance === currentMetrics.distance &&
                                previousMetrics.strokeCount === currentMetrics.strokeCount &&
                                previousMetrics.speed === currentMetrics.speed,
                        ),
                        startWith(seed.sessionMetrics),
                        takeUntil(this.indicateStop$),
                    ),
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
                this._elapsedTime.set(this.stopwatch.elapsedSeconds());
            });

        this.setupAutoStart();
        this.setupRecording();
    }

    start(timeOffset: number = 0): void {
        if (this.sessionState() === "running") {
            return;
        }

        if (this.sessionState() === "paused") {
            this.stopwatch.start(timeOffset);
            this._elapsedTime.set(this.stopwatch.elapsedSeconds());
            this.sessionState$.next("running");

            return;
        }

        this.stopwatch.start(timeOffset);
        this._elapsedTime.set(this.stopwatch.elapsedSeconds());
        this.dataRecorder.reset(this.connectedDeviceName());
        this.sessionState$.next("running");
    }

    pause(): void {
        if (this.sessionState() !== "running") {
            return;
        }

        this.stopwatch.pause();
        this.sessionState$.next("paused");
    }

    stop(): void {
        if (this.sessionState() !== "running" && this.sessionState() !== "paused") {
            return;
        }

        this.stopwatch.stop();
        this.sessionState$.next("stopped");
    }

    private setupAutoStart(): void {
        this.metricsService.rawMetrics$
            .pipe(
                startWith(ZERO_RAW_METRICS),
                pairwise(),
                filter(
                    ([prev, curr]: [IRawCalculatedMetrics, IRawCalculatedMetrics]): boolean =>
                        this.autoStartEnabled() &&
                        this.sessionState() !== "running" &&
                        (curr.rawStrokeCount > prev.rawStrokeCount ||
                            (curr.rawStrokeCount > 0 && curr.rawStrokeCount < prev.rawStrokeCount)),
                ),
                takeUntilDestroyed(),
            )
            .subscribe(([prev, curr]: [IRawCalculatedMetrics, IRawCalculatedMetrics]): void => {
                if (this.sessionState() === "paused") {
                    this.start(curr.driveDuration * 1000);

                    return;
                }

                // if device resets while stopped treat the new data as overflown and that current is the full delta, hence set seed to 0
                const prevForSeed: IRawCalculatedMetrics =
                    curr.rawStrokeCount < prev.rawStrokeCount
                        ? { ...prev, rawDistance: 0, rawStrokeCount: 0 }
                        : prev;
                this.autoStartSeed$.next(prevForSeed);
                this.start(curr.driveDuration * 1000);
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
                            takeUntil(this.indicateStop$),
                        ),
                ),
                map(([metrics]: [ICalculatedMetrics, number]): ICalculatedMetrics => metrics),
                withLatestFrom(this.metricsService.heartRateData$),
                filter((): boolean => this.sessionState() === "running"),
                takeUntilDestroyed(),
            )
            .subscribe(([metrics, heartRate]: [ICalculatedMetrics, IHeartRate | undefined]): void => {
                this.dataRecorder.addSessionData({
                    ...metrics,
                    elapsedTime: this.stopwatch.elapsedSeconds(),
                    heartRate,
                });
            });
    }

    private static accumulateSessionMetrics(
        sessionMetrics: SessionAccumulator,
        currentMetrics: IRawCalculatedMetrics,
    ): SessionAccumulator {
        const {
            rawDistance: currentRawDistance,
            rawStrokeCount: currentRawStrokeCount,
            ...currentRest
        }: IRawCalculatedMetrics = currentMetrics;

        // if device resets mid session treat the new data as overflown and that current is the full delta, hence set previous to 0
        const prevDistance =
            currentRawDistance < sessionMetrics.previousRawMetrics.rawDistance
                ? 0
                : sessionMetrics.previousRawMetrics.rawDistance;
        const prevStrokeCount =
            currentRawStrokeCount < sessionMetrics.previousRawMetrics.rawStrokeCount
                ? 0
                : sessionMetrics.previousRawMetrics.rawStrokeCount;

        return {
            sessionMetrics: {
                ...currentRest,
                distance:
                    sessionMetrics.sessionMetrics.distance + Math.max(0, currentRawDistance - prevDistance),
                strokeCount:
                    sessionMetrics.sessionMetrics.strokeCount +
                    Math.max(0, currentRawStrokeCount - prevStrokeCount),
            },
            previousRawMetrics: currentMetrics,
        };
    }
}
