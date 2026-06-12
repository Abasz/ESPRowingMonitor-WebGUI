import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
    combineLatest,
    distinctUntilChanged,
    filter,
    map,
    Observable,
    pairwise,
    shareReplay,
    startWith,
    withLatestFrom,
} from "rxjs";

import {
    IBaseMetrics,
    IErgConnectionStatus,
    IExtendedMetrics,
    IHeartRate,
    IHRConnectionStatus,
    IRawCalculatedMetrics,
} from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { ErgMetricsService } from "./ergometer/erg-metric-data.service";
import { ErgSettingsService } from "./ergometer/erg-settings.service";
import { HeartRateService } from "./heart-rate/heart-rate.service";

const cmInM = 100;

@Injectable({
    providedIn: "root",
})
export class MetricsService {
    readonly rawMetrics$: Observable<IRawCalculatedMetrics>;
    readonly heartRateData$: Observable<IHeartRate | undefined>;
    readonly hrConnectionStatus$: Observable<IHRConnectionStatus>;

    private readonly measurement$: Observable<IBaseMetrics> = this.ergMetricService
        .streamMeasurement$()
        .pipe(shareReplay({ bufferSize: 1, refCount: true }));

    private readonly handleForces$: Observable<Array<number>> = this.ergMetricService
        .streamHandleForces$()
        .pipe(startWith([] as Array<number>), shareReplay({ bufferSize: 1, refCount: true }));

    constructor(
        private ergMetricService: ErgMetricsService,
        private ergConnectionService: ErgConnectionService,
        private ergSettingsService: ErgSettingsService,
        private dataRecorder: DataRecorderService,
        private heartRateService: HeartRateService,
        private destroyRef: DestroyRef,
    ) {
        this.rawMetrics$ = this.streamBasicMetrics$().pipe(shareReplay({ bufferSize: 1, refCount: true }));
        this.heartRateData$ = this.heartRateService.streamHeartRate$();
        this.hrConnectionStatus$ = this.heartRateService.connectionStatus$();

        this.setupLogging();

        if (isSecureContext === true && navigator.bluetooth !== undefined) {
            this.ergConnectionService.reconnect();
        }
    }

    private calculateDriveLength(handleForcesLength: number): number {
        const {
            sprocketRadius,
            impulsePerRevolution,
        }: { sprocketRadius: number; impulsePerRevolution: number } =
            this.ergSettingsService.rowerSettings().rowingSettings.machineSettings;

        if (impulsePerRevolution === 0 || sprocketRadius === 0 || handleForcesLength === 0) {
            return 0;
        }

        return (((2 * Math.PI * sprocketRadius) / impulsePerRevolution) * handleForcesLength) / cmInM;
    }

    private calculateSpeed(baseMetricsPrevious: IBaseMetrics, baseMetricsCurrent: IBaseMetrics): number {
        if (
            baseMetricsCurrent.distance === baseMetricsPrevious.distance ||
            baseMetricsCurrent.revTime === baseMetricsPrevious.revTime
        ) {
            return 0;
        }

        return (
            (baseMetricsCurrent.distance - baseMetricsPrevious.distance) /
            cmInM /
            ((baseMetricsCurrent.revTime - baseMetricsPrevious.revTime) / 1e6)
        );
    }
    private calculateStrokeDistance(
        baseMetricsPrevious: IBaseMetrics,
        baseMetricsCurrent: IBaseMetrics,
    ): number {
        if (
            baseMetricsCurrent.distance === baseMetricsPrevious.distance ||
            baseMetricsCurrent.strokeCount === baseMetricsPrevious.strokeCount
        ) {
            return 0;
        }

        return (
            (baseMetricsCurrent.distance - baseMetricsPrevious.distance) /
            cmInM /
            (baseMetricsCurrent.strokeCount - baseMetricsPrevious.strokeCount)
        );
    }

    private calculateStrokeRate(baseMetricsPrevious: IBaseMetrics, baseMetricsCurrent: IBaseMetrics): number {
        if (
            baseMetricsCurrent.strokeCount === baseMetricsPrevious.strokeCount ||
            baseMetricsCurrent.strokeTime === baseMetricsPrevious.strokeTime
        ) {
            return 0;
        }

        return (
            ((baseMetricsCurrent.strokeCount - baseMetricsPrevious.strokeCount) /
                ((baseMetricsCurrent.strokeTime - baseMetricsPrevious.strokeTime) / 1e6)) *
            60
        );
    }

