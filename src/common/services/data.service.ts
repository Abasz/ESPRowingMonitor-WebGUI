import { Injectable } from "@angular/core";
import {
    combineLatest,
    filter,
    map,
    merge,
    Observable,
    pairwise,
    shareReplay,
    Subject,
    switchMap,
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

import { BluetoothMetricsService } from "./ble-data.service";
import { ConfigManagerService } from "./config-manager.service";
import { DataRecorderService } from "./data-recorder.service";
import { HeartRateService } from "./heart-rate.service";
import { WebSocketService } from "./websocket.service";

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
        private webSocketService: WebSocketService,
        private bleDataService: BluetoothMetricsService,
        private configManager: ConfigManagerService,
        private dataRecorder: DataRecorderService,
        private heartRateService: HeartRateService,
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
            )
            .subscribe((): void => {
                this.activityStartTime = new Date();
            });

        // TODO: Serves backward compatibility with WS API, remove once WS connection is removed
        this.configManager.useBluetoothChanged$.subscribe((useBluetooth: boolean): void => {
            this.baseMetrics = {
                revTime: 0,
                distance: 0,
                strokeTime: 0,
                strokeCount: 0,
            };
            this.resetSubject.next(this.baseMetrics);
            this.activityStartTime = new Date();

            if (!useBluetooth) {
                this.bleDataService.disconnectDevice();
            } else {
                this.bleDataService.reconnect();
            }
        });
    }

    changeBleServiceType(bleService: BleServiceFlag): Promise<void> {
        return this.configManager.getItem("useBluetooth") === "true"
            ? this.bleDataService.changeBleServiceType(bleService)
            : Promise.resolve(this.webSocketService.changeBleServiceType(bleService));
    }

    changeDeltaTimeLogging(shouldEnable: boolean): Promise<void> {
        return this.configManager.getItem("useBluetooth") === "true"
            ? this.bleDataService.changeDeltaTimeLogging(shouldEnable)
            : Promise.resolve(this.webSocketService.changeDeltaTimeLogging(shouldEnable));
    }

    changeLogLevel(logLevel: LogLevel): Promise<void> {
        return this.configManager.getItem("useBluetooth") === "true"
            ? this.bleDataService.changeLogLevel(logLevel)
            : Promise.resolve(this.webSocketService.changeLogLevel(logLevel));
    }

    changeLogToSdCard(shouldEnable: boolean): Promise<void> {
        return this.configManager.getItem("useBluetooth") === "true"
            ? this.bleDataService.changeLogToSdCard(shouldEnable)
            : Promise.resolve(this.webSocketService.changeLogToSdCard(shouldEnable));
    }

    ergConnectionStatus$(): Observable<IErgConnectionStatus> {
        return this.configManager.useBluetoothChanged$.pipe(
            switchMap(
                (useBluetooth: boolean): Observable<IErgConnectionStatus> =>
                    useBluetooth
                        ? this.bleDataService.connectionStatus$()
                        : this.webSocketService.connectionStatus().pipe(
                              map(
                                  (isConnected: boolean): IErgConnectionStatus => ({
                                      deviceName: isConnected
                                          ? new URL(this.configManager.getItem("webSocketAddress")).hostname
                                          : undefined,
                                      status: isConnected ? "connected" : "disconnected",
                                  }),
                              ),
                          ),
            ),
        );
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

    streamExtended$(): Observable<IExtendedMetrics> {
        return merge(
            this.configManager.useBluetoothChanged$.pipe(
                switchMap(
                    (useBluetooth: boolean): Observable<IExtendedMetrics> =>
                        useBluetooth
                            ? this.bleDataService.streamExtended$()
                            : this.webSocketService.streamExtended$(),
                ),
                shareReplay(1),
            ),
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

    streamHandleForces$(): Observable<Array<number>> {
        return merge(
            this.configManager.useBluetoothChanged$.pipe(
                switchMap(
                    (useBluetooth: boolean): Observable<Array<number>> =>
                        useBluetooth
                            ? this.bleDataService.streamHandleForces$()
                            : this.webSocketService.streamHandleForces$(),
                ),
                shareReplay(1),
            ),
            this.resetSubject.pipe(map((): Array<number> => [])),
        );
    }

    streamHeartRate$(): Observable<IHeartRate | undefined> {
        return this.heartRateData$;
    }

    streamMeasurement$(): Observable<IBaseMetrics> {
        return merge(
            this.configManager.useBluetoothChanged$.pipe(
                switchMap(
                    (useBluetooth: boolean): Observable<IBaseMetrics> =>
                        useBluetooth
                            ? this.bleDataService.streamMeasurement$()
                            : this.webSocketService.streamMeasurement$(),
                ),
                shareReplay(1),
            ),
            this.resetSubject,
        );
    }

    streamMonitorBatteryLevel$(): Observable<number> {
        return this.configManager.useBluetoothChanged$.pipe(
            switchMap(
                (useBluetooth: boolean): Observable<number> =>
                    useBluetooth
                        ? this.bleDataService.streamMonitorBatteryLevel$()
                        : this.webSocketService.streamMonitorBatteryLevel$(),
            ),
            shareReplay(1),
        );
    }

    streamSettings$(): Observable<IRowerSettings> {
        return this.configManager.useBluetoothChanged$.pipe(
            switchMap(
                (useBluetooth: boolean): Observable<IRowerSettings> =>
                    useBluetooth
                        ? this.bleDataService.streamSettings$()
                        : this.webSocketService.streamSettings$(),
            ),
            shareReplay(1),
        );
    }

    private setupLogging(): void {
        this.configManager.useBluetoothChanged$
            .pipe(
                switchMap(
                    (useBluetooth: boolean): Observable<Array<number>> =>
                        useBluetooth
                            ? this.bleDataService.streamDeltaTimes$()
                            : this.webSocketService.streamDeltaTimes$(),
                ),
                filter((deltaTimes: Array<number>): boolean => deltaTimes.length > 0),
            )
            .subscribe((deltaTimes: Array<number>): void => {
                this.dataRecorder.addDeltaTimes(deltaTimes);
            });

        this.streamMeasurement$()
            .pipe(
                withLatestFrom(this.calculatedMetrics$, this.streamHeartRate$()),
                filter(
                    ([_, calculatedMetrics]: [
                        IBaseMetrics,
                        ICalculatedMetrics,
                        IHeartRate | undefined,
                    ]): boolean => calculatedMetrics.strokeCount > 0 || calculatedMetrics.distance > 0,
                ),
            )
            .subscribe(
                ([_, calculatedMetrics, heartRate]: [
                    IBaseMetrics,
                    ICalculatedMetrics,
                    IHeartRate | undefined,
                ]): void => {
                    this.dataRecorder.addSessionData({
                        ...calculatedMetrics,
                        heartRate,
                    });
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
}
