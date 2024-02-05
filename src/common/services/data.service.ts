import { Injectable } from "@angular/core";
import { map, merge, Observable, shareReplay, Subject, withLatestFrom } from "rxjs";

import {
    BleServiceFlag,
    IAppState,
    IHeartRate,
    IRowerData,
    IRowerDataDto,
    IRowerSettings,
    LogLevel,
} from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { HeartRateService } from "./heart-rate.service";
import { WebSocketService } from "./websocket.service";

@Injectable({
    providedIn: "root",
})
export class DataService {
    private activityStartDistance: number = 0;
    private activityStartStrokeCount: number = 0;

    private appState$: Observable<IAppState>;

    private batteryLevel: number = 0;
    private bleServiceFlag: BleServiceFlag = BleServiceFlag.CpsService;

    private heartRateData$: Observable<IHeartRate | undefined>;

    private lastDistance: number = 0;
    private lastRevCount: number = 0;
    private lastRevTime: number = 0;
    private lastStrokeCount: number = 0;
    private lastStrokeTime: number = 0;

    private logLevel: LogLevel = LogLevel.Trace;

    private resetSubject: Subject<IRowerDataDto> = new Subject();

    private rowingData: IRowerData = {
        revTime: 0,
        distance: 0,
        strokeTime: 0,
        strokeCount: 0,
        avgStrokePower: 0,
        driveDuration: 0,
        recoveryDuration: 0,
        dragFactor: 0,
        handleForces: [],
        deltaTimes: [],
    };

    constructor(
        private webSocketService: WebSocketService,
        private dataRecorder: DataRecorderService,
        private heartRateService: HeartRateService,
    ) {
        this.heartRateData$ = this.heartRateService.streamHeartRate();

        this.appState$ = merge(this.webSocketService.data(), this.resetSubject).pipe(
            withLatestFrom(this.heartRateData$),
            map(
                ([rowerRawMessage, heartRateData]: [
                    IRowerDataDto | IRowerSettings,
                    IHeartRate | undefined,
                ]): IAppState => {
                    dataRecorder.addRaw(rowerRawMessage);
                    this.bleServiceFlag =
                        "bleServiceFlag" in rowerRawMessage
                            ? rowerRawMessage.bleServiceFlag
                            : this.bleServiceFlag;
                    this.logLevel = "logLevel" in rowerRawMessage ? rowerRawMessage.logLevel : this.logLevel;
                    this.batteryLevel =
                        "batteryLevel" in rowerRawMessage ? rowerRawMessage.batteryLevel : this.batteryLevel;

                    if ("data" in rowerRawMessage) {
                        this.rowingData = {
                            revTime: rowerRawMessage.data[0],
                            distance: rowerRawMessage.data[1],
                            strokeTime: rowerRawMessage.data[2],
                            strokeCount: rowerRawMessage.data[3],
                            avgStrokePower: rowerRawMessage.data[4],
                            driveDuration: rowerRawMessage.data[5],
                            recoveryDuration: rowerRawMessage.data[6],
                            dragFactor: rowerRawMessage.data[7],
                            handleForces: rowerRawMessage.data[8],
                            deltaTimes: rowerRawMessage.data[9],
                        };
                    }

                    const distance = Math.round(this.rowingData.distance);
                    const appData: IAppState = {
                        bleServiceFlag: this.bleServiceFlag,
                        logLevel: this.logLevel,
                        batteryLevel: this.batteryLevel,
                        driveDuration: this.rowingData.driveDuration / 1e6,
                        recoveryDuration: this.rowingData.recoveryDuration / 1e6,
                        avgStrokePower: this.rowingData.avgStrokePower,
                        distance: this.rowingData.distance - this.activityStartDistance,
                        dragFactor: this.rowingData.dragFactor,
                        strokeCount: this.rowingData.strokeCount - this.activityStartStrokeCount,
                        handleForces: this.rowingData.handleForces,
                        peakForce: Math.max(...this.rowingData.handleForces),
                        strokeRate:
                            ((this.rowingData.strokeCount - this.lastStrokeCount) /
                                ((this.rowingData.strokeTime - this.lastStrokeTime) / 1e6)) *
                            60,
                        speed:
                            (distance - this.lastRevCount) /
                            100 /
                            ((this.rowingData.revTime - this.lastRevTime) / 1e6),
                        distPerStroke:
                            Math.round(this.rowingData.distance) === this.lastRevCount
                                ? 0
                                : (distance - this.lastRevCount) /
                                  100 /
                                  (this.rowingData.strokeCount - this.lastStrokeCount),
                    };

                    if ("data" in rowerRawMessage) {
                        this.dataRecorder.add({
                            ...appData,
                            heartRate: heartRateData?.contactDetected ? heartRateData : undefined,
                        });

                        this.lastRevTime = this.rowingData.revTime;
                        this.lastRevCount = distance;
                        this.lastStrokeTime = this.rowingData.strokeTime;
                        this.lastStrokeCount = this.rowingData.strokeCount;
                        this.lastDistance = this.rowingData.distance;
                    }

                    return appData;
                },
            ),
            shareReplay(),
        );
    }

    appState(): Observable<IAppState> {
        return this.appState$;
    }

    getBleServiceFlag(): BleServiceFlag {
        return this.bleServiceFlag;
    }

    getLogLevel(): LogLevel {
        return this.logLevel;
    }

    heartRateData(): Observable<IHeartRate | undefined> {
        return this.heartRateData$;
    }

    reset(): void {
        this.activityStartDistance = this.lastDistance;
        this.activityStartStrokeCount = this.lastStrokeCount;
        this.dataRecorder.reset();

        this.resetSubject.next({
            data: [
                this.lastRevTime,
                this.lastDistance,
                this.lastStrokeTime,
                this.lastStrokeCount,
                0,
                0,
                0,
                0,
                [],
                [],
            ],
        });
    }
}
