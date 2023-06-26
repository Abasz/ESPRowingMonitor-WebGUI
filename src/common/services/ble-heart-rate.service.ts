import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BluetoothCore } from "@manekinekko/angular-web-bluetooth";
import {
    BehaviorSubject,
    catchError,
    combineLatest,
    concat,
    concatMap,
    EMPTY,
    filter,
    map,
    merge,
    Observable,
    of,
    startWith,
    switchMap,
    take,
    takeUntil,
    tap,
    timer,
    withLatestFrom,
} from "rxjs";

import {
    BATTERY_LEVEL_CHARACTERISTIC,
    BATTERY_LEVEL_SERVICE,
    HEART_RATE_CHARACTERISTIC,
    HEART_RATE_SERVICE,
    IHeartRate,
    IHeartRateService,
} from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class BLEHeartRateService implements IHeartRateService {
    private batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);
    private heartRateCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined> =
        new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(undefined);

    constructor(private snackBar: MatSnackBar, private ble: BluetoothCore) {}

    disconnectDevice(): void {
        if (
            this.batteryCharacteristic.value !== undefined ||
            this.heartRateCharacteristic.value !== undefined
        ) {
            this.ble.disconnectDevice();
            this.batteryCharacteristic.next(undefined);
            this.heartRateCharacteristic.next(undefined);
        }
    }

    discover$(): Observable<Array<Observable<never> | BluetoothRemoteGATTCharacteristic>> {
        return this.ble
            .discover$({
                acceptAllDevices: false,
                filters: [{ services: [HEART_RATE_SERVICE] }],
                optionalServices: [BATTERY_LEVEL_SERVICE],
            })
            .pipe(
                concatMap(
                    (
                        gatt: void | BluetoothRemoteGATTServer
                    ): Observable<Array<Observable<never> | BluetoothRemoteGATTCharacteristic>> => {
                        if (gatt === undefined) {
                            return EMPTY;
                        }

                        return combineLatest([
                            merge(
                                timer(15 * 1000).pipe(
                                    tap((): void => {
                                        this.snackBar.open("Getting battery info timed out", "Dismiss");
                                    }),
                                    map((): Observable<never> => EMPTY)
                                ),
                                this.connectToBattery(gatt)
                            ),
                            this.connectToHearRate(gatt),
                        ]);
                    }
                ),
                tap({
                    error: (error: unknown): void => {
                        if (error) {
                            this.snackBar.open(`${error}`, "Dismiss");
                        }
                    },
                }),
                catchError((): Observable<never> => EMPTY)
            );
    }

    streamHRMonitorBatteryLevel$(): Observable<number | undefined> {
        return this.batteryCharacteristic.pipe(
            filter(
                (
                    batteryCharacteristic: BluetoothRemoteGATTCharacteristic | undefined
                ): batteryCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    batteryCharacteristic !== undefined
            ),
            switchMap(
                (batteryCharacteristic: BluetoothRemoteGATTCharacteristic): Observable<number | undefined> =>
                    this.observeBattery(batteryCharacteristic)
            ),
            startWith(undefined as number | undefined)
        );
    }

    streamHeartRate$(): Observable<IHeartRate | undefined> {
        return this.heartRateCharacteristic.pipe(
            filter(
                (
                    heartRateCharacteristic: BluetoothRemoteGATTCharacteristic | undefined
                ): heartRateCharacteristic is BluetoothRemoteGATTCharacteristic =>
                    heartRateCharacteristic !== undefined
            ),
            switchMap(
                (
                    heartRateCharacteristic: BluetoothRemoteGATTCharacteristic
                ): Observable<IHeartRate | undefined> => this.observeHeartRate(heartRateCharacteristic)
            ),
            startWith(undefined as IHeartRate | undefined)
        );
    }

    private connectToBattery(gatt: BluetoothRemoteGATTServer): Observable<BluetoothRemoteGATTCharacteristic> {
        return this.ble.getPrimaryService$(gatt, BATTERY_LEVEL_SERVICE).pipe(
            concatMap(
                (
                    primaryService: BluetoothRemoteGATTService
                ): Observable<void | BluetoothRemoteGATTCharacteristic> => {
                    return this.ble.getCharacteristic$(primaryService, BATTERY_LEVEL_CHARACTERISTIC).pipe(
                        tap((): void => {
                            this.snackBar.open("Battery service is available", "Dismiss");
                        })
                    );
                }
            ),
            concatMap(
                (
                    characteristic: void | BluetoothRemoteGATTCharacteristic
                ): Observable<BluetoothRemoteGATTCharacteristic> => {
                    if (characteristic === undefined) {
                        return EMPTY;
                    }
                    this.batteryCharacteristic.next(characteristic);

                    return of(characteristic);
                }
            ),
            catchError((): Observable<never> => EMPTY),
            take(1)
        );
    }

    private connectToHearRate(
        gatt: BluetoothRemoteGATTServer
    ): Observable<BluetoothRemoteGATTCharacteristic> {
        return this.ble.getPrimaryService$(gatt, HEART_RATE_SERVICE).pipe(
            concatMap(
                (
                    primaryService: BluetoothRemoteGATTService
                ): Observable<void | BluetoothRemoteGATTCharacteristic> => {
                    return this.ble.getCharacteristic$(primaryService, HEART_RATE_CHARACTERISTIC).pipe(
                        tap((): void => {
                            this.snackBar.open("Heart Rate monitor is connected", "Dismiss");
                        })
                    );
                }
            ),
            concatMap(
                (
                    characteristic: void | BluetoothRemoteGATTCharacteristic
                ): Observable<BluetoothRemoteGATTCharacteristic> => {
                    if (characteristic === undefined) {
                        return EMPTY;
                    }
                    this.heartRateCharacteristic.next(characteristic);

                    return of(characteristic);
                }
            ),
            catchError((): Observable<never> => EMPTY),
            take(1)
        );
    }

    private observeBattery(
        batteryCharacteristic: BluetoothRemoteGATTCharacteristic
    ): Observable<number | undefined> {
        return concat(
            concat(
                this.ble.readValue$(batteryCharacteristic),
                this.ble.observeValue$(batteryCharacteristic)
            ).pipe(
                map((value: DataView): number => value.getInt8(0)),
                takeUntil(
                    this.ble.getDevice$().pipe(
                        filter((device: BluetoothDevice): boolean => !device),
                        tap((): void => {
                            this.heartRateCharacteristic.next(undefined);
                            this.batteryCharacteristic.next(undefined);
                        }),
                        take(1)
                    )
                )
            ),
            of(undefined)
        );
    }

    private observeHeartRate(
        heartRateCharacteristic: BluetoothRemoteGATTCharacteristic
    ): Observable<IHeartRate | undefined> {
        return concat(
            this.ble
                .observeValue$(heartRateCharacteristic)
                .pipe(
                    withLatestFrom(this.streamHRMonitorBatteryLevel$()),
                    map(
                        ([heartRateData, batteryLevel]: [DataView, number | undefined]): IHeartRate => ({
                            ...this.parseHeartRate(heartRateData),
                            batteryLevel,
                        })
                    )
                )
                .pipe(
                    takeUntil(
                        this.ble.getDevice$().pipe(
                            filter((device: BluetoothDevice): boolean => !device),
                            tap((): void => {
                                this.heartRateCharacteristic.next(undefined);
                                this.batteryCharacteristic.next(undefined);
                            }),
                            take(1)
                        )
                    )
                ),
            of(undefined)
        );
    }

    private parseHeartRate(value: DataView): Omit<IHeartRate, "batteryLevel"> {
        const flags = value.getUint8(0);
        const rate16Bits = flags & 0x1;
        const result: IHeartRate = { heartRate: 0, contactDetected: true };
        let index = 1;
        if (rate16Bits) {
            result.heartRate = value.getUint16(index, true);
            index += 2;
        } else {
            result.heartRate = value.getUint8(index);
            index += 1;
        }
        const contactDetected = flags & 0x2;
        const contactSensorPresent = flags & 0x4;
        if (contactSensorPresent) {
            result.contactDetected = !!contactDetected;
        }
        const energyPresent = flags & 0x8;
        if (energyPresent) {
            result.energyExpended = value.getUint16(index, true);
            index += 2;
        }
        const rrIntervalPresent = flags & 0x10;
        if (rrIntervalPresent) {
            const rrIntervals = [];
            for (; index + 1 < value.byteLength; index += 2) {
                rrIntervals.push(value.getUint16(index, true));
            }
            result.rrIntervals = rrIntervals;
        }

        return result;
    }
}
