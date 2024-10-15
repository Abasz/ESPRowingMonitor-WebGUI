import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
    combineLatest,
    filter,
    map,
    merge,
    Observable,
    pairwise,
    shareReplay,
    Subject,
    take,
    tap,
    withLatestFrom,
} from "rxjs";

import { BleServiceFlag, LogLevel } from "../ble.interfaces";
import {
    IBaseMetrics,
    ICalculatedMetrics,
    IErgConnectionStatus,
    IExtendedMetrics,
    IHeartRate,
    IHRConnectionStatus,
    IRowerSettings,
} from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { ErgMetricsService } from "./erg-metric-data.service";
import { HeartRateService } from "./heart-rate.service";

@Injectable({
    providedIn: "root",
})
export class DataService {
    private activityStartDistance: number = 0;
    private activityStartStrokeCount: number = 0;
    private activityStartTime: Date = new Date();

    private baseMetrics: IBaseMetrics = {
        revTime: 0,
        distance: 0,
        strokeTime: 0,
        strokeCount: 0,
    };

    private calculatedMetrics$: Observable<ICalculatedMetrics>;

    private heartRateData$: Observable<IHeartRate | undefined>;

    private resetSubject: Subject<IBaseMetrics> = new Subject();

    constructor(
        private ergMetricService: ErgMetricsService,
        private dataRecorder: DataRecorderService,
        private heartRateService: HeartRateService,
        private destroyRef: DestroyRef,
    ) {
        this.heartRateData$ = this.heartRateService.streamHeartRate$();
        this.calculatedMetrics$ = this.setupMetricStream();
        this.setupLogging();

        this.ergConnectionStatus$()
            .pipe(
                filter(
                    (connectionStatus: IErgConnectionStatus): boolean =>
                        connectionStatus.status === "connected",
                ),
                take(1),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe((): void => {
                this.activityStartTime = new Date();
            });

        if (isSecureContext && navigator.bluetooth) {
            this.ergMetricService.reconnect();
        }
    }

    changeBleServiceType(bleService: BleServiceFlag): Promise<void> {
        return this.ergMetricService.changeBleServiceType(bleService);
    }

    changeDeltaTimeLogging(shouldEnable: boolean): Promise<void> {
        return this.ergMetricService.changeDeltaTimeLogging(shouldEnable);
    }

    changeLogLevel(logLevel: LogLevel): Promise<void> {
        return this.ergMetricService.changeLogLevel(logLevel);
    }

    changeLogToSdCard(shouldEnable: boolean): Promise<void> {
        return this.ergMetricService.changeLogToSdCard(shouldEnable);
    }

    ergConnectionStatus$(): Observable<IErgConnectionStatus> {
        return this.ergMetricService.connectionStatus$();
    }

    getActivityStartTime(): Date {
        return this.activityStartTime;
    }

    hrConnectionStatus$(): Observable<IHRConnectionStatus> {
        return this.heartRateService.connectionStatus$();
    }

    reset(): void {
        this.activityStartDistance = this.baseMetrics.distance;
        this.activityStartStrokeCount = this.baseMetrics.strokeCount;
        this.activityStartTime = new Date();
        this.dataRecorder.reset();

        this.resetSubject.next({
            revTime: this.baseMetrics.revTime,
            distance: this.baseMetrics.distance,
            strokeTime: this.baseMetrics.strokeTime,
            strokeCount: this.baseMetrics.strokeCount,
        });
    }

    streamAllMetrics$(): Observable<ICalculatedMetrics> {
        return this.calculatedMetrics$;
    }

    streamHeartRate$(): Observable<IHeartRate | undefined> {
        return this.heartRateData$;
    }

    streamMonitorBatteryLevel$(): Observable<number> {
        return this.ergMetricService.streamMonitorBatteryLevel$();
    }

    streamSettings$(): Observable<IRowerSettings> {
        return this.ergMetricService.streamSettings$().pipe(shareReplay(1));
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

        this.streamMeasurement$()
            .pipe(
                withLatestFrom(this.calculatedMetrics$, this.streamHeartRate$(), this.ergConnectionStatus$()),
                filter(
                    ([_, calculatedMetrics]: [
                        IBaseMetrics,
                        ICalculatedMetrics,
                        IHeartRate | undefined,
                        IErgConnectionStatus,
                    ]): boolean => calculatedMetrics.strokeCount > 0 || calculatedMetrics.distance > 0,
                ),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe(
                ([_, calculatedMetrics, heartRate, connectionStatus]: [
                    IBaseMetrics,
                    ICalculatedMetrics,
                    IHeartRate | undefined,
                    IHRConnectionStatus,
                ]): void => {
                    this.dataRecorder.addSessionData({
                        ...calculatedMetrics,
                        heartRate,
                    });
                    if (connectionStatus.deviceName !== undefined) {
                        this.dataRecorder.addConnectedDevice(connectionStatus.deviceName);
                    }
                },
            );
    }

    private setupMetricStream(): Observable<ICalculatedMetrics> {
        return combineLatest([
            this.streamMeasurement$().pipe(
                tap((baseMetrics: IBaseMetrics): void => {
                    if (baseMetrics.distance < this.baseMetrics.distance) {
                        this.dataRecorder.reset();
                    }
                    this.baseMetrics = baseMetrics;
                }),
                pairwise(),
            ),
            this.streamExtended$(),
            this.streamHandleForces$(),
        ]).pipe(
            map(
                ([[baseMetricsPrevious, baseMetricsCurrent], extendedMetrics, handleForces]: [
                    [IBaseMetrics, IBaseMetrics],
                    IExtendedMetrics,
                    Array<number>,
                ]): ICalculatedMetrics => {
                    const distance: number = baseMetricsCurrent.distance - this.activityStartDistance;
                    const strokeCount: number =
                        baseMetricsCurrent.strokeCount - this.activityStartStrokeCount;

                    const strokeRate: number =
                        baseMetricsCurrent.strokeCount === baseMetricsPrevious.strokeCount ||
                        baseMetricsCurrent.strokeTime === baseMetricsPrevious.strokeTime
                            ? 0
                            : ((baseMetricsCurrent.strokeCount - baseMetricsPrevious.strokeCount) /
                                  ((baseMetricsCurrent.strokeTime - baseMetricsPrevious.strokeTime) / 1e6)) *
                              60;
                    const speed: number =
                        baseMetricsCurrent.distance === baseMetricsPrevious.distance ||
                        baseMetricsCurrent.revTime === baseMetricsPrevious.revTime
                            ? 0
                            : (baseMetricsCurrent.distance - baseMetricsPrevious.distance) /
                              100 /
                              ((baseMetricsCurrent.revTime - baseMetricsPrevious.revTime) / 1e6);
                    const distPerStroke: number =
                        baseMetricsCurrent.distance === baseMetricsPrevious.distance ||
                        baseMetricsCurrent.strokeCount === baseMetricsPrevious.strokeCount
                            ? 0
                            : (baseMetricsCurrent.distance - baseMetricsPrevious.distance) /
                              100 /
                              (baseMetricsCurrent.strokeCount - baseMetricsPrevious.strokeCount);

                    return {
                        activityStartTime: this.activityStartTime,
                        avgStrokePower: extendedMetrics.avgStrokePower,
                        driveDuration: extendedMetrics.driveDuration / 1e6,
                        recoveryDuration: extendedMetrics.recoveryDuration / 1e6,
                        dragFactor: extendedMetrics.dragFactor,
                        distance: distance > 0 ? distance : 0,
                        strokeCount: strokeCount > 0 ? strokeCount : 0,
                        handleForces: handleForces,
                        peakForce: Math.max(...handleForces, 0),
                        strokeRate,
                        speed,
                        distPerStroke,
                    };
                },
            ),
            shareReplay(),
        );
    }

    private streamExtended$(): Observable<IExtendedMetrics> {
        return merge(
            this.ergMetricService.streamExtended$(),
            this.resetSubject.pipe(
                map(
                    (): IExtendedMetrics => ({
                        avgStrokePower: 0,
                        dragFactor: 0,
                        driveDuration: 0,
                        recoveryDuration: 0,
                    }),
                ),
            ),
        );
    }

    private streamHandleForces$(): Observable<Array<number>> {
        return merge(
            this.ergMetricService.streamHandleForces$(),
            this.resetSubject.pipe(map((): Array<number> => [])),
        );
    }

    private streamMeasurement$(): Observable<IBaseMetrics> {
        return merge(this.ergMetricService.streamMeasurement$(), this.resetSubject);
    }
}
