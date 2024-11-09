import { DestroyRef, Injectable, Signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
    combineLatest,
    filter,
    map,
    merge,
    Observable,
    pairwise,
    startWith,
    Subject,
    take,
    tap,
    withLatestFrom,
} from "rxjs";

import { BleServiceFlag, IDeviceInformation, LogLevel } from "../ble.interfaces";
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
    readonly allMetrics$: Observable<ICalculatedMetrics>;
    readonly ergBatteryLevel$: Observable<number>;
    readonly ergConnectionStatus$: Observable<IErgConnectionStatus>;
    readonly heartRateData$: Observable<IHeartRate | undefined>;
    readonly hrConnectionStatus$: Observable<IHRConnectionStatus>;
    readonly settings: Signal<IRowerSettings>;

    private activityStartDistance: number = 0;
    private activityStartStrokeCount: number = 0;
    private activityStartTime: Date = new Date();

    private baseMetrics: IBaseMetrics = {
        revTime: 0,
        distance: 0,
        strokeTime: 0,
        strokeCount: 0,
    };

    private resetSubject: Subject<IBaseMetrics> = new Subject();

    constructor(
        private ergMetricService: ErgMetricsService,
        private dataRecorder: DataRecorderService,
        private heartRateService: HeartRateService,
        private destroyRef: DestroyRef,
    ) {
        this.allMetrics$ = this.setupMetricStream$();
        this.heartRateData$ = this.heartRateService.streamHeartRate$();
        this.ergBatteryLevel$ = this.ergMetricService.streamMonitorBatteryLevel$();
        this.ergConnectionStatus$ = this.ergMetricService.connectionStatus$();
        this.hrConnectionStatus$ = this.heartRateService.connectionStatus$();
        this.settings = toSignal(this.ergMetricService.streamSettings$(), {
            initialValue: {
                logDeltaTimes: undefined,
                logToSdCard: undefined,
                logLevel: 0,
                bleServiceFlag: BleServiceFlag.CpsService,
            },
        });

        this.setupLogging();

        this.ergConnectionStatus$
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

    getActivityStartTime(): Date {
        return this.activityStartTime;
    }

    readDeviceInfo(): Promise<IDeviceInformation> {
        return this.ergMetricService.readDeviceInfo();
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

    private calculateSpeed(baseMetricsPrevious: IBaseMetrics, baseMetricsCurrent: IBaseMetrics): number {
        if (
            baseMetricsCurrent.distance === baseMetricsPrevious.distance ||
            baseMetricsCurrent.revTime === baseMetricsPrevious.revTime
        ) {
            return 0;
        }

        return (
            (baseMetricsCurrent.distance - baseMetricsPrevious.distance) /
            100 /
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
            100 /
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

        this.streamMeasurement$()
            .pipe(
                withLatestFrom(this.allMetrics$, this.heartRateData$, this.ergConnectionStatus$),
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
                    IErgConnectionStatus,
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

    private setupMetricStream$(): Observable<ICalculatedMetrics> {
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
                        strokeRate: this.calculateStrokeRate(baseMetricsPrevious, baseMetricsCurrent),
                        speed: this.calculateSpeed(baseMetricsPrevious, baseMetricsCurrent),
                        distPerStroke: this.calculateStrokeDistance(baseMetricsPrevious, baseMetricsCurrent),
                    };
                },
            ),
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
        ).pipe(
            startWith({
                avgStrokePower: 0,
                dragFactor: 0,
                driveDuration: 0,
                recoveryDuration: 0,
            }),
        );
    }

    private streamHandleForces$(): Observable<Array<number>> {
        return merge(
            this.ergMetricService.streamHandleForces$(),
            this.resetSubject.pipe(map((): Array<number> => [])),
        ).pipe(startWith([]));
    }

    private streamMeasurement$(): Observable<IBaseMetrics> {
        return merge(this.ergMetricService.streamMeasurement$(), this.resetSubject);
    }
}