    private setupLogging(): void {
        this.ergMetricService
            .streamDeltaTimes$()
            .pipe(
                filter((deltaTimes: Array<number>): boolean => deltaTimes.length > 0),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe((deltaTimes: Array<number>): void => {
                this.dataRecorder.addDeltaTimes(deltaTimes);
            });

        this.ergConnectionService
            .connectionStatus$()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((connectionStatus: IErgConnectionStatus): void => {
                if (connectionStatus.deviceName && connectionStatus.deviceName.length > 0) {
                    this.dataRecorder.addConnectedDevice(connectionStatus.deviceName);
                }
            });
    }

    private streamBasicMetrics$(): Observable<IRawCalculatedMetrics> {
        return combineLatest([
            this.measurement$.pipe(pairwise()),
            this.streamExtended$(),
            this.handleForces$,
        ]).pipe(
            withLatestFrom(this.streamPowerBalance$()),
            map(
                ([metricsInput, powerBalance]: [
                    [[IBaseMetrics, IBaseMetrics], IExtendedMetrics, Array<number>],
                    number,
                ]): IRawCalculatedMetrics => {
                    const [[baseMetricsPrevious, baseMetricsCurrent], extendedMetrics, handleForces]: [
                        [IBaseMetrics, IBaseMetrics],
                        IExtendedMetrics,
                        Array<number>,
                    ] = metricsInput;
                    const { peakForce, peakForceIndex }: { peakForce: number; peakForceIndex: number } =
                        handleForces.reduce(
                            (
                                accumulator: { peakForce: number; peakForceIndex: number },
                                force: number,
                                index: number,
                            ): { peakForce: number; peakForceIndex: number } =>
                                force > accumulator.peakForce
                                    ? { peakForce: force, peakForceIndex: index }
                                    : accumulator,
                            { peakForce: 0, peakForceIndex: 0 },
                        );

                    return {
                        avgStrokePower: extendedMetrics.avgStrokePower,
                        driveDuration: extendedMetrics.driveDuration / 1e6,
                        recoveryDuration: extendedMetrics.recoveryDuration / 1e6,
                        dragFactor: extendedMetrics.dragFactor,
                        rawDistance: baseMetricsCurrent.distance,
                        rawStrokeCount: baseMetricsCurrent.strokeCount,
                        handleForces,
                        peakForce,
                        peakForcePositionNorm:
                            handleForces.length > 1 ? (peakForceIndex / (handleForces.length - 1)) * 100 : 0,
                        strokeRate: this.calculateStrokeRate(baseMetricsPrevious, baseMetricsCurrent),
                        speed: this.calculateSpeed(baseMetricsPrevious, baseMetricsCurrent),
                        distPerStroke: this.calculateStrokeDistance(baseMetricsPrevious, baseMetricsCurrent),
                        driveLength: this.calculateDriveLength(handleForces.length),
                        powerBalance,
                    };
                },
            ),
        );
    }

    /**
     * Produces a rolling kayak power-balance value (side-A fraction, 0–1).
     *
     * Uses `combineLatest` to ensure handle forces are always paired with their
     * matching measurement, then deduplicates by strokeCount so only the last
     * emission per stroke is kept. `pairwise()` surfaces consecutive [prev, curr]
     * stroke pairs; only valid A+B pairs (odd stroke followed immediately by the
     * next even stroke) pass the filter and feed the balance computation.
     * Emits a new balance only when a complete pair is detected; between pairs the
     * `withLatestFrom` in `streamBasicMetrics$` retains the last emitted value.
     * Starts at 0.5 (perfectly balanced) before the first complete pair arrives.
     */
    private streamPowerBalance$(): Observable<number> {
        return combineLatest([this.measurement$, this.handleForces$]).pipe(
            distinctUntilChanged(
                (
                    [previousMeasurement]: [IBaseMetrics, Array<number>],
                    [currentMeasurement]: [IBaseMetrics, Array<number>],
                ): boolean => previousMeasurement.strokeCount === currentMeasurement.strokeCount,
            ),
            pairwise(),
            filter(
                ([[previousMeasurement], [currentMeasurement]]: [
                    [IBaseMetrics, Array<number>],
                    [IBaseMetrics, Array<number>],
                ]): boolean =>
                    previousMeasurement.strokeCount % 2 === 1 &&
                    currentMeasurement.strokeCount === previousMeasurement.strokeCount + 1,
            ),
            map(
                ([[, sideAForces], [, sideBForces]]: [
                    [IBaseMetrics, Array<number>],
                    [IBaseMetrics, Array<number>],
                ]): number => {
                    const meanA: number =
                        sideAForces.length > 0
                            ? sideAForces.reduce((sum: number, force: number): number => sum + force, 0) /
                              sideAForces.length
                            : 0;
                    const meanB: number =
                        sideBForces.length > 0
                            ? sideBForces.reduce((sum: number, force: number): number => sum + force, 0) /
                              sideBForces.length
                            : 0;
                    const totalForce: number = meanA + meanB;

                    return totalForce > 0 ? meanA / totalForce : 0.5;
                },
            ),
            startWith(0.5),
        );
    }

    private streamExtended$(): Observable<IExtendedMetrics> {
        return this.ergMetricService.streamExtended$().pipe(
            startWith({
                avgStrokePower: 0,
                dragFactor: 0,
                driveDuration: 0,
                recoveryDuration: 0,
            }),
        );
    }
}
