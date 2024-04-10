import { Injectable } from "@angular/core";
import { map, merge, Observable, shareReplay, Subject, switchMap, withLatestFrom } from "rxjs";

import {
    BleServiceFlag,
    IAppState,
    IHeartRate,
    IRowerData,
    IRowerDataDto,
    IRowerSettings,
    LogLevel,
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

    private appData: IAppState = {} as IAppState;
    private appState$: Observable<IAppState>;

    private batteryLevel: number = 0;
    private bleServiceFlag: BleServiceFlag = BleServiceFlag.CpsService;

    private heartRateData$: Observable<IHeartRate | undefined>;

    private logDeltaTime: boolean | undefined = undefined;
    private logLevel: LogLevel = LogLevel.Trace;
    private logToSdCard: boolean | undefined = undefined;

    private resetSubject: Subject<IRowerDataDto> = new Subject();

    private rowingData: IRowerData = {
        timeStamp: new Date(),
        revTime: 0,
        distance: 0,
        strokeTime: 0,
        strokeCount: 0,
        avgStrokePower: 0,
        driveDuration: 0,
        recoveryDuration: 0,
        dragFactor: 0,
        handleForces: [],
    };

    constructor(
        private webSocketService: WebSocketService,
        private bleDataService: BluetoothMetricsService,
        private configManager: ConfigManagerService,
        private dataRecorder: DataRecorderService,
        private heartRateService: HeartRateService,
    ) {
        this.heartRateData$ = this.heartRateService.streamHeartRate();

        this.appState$ = merge(
            this.configManager.useBluetoothChanged$.pipe(
                switchMap(
                    (useBluetooth: boolean): Observable<IRowerDataDto | IRowerSettings> =>
                        useBluetooth ? this.bleDataService.data() : this.webSocketService.data(),
                ),
            ),
            this.resetSubject,
        ).pipe(
            withLatestFrom(this.heartRateData$),
            map(
                ([rowerRawMessage, heartRateData]: [
                    IRowerDataDto | IRowerSettings,
                    IHeartRate | undefined,
                ]): IAppState => {
                    this.bleServiceFlag =
                        "bleServiceFlag" in rowerRawMessage
                            ? rowerRawMessage.bleServiceFlag
                            : this.bleServiceFlag;
                    this.logLevel = "logLevel" in rowerRawMessage ? rowerRawMessage.logLevel : this.logLevel;
                    this.logDeltaTime =
                        "logDeltaTimes" in rowerRawMessage
                            ? rowerRawMessage.logDeltaTimes ?? undefined
                            : this.logDeltaTime;
                    this.logToSdCard =
                        "logToSdCard" in rowerRawMessage
                            ? rowerRawMessage.logToSdCard ?? undefined
                            : this.logToSdCard;
                    this.batteryLevel =
                        "batteryLevel" in rowerRawMessage ? rowerRawMessage.batteryLevel : this.batteryLevel;

                    this.appData = {
                        ...this.appData,
                        bleServiceFlag: this.bleServiceFlag,
                        logLevel: this.logLevel,
                        logToSdCard: this.logToSdCard,
                        logDeltaTimes: this.logDeltaTime,
                        batteryLevel: this.batteryLevel,
                    };

                    if ("data" in rowerRawMessage) {
                        const {
                            revTime: lastRevTime,
                            distance: lastDistance,
                            strokeTime: lastStrokeTime,
                            strokeCount: lastStrokeCount,
                        }: {
                            revTime: number;
                            distance: number;
                            strokeTime: number;
                            strokeCount: number;
                        } = this.rowingData;

                        this.dataRecorder.addRaw(rowerRawMessage);

                        this.rowingData = {
                            timeStamp: rowerRawMessage.timeStamp,
                            revTime: rowerRawMessage.data[0],
                            distance: rowerRawMessage.data[1],
                            strokeTime: rowerRawMessage.data[2],
                            strokeCount: rowerRawMessage.data[3],
                            avgStrokePower: rowerRawMessage.data[4],
                            driveDuration: rowerRawMessage.data[5],
                            recoveryDuration: rowerRawMessage.data[6],
                            dragFactor: rowerRawMessage.data[7],
                            handleForces: rowerRawMessage.data[8],
                        };

                        this.appData = {
                            ...this.appData,
                            timeStamp: this.rowingData.timeStamp,
                            driveDuration: this.rowingData.driveDuration / 1e6,
                            recoveryDuration: this.rowingData.recoveryDuration / 1e6,
                            avgStrokePower: this.rowingData.avgStrokePower,
                            distance: this.rowingData.distance - this.activityStartDistance,
                            dragFactor: this.rowingData.dragFactor,
                            strokeCount: this.rowingData.strokeCount - this.activityStartStrokeCount,
                            handleForces: this.rowingData.handleForces,
                            peakForce: Math.max(...this.rowingData.handleForces),
                            strokeRate:
                                ((this.rowingData.strokeCount - lastStrokeCount) /
                                    ((this.rowingData.strokeTime - lastStrokeTime) / 1e6)) *
                                60,
                            speed:
                                (this.rowingData.distance - lastDistance) /
                                100 /
                                ((this.rowingData.revTime - lastRevTime) / 1e6),
                            distPerStroke:
                                this.rowingData.distance === lastDistance
                                    ? 0
                                    : (this.rowingData.distance - lastDistance) /
                                      100 /
                                      (this.rowingData.strokeCount - lastStrokeCount),
                        };

                        this.dataRecorder.add({
                            ...this.appData,
                            heartRate: heartRateData?.contactDetected ? heartRateData : undefined,
                        });
                    }

                    return this.appData;
                },
            ),
            shareReplay(),
        );

        this.configManager.useBluetoothChanged$
            .pipe(
                switchMap(
                    (useBluetooth: boolean): Observable<Array<number>> =>
                        useBluetooth
                            ? this.bleDataService.streamDeltaTimes$()
                            : this.webSocketService.streamDeltaTimes$(),
                ),
            )
            .subscribe((deltaTimes: Array<number>): void => {
                this.dataRecorder.addDeltaTimes(deltaTimes);
            });
    }

    appState(): Observable<IAppState> {
        return this.appState$;
    }

    changeBleServiceType(bleService: BleServiceFlag): void {
        this.configManager.getItem("useBluetooth") === "true"
            ? this.bleDataService.changeBleServiceType(bleService)
            : this.webSocketService.changeBleServiceType(bleService);
    }

    changeDeltaTimeLogging(shouldEnable: boolean): void {
        this.configManager.getItem("useBluetooth") === "true"
            ? this.bleDataService.changeDeltaTimeLogging(shouldEnable)
            : this.webSocketService.changeDeltaTimeLogging(shouldEnable);
    }

    changeLogLevel(logLevel: LogLevel): void {
        this.configManager.getItem("useBluetooth") === "true"
            ? this.bleDataService.changeLogLevel(logLevel)
            : this.webSocketService.changeLogLevel(logLevel);
    }

    changeLogToSdCard(shouldEnable: boolean): void {
        this.configManager.getItem("useBluetooth") === "true"
            ? this.bleDataService.changeLogToSdCard(shouldEnable)
            : this.webSocketService.changeLogToSdCard(shouldEnable);
    }

    connectionStatus(): Observable<boolean> {
        return this.configManager.useBluetoothChanged$.pipe(
            switchMap(
                (useBluetooth: boolean): Observable<boolean> =>
                    useBluetooth
                        ? this.bleDataService.connectionStatus()
                        : this.webSocketService.connectionStatus(),
            ),
        );
    }

    getBleServiceFlag(): BleServiceFlag {
        return this.bleServiceFlag;
    }

    getDeltaTimeLoggingState(): boolean | undefined {
        return this.logDeltaTime;
    }

    getLogLevel(): LogLevel {
        return this.logLevel;
    }

    getSdCardLoggingState(): boolean | undefined {
        return this.logToSdCard;
    }

    heartRateData(): Observable<IHeartRate | undefined> {
        return this.heartRateData$;
    }

    reset(): void {
        this.activityStartDistance = this.rowingData.distance;
        this.activityStartStrokeCount = this.rowingData.strokeCount;
        this.dataRecorder.reset();

        this.resetSubject.next({
            timeStamp: new Date(),
            data: [
                this.rowingData.revTime,
                this.rowingData.distance,
                this.rowingData.strokeTime,
                this.rowingData.strokeCount,
                0,
                0,
                0,
                0,
                [],
            ],
        });
    }
}
