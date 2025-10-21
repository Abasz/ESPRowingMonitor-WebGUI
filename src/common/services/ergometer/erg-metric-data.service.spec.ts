import { provideZonelessChangeDetection } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { BehaviorSubject, Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import {
    CYCLING_POWER_CHARACTERISTIC,
    CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC,
    ROWER_DATA_CHARACTERISTIC,
} from "../../ble.interfaces";
import { IBaseMetrics, IExtendedMetrics } from "../../common.interfaces";
import {
    changedListenerReadyFactory,
    createBaseMetrics,
    createCPSMeasurementDataView,
    createCSCMeasurementDataView,
    createDeltaTimesDataView,
    createExtendedMetricsDataView,
    createFTMSMeasurementDataView,
    createHandleForcesDataView,
    createMeasurementDataViews,
    createMockBluetoothDevice,
    createMockCharacteristic,
    ListenerTrigger,
} from "../ble.test.helpers";

import { ErgConnectionService } from "./erg-connection.service";
import { ErgMetricsService } from "./erg-metric-data.service";

describe("ErgMetricsService", (): void => {
    const destroySubject: Subject<void> = new Subject<void>();

    let service: ErgMetricsService;
    let mockErgConnectionService: jasmine.SpyObj<ErgConnectionService>;
    let mockBluetoothDevice: jasmine.SpyObj<BluetoothDevice>;

    let mockDeltaTimesCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockExtendedCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockHandleForceCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockMeasurementCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockMeasurementUUID: jasmine.Spy<() => string>;

    let deltaTimesCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
    let extendedCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
    let handleForceCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
    let measurementCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;

    let createDeltaTimesValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView>>;
    let createExtendedValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView>>;
    let createHandleForceValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView>>;
    let createMeasurementValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView>>;
    let createDisconnectChangedListenerReady: () => Promise<ListenerTrigger<void>>;

    beforeEach((): void => {
        mockBluetoothDevice = createMockBluetoothDevice();
        mockDeltaTimesCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockExtendedCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockHandleForceCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockMeasurementCharacteristic = createMockCharacteristic(mockBluetoothDevice);

        mockMeasurementUUID = (
            Object.getOwnPropertyDescriptor(mockMeasurementCharacteristic, "uuid")?.get as jasmine.Spy<
                () => string
            >
        ).and.returnValue(BluetoothUUID.getCharacteristic(CYCLING_POWER_CHARACTERISTIC));

        deltaTimesCharacteristicSubject = new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(
            undefined,
        );
        extendedCharacteristicSubject = new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(
            undefined,
        );
        handleForceCharacteristicSubject = new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(
            undefined,
        );
        measurementCharacteristicSubject = new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(
            undefined,
        );

        mockErgConnectionService = jasmine.createSpyObj(
            "ErgConnectionService",
            [
                "readDeltaTimesCharacteristic",
                "connectToDeltaTimes",
                "resetDeltaTimesCharacteristic",
                "readExtendedCharacteristic",
                "connectToExtended",
                "resetExtendedCharacteristic",
                "readHandleForceCharacteristic",
                "connectToHandleForces",
                "resetHandleForceCharacteristic",
                "readMeasurementCharacteristic",
                "connectToMeasurement",
                "resetMeasurementCharacteristic",
            ],
            {
                deltaTimesCharacteristic$: deltaTimesCharacteristicSubject.asObservable(),
                extendedCharacteristic$: extendedCharacteristicSubject.asObservable(),
                handleForceCharacteristic$: handleForceCharacteristicSubject.asObservable(),
                measurementCharacteristic$: measurementCharacteristicSubject.asObservable(),
            },
        );
        mockErgConnectionService.readDeltaTimesCharacteristic.and.returnValue(mockDeltaTimesCharacteristic);
        mockErgConnectionService.readExtendedCharacteristic.and.returnValue(mockExtendedCharacteristic);
        mockErgConnectionService.readHandleForceCharacteristic.and.returnValue(mockHandleForceCharacteristic);
        mockErgConnectionService.readMeasurementCharacteristic.and.returnValue(mockMeasurementCharacteristic);

        createDeltaTimesValueChangedListenerReady = changedListenerReadyFactory<
            typeof mockDeltaTimesCharacteristic,
            DataView
        >(mockDeltaTimesCharacteristic, "characteristicvaluechanged");
        createExtendedValueChangedListenerReady = changedListenerReadyFactory<
            typeof mockExtendedCharacteristic,
            DataView
        >(mockExtendedCharacteristic, "characteristicvaluechanged");
        createHandleForceValueChangedListenerReady = changedListenerReadyFactory<
            typeof mockHandleForceCharacteristic,
            DataView
        >(mockHandleForceCharacteristic, "characteristicvaluechanged");
        createMeasurementValueChangedListenerReady = changedListenerReadyFactory<
            typeof mockMeasurementCharacteristic,
            DataView
        >(mockMeasurementCharacteristic, "characteristicvaluechanged");
        createDisconnectChangedListenerReady = changedListenerReadyFactory<typeof mockBluetoothDevice, void>(
            mockBluetoothDevice,
            "gattserverdisconnected",
        );

        TestBed.configureTestingModule({
            providers: [
                ErgMetricsService,
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                provideZonelessChangeDetection(),
            ],
        });

        service = TestBed.inject(ErgMetricsService);
    });

    afterEach((): void => {
        destroySubject.next();
        destroySubject.complete();
    });

    describe("streamDeltaTimes$ method", (): void => {
        it("should not emit values when characteristic is undefined", (): void => {
            const emittedValues: Array<Array<number>> = [];

            service
                .streamDeltaTimes$()
                .pipe(takeUntil(destroySubject))
                .subscribe({
                    next: (value: Array<number>): void => {
                        emittedValues.push(value);
                    },
                });

            expect(emittedValues).toHaveSize(0);
        });

        describe("when characteristic is available", (): void => {
            let deltaTrigger: Promise<ListenerTrigger<DataView>>;

            beforeEach(async (): Promise<void> => {
                deltaTimesCharacteristicSubject.next(mockDeltaTimesCharacteristic);
                deltaTrigger = createDeltaTimesValueChangedListenerReady();
            });

            it("should filter out undefined characteristics", async (): Promise<void> => {
                const emittedValues: Array<Array<number>> = [];

                service
                    .streamDeltaTimes$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: Array<number>): void => {
                            emittedValues.push(value);
                        },
                    });

                (await deltaTrigger).triggerChanged(createDeltaTimesDataView([1000, 2000, 3000]));
                deltaTimesCharacteristicSubject.next(undefined);
                deltaTimesCharacteristicSubject.next(mockDeltaTimesCharacteristic);

                expect(emittedValues).toHaveSize(1);
                expect(emittedValues[0]).toEqual([1000, 2000, 3000]);
                expect(mockErgConnectionService.resetDeltaTimesCharacteristic).toHaveBeenCalled();
            });

            it("should emit parsed delta times when data is received", async (): Promise<void> => {
                const emittedValues: Array<Array<number>> = [];

                service
                    .streamDeltaTimes$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: Array<number>): void => {
                            emittedValues.push(value);
                        },
                    });

                const testData = createDeltaTimesDataView([1000, 2000, 3000]);
                (await deltaTrigger).triggerChanged(testData);

                expect(emittedValues).toHaveSize(1);
                expect(emittedValues[0]).toEqual([1000, 2000, 3000]);
            });

            it("should emit delta times array", async (): Promise<void> => {
                const emittedValues: Array<Array<number>> = [];

                service
                    .streamDeltaTimes$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: Array<number>): void => {
                            emittedValues.push(value);
                        },
                    });

                (await deltaTrigger).triggerChanged(createDeltaTimesDataView([500, 1000, 1500, 2000]));

                expect(emittedValues).toHaveSize(1);
                expect(emittedValues[0]).toEqual([500, 1000, 1500, 2000]);
            });

            it("should reset delta times characteristic when observable completes", async (): Promise<void> => {
                const deltaValueChangeReady = createDeltaTimesValueChangedListenerReady();
                const disconnectReady = createDisconnectChangedListenerReady();

                service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                await deltaValueChangeReady;
                (await disconnectReady).triggerChanged();

                expect(mockErgConnectionService.resetDeltaTimesCharacteristic).toHaveBeenCalled();
            });
        });

        describe("when characteristic errors", (): void => {
            it("should retry up to 4 times", fakeAsync((): void => {
                service
                    .streamDeltaTimes$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        error: (): void => {
                            // no-op
                        },
                    });

                deltaTimesCharacteristicSubject.error(new Error("Test error unknown"));

                tick(4 * 2000);

                expect(mockErgConnectionService.readDeltaTimesCharacteristic).toHaveBeenCalledTimes(4);
                expect(mockErgConnectionService.connectToDeltaTimes).toHaveBeenCalledTimes(4);
            }));

            it("should delay retry by 2000ms", fakeAsync((): void => {
                service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                deltaTimesCharacteristicSubject.error(new Error("test error unknown"));
                // reset so we have only one call to connect after the timeout
                mockErgConnectionService.connectToDeltaTimes.calls.reset();

                tick(2000);

                expect(mockErgConnectionService.connectToDeltaTimes).toHaveBeenCalledOnceWith(
                    mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                );
            }));

            describe("and error message contains 'unknown'", (): void => {
                let gattSpy: jasmine.Spy<() => BluetoothRemoteGATTServer | undefined>;

                beforeEach((): void => {
                    gattSpy = Object.getOwnPropertyDescriptor(mockBluetoothDevice, "gatt")
                        ?.get as jasmine.Spy<() => BluetoothRemoteGATTServer | undefined>;
                });

                it("should get GATT from connection service", fakeAsync((): void => {
                    service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                    deltaTimesCharacteristicSubject.error(new Error("unknown connection issue"));
                    gattSpy.calls.reset();
                    tick(2000);

                    expect(gattSpy).toHaveBeenCalled();
                }));

                it("should reconnect to delta times when GATT available", fakeAsync((): void => {
                    service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                    deltaTimesCharacteristicSubject.error(new Error("unknown connection issue"));
                    mockErgConnectionService.connectToDeltaTimes.calls.reset();
                    tick(2000);

                    expect(mockErgConnectionService.connectToDeltaTimes).toHaveBeenCalledWith(
                        mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                    );
                }));

                it("should retry without reconnect when GATT is unavailable", fakeAsync((): void => {
                    gattSpy.and.returnValue(undefined);
                    service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                    deltaTimesCharacteristicSubject.error(new Error("unknown connection issue"));
                    tick(2000);

                    expect(mockErgConnectionService.connectToDeltaTimes).not.toHaveBeenCalled();
                }));
            });

            it("and error message does not contain 'unknown' should not attempt reconnection", fakeAsync((): void => {
                service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                deltaTimesCharacteristicSubject.error(new Error("different error"));
                tick(2000);

                expect(mockErgConnectionService.connectToDeltaTimes).not.toHaveBeenCalled();
            }));
        });
    });

    describe("streamExtended$ method", (): void => {
        it("should not emit values when characteristic is undefined", (): void => {
            const emittedValues: Array<IExtendedMetrics> = [];

            service
                .streamExtended$()
                .pipe(takeUntil(destroySubject))
                .subscribe({
                    next: (value: IExtendedMetrics): void => {
                        emittedValues.push(value);
                    },
                });

            expect(emittedValues).toHaveSize(0);
        });

        describe("when characteristic is available", (): void => {
            let extendedTrigger: Promise<ListenerTrigger<DataView>>;

            beforeEach(async (): Promise<void> => {
                extendedCharacteristicSubject.next(mockExtendedCharacteristic);
                extendedTrigger = createExtendedValueChangedListenerReady();
            });

            it("should filter out undefined characteristics", async (): Promise<void> => {
                const emittedValues: Array<IExtendedMetrics> = [];

                service
                    .streamExtended$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: IExtendedMetrics): void => {
                            emittedValues.push(value);
                        },
                    });

                (await extendedTrigger).triggerChanged(createExtendedMetricsDataView(150, 4096, 8192, 100));
                extendedCharacteristicSubject.next(undefined);
                extendedCharacteristicSubject.next(mockDeltaTimesCharacteristic);

                expect(emittedValues).toHaveSize(1);
                expect(emittedValues[0]).toEqual({
                    avgStrokePower: 150,
                    driveDuration: 1000000,
                    recoveryDuration: 2000000,
                    dragFactor: 100,
                });
                expect(mockErgConnectionService.resetExtendedCharacteristic).toHaveBeenCalled();
            });

            it("should emit correctly parsed extended metrics", async (): Promise<void> => {
                const emittedValues: Array<IExtendedMetrics> = [];

                service
                    .streamExtended$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: IExtendedMetrics): void => {
                            emittedValues.push(value);
                        },
                    });

                (await extendedTrigger).triggerChanged(createExtendedMetricsDataView(200, 2048, 4096, 120));

                expect(emittedValues).toHaveSize(1);
                expect(emittedValues[0]).toEqual({
                    avgStrokePower: 200,
                    driveDuration: Math.round((2048 / 4096) * 1e6),
                    recoveryDuration: Math.round((4096 / 4096) * 1e6),
                    dragFactor: 120,
                });
            });

            it("should reset extended characteristic when observable completes", async (): Promise<void> => {
                const extendedValueChangeReady = createExtendedValueChangedListenerReady();
                const disconnectReady = createDisconnectChangedListenerReady();

                service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                await extendedValueChangeReady;
                (await disconnectReady).triggerChanged();

                expect(mockErgConnectionService.resetExtendedCharacteristic).toHaveBeenCalled();
            });
        });

        describe("when characteristic errors", (): void => {
            it("should retry up to 4 times", fakeAsync((): void => {
                service
                    .streamExtended$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        error: (): void => {
                            // no-op
                        },
                    });

                extendedCharacteristicSubject.error(new Error("test error unknown"));

                tick(4 * 2000);

                expect(mockErgConnectionService.readExtendedCharacteristic).toHaveBeenCalledTimes(4);
                expect(mockErgConnectionService.connectToExtended).toHaveBeenCalledTimes(4);
            }));

            it("should delay retry by 2000ms", fakeAsync((): void => {
                service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                extendedCharacteristicSubject.error(new Error("test error unknown"));
                // reset so we have only one call to connect after the timeout
                mockErgConnectionService.connectToExtended.calls.reset();

                tick(2000);

                expect(mockErgConnectionService.connectToExtended).toHaveBeenCalledOnceWith(
                    mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                );
            }));

            describe("when error message contains 'unknown'", (): void => {
                it("should get GATT from connection service", fakeAsync((): void => {
                    const gattSpy = Object.getOwnPropertyDescriptor(mockBluetoothDevice, "gatt")
                        ?.get as jasmine.Spy<() => BluetoothRemoteGATTServer | undefined>;
                    service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                    extendedCharacteristicSubject.error(new Error("unknown connection issue"));
                    gattSpy.calls.reset();
                    tick(2000);

                    expect(gattSpy).toHaveBeenCalled();
                }));

                it("should reconnect to extended when GATT available", fakeAsync((): void => {
                    service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                    extendedCharacteristicSubject.error(new Error("unknown connection issue"));
                    mockErgConnectionService.connectToExtended.calls.reset();
                    tick(2000);

                    expect(mockErgConnectionService.connectToExtended).toHaveBeenCalledWith(
                        mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                    );
                }));
            });

            describe("should not attempt reconnection", (): void => {
                it("when error message does not contain 'unknown'", fakeAsync((): void => {
                    const connectSpy = mockErgConnectionService.connectToExtended;
                    connectSpy.calls.reset();
                    service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                    extendedCharacteristicSubject.error(new Error("different error"));
                    tick(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                }));

                it("when GATT is unavailable", fakeAsync((): void => {
                    const gattSpy = Object.getOwnPropertyDescriptor(mockBluetoothDevice, "gatt")
                        ?.get as jasmine.Spy<() => BluetoothRemoteGATTServer | undefined>;
                    gattSpy.and.returnValue(undefined);

                    const connectSpy = mockErgConnectionService.connectToExtended;
                    connectSpy.calls.reset();
                    service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                    extendedCharacteristicSubject.error(new Error("unknown connection issue"));
                    tick(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                }));
            });
        });
    });

    describe("streamHandleForces$ method", (): void => {
        it("should not emit values when characteristic is undefined", (): void => {
            const emittedValues: Array<Array<number>> = [];

            service
                .streamHandleForces$()
                .pipe(takeUntil(destroySubject))
                .subscribe({
                    next: (value: Array<number>): void => {
                        emittedValues.push(value);
                    },
                });

            expect(emittedValues).toHaveSize(0);
        });

        describe("when characteristic is available", (): void => {
            let handleForceTrigger: Promise<ListenerTrigger<DataView>>;

            beforeEach(async (): Promise<void> => {
                handleForceCharacteristicSubject.next(mockHandleForceCharacteristic);
                handleForceTrigger = createHandleForceValueChangedListenerReady();
            });

            it("should filter out undefined characteristics", async (): Promise<void> => {
                const emittedValues: Array<Array<number>> = [];

                service
                    .streamHandleForces$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: Array<number>): void => {
                            emittedValues.push(value);
                        },
                    });

                (await handleForceTrigger).triggerChanged(
                    createHandleForcesDataView(3, 1, [10.5, 15.2, 20.8]),
                );
                (await handleForceTrigger).triggerChanged(createHandleForcesDataView(3, 2, [22.1, 24.7]));
                (await handleForceTrigger).triggerChanged(createHandleForcesDataView(3, 3, [25.1, 30.7]));
                handleForceCharacteristicSubject.next(undefined);
                handleForceCharacteristicSubject.next(mockDeltaTimesCharacteristic);

                expect(emittedValues).toHaveSize(1);
                expect(emittedValues[0]).toHaveSize(7);
                const expected = [10.5, 15.2, 20.8, 22.1, 24.7, 25.1, 30.7];
                expected.forEach((val: number, idx: number): void => {
                    expect(emittedValues[0][idx]).withContext(`Value at index ${idx}`).toBeCloseTo(val, 3);
                });
                expect(mockErgConnectionService.resetHandleForceCharacteristic).toHaveBeenCalled();
            });

            describe("when underlying observable emits data", (): void => {
                it("should parse handle forces array from multiple messages", async (): Promise<void> => {
                    const emittedValues: Array<Array<number>> = [];

                    service
                        .streamHandleForces$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe({
                            next: (value: Array<number>): void => {
                                emittedValues.push(value);
                            },
                        });

                    const testData1 = createHandleForcesDataView(5, 6, [100.5, 200.2, 100.6, 400]);
                    (await handleForceTrigger).triggerChanged(testData1);
                    const testData2 = createHandleForcesDataView(7, 7, [300.8]);
                    (await handleForceTrigger).triggerChanged(testData2);

                    expect(emittedValues).toHaveSize(1);
                    const expected = [100.5, 200.2, 100.6, 400, 300.8];
                    expected.forEach((val: number, idx: number): void => {
                        expect(emittedValues[0][idx])
                            .withContext(`Value at index ${idx}`)
                            .toBeCloseTo(val, 3);
                    });
                });

                it("should buffer until bytes 0 and 1 of the payload is equal and then emit", async (): Promise<void> => {
                    const emittedValues: Array<Array<number>> = [];

                    service
                        .streamHandleForces$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe({
                            next: (value: Array<number>): void => {
                                emittedValues.push(value);
                            },
                        });

                    (await handleForceTrigger).triggerChanged(createHandleForcesDataView(10, 20, [1.1]));
                    (await handleForceTrigger).triggerChanged(createHandleForcesDataView(15, 20, [4.1]));
                    (await handleForceTrigger).triggerChanged(createHandleForcesDataView(19, 20, [10.1]));

                    expect(emittedValues).toHaveSize(0);

                    (await handleForceTrigger).triggerChanged(createHandleForcesDataView(20, 20, [2.2]));

                    expect(emittedValues).toHaveSize(1);
                });
            });

            it("should reset handle force characteristic when observable completes", async (): Promise<void> => {
                const handleForceValueChangeReady = createHandleForceValueChangedListenerReady();
                const disconnectReady = createDisconnectChangedListenerReady();

                service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                await handleForceValueChangeReady;
                (await disconnectReady).triggerChanged();

                expect(mockErgConnectionService.resetHandleForceCharacteristic).toHaveBeenCalled();
            });
        });

        describe("when characteristic errors", (): void => {
            beforeEach((): void => {
                handleForceCharacteristicSubject.next(mockHandleForceCharacteristic);
            });

            it("should retry up to 4 times", fakeAsync((): void => {
                const emittedValues: Array<Array<number>> = [];

                service
                    .streamHandleForces$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: Array<number>): void => {
                            emittedValues.push(value);
                        },
                        error: (): void => {
                            // no-op
                        },
                    });

                handleForceCharacteristicSubject.error(new Error("test error unknown"));

                tick(4 * 2000);

                expect(mockErgConnectionService.readHandleForceCharacteristic).toHaveBeenCalledTimes(4);
                expect(mockErgConnectionService.connectToHandleForces).toHaveBeenCalledTimes(4);
            }));

            it("should delay retry by 2000ms", fakeAsync((): void => {
                service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                handleForceCharacteristicSubject.error(new Error("test error unknown"));
                mockErgConnectionService.connectToHandleForces.calls.reset();

                tick(2000);

                expect(mockErgConnectionService.connectToHandleForces).toHaveBeenCalledWith(
                    mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                );
            }));

            describe("when error message contains 'unknown'", (): void => {
                it("should get GATT from connection service", fakeAsync((): void => {
                    const gattSpy = Object.getOwnPropertyDescriptor(mockBluetoothDevice, "gatt")
                        ?.get as jasmine.Spy<() => BluetoothRemoteGATTServer | undefined>;

                    service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                    handleForceCharacteristicSubject.error(new Error("unknown connection issue"));
                    gattSpy.calls.reset();
                    tick(2000);

                    expect(gattSpy).toHaveBeenCalled();
                }));

                it("should reconnect to handle forces when GATT available", fakeAsync((): void => {
                    service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                    handleForceCharacteristicSubject.error(new Error("unknown connection issue"));
                    mockErgConnectionService.connectToHandleForces.calls.reset();
                    tick(2000);

                    expect(mockErgConnectionService.connectToHandleForces).toHaveBeenCalledWith(
                        mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                    );
                }));
            });

            describe("should not attempt reconnection", (): void => {
                it("when error message does not contain 'unknown'", fakeAsync((): void => {
                    const connectSpy = mockErgConnectionService.connectToHandleForces;
                    connectSpy.calls.reset();

                    service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                    handleForceCharacteristicSubject.error(new Error("different error"));
                    tick(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                }));

                it("when GATT is unavailable", fakeAsync((): void => {
                    const gattSpy = Object.getOwnPropertyDescriptor(mockBluetoothDevice, "gatt")
                        ?.get as jasmine.Spy<() => BluetoothRemoteGATTServer | undefined>;
                    gattSpy.and.returnValue(undefined);

                    const connectSpy = mockErgConnectionService.connectToHandleForces;
                    connectSpy.calls.reset();
                    service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                    handleForceCharacteristicSubject.error(new Error("unknown connection issue"));
                    tick(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                }));
            });
        });

        describe("streamMeasurement$ method", (): void => {
            it("should not emit values when characteristic is undefined", (): void => {
                const emittedValues: Array<IBaseMetrics> = [];

                service
                    .streamMeasurement$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: IBaseMetrics): void => {
                            emittedValues.push(value);
                        },
                    });

                expect(emittedValues).toHaveSize(0);
            });

            it("should filter out undefined characteristics", async (): Promise<void> => {
                const emittedValues: Array<IBaseMetrics> = [];
                const expectedMetrics: IBaseMetrics = createBaseMetrics();
                measurementCharacteristicSubject.next(mockMeasurementCharacteristic);
                const measurementTrigger: Promise<ListenerTrigger<DataView>> =
                    createMeasurementValueChangedListenerReady();

                service
                    .streamMeasurement$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: IBaseMetrics): void => {
                            emittedValues.push(value);
                        },
                    });

                (await measurementTrigger).triggerChanged(createCPSMeasurementDataView(expectedMetrics));
                measurementCharacteristicSubject.next(undefined);
                measurementCharacteristicSubject.next(mockMeasurementCharacteristic);

                expect(emittedValues).toHaveSize(1);
                expect(emittedValues[0]).toEqual(
                    jasmine.objectContaining({
                        distance: expectedMetrics.distance,
                        strokeCount: expectedMetrics.strokeCount,
                    }),
                );
                expect(Math.abs(emittedValues[0].revTime - expectedMetrics.revTime))
                    .withContext(`revTime: ${emittedValues[0].revTime} -> ${expectedMetrics.revTime}`)
                    .toBeLessThanOrEqual(200);
                expect(Math.abs(emittedValues[0].strokeTime - expectedMetrics.strokeTime))
                    .withContext(
                        `strokeTime: ${emittedValues[0].strokeTime} -> ${expectedMetrics.strokeTime}`,
                    )
                    .toBeLessThanOrEqual(200);
                expect(mockErgConnectionService.resetMeasurementCharacteristic).toHaveBeenCalled();
            });

            describe("when characteristic is available", (): void => {
                let measurementTrigger: Promise<ListenerTrigger<DataView>>;
                const deltaMetrics = [
                    createBaseMetrics(),
                    {
                        distance: 2400,
                        strokeCount: 5,
                        revTime: createBaseMetrics().revTime / 2,
                        strokeTime: createBaseMetrics().strokeTime / 2,
                    },
                    {
                        distance: 2200,
                        strokeCount: 4,
                        revTime: createBaseMetrics().revTime / 3,
                        strokeTime: createBaseMetrics().strokeTime / 3,
                    },
                ];

                beforeEach(async (): Promise<void> => {
                    measurementCharacteristicSubject.next(mockMeasurementCharacteristic);
                    measurementTrigger = createMeasurementValueChangedListenerReady();
                });

                describe("should emit base metrics", (): void => {
                    it("when service is Fitness Machine", async (): Promise<void> => {
                        const emittedValues: Array<IBaseMetrics> = [];
                        const {
                            expectedMetrics,
                            metricsDataViews,
                        }: { expectedMetrics: Array<IBaseMetrics>; metricsDataViews: Array<DataView> } =
                            createMeasurementDataViews(deltaMetrics, createFTMSMeasurementDataView);
                        mockMeasurementUUID.and.returnValue(
                            BluetoothUUID.getCharacteristic(ROWER_DATA_CHARACTERISTIC),
                        );
                        service
                            .streamMeasurement$()
                            .pipe(takeUntil(destroySubject))
                            .subscribe({
                                next: (value: IBaseMetrics): void => {
                                    emittedValues.push(value);
                                },
                            });

                        const measurementTriggerHandler = await measurementTrigger;
                        metricsDataViews.forEach((dataView: DataView): void => {
                            measurementTriggerHandler.triggerChanged(dataView);
                        });

                        expect(emittedValues).toHaveSize(3);
                        expectedMetrics.forEach((expectedMetric: IBaseMetrics, index: number): void => {
                            expect(emittedValues[index]).toEqual(
                                jasmine.objectContaining({
                                    distance: expectedMetric.distance,
                                    strokeCount: expectedMetric.strokeCount,
                                }),
                            );
                            expect(Math.abs(emittedValues[index].revTime - expectedMetric.revTime))
                                .withContext(
                                    `revTime[${index}]: ${emittedValues[index].revTime} -> ${expectedMetric.revTime}`,
                                )
                                .toBeLessThanOrEqual(20 * 1000); // so within 33 milliseconds which is due to rounding
                            expect(Math.abs(emittedValues[index].strokeTime - expectedMetric.strokeTime))
                                .withContext(
                                    `strokeTime[${index}]: ${emittedValues[index].strokeTime} -> ${expectedMetric.strokeTime}`,
                                )
                                .toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                        });
                    });

                    it("when service is Cycling Power", async (): Promise<void> => {
                        const emittedValues: Array<IBaseMetrics> = [];
                        const {
                            expectedMetrics: expectedMetricsCPS,
                            metricsDataViews: metricsDataViewsCPS,
                        }: { expectedMetrics: Array<IBaseMetrics>; metricsDataViews: Array<DataView> } =
                            createMeasurementDataViews(deltaMetrics, createCPSMeasurementDataView);
                        mockMeasurementUUID.and.returnValue(
                            BluetoothUUID.getCharacteristic(CYCLING_POWER_CHARACTERISTIC),
                        );
                        service
                            .streamMeasurement$()
                            .pipe(takeUntil(destroySubject))
                            .subscribe({
                                next: (value: IBaseMetrics): void => {
                                    emittedValues.push(value);
                                },
                            });

                        const measurementTriggerHandler = await measurementTrigger;
                        metricsDataViewsCPS.forEach((dataView: DataView): void => {
                            measurementTriggerHandler.triggerChanged(dataView);
                        });

                        expect(emittedValues).toHaveSize(3);
                        expectedMetricsCPS.forEach((expectedMetric: IBaseMetrics, index: number): void => {
                            expect(emittedValues[index]).toEqual(
                                jasmine.objectContaining({
                                    distance: expectedMetric.distance,
                                    strokeCount: expectedMetric.strokeCount,
                                }),
                            );
                            expect(Math.abs(emittedValues[index].revTime - expectedMetric.revTime))
                                .withContext(
                                    `revTime[${index}]: ${emittedValues[index].revTime} -> ${expectedMetric.revTime}`,
                                )
                                .toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                            expect(Math.abs(emittedValues[index].strokeTime - expectedMetric.strokeTime))
                                .withContext(
                                    `strokeTime[${index}]: ${emittedValues[index].strokeTime} -> ${expectedMetric.strokeTime}`,
                                )
                                .toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                        });
                    });

                    it("when service is Cycling Speed and Cadence", async (): Promise<void> => {
                        const emittedValues: Array<IBaseMetrics> = [];
                        const {
                            expectedMetrics: expectedMetricsCSC,
                            metricsDataViews: metricsDataViewsCSC,
                        }: { expectedMetrics: Array<IBaseMetrics>; metricsDataViews: Array<DataView> } =
                            createMeasurementDataViews(deltaMetrics, createCSCMeasurementDataView);
                        mockMeasurementUUID.and.returnValue(
                            BluetoothUUID.getCharacteristic(CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC),
                        );
                        service
                            .streamMeasurement$()
                            .pipe(takeUntil(destroySubject))
                            .subscribe({
                                next: (value: IBaseMetrics): void => {
                                    emittedValues.push(value);
                                },
                            });

                        const measurementTriggerHandler = await measurementTrigger;
                        metricsDataViewsCSC.forEach((dataView: DataView): void => {
                            measurementTriggerHandler.triggerChanged(dataView);
                        });

                        expect(emittedValues).toHaveSize(3);
                        expectedMetricsCSC.forEach((expectedMetric: IBaseMetrics, index: number): void => {
                            expect(emittedValues[index]).toEqual(
                                jasmine.objectContaining({
                                    distance: expectedMetric.distance,
                                    strokeCount: expectedMetric.strokeCount,
                                }),
                            );
                            expect(Math.abs(emittedValues[index].revTime - expectedMetric.revTime))
                                .withContext(
                                    `revTime[${index}]: ${emittedValues[index].revTime} -> ${expectedMetric.revTime}`,
                                )
                                .toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                            expect(Math.abs(emittedValues[index].strokeTime - expectedMetric.strokeTime))
                                .withContext(
                                    `strokeTime[${index}]: ${emittedValues[index].strokeTime} -> ${expectedMetric.strokeTime}`,
                                )
                                .toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                        });
                    });
                });

                it("should apply distinctUntilChanged based on distance and stroke count", async (): Promise<void> => {
                    const emittedValues: Array<IBaseMetrics> = [];
                    const { metricsDataViews }: { metricsDataViews: Array<DataView> } =
                        createMeasurementDataViews(
                            [
                                ...deltaMetrics,
                                {
                                    distance: 0,
                                    strokeCount: 0,
                                    revTime: createBaseMetrics().revTime / 3,
                                    strokeTime: createBaseMetrics().strokeTime / 3,
                                },
                            ],
                            createCPSMeasurementDataView,
                        );
                    service
                        .streamMeasurement$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe({
                            next: (value: IBaseMetrics): void => {
                                emittedValues.push(value);
                            },
                        });

                    const measurementTriggerHandler = await measurementTrigger;
                    metricsDataViews.forEach((dataView: DataView): void => {
                        measurementTriggerHandler.triggerChanged(dataView);
                    });

                    expect(emittedValues).toHaveSize(3);
                });

                it("should emit the last data 4.5s after the last emission", fakeAsync((): void => {
                    const emittedValues: Array<IBaseMetrics> = [];

                    service
                        .streamMeasurement$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe({
                            next: (value: IBaseMetrics): void => {
                                emittedValues.push(value);
                            },
                        });

                    measurementTrigger.then((handler: ListenerTrigger<DataView>): void => {
                        handler.triggerChanged(createCPSMeasurementDataView(createBaseMetrics()));
                        expect(emittedValues).toHaveSize(1);
                        tick(4500);
                        expect(emittedValues).toHaveSize(2);
                    });
                }));

                it("should reset measurement characteristic when observable completes", async (): Promise<void> => {
                    const measurementValueChangeReady = createMeasurementValueChangedListenerReady();
                    const disconnectReady = createDisconnectChangedListenerReady();

                    service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                    await measurementValueChangeReady;
                    (await disconnectReady).triggerChanged();

                    expect(mockErgConnectionService.resetMeasurementCharacteristic).toHaveBeenCalled();
                });
            });
        });

        describe("when characteristic errors", (): void => {
            beforeEach((): void => {
                measurementCharacteristicSubject.next(mockMeasurementCharacteristic);
            });

            it("should retry up to 4 times", fakeAsync((): void => {
                service
                    .streamMeasurement$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        error: (): void => {
                            // no-op
                        },
                    });

                measurementCharacteristicSubject.error(new Error("test error unknown"));

                tick(4 * 2000);

                expect(mockErgConnectionService.readMeasurementCharacteristic).toHaveBeenCalledTimes(4);
                expect(mockErgConnectionService.connectToMeasurement).toHaveBeenCalledTimes(4);
            }));

            it("should delay retry by 2000ms", fakeAsync((): void => {
                service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                measurementCharacteristicSubject.error(new Error("test error unknown"));
                // reset so we have only one call to connect after the timeout
                mockErgConnectionService.connectToMeasurement.calls.reset();

                tick(2000);

                expect(mockErgConnectionService.connectToMeasurement).toHaveBeenCalledOnceWith(
                    mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                );
            }));

            describe("when error message contains 'unknown'", (): void => {
                it("should get GATT from connection service", fakeAsync((): void => {
                    const gattSpy = Object.getOwnPropertyDescriptor(mockBluetoothDevice, "gatt")
                        ?.get as jasmine.Spy<() => BluetoothRemoteGATTServer | undefined>;

                    service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                    measurementCharacteristicSubject.error(new Error("unknown connection issue"));
                    gattSpy.calls.reset();
                    tick(2000);

                    expect(gattSpy).toHaveBeenCalled();
                }));

                it("should reconnect to measurement when GATT available", fakeAsync((): void => {
                    service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                    measurementCharacteristicSubject.error(new Error("unknown connection issue"));
                    tick(2000);

                    expect(mockErgConnectionService.connectToMeasurement).toHaveBeenCalledWith(
                        mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                    );
                }));
            });

            describe("should not attempt reconnection", (): void => {
                it("when error message does not contain 'unknown'", fakeAsync((): void => {
                    const connectSpy = mockErgConnectionService.connectToMeasurement;
                    connectSpy.calls.reset();

                    service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                    measurementCharacteristicSubject.error(new Error("different error"));
                    tick(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                }));

                it("when GATT is unavailable", fakeAsync((): void => {
                    const gattSpy = Object.getOwnPropertyDescriptor(mockBluetoothDevice, "gatt")
                        ?.get as jasmine.Spy<() => BluetoothRemoteGATTServer | undefined>;
                    gattSpy.and.returnValue(undefined);

                    const connectSpy = mockErgConnectionService.connectToMeasurement;
                    connectSpy.calls.reset();

                    service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                    measurementCharacteristicSubject.error(new Error("unknown connection issue"));
                    tick(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                }));
            });
        });
    });
});
