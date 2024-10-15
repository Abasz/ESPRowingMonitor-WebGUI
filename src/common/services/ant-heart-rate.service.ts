import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatSnackBar } from "@angular/material/snack-bar";
import {
    BehaviorSubject,
    filter,
    from,
    fromEvent,
    map,
    merge,
    Observable,
    of,
    startWith,
    Subscription,
    switchMap,
    take,
    takeWhile,
    tap,
} from "rxjs";
import { HeartRateSensor, HeartRateSensorState, USBDriver } from "web-ant-plus";

import { IHeartRate, IHeartRateService, IHRConnectionStatus } from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class AntHeartRateService implements IHeartRateService {
    private batteryLevelSubject: BehaviorSubject<number | undefined> = new BehaviorSubject<
        number | undefined
    >(undefined);
    private connectionStatusSubject: BehaviorSubject<IHRConnectionStatus> =
        new BehaviorSubject<IHRConnectionStatus>({ status: "disconnected" });
    private heartRateSensorSubject: BehaviorSubject<HeartRateSensor | undefined> = new BehaviorSubject<
        HeartRateSensor | undefined
    >(undefined);

    private onConnect: Subscription | undefined;

    private onConnect$: Observable<void> = (
        fromEvent(navigator.usb, "connect") as Observable<USBConnectionEvent>
    ).pipe(
        filter(
            (event: USBConnectionEvent): boolean =>
                ((event.device.vendorId === USBDriver.supportedDevices[0].vendor ||
                    event.device.vendorId === USBDriver.supportedDevices[1].vendor) &&
                    event.device.productId === USBDriver.supportedDevices[0].product) ||
                event.device.productId === USBDriver.supportedDevices[1].product,
        ),
        switchMap((): Observable<void> => from(this.reconnect())),
    );
    private stick: USBDriver | undefined = undefined;

    constructor(
        private snackBar: MatSnackBar,
        private destroyRef: DestroyRef,
    ) {}

    connectionStatus$(): Observable<IHRConnectionStatus> {
        return merge(
            this.connectionStatusSubject,
            this.heartRateSensorSubject.pipe(
                map(
                    (hrSensor: HeartRateSensor | undefined): IHRConnectionStatus => ({
                        deviceName: hrSensor?.deviceID?.toString(),
                        status: hrSensor?.deviceID ? "connected" : "disconnected",
                    }),
                ),
            ),
        );
    }

    async disconnectDevice(): Promise<void> {
        if (this.heartRateSensorSubject.value !== undefined) {
            await this.stick?.close();
        }
        this.onConnect?.unsubscribe();
        this.batteryLevelSubject.next(undefined);
        this.heartRateSensorSubject.next(undefined);
        this.stick = undefined;
        this.onConnect = undefined;
    }

    async discover(): Promise<void> {
        let newStick: USBDriver | undefined;
        try {
            newStick = await USBDriver.createFromNewDevice();
        } catch (error) {
            if (error) {
                this.snackBar.open("No USB device was selected", "Dismiss");
            }
        }
        if (newStick !== undefined) {
            await this.disconnectDevice();
            await this.connect(newStick);
        }
    }

    async reconnect(): Promise<void> {
        await this.disconnectDevice();
        const stick = await USBDriver.createFromPairedDevice();

        if (this.onConnect === undefined) {
            this.onConnect = this.onConnect$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
        }

        if (stick !== undefined) {
            await this.connect(stick);
        }
    }

    streamHRMonitorBatteryLevel$(): Observable<number | undefined> {
        return this.batteryLevelSubject.asObservable();
    }

    streamHeartRate$(): Observable<IHeartRate | undefined> {
        return this.heartRateSensorSubject.pipe(
            switchMap((hrSensor: HeartRateSensor | undefined): Observable<IHeartRate | undefined> => {
                if (hrSensor !== undefined) {
                    return (fromEvent(hrSensor, "hbData") as Observable<HeartRateSensorState>).pipe(
                        map((data: HeartRateSensorState): IHeartRate => {
                            const batteryLevel =
                                data.BatteryLevel ?? this.parseBatteryStatus(data.BatteryStatus) ?? 0;
                            this.batteryLevelSubject.next(batteryLevel);

                            return {
                                contactDetected: true,
                                heartRate: data.ComputedHeartRate ?? 0,
                                batteryLevel,
                            };
                        }),
                    );
                }

                return of(undefined);
            }),
            startWith(undefined as IHeartRate | undefined),
        );
    }

    private async connect(stick: USBDriver): Promise<void> {
        if (this.onConnect === undefined) {
            this.onConnect = this.onConnect$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
        }
        this.stick = stick;
        const hrSensor = new HeartRateSensor(this.stick);

        fromEvent(this.stick, "startup")
            .pipe(
                take(1),
                switchMap((): Observable<void> => {
                    this.snackBar.open("ANT+ Stick is ready", "Dismiss");

                    this.connectionStatusSubject.next({
                        status: "searching",
                    });

                    return from(hrSensor.attachSensor(0, 0));
                }),
                switchMap(
                    (): Observable<void> =>
                        merge(
                            (fromEvent(hrSensor, "detached") as Observable<void>).pipe(
                                switchMap((): Observable<void> => {
                                    this.batteryLevelSubject.next(undefined);
                                    this.heartRateSensorSubject.next(undefined);
                                    this.snackBar.open("Heart Rate Monitor connection lost", "Dismiss");

                                    return from(hrSensor.attachSensor(0, 0));
                                }),
                            ),
                            (fromEvent(hrSensor, "attached") as Observable<void>).pipe(
                                tap((): void => {
                                    this.heartRateSensorSubject.next(hrSensor);
                                }),
                            ),
                        ),
                ),
            )
            .pipe(takeWhile((): boolean => this.onConnect !== undefined))
            .subscribe();

        try {
            await this.stick.open();
        } catch (error) {
            if (error instanceof Error) {
                console.error(error);
                this.heartRateSensorSubject.next(undefined);
                this.snackBar.open("An error occurred while communicating with ANT+ Stick", "Dismiss");
            }
        }
    }

    private parseBatteryStatus(
        batteryStatus: "New" | "Good" | "Ok" | "Low" | "Critical" | "Invalid" | undefined,
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
