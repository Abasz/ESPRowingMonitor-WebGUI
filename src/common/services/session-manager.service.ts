import { Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { MatSnackBar } from "@angular/material/snack-bar";
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
    AutoLapMode,
    Config,
    ICalculatedMetrics,
    IErgConnectionStatus,
    IHeartRate,
    IIntervalsIcuConfig,
    IRawCalculatedMetrics,
    SessionState,
} from "../common.interfaces";
import { Stopwatch } from "../utils/stopwatch";

import { ConfigManagerService } from "./config-manager.service";
import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { IntervalsIcuService } from "./intervals-icu.service";
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
    peakForcePositionNorm: 0,
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
    private readonly lapCount: WritableSignal<number> = signal<number>(0);
    private readonly currentStrokeCount: Signal<number>;

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
            map((config: Config): boolean => config.general.session.autoSession !== "off"),
        ),
        { initialValue: true },
    );

    private readonly autoPauseEnabled: Signal<boolean> = toSignal(
        this.configManager.configChanged$.pipe(
            map((config: Config): boolean => config.general.session.autoSession === "autoStartAndPause"),
        ),
        { initialValue: false },
    );

    private hasSeenNonZeroSpeed: boolean = false;
    private readonly resetAutoLap$: Subject<void> = new Subject<void>();

    private indicateStop$: Observable<SessionState> = this.sessionState$.pipe(
        filter((sessionState: SessionState): boolean => sessionState === "stopped"),
    );

    constructor(
        private metricsService: MetricsService,
        private dataRecorder: DataRecorderService,
        private ergConnectionService: ErgConnectionService,
        private configManager: ConfigManagerService,
        private intervalsService: IntervalsIcuService,
        private snackBar: MatSnackBar,
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
                    sessionMetrics: { ...seedRaw, distance: 0, strokeCount: 0, totalWork: 0 },
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

        this.currentStrokeCount = toSignal(
            this.sessionMetrics$.pipe(map((metrics: ICalculatedMetrics): number => metrics.strokeCount)),
            { initialValue: 0 },
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
        this.setupAutoLap();
        this.setupAutoPause();
    }

    addLap(): void {
        if (this.sessionState() !== "running") {
            return;
        }
        this.resetAutoLap$.next();
        void this.dataRecorder.addLap(this.currentStrokeCount(), "manual");
        this.lapCount.update((count: number): number => count + 1);
        this.snackBar.open(`Lap ${this.lapCount()}`, "Dismiss", { duration: 3000 });
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

        void this.dataRecorder.addLap(this.currentStrokeCount(), "manual", true);
        this.stopwatch.pause();
        this.sessionState$.next("paused");
    }

    stop(): void {
        if (this.sessionState() !== "running" && this.sessionState() !== "paused") {
            return;
        }

        const sessionId = this.dataRecorder.currentSessionId;
        this.hasSeenNonZeroSpeed = false;
        this.lapCount.set(0);
        this.stopwatch.stop();
        this.sessionState$.next("stopped");
        void this.handleAutoUpload(sessionId);
    }

    private async handleAutoUpload(sessionId: number): Promise<void> {
        const { intervalsIcu }: { intervalsIcu: IIntervalsIcuConfig } =
            this.configManager.getGroup("general");

        if (!intervalsIcu.autoUploadEnabled || !intervalsIcu.apiKey) {
            return;
        }
        await this.intervalsService.uploadSession(sessionId, intervalsIcu);
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

    private setupAutoLap(): void {
        let lastLapValue = 0;

        merge(
            this.resetAutoLap$,
            this.configManager.configChanged$.pipe(
                map((config: Config): AutoLapMode => config.general.session.autoLap),
                distinctUntilChanged(),
            ),
        )
            .pipe(
                withLatestFrom(this.sessionMetrics$, this.configManager.configChanged$),
                takeUntilDestroyed(),
            )
            .subscribe(([, metrics, config]: [unknown, ICalculatedMetrics, Config]): void => {
                lastLapValue =
                    config.general.session.autoLap === "distance"
                        ? metrics.distance / 100
                        : this.stopwatch.elapsedSeconds() / 60;
            });

        this.sessionMetrics$
            .pipe(
                withLatestFrom(this.configManager.configChanged$),
                filter(
                    ([, config]: [ICalculatedMetrics, Config]): boolean =>
                        config.general.session.autoLap !== "off",
                ),
                filter(([metrics, config]: [ICalculatedMetrics, Config]): boolean => {
                    const currentValue =
                        config.general.session.autoLap === "distance"
                            ? metrics.distance / 100
                            : this.stopwatch.elapsedSeconds() / 60;

                    if (currentValue < lastLapValue) {
                        lastLapValue = currentValue;
                    }

                    if (currentValue - lastLapValue >= config.general.session.autoLapValue) {
                        lastLapValue += config.general.session.autoLapValue;

                        return true;
                    }

                    return false;
                }),
                takeUntilDestroyed(),
            )
            .subscribe(([metrics, config]: [ICalculatedMetrics, Config]): void => {
                void this.dataRecorder.addLap(
                    metrics.strokeCount,
                    config.general.session.autoLap as Exclude<AutoLapMode, "off">,
                );
                this.lapCount.update((count: number): number => count + 1);
                this.snackBar.open(`Lap ${this.lapCount()}`, "Dismiss", { duration: 3000 });
            });
    }

    private setupAutoPause(): void {
        this.metricsService.rawMetrics$
            .pipe(
                filter((): boolean => this.autoPauseEnabled() && this.sessionState() === "running"),
                takeUntilDestroyed(),
            )
            .subscribe((metrics: IRawCalculatedMetrics): void => {
                if (metrics.speed > 0) {
                    this.hasSeenNonZeroSpeed = true;

                    return;
                }

                if (!this.hasSeenNonZeroSpeed) {
                    return;
                }

                this.pause();
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
                totalWork:
                    sessionMetrics.sessionMetrics.totalWork +
                    (currentRawStrokeCount > prevStrokeCount
                        ? currentMetrics.avgStrokePower *
                          (currentMetrics.driveDuration + currentMetrics.recoveryDuration)
                        : 0),
            },
            previousRawMetrics: currentMetrics,
        };
    }
}
