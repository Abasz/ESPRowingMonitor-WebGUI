import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, filter, map, Observable, pairwise, shareReplay, startWith } from "rxjs";

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
            this.ergMetricService.streamMeasurement$().pipe(pairwise()),
            this.streamExtended$(),
            this.streamHandleForces$(),
        ]).pipe(
            map(
                ([[baseMetricsPrevious, baseMetricsCurrent], extendedMetrics, handleForces]: [
                    [IBaseMetrics, IBaseMetrics],
                    IExtendedMetrics,
                    Array<number>,
                ]): IRawCalculatedMetrics => ({
                    avgStrokePower: extendedMetrics.avgStrokePower,
                    driveDuration: extendedMetrics.driveDuration / 1e6,
                    recoveryDuration: extendedMetrics.recoveryDuration / 1e6,
                    dragFactor: extendedMetrics.dragFactor,
                    rawDistance: baseMetricsCurrent.distance,
                    rawStrokeCount: baseMetricsCurrent.strokeCount,
                    handleForces: handleForces,
                    peakForce: Math.max(...handleForces, 0),
                    strokeRate: this.calculateStrokeRate(baseMetricsPrevious, baseMetricsCurrent),
                    speed: this.calculateSpeed(baseMetricsPrevious, baseMetricsCurrent),
                    distPerStroke: this.calculateStrokeDistance(baseMetricsPrevious, baseMetricsCurrent),
                    driveLength: this.calculateDriveLength(handleForces.length),
                }),
            ),
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

    private streamHandleForces$(): Observable<Array<number>> {
        return this.ergMetricService.streamHandleForces$().pipe(startWith([]));
    }
}
