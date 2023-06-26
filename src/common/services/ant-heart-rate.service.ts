import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import {
    BehaviorSubject,
    catchError,
    EMPTY,
    from,
    fromEvent,
    map,
    merge,
    Observable,
    of,
    startWith,
    switchMap,
    tap,
} from "rxjs";
import { HeartRateSensor, HeartRateSensorState } from "web-ant-plus";
import { USBDriver } from "web-ant-plus/dist/USBDriver";

import { IHeartRate, IHeartRateService } from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class AntHeartRateService implements IHeartRateService {
    private batteryLevelSubject: BehaviorSubject<number | undefined> = new BehaviorSubject<
        number | undefined
    >(undefined);

    private heartRateSensorSubject: BehaviorSubject<HeartRateSensor | undefined> = new BehaviorSubject<
        HeartRateSensor | undefined
    >(undefined);

    private stick: USBDriver | undefined = undefined;

    constructor(private snackBar: MatSnackBar) {}

    async disconnectDevice(): Promise<void> {
        await this.heartRateSensorSubject.value?.detach();
        await this.stick?.close();
        this.batteryLevelSubject.next(undefined);
        this.heartRateSensorSubject.next(undefined);
        this.stick = undefined;
    }

    discover$(): Observable<HeartRateSensor> {
        return from(USBDriver.requestDevice()).pipe(
            tap({
                error: (error: unknown): void => {
                    if (error) {
                        this.snackBar.open("No USB device was selected", "Dismiss");
                    }
                },
            }),
            switchMap((stick: USBDriver): Observable<HeartRateSensor> => {
                this.stick = stick;
                const hrSensor = new HeartRateSensor(this.stick);

                return merge(
                    fromEvent(this.stick, "startup").pipe(
                        switchMap((): Observable<void> => from(hrSensor.attachSensor(0, 0)))
                    ),
                    fromEvent(hrSensor, "detached").pipe(
                        switchMap((): Observable<void> => {
                            this.batteryLevelSubject.next(undefined);
                            this.heartRateSensorSubject.next(undefined);

                            return from(hrSensor.attachSensor(0, 0));
                        })
                    ),
                    from(this.stick.open())
                ).pipe(
                    map((): HeartRateSensor => hrSensor),
                    tap((hrSensor: HeartRateSensor): void => this.heartRateSensorSubject.next(hrSensor))
                );
            }),
            catchError((): Observable<never> => EMPTY)
        );
    }

    streamHRMonitorBatteryLevel$(): Observable<number | undefined> {
        return this.batteryLevelSubject.asObservable();
    }

    streamHeartRate$(): Observable<IHeartRate | undefined> {
        return this.heartRateSensorSubject.pipe(
            switchMap((hrSensor: HeartRateSensor | undefined): Observable<IHeartRate | undefined> => {
                if (hrSensor !== undefined) {
                    return fromEvent<HeartRateSensorState>(hrSensor, "hbData").pipe(
                        map((data: HeartRateSensorState): IHeartRate => {
                            const batteryLevel =
                                data.BatteryLevel ?? this.parseBatteryStatus(data.BatteryStatus) ?? 0;
                            this.batteryLevelSubject.next(batteryLevel);
                            console.log(data);

                            return {
                                contactDetected: true,
                                heartRate: data.ComputedHeartRate ?? 0,
                                batteryLevel,
                            };
                        })
                    );
                }

                return of(undefined);
            }),
            startWith(undefined as IHeartRate | undefined)
        );
    }

    private parseBatteryStatus(
        batteryStatus: "New" | "Good" | "Ok" | "Low" | "Critical" | "Invalid" | undefined
    ): number {
        switch (batteryStatus) {
            case "New":
                return 100;
            case "Good":
                return 80;
            case "Ok":
                return 60;
            case "Low":
                return 40;
            case "Critical":
                return 20;
            default:
                return 0;
        }
    }
}
