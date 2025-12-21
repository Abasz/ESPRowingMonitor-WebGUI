import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

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
    let mockErgConnectionService: Pick<
        ErgConnectionService,
        | "readDeltaTimesCharacteristic"
        | "connectToDeltaTimes"
        | "resetDeltaTimesCharacteristic"
        | "readExtendedCharacteristic"
        | "connectToExtended"
        | "resetExtendedCharacteristic"
        | "readHandleForceCharacteristic"
        | "connectToHandleForces"
        | "resetHandleForceCharacteristic"
        | "readMeasurementCharacteristic"
        | "connectToMeasurement"
        | "resetMeasurementCharacteristic"
        | "deltaTimesCharacteristic$"
        | "extendedCharacteristic$"
        | "handleForceCharacteristic$"
        | "measurementCharacteristic$"
    >;
    let mockBluetoothDevice: BluetoothDevice;

    let mockDeltaTimesCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockExtendedCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockHandleForceCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockMeasurementCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockMeasurementUUID: Mock<() => string>;

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

        mockMeasurementUUID = vi
            .spyOn(mockMeasurementCharacteristic, "uuid", "get")
            .mockReturnValue(BluetoothUUID.getCharacteristic(CYCLING_POWER_CHARACTERISTIC));

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

        mockErgConnectionService = {
            readDeltaTimesCharacteristic: vi.fn(),
            connectToDeltaTimes: vi.fn(),
            resetDeltaTimesCharacteristic: vi.fn(),
            readExtendedCharacteristic: vi.fn(),
            connectToExtended: vi.fn(),
            resetExtendedCharacteristic: vi.fn(),
            readHandleForceCharacteristic: vi.fn(),
            connectToHandleForces: vi.fn(),
            resetHandleForceCharacteristic: vi.fn(),
            readMeasurementCharacteristic: vi.fn(),
            connectToMeasurement: vi.fn(),
            resetMeasurementCharacteristic: vi.fn(),
            deltaTimesCharacteristic$: deltaTimesCharacteristicSubject.asObservable(),
            extendedCharacteristic$: extendedCharacteristicSubject.asObservable(),
            handleForceCharacteristic$: handleForceCharacteristicSubject.asObservable(),
            measurementCharacteristic$: measurementCharacteristicSubject.asObservable(),
        };
        vi.mocked(mockErgConnectionService.readDeltaTimesCharacteristic).mockReturnValue(
            mockDeltaTimesCharacteristic,
        );
        vi.mocked(mockErgConnectionService.readExtendedCharacteristic).mockReturnValue(
            mockExtendedCharacteristic,
        );
        vi.mocked(mockErgConnectionService.readHandleForceCharacteristic).mockReturnValue(
            mockHandleForceCharacteristic,
        );
        vi.mocked(mockErgConnectionService.readMeasurementCharacteristic).mockReturnValue(
            mockMeasurementCharacteristic,
        );

        createDeltaTimesValueChangedListenerReady = changedListenerReadyFactory(
            mockDeltaTimesCharacteristic,
            "characteristicvaluechanged",
        );
        createExtendedValueChangedListenerReady = changedListenerReadyFactory(
            mockExtendedCharacteristic,
            "characteristicvaluechanged",
        );
        createHandleForceValueChangedListenerReady = changedListenerReadyFactory(
            mockHandleForceCharacteristic,
            "characteristicvaluechanged",
        );
        createMeasurementValueChangedListenerReady = changedListenerReadyFactory(
            mockMeasurementCharacteristic,
            "characteristicvaluechanged",
        );
        createDisconnectChangedListenerReady = changedListenerReadyFactory<BluetoothDevice, void>(
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

            expect(emittedValues).toHaveLength(0);
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

                expect(emittedValues).toHaveLength(1);
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

                expect(emittedValues).toHaveLength(1);
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

                expect(emittedValues).toHaveLength(1);
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
            beforeEach((): void => {
                vi.useFakeTimers();
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should retry up to 4 times", async (): Promise<void> => {
                service
                    .streamDeltaTimes$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        error: (): void => {
                            // no-op
                        },
                    });

                deltaTimesCharacteristicSubject.error(new Error("Test error unknown"));

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(mockErgConnectionService.readDeltaTimesCharacteristic).toHaveBeenCalledTimes(4);
                expect(mockErgConnectionService.connectToDeltaTimes).toHaveBeenCalledTimes(4);
            });

            it("should delay retry by 2000ms", async (): Promise<void> => {
                service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                deltaTimesCharacteristicSubject.error(new Error("test error unknown"));
                // reset so we have only one call to connect after the timeout
                vi.mocked(mockErgConnectionService.connectToDeltaTimes).mockClear();

                await vi.advanceTimersByTimeAsync(2000);

                expect(mockErgConnectionService.connectToDeltaTimes).toHaveBeenCalledTimes(1);

                expect(mockErgConnectionService.connectToDeltaTimes).toHaveBeenCalledWith(
                    mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                );
            });

            describe("and error message contains 'unknown'", (): void => {
                let gattSpy: ReturnType<typeof vi.spyOn>;

                beforeEach((): void => {
                    gattSpy = vi.spyOn(mockBluetoothDevice, "gatt", "get");
                });

                it("should get GATT from connection service", async (): Promise<void> => {
                    service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                    deltaTimesCharacteristicSubject.error(new Error("unknown connection issue"));
                    gattSpy.mockClear();
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(gattSpy).toHaveBeenCalled();
                });

                it("should reconnect to delta times when GATT available", async (): Promise<void> => {
                    service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                    deltaTimesCharacteristicSubject.error(new Error("unknown connection issue"));
                    vi.mocked(mockErgConnectionService.connectToDeltaTimes).mockClear();
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(mockErgConnectionService.connectToDeltaTimes).toHaveBeenCalledWith(
                        mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                    );
                });

                it("should retry without reconnect when GATT is unavailable", async (): Promise<void> => {
                    gattSpy.mockReturnValue(undefined);
                    service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                    deltaTimesCharacteristicSubject.error(new Error("unknown connection issue"));
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(mockErgConnectionService.connectToDeltaTimes).not.toHaveBeenCalled();
                });
            });

            it("and error message does not contain 'unknown' should not attempt reconnection", async (): Promise<void> => {
                service.streamDeltaTimes$().pipe(takeUntil(destroySubject)).subscribe();

                deltaTimesCharacteristicSubject.error(new Error("different error"));
                await vi.advanceTimersByTimeAsync(2000);

                expect(mockErgConnectionService.connectToDeltaTimes).not.toHaveBeenCalled();
            });
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

            expect(emittedValues).toHaveLength(0);
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

                expect(emittedValues).toHaveLength(1);
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

                expect(emittedValues).toHaveLength(1);
                expect(emittedValues[0]).toEqual({
                    avgStrokePower: 200,
                    driveDuration: Math.round((2048 / 4096) * 1e6),
                    recoveryDuration: Math.round((4096 / 4096) * 1e6),
                    dragFactor: 120,
                });
            });

            it("should parse 16-bit dragFactor values correctly", async (): Promise<void> => {
                const emittedValues: Array<IExtendedMetrics> = [];

                service
                    .streamExtended$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: IExtendedMetrics): void => {
                            emittedValues.push(value);
                        },
                    });

                (await extendedTrigger).triggerChanged(createExtendedMetricsDataView(250, 3000, 5000, 512));

                expect(emittedValues).toHaveLength(1);
                expect(emittedValues[0]).toEqual({
                    avgStrokePower: 250,
                    driveDuration: Math.round((3000 / 4096) * 1e6),
                    recoveryDuration: Math.round((5000 / 4096) * 1e6),
                    dragFactor: 512,
                });
            });

            it("should support backward compatibility with 7-byte packets (old format)", async (): Promise<void> => {
                const emittedValues: Array<IExtendedMetrics> = [];

                service
                    .streamExtended$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (value: IExtendedMetrics): void => {
                            emittedValues.push(value);
                        },
                    });

                const buffer = new ArrayBuffer(7);
                const dataView = new DataView(buffer);
                dataView.setUint16(0, 180, true);
                dataView.setUint16(2, 2500, true);
                dataView.setUint16(4, 4500, true);
                dataView.setUint8(6, 100);

                (await extendedTrigger).triggerChanged(dataView);

                expect(emittedValues).toHaveLength(1);
                expect(emittedValues[0]).toEqual({
                    avgStrokePower: 180,
                    driveDuration: Math.round((2500 / 4096) * 1e6),
                    recoveryDuration: Math.round((4500 / 4096) * 1e6),
                    dragFactor: 100,
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
            beforeEach((): void => {
                vi.useFakeTimers();
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should retry up to 4 times", async (): Promise<void> => {
                service
                    .streamExtended$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        error: (): void => {
                            // no-op
                        },
                    });

                extendedCharacteristicSubject.error(new Error("test error unknown"));

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(mockErgConnectionService.readExtendedCharacteristic).toHaveBeenCalledTimes(4);
                expect(mockErgConnectionService.connectToExtended).toHaveBeenCalledTimes(4);
            });

            it("should delay retry by 2000ms", async (): Promise<void> => {
                service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                extendedCharacteristicSubject.error(new Error("test error unknown"));
                // reset so we have only one call to connect after the timeout
                vi.mocked(mockErgConnectionService.connectToExtended).mockClear();

                await vi.advanceTimersByTimeAsync(2000);

                expect(mockErgConnectionService.connectToExtended).toHaveBeenCalledTimes(1);

                expect(mockErgConnectionService.connectToExtended).toHaveBeenCalledWith(
                    mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                );
            });

            describe("when error message contains 'unknown'", (): void => {
                it("should get GATT from connection service", async (): Promise<void> => {
                    const gattSpy = vi.spyOn(mockBluetoothDevice, "gatt", "get");
                    service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                    extendedCharacteristicSubject.error(new Error("unknown connection issue"));
                    gattSpy.mockClear();
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(gattSpy).toHaveBeenCalled();
                });

                it("should reconnect to extended when GATT available", async (): Promise<void> => {
                    service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                    extendedCharacteristicSubject.error(new Error("unknown connection issue"));
                    vi.mocked(mockErgConnectionService.connectToExtended).mockClear();
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(mockErgConnectionService.connectToExtended).toHaveBeenCalledWith(
                        mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                    );
                });
            });

            describe("should not attempt reconnection", (): void => {
                it("when error message does not contain 'unknown'", async (): Promise<void> => {
                    const connectSpy = mockErgConnectionService.connectToExtended;
                    vi.mocked(connectSpy).mockClear();
                    service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                    extendedCharacteristicSubject.error(new Error("different error"));
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                });

                it("when GATT is unavailable", async (): Promise<void> => {
                    const gattSpy = vi.spyOn(mockBluetoothDevice, "gatt", "get");
                    gattSpy.mockReturnValue(undefined);

                    const connectSpy = mockErgConnectionService.connectToExtended;
                    vi.mocked(connectSpy).mockClear();
                    service.streamExtended$().pipe(takeUntil(destroySubject)).subscribe();

                    extendedCharacteristicSubject.error(new Error("unknown connection issue"));
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                });
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

            expect(emittedValues).toHaveLength(0);
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

                expect(emittedValues).toHaveLength(1);
                expect(emittedValues[0]).toHaveLength(7);
                const expected = [10.5, 15.2, 20.8, 22.1, 24.7, 25.1, 30.7];
                expected.forEach((val: number, idx: number): void => {
                    expect(emittedValues[0][idx], `Value at index ${idx}`).toBeCloseTo(val, 3);
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

                    expect(emittedValues).toHaveLength(1);
                    const expected = [100.5, 200.2, 100.6, 400, 300.8];
                    expected.forEach((val: number, idx: number): void => {
                        expect(emittedValues[0][idx], `Value at index ${idx}`).toBeCloseTo(val, 3);
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

                    expect(emittedValues).toHaveLength(0);

                    (await handleForceTrigger).triggerChanged(createHandleForcesDataView(20, 20, [2.2]));

                    expect(emittedValues).toHaveLength(1);
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
                vi.useFakeTimers();
                handleForceCharacteristicSubject.next(mockHandleForceCharacteristic);
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should retry up to 4 times", async (): Promise<void> => {
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

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(mockErgConnectionService.readHandleForceCharacteristic).toHaveBeenCalledTimes(4);
                expect(mockErgConnectionService.connectToHandleForces).toHaveBeenCalledTimes(4);
            });

            it("should delay retry by 2000ms", async (): Promise<void> => {
                service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                handleForceCharacteristicSubject.error(new Error("test error unknown"));
                vi.mocked(mockErgConnectionService.connectToHandleForces).mockClear();

                await vi.advanceTimersByTimeAsync(2000);

                expect(mockErgConnectionService.connectToHandleForces).toHaveBeenCalledWith(
                    mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                );
            });

            describe("when error message contains 'unknown'", (): void => {
                it("should get GATT from connection service", async (): Promise<void> => {
                    const gattSpy = vi.spyOn(mockBluetoothDevice, "gatt", "get");

                    service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                    handleForceCharacteristicSubject.error(new Error("unknown connection issue"));
                    gattSpy.mockClear();
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(gattSpy).toHaveBeenCalled();
                });

                it("should reconnect to handle forces when GATT available", async (): Promise<void> => {
                    service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                    handleForceCharacteristicSubject.error(new Error("unknown connection issue"));
                    vi.mocked(mockErgConnectionService.connectToHandleForces).mockClear();
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(mockErgConnectionService.connectToHandleForces).toHaveBeenCalledWith(
                        mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                    );
                });
            });

            describe("should not attempt reconnection", (): void => {
                it("when error message does not contain 'unknown'", async (): Promise<void> => {
                    const connectSpy = mockErgConnectionService.connectToHandleForces;
                    vi.mocked(connectSpy).mockClear();

                    service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                    handleForceCharacteristicSubject.error(new Error("different error"));
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                });

                it("when GATT is unavailable", async (): Promise<void> => {
                    const gattSpy = vi.spyOn(mockBluetoothDevice, "gatt", "get");
                    gattSpy.mockReturnValue(undefined);

                    const connectSpy = mockErgConnectionService.connectToHandleForces;
                    vi.mocked(connectSpy).mockClear();
                    service.streamHandleForces$().pipe(takeUntil(destroySubject)).subscribe();

                    handleForceCharacteristicSubject.error(new Error("unknown connection issue"));
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                });
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

                expect(emittedValues).toHaveLength(0);
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

                expect(emittedValues).toHaveLength(1);
                expect(emittedValues[0]).toEqual(
                    expect.objectContaining({
                        distance: expectedMetrics.distance,
                        strokeCount: expectedMetrics.strokeCount,
                    }),
                );
                expect(
                    Math.abs(emittedValues[0].revTime - expectedMetrics.revTime),
                    `revTime: ${emittedValues[0].revTime} -> ${expectedMetrics.revTime}`,
                ).toBeLessThanOrEqual(200);
                expect(
                    Math.abs(emittedValues[0].strokeTime - expectedMetrics.strokeTime),
                    `strokeTime: ${emittedValues[0].strokeTime} -> ${expectedMetrics.strokeTime}`,
                ).toBeLessThanOrEqual(200);
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
                        }: {
                            expectedMetrics: Array<IBaseMetrics>;
                            metricsDataViews: Array<DataView>;
                        } = createMeasurementDataViews(deltaMetrics, createFTMSMeasurementDataView);
                        mockMeasurementUUID.mockReturnValue(
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

                        expect(emittedValues).toHaveLength(3);
                        expectedMetrics.forEach((expectedMetric: IBaseMetrics, index: number): void => {
                            expect(emittedValues[index]).toEqual(
                                expect.objectContaining({
                                    distance: expectedMetric.distance,
                                    strokeCount: expectedMetric.strokeCount,
                                }),
                            );
                            expect(
                                Math.abs(emittedValues[index].revTime - expectedMetric.revTime),
                                `revTime[${index}]: ${emittedValues[index].revTime} -> ${expectedMetric.revTime}`,
                            ).toBeLessThanOrEqual(20 * 1000); // so within 33 milliseconds which is due to rounding
                            expect(
                                Math.abs(emittedValues[index].strokeTime - expectedMetric.strokeTime),
                                `strokeTime[${index}]: ${emittedValues[index].strokeTime} -> ${expectedMetric.strokeTime}`,
                            ).toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                        });
                    });

                    it("when service is Cycling Power", async (): Promise<void> => {
                        const emittedValues: Array<IBaseMetrics> = [];
                        const {
                            expectedMetrics: expectedMetricsCPS,
                            metricsDataViews: metricsDataViewsCPS,
                        }: {
                            expectedMetrics: Array<IBaseMetrics>;
                            metricsDataViews: Array<DataView>;
                        } = createMeasurementDataViews(deltaMetrics, createCPSMeasurementDataView);
                        mockMeasurementUUID.mockReturnValue(
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

                        expect(emittedValues).toHaveLength(3);
                        expectedMetricsCPS.forEach((expectedMetric: IBaseMetrics, index: number): void => {
                            expect(emittedValues[index]).toEqual(
                                expect.objectContaining({
                                    distance: expectedMetric.distance,
                                    strokeCount: expectedMetric.strokeCount,
                                }),
                            );
                            expect(
                                Math.abs(emittedValues[index].revTime - expectedMetric.revTime),
                                `revTime[${index}]: ${emittedValues[index].revTime} -> ${expectedMetric.revTime}`,
                            ).toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                            expect(
                                Math.abs(emittedValues[index].strokeTime - expectedMetric.strokeTime),
                                `strokeTime[${index}]: ${emittedValues[index].strokeTime} -> ${expectedMetric.strokeTime}`,
                            ).toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                        });
                    });

                    it("when service is Cycling Speed and Cadence", async (): Promise<void> => {
                        const emittedValues: Array<IBaseMetrics> = [];
                        const {
                            expectedMetrics: expectedMetricsCSC,
                            metricsDataViews: metricsDataViewsCSC,
                        }: {
                            expectedMetrics: Array<IBaseMetrics>;
                            metricsDataViews: Array<DataView>;
                        } = createMeasurementDataViews(deltaMetrics, createCSCMeasurementDataView);
                        mockMeasurementUUID.mockReturnValue(
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

                        expect(emittedValues).toHaveLength(3);
                        expectedMetricsCSC.forEach((expectedMetric: IBaseMetrics, index: number): void => {
                            expect(emittedValues[index]).toEqual(
                                expect.objectContaining({
                                    distance: expectedMetric.distance,
                                    strokeCount: expectedMetric.strokeCount,
                                }),
                            );
                            expect(
                                Math.abs(emittedValues[index].revTime - expectedMetric.revTime),
                                `revTime[${index}]: ${emittedValues[index].revTime} -> ${expectedMetric.revTime}`,
                            ).toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                            expect(
                                Math.abs(emittedValues[index].strokeTime - expectedMetric.strokeTime),
                                `strokeTime[${index}]: ${emittedValues[index].strokeTime} -> ${expectedMetric.strokeTime}`,
                            ).toBeLessThanOrEqual(20 * 1000); // so within 20 milliseconds which is due to rounding
                        });
                    });
                });

                it("should apply distinctUntilChanged based on distance and stroke count", async (): Promise<void> => {
                    const emittedValues: Array<IBaseMetrics> = [];
                    const {
                        metricsDataViews,
                    }: {
                        metricsDataViews: Array<DataView>;
                    } = createMeasurementDataViews(
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

                    expect(emittedValues).toHaveLength(3);
                });

                it("should emit the last data 4.5s after the last emission", async (): Promise<void> => {
                    vi.useFakeTimers();
                    const emittedValues: Array<IBaseMetrics> = [];

                    service
                        .streamMeasurement$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe({
                            next: (value: IBaseMetrics): void => {
                                emittedValues.push(value);
                            },
                        });

                    const handler = await measurementTrigger;
                    handler.triggerChanged(createCPSMeasurementDataView(createBaseMetrics()));
                    expect(emittedValues).toHaveLength(1);
                    await vi.advanceTimersByTimeAsync(4500);
                    expect(emittedValues).toHaveLength(2);
                    vi.useRealTimers();
                });

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
                vi.useFakeTimers();
                measurementCharacteristicSubject.next(mockMeasurementCharacteristic);
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should retry up to 4 times", async (): Promise<void> => {
                service
                    .streamMeasurement$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        error: (): void => {
                            // no-op
                        },
                    });

                measurementCharacteristicSubject.error(new Error("test error unknown"));

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(mockErgConnectionService.readMeasurementCharacteristic).toHaveBeenCalledTimes(4);
                expect(mockErgConnectionService.connectToMeasurement).toHaveBeenCalledTimes(4);
            });

            it("should delay retry by 2000ms", async (): Promise<void> => {
                service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                measurementCharacteristicSubject.error(new Error("test error unknown"));
                // reset so we have only one call to connect after the timeout
                vi.mocked(mockErgConnectionService.connectToMeasurement).mockClear();

                await vi.advanceTimersByTimeAsync(2000);

                expect(mockErgConnectionService.connectToMeasurement).toHaveBeenCalledTimes(1);

                expect(mockErgConnectionService.connectToMeasurement).toHaveBeenCalledWith(
                    mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                );
            });

            describe("when error message contains 'unknown'", (): void => {
                it("should get GATT from connection service", async (): Promise<void> => {
                    const gattSpy = vi.spyOn(mockBluetoothDevice, "gatt", "get");

                    service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                    measurementCharacteristicSubject.error(new Error("unknown connection issue"));
                    gattSpy.mockClear();
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(gattSpy).toHaveBeenCalled();
                });

                it("should reconnect to measurement when GATT available", async (): Promise<void> => {
                    service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                    measurementCharacteristicSubject.error(new Error("unknown connection issue"));
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(mockErgConnectionService.connectToMeasurement).toHaveBeenCalledWith(
                        mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
                    );
                });
            });

            describe("should not attempt reconnection", (): void => {
                it("when error message does not contain 'unknown'", async (): Promise<void> => {
                    const connectSpy = mockErgConnectionService.connectToMeasurement;
                    vi.mocked(connectSpy).mockClear();

                    service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                    measurementCharacteristicSubject.error(new Error("different error"));
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                });

                it("when GATT is unavailable", async (): Promise<void> => {
                    const gattSpy = vi.spyOn(mockBluetoothDevice, "gatt", "get");
                    gattSpy.mockReturnValue(undefined);

                    const connectSpy = mockErgConnectionService.connectToMeasurement;
                    vi.mocked(connectSpy).mockClear();

                    service.streamMeasurement$().pipe(takeUntil(destroySubject)).subscribe();

                    measurementCharacteristicSubject.error(new Error("unknown connection issue"));
                    await vi.advanceTimersByTimeAsync(2000);

                    expect(connectSpy).not.toHaveBeenCalled();
                });
            });
        });
    });
});
