import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject, firstValueFrom, skip, Subject, takeUntil } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { BATTERY_LEVEL_SERVICE, HEART_RATE_SERVICE } from "../../ble.interfaces";
import { IHeartRate, IHRConnectionStatus } from "../../common.interfaces";
import {
    changedListenerReadyFactory,
    createBatteryDataView,
    createHeartRateDataView,
    createMockBluetoothDevice,
    createMockCharacteristic,
    ListenerTrigger,
    visibilityChangeListenerReady,
} from "../ble.test.helpers";
import { ConfigManagerService } from "../config-manager.service";

import { BLEHeartRateService } from "./ble-heart-rate.service";

describe("BLEHeartRateService", (): void => {
    const destroySubject: Subject<void> = new Subject<void>();

    let service: BLEHeartRateService;
    let mockConfigManager: Pick<ConfigManagerService, "getItem" | "setItem">;
    let mockSnackBar: Pick<MatSnackBar, "open">;
    let mockBluetooth: Mock;
    let mockBluetoothDevice: BluetoothDevice;
    let mockHeartRateCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockBatteryCharacteristic: BluetoothRemoteGATTCharacteristic;

    let createHeartRateValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView>>;
    let createBatteryValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView<ArrayBufferLike>>>;
    let createDeviceDisconnectListenerReady: () => Promise<ListenerTrigger<void>>;
    let createAdvertisementReceivedListenerReady: () => Promise<ListenerTrigger<BluetoothAdvertisingEvent>>;

    beforeEach((): void => {
        mockConfigManager = {
            getItem: vi.fn(),
            setItem: vi.fn(),
        };
        mockSnackBar = {
            open: vi.fn(),
        };

        mockBluetoothDevice = createMockBluetoothDevice();
        mockHeartRateCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockBatteryCharacteristic = createMockCharacteristic(mockBluetoothDevice);

        createBatteryValueChangedListenerReady = changedListenerReadyFactory(
            mockBatteryCharacteristic,
            "characteristicvaluechanged",
        );
        createDeviceDisconnectListenerReady = changedListenerReadyFactory(
            mockBluetoothDevice,
            "gattserverdisconnected",
        );
        createAdvertisementReceivedListenerReady = changedListenerReadyFactory(
            mockBluetoothDevice,
            "advertisementreceived",
        );
        createHeartRateValueChangedListenerReady = changedListenerReadyFactory(
            mockHeartRateCharacteristic,
            "characteristicvaluechanged",
        );

        // setup default mock returns
        vi.mocked(mockConfigManager.getItem).mockReturnValue("test-device-id");
        vi.mocked(mockBluetoothDevice.gatt!.connect).mockResolvedValue(
            mockBluetoothDevice.gatt as BluetoothRemoteGATTServer,
        );
        vi.mocked(mockBluetoothDevice.gatt!.getPrimaryService).mockImplementation(
            (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                if (service === HEART_RATE_SERVICE) {
                    return Promise.resolve(mockHeartRateCharacteristic.service);
                }
                if (service === BATTERY_LEVEL_SERVICE) {
                    return Promise.resolve(mockBatteryCharacteristic.service);
                }

                return Promise.reject(new Error(`Service ${service} not found`));
            },
        );
        vi.mocked(mockHeartRateCharacteristic.service.getCharacteristic).mockResolvedValue(
            mockHeartRateCharacteristic,
        );
        vi.mocked(mockBatteryCharacteristic.service.getCharacteristic).mockResolvedValue(
            mockBatteryCharacteristic,
        );
        vi.mocked(mockBatteryCharacteristic.readValue).mockResolvedValue(createBatteryDataView(20));
        mockBluetooth = vi.spyOn(navigator, "bluetooth", "get").mockReturnValue({
            requestDevice: vi.fn().mockResolvedValue(mockBluetoothDevice),
            getDevices: vi.fn().mockResolvedValue([mockBluetoothDevice]),
        } as unknown as Bluetooth);

        vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

        TestBed.configureTestingModule({
            providers: [
                BLEHeartRateService,
                { provide: ConfigManagerService, useValue: mockConfigManager },
                { provide: MatSnackBar, useValue: mockSnackBar },
                provideZonelessChangeDetection(),
            ],
        });

        service = TestBed.inject(BLEHeartRateService);
    });

    afterEach((): void => {
        destroySubject.next();
        destroySubject.complete();
    });

    describe("connectionStatus$ method", (): void => {
        it("should return observable of connection status", async (): Promise<void> => {
            const status$ = service.connectionStatus$();
            expect(status$).toBeDefined();

            const status = await firstValueFrom(status$.pipe(takeUntil(destroySubject)));

            expect(status).toEqual(
                expect.objectContaining({
                    status: expect.any(String),
                }),
            );
        });

        it("should emit current connection status", (): void => {
            const statuses: Array<IHRConnectionStatus> = [];

            service
                .connectionStatus$()
                .pipe(takeUntil(destroySubject))
                .subscribe((status: IHRConnectionStatus): void => {
                    statuses.push(status);
                });

            expect(statuses).toContainEqual(expect.objectContaining({ status: "disconnected" }));
        });

        it("should emit status changes", (): void => {
            const statuses: Array<IHRConnectionStatus> = [];

            (
                service as unknown as {
                    connectionStatusSubject: BehaviorSubject<IHRConnectionStatus>;
                }
            ).connectionStatusSubject.next({ status: "connecting" });

            service
                .connectionStatus$()
                .pipe(takeUntil(destroySubject))
                .subscribe((status: IHRConnectionStatus): void => {
                    statuses.push(status);
                });

            expect(statuses.length).toBeGreaterThan(0);
            expect(statuses[statuses.length - 1]).toEqual({ status: "connecting" });
        });
    });

    describe("disconnectDevice method", (): void => {
        it("should reset device to undefined", async (): Promise<void> => {
            const bluetoothDeviceSpy = service as unknown as {
                bluetoothDevice: BluetoothDevice | undefined;
            };
            bluetoothDeviceSpy.bluetoothDevice = mockBluetoothDevice;

            await service.disconnectDevice();

            expect(bluetoothDeviceSpy.bluetoothDevice).toBeUndefined();
        });

        describe("when bluetooth device is undefined", (): void => {
            it("should resolve immediately", async (): Promise<void> => {
                await expect(service.disconnectDevice()).resolves.not.toThrow();
            });

            it("should reset characteristics to undefined", async (): Promise<void> => {
                const batteryCharacteristicSpy = service as unknown as {
                    batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
                };
                const heartRateCharacteristicSpy = service as unknown as {
                    heartRateCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
                };
                batteryCharacteristicSpy.batteryCharacteristic.next(mockBatteryCharacteristic);
                heartRateCharacteristicSpy.heartRateCharacteristic.next(mockHeartRateCharacteristic);

                await service.disconnectDevice();

                expect(batteryCharacteristicSpy.batteryCharacteristic.value).toBeUndefined();

                expect(heartRateCharacteristicSpy.heartRateCharacteristic.value).toBeUndefined();
            });

            it("should abort cancellation token", async (): Promise<void> => {
                const abortSpy = vi.spyOn(AbortController.prototype, "abort");
                await service.disconnectDevice();
                expect(abortSpy).toHaveBeenCalled();
            });

            it("should emit disconnected status", async (): Promise<void> => {
                const status = firstValueFrom(
                    service.connectionStatus$().pipe(skip(1), takeUntil(destroySubject)),
                );

                await service.disconnectDevice();

                expect((await status).status).toBe("disconnected");
            });
        });

        it("when bluetooth device is not connected should resolve immediately without calling disconnect", async (): Promise<void> => {
            await service.disconnectDevice();

            expect(mockBluetoothDevice.gatt?.disconnect).not.toHaveBeenCalled();
        });

        describe("when bluetooth device is connected", (): void => {
            beforeEach(async (): Promise<void> => {
                (
                    service as unknown as {
                        bluetoothDevice: BluetoothDevice;
                    }
                ).bluetoothDevice = mockBluetoothDevice;
                vi.spyOn(mockBluetoothDevice.gatt!, "connected", "get").mockReturnValue(true);
                vi.mocked(mockBluetoothDevice.gatt!.disconnect).mockReturnValue();
            });

            it("should call gatt disconnect", async (): Promise<void> => {
                const disconnectTrigger = createDeviceDisconnectListenerReady();
                const disconnectPromise = service.disconnectDevice();

                // trigger the disconnect event to resolve the promise
                (await disconnectTrigger).triggerChanged();
                await disconnectPromise;

                expect(mockBluetoothDevice.gatt?.disconnect).toHaveBeenCalled();
            });

            it("should wait for disconnection event", async (): Promise<void> => {
                const disconnectTrigger = createDeviceDisconnectListenerReady();
                const disconnectPromise = service.disconnectDevice();

                // trigger disconnect and verify it resolves
                (await disconnectTrigger).triggerChanged();

                await expect(disconnectPromise).resolves.not.toThrow();
            });

            it("should reset all state after disconnection", async (): Promise<void> => {
                const disconnectTrigger = createDeviceDisconnectListenerReady();
                const disconnectPromise = service.disconnectDevice();

                (await disconnectTrigger).triggerChanged();
                await disconnectPromise;

                const device = (
                    service as unknown as {
                        bluetoothDevice: BluetoothDevice | undefined;
                    }
                ).bluetoothDevice;
                expect(device).toBeUndefined();

                const status = await firstValueFrom(
                    service.connectionStatus$().pipe(takeUntil(destroySubject)),
                );

                expect(status.status).toBe("disconnected");
            });
        });
    });

    describe("discover method", (): void => {
        describe("when device selection is successful", (): void => {
            let connectSpy: Mock;
            let disconnectSpy: Mock;

            beforeEach((): void => {
                connectSpy = vi
                    .spyOn(
                        service as unknown as {
                            connect: () => Promise<void>;
                        },
                        "connect",
                    )
                    .mockResolvedValue();
                disconnectSpy = vi.spyOn(service, "disconnectDevice").mockResolvedValue();
                mockBluetooth.mockReturnValue({
                    requestDevice: vi.fn().mockResolvedValue(mockBluetoothDevice),
                    getDevices: vi.fn().mockResolvedValue([]),
                } as unknown as Bluetooth);
            });

            it("should call disconnectDevice first", async (): Promise<void> => {
                await service.discover();

                expect(Math.min(...disconnectSpy.mock.invocationCallOrder)).toBeLessThan(
                    Math.min(...connectSpy.mock.invocationCallOrder),
                );
            });

            it("should request device with correct filters", async (): Promise<void> => {
                await service.discover();

                expect(navigator.bluetooth.requestDevice).toHaveBeenCalledWith({
                    acceptAllDevices: false,
                    filters: [{ services: [HEART_RATE_SERVICE] }],
                    optionalServices: [BATTERY_LEVEL_SERVICE],
                });
            });

            it("should include battery service as optional", async (): Promise<void> => {
                await service.discover();

                const args = vi.mocked(navigator.bluetooth.requestDevice).mock.calls[0][0];
                expect(args!.optionalServices).toContain(BATTERY_LEVEL_SERVICE);
            });

            it("should call connect with selected device", async (): Promise<void> => {
                await service.discover();

                expect(connectSpy).toHaveBeenCalledWith(mockBluetoothDevice);
            });

            it("should resolve when connection succeeds", async (): Promise<void> => {
                await expect(service.discover()).resolves.not.toThrow();
            });
        });

        describe("when device selection is cancelled", (): void => {
            let reconnectSpy: Mock;

            beforeEach((): void => {
                reconnectSpy = vi
                    .spyOn(
                        service as unknown as {
                            reconnect: () => Promise<void>;
                        },
                        "reconnect",
                    )
                    .mockResolvedValue();
                mockBluetooth.mockReturnValue({
                    requestDevice: vi.fn().mockRejectedValue(new Error("User cancelled device selection")),
                    getDevices: vi.fn().mockResolvedValue([]),
                } as unknown as Bluetooth);
            });

            it("should call reconnect as fallback", async (): Promise<void> => {
                await service.discover();

                expect(reconnectSpy).toHaveBeenCalled();
            });

            it("should not throw error", async (): Promise<void> => {
                await expect(service.discover()).resolves.not.toThrow();
            });
        });

        describe("when device selection throws error", (): void => {
            let reconnectSpy: Mock;

            beforeEach((): void => {
                reconnectSpy = vi
                    .spyOn(
                        service as unknown as {
                            reconnect: () => Promise<void>;
                        },
                        "reconnect",
                    )
                    .mockResolvedValue();
                mockBluetooth.mockReturnValue({
                    requestDevice: vi.fn().mockRejectedValue(new Error("Bluetooth error")),
                    getDevices: vi.fn().mockResolvedValue([]),
                } as unknown as Bluetooth);
            });

            it("should handle error gracefully", async (): Promise<void> => {
                await expect(service.discover()).resolves.not.toThrow();
            });

            it("should attempt reconnect", async (): Promise<void> => {
                await service.discover();

                expect(reconnectSpy).toHaveBeenCalled();
            });
        });
    });

    describe("reconnect method", (): void => {
        describe("when paired device exists", (): void => {
            beforeEach((): void => {
                vi.mocked(mockConfigManager.getItem).mockReturnValue("test-device-id");
            });

            it("should call disconnectDevice first", async (): Promise<void> => {
                const disconnectSpy = vi.spyOn(service, "disconnectDevice").mockResolvedValue();

                await service.reconnect();

                expect(disconnectSpy).toHaveBeenCalled();
            });

            it("should get stored device ID from config", async (): Promise<void> => {
                await service.reconnect();

                expect(mockConfigManager.getItem).toHaveBeenCalledWith("heartRateBleId");
            });

            it("should get device by stored ID", async (): Promise<void> => {
                const getDevicesSpy = vi.mocked(navigator.bluetooth.getDevices);
                getDevicesSpy.mockResolvedValue([mockBluetoothDevice, {} as BluetoothDevice]);

                await service.reconnect();

                expect(getDevicesSpy).toHaveBeenCalled();
                expect(
                    mockBluetoothDevice.watchAdvertisements,
                    "Empty device was selected from the list",
                ).toHaveBeenCalled();
            });

            it("should start watching advertisements", async (): Promise<void> => {
                await service.reconnect();

                expect(mockBluetoothDevice.watchAdvertisements).toHaveBeenCalled();
            });

            it("should set connection status to searching", async (): Promise<void> => {
                const statuses: Array<IHRConnectionStatus> = [];
                service
                    .connectionStatus$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((status: IHRConnectionStatus): void => {
                        statuses.push(status);
                    });

                await service.reconnect();

                expect(statuses[statuses.length - 1]).toEqual({ status: "searching" });
            });

            it("should setup advertisement handler", async (): Promise<void> => {
                const advertisementReady = createAdvertisementReceivedListenerReady();

                await service.reconnect();

                await expect(advertisementReady).resolves.not.toThrow();
            });
        });

        describe("when no paired device exists", (): void => {
            beforeEach((): void => {
                vi.mocked(mockConfigManager.getItem).mockReturnValue("");
            });

            it("should return early without further action", async (): Promise<void> => {
                await service.reconnect();

                expect(mockBluetoothDevice.watchAdvertisements).not.toHaveBeenCalled();
            });

            it("should not call watchAdvertisements", async (): Promise<void> => {
                await service.reconnect();

                expect(mockBluetoothDevice.watchAdvertisements).not.toHaveBeenCalled();
            });

            it("should not change connection status", async (): Promise<void> => {
                let statuses: Array<IHRConnectionStatus> = [];

                service
                    .connectionStatus$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((status: IHRConnectionStatus): void => {
                        statuses.push(status);
                    });

                await service.reconnect();
                await service.reconnect();

                expect(statuses).toHaveLength(3);
                expect(
                    statuses.every(
                        (status: IHRConnectionStatus): boolean => status.status === "disconnected",
                    ),
                ).toBe(true);
            });
        });

        describe("when watchAdvertisements fails", (): void => {
            beforeEach((): void => {
                vi.mocked(mockConfigManager.getItem).mockReturnValue("test-device-id");
                vi.mocked(navigator.bluetooth.getDevices).mockResolvedValue([mockBluetoothDevice]);
                vi.mocked(mockBluetoothDevice.watchAdvertisements).mockRejectedValueOnce(
                    new Error("Advertisement failed"),
                );
            });

            it("should handle error by calling reconnect again", async (): Promise<void> => {
                const reconnectSpy = vi.spyOn(service, "reconnect");

                await service.reconnect();

                expect(reconnectSpy).toHaveBeenCalledTimes(2);
            });

            it("should not throw unhandled error", async (): Promise<void> => {
                await expect(service.reconnect()).resolves.not.toThrow();
            });
        });

        describe("when document visibility changes", (): void => {
            beforeEach((): void => {
                vi.mocked(mockConfigManager.getItem).mockReturnValue("test-device-id");
                vi.mocked(navigator.bluetooth.getDevices).mockResolvedValue([mockBluetoothDevice]);
                vi.mocked(mockBluetoothDevice.watchAdvertisements).mockResolvedValue(undefined);
            });

            it("should restart connection on visibility change to visible", async (): Promise<void> => {
                const visibilityChangeReady = visibilityChangeListenerReady();
                await service.reconnect();
                vi.mocked(mockBluetoothDevice.watchAdvertisements).mockClear();

                (await visibilityChangeReady).triggerChanged();

                expect(mockBluetoothDevice.watchAdvertisements).toHaveBeenCalled();
            });

            it("should not restart when visibility changes to hidden", async (): Promise<void> => {
                const visibilityChangeReady = visibilityChangeListenerReady("hidden");
                await service.reconnect();
                vi.mocked(mockBluetoothDevice.watchAdvertisements).mockClear();

                (await visibilityChangeReady).triggerChanged();

                expect(mockBluetoothDevice.watchAdvertisements).not.toHaveBeenCalled();
            });

            it("should stop watching when connection status changes", async (): Promise<void> => {
                const visibilityChangeReady = visibilityChangeListenerReady();
                await service.reconnect();
                (
                    service as unknown as {
                        connectionStatusSubject: BehaviorSubject<IHRConnectionStatus>;
                    }
                ).connectionStatusSubject.next({
                    status: "connecting",
                    deviceName: mockBluetoothDevice.name,
                });
                vi.mocked(mockBluetoothDevice.watchAdvertisements).mockClear();

                (await visibilityChangeReady).triggerChanged("visible");

                expect(mockBluetoothDevice.watchAdvertisements).not.toHaveBeenCalled();
            });
        });
    });

    describe("streamHRMonitorBatteryLevel$ method", (): void => {
        describe("when battery characteristic is undefined", (): void => {
            it("should start with undefined", async (): Promise<void> => {
                const batteryLevel = await firstValueFrom(
                    service.streamHRMonitorBatteryLevel$().pipe(takeUntil(destroySubject)),
                );

                expect(batteryLevel).toBeUndefined();
            });
        });

        describe("when battery characteristic is available", (): void => {
            beforeEach((): void => {
                (
                    service as unknown as {
                        batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
                    }
                ).batteryCharacteristic.next(mockBatteryCharacteristic);
            });

            describe("and battery readings are successful", (): void => {
                const mockBatteryData = createBatteryDataView(85);
                let result: number | undefined;

                let batteryValueChangeReady: ListenerTrigger<DataView>;
                let disconnectReady: ListenerTrigger<void>;

                beforeEach(async (): Promise<void> => {
                    const disconnectReadyPromise = createDeviceDisconnectListenerReady();
                    const batteryValueChangeReadyPromise = createBatteryValueChangedListenerReady();

                    service
                        .streamHRMonitorBatteryLevel$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe((batteryLevel: number | undefined): void => {
                            result = batteryLevel;
                        });

                    disconnectReady = await disconnectReadyPromise;
                    batteryValueChangeReady = await batteryValueChangeReadyPromise;
                });

                it("should parse and merge notifications with initial read", (): void => {
                    expect(result).toBe(20);

                    batteryValueChangeReady.triggerChanged(mockBatteryData);

                    expect(result).toBe(85);
                });

                it("should end with undefined on complete", async (): Promise<void> => {
                    expect(result).toBeDefined();

                    disconnectReady.triggerChanged();

                    expect(result).toBeUndefined();
                });

                it("should reset battery characteristic on finalize", (): void => {
                    const batteryCharacteristicSpy = vi.spyOn(
                        (
                            service as unknown as {
                                batteryCharacteristic: BehaviorSubject<
                                    BluetoothRemoteGATTCharacteristic | undefined
                                >;
                            }
                        ).batteryCharacteristic,
                        "next",
                    );

                    disconnectReady.triggerChanged();

                    expect(batteryCharacteristicSpy).toHaveBeenCalledTimes(1);

                    expect(batteryCharacteristicSpy).toHaveBeenCalledWith(undefined);
                });
            });

            describe("when battery readings fail", (): void => {
                beforeEach((): void => {
                    vi.mocked(mockBatteryCharacteristic.readValue).mockRejectedValue(
                        new Error("Read failed"),
                    );
                });

                it("should handle readValue errors", async (): Promise<void> => {
                    const batteryValueChangeReady = createBatteryValueChangedListenerReady();
                    const batteryLevel = firstValueFrom(
                        service.streamHRMonitorBatteryLevel$().pipe(takeUntil(destroySubject)),
                    );

                    (await batteryValueChangeReady).triggerChanged(createBatteryDataView(50));

                    expect(await batteryLevel).toBeUndefined();
                });

                it("should still finalize properly", async (): Promise<void> => {
                    vi.useFakeTimers();
                    const batteryCharacteristicSpy = vi.spyOn(
                        (
                            service as unknown as {
                                batteryCharacteristic: BehaviorSubject<
                                    BluetoothRemoteGATTCharacteristic | undefined
                                >;
                            }
                        ).batteryCharacteristic,
                        "next",
                    );
                    const heartRateBatteryLevel = firstValueFrom(
                        service.streamHRMonitorBatteryLevel$().pipe(takeUntil(destroySubject)),
                    );

                    await vi.advanceTimersByTimeAsync(4 * 2000);

                    expect(batteryCharacteristicSpy).toHaveBeenCalledExactlyOnceWith(undefined);
                    expect(await heartRateBatteryLevel).toBeUndefined();
                    vi.useRealTimers();
                });
            });
        });

        describe("when battery characteristic errors", (): void => {
            beforeEach((): void => {
                vi.useFakeTimers();
                (
                    service as unknown as {
                        batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
                    }
                ).batteryCharacteristic.next(mockBatteryCharacteristic);
                vi.mocked(mockBatteryCharacteristic.readValue).mockRejectedValue(
                    new Error("Read failed unknown"),
                );
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should retry up to 4 times", async (): Promise<void> => {
                const batteryCharacteristicSpy = vi.spyOn(
                    (
                        service as unknown as {
                            batteryCharacteristic: BehaviorSubject<
                                BluetoothRemoteGATTCharacteristic | undefined
                            >;
                        }
                    ).batteryCharacteristic,
                    "next",
                );

                service.streamHRMonitorBatteryLevel$().pipe(takeUntil(destroySubject)).subscribe();
                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(
                    vi
                        .mocked(batteryCharacteristicSpy)
                        .mock.calls.filter(
                            ([args]: [BluetoothRemoteGATTCharacteristic | undefined]): boolean =>
                                args === undefined,
                        ),
                ).toEqual([[undefined], [undefined], [undefined], [undefined], [undefined]]);
            });

            it("should reconnect to battery on retryable errors", async (): Promise<void> => {
                service.streamHRMonitorBatteryLevel$().pipe(takeUntil(destroySubject)).subscribe();

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(mockBatteryCharacteristic.service.getCharacteristic).toHaveBeenCalledTimes(4);
            });

            it("should emit only two undefined value", async (): Promise<void> => {
                const results: Array<number | undefined> = [];
                service
                    .streamHRMonitorBatteryLevel$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((value: number | undefined): void => {
                        results.push(value);
                    });

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(results, "Start with undefined and finalize with undefined").toEqual([
                    undefined,
                    undefined,
                ]);
            });

            it("should show error snackbar on final error", async (): Promise<void> => {
                service.streamHRMonitorBatteryLevel$().pipe(takeUntil(destroySubject)).subscribe();

                await vi.advanceTimersByTimeAsync(3 * 2000);

                expect(mockSnackBar.open).not.toHaveBeenCalled();
                await vi.advanceTimersByTimeAsync(1 * 2000);
                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    expect.stringContaining("Error while connecting to"),
                    "Dismiss",
                );
            });
        });
    });

    describe("streamHeartRate$ method", (): void => {
        describe("when heart rate characteristic is undefined", (): void => {
            it("should start with undefined", (): void => {
                service
                    .streamHeartRate$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((heartRate: IHeartRate | undefined): void => {
                        expect(heartRate).toBeUndefined();
                    });
            });
        });

        describe("when heart rate characteristic is available", (): void => {
            const mockDefaultHrData = createHeartRateDataView(140);
            const mockDefaultBatteryData = createBatteryDataView(75);
            let heartRateValueChangeReady: Promise<ListenerTrigger<DataView>>;
            let batteryValueChangeReady: Promise<ListenerTrigger<DataView>>;

            beforeEach((): void => {
                (
                    service as unknown as {
                        heartRateCharacteristic: BehaviorSubject<
                            BluetoothRemoteGATTCharacteristic | undefined
                        >;
                    }
                ).heartRateCharacteristic.next(mockHeartRateCharacteristic);

                heartRateValueChangeReady = createHeartRateValueChangedListenerReady();
                batteryValueChangeReady = createBatteryValueChangedListenerReady();
            });

            describe("and heart rate is 8-bit format", (): void => {
                let result: IHeartRate | undefined;
                const data = createHeartRateDataView(120, {
                    is16Bit: false,
                    energyExpended: 0,
                    rrIntervals: [],
                });
                let triggerHandler: ListenerTrigger<DataView>;

                beforeEach(async (): Promise<void> => {
                    service
                        .streamHeartRate$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            result = heartRate;
                        });

                    triggerHandler = await heartRateValueChangeReady;
                    triggerHandler.triggerChanged(data);
                });

                it("should parse 8-bit heart rate value", (): void => {
                    expect(result?.heartRate).toBe(120);
                });

                it("should default contact detected to true", (): void => {
                    expect(result?.contactDetected).toBe(true);
                });
            });

            describe("and heart rate is 16-bit format", (): void => {
                const data = createHeartRateDataView(300, {
                    is16Bit: true,
                    energyExpended: 0,
                    rrIntervals: [],
                });
                let result: IHeartRate | undefined;
                let triggerHandler: ListenerTrigger<DataView>;

                beforeEach(async (): Promise<void> => {
                    service
                        .streamHeartRate$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            result = heartRate;
                        });

                    triggerHandler = await heartRateValueChangeReady;
                    triggerHandler.triggerChanged(data);
                });

                it("should parse 16-bit heart rate value", (): void => {
                    expect(result?.heartRate).toBe(300);
                });

                it("should handle values above 255", async (): Promise<void> => {
                    triggerHandler.triggerChanged(
                        createHeartRateDataView(400, {
                            is16Bit: true,
                            energyExpended: 0,
                            rrIntervals: [],
                        }),
                    );

                    expect(result?.heartRate).toBe(400);
                });
            });

            describe("and contact sensor data is present", (): void => {
                const data = createHeartRateDataView(120, {
                    hasContactSensor: true,
                    isContactDetected: true,
                    energyExpended: 0,
                    rrIntervals: [],
                });
                let result: IHeartRate | undefined;
                let triggerHandler: ListenerTrigger<DataView>;

                beforeEach(async (): Promise<void> => {
                    service
                        .streamHeartRate$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            result = heartRate;
                        });

                    triggerHandler = await heartRateValueChangeReady;
                    triggerHandler.triggerChanged(data);
                });

                it("should set contact detected to true when flag is set", (): void => {
                    expect(result?.contactDetected).toBe(true);
                });

                it("should set contact detected to false when flag is not set", (): void => {
                    triggerHandler.triggerChanged(
                        createHeartRateDataView(120, {
                            hasContactSensor: true,
                            isContactDetected: false,
                            energyExpended: 0,
                            rrIntervals: [],
                        }),
                    );

                    expect(result?.contactDetected).toBe(false);
                });

                it("should ignore contact detected when sensor not present", (): void => {
                    triggerHandler.triggerChanged(
                        createHeartRateDataView(120, {
                            hasContactSensor: false,
                            isContactDetected: false,
                            energyExpended: 0,
                            rrIntervals: [],
                        }),
                    );

                    expect(result?.contactDetected).toBe(true);
                });
            });

            describe("and energy expended data is present", (): void => {
                const data = createHeartRateDataView(120, {
                    hasEnergyExpended: true,
                    energyExpended: 250,
                    rrIntervals: [],
                });
                let result: IHeartRate | undefined;
                let triggerHandler: ListenerTrigger<DataView>;

                beforeEach(async (): Promise<void> => {
                    service
                        .streamHeartRate$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            result = heartRate;
                        });

                    triggerHandler = await heartRateValueChangeReady;
                    triggerHandler.triggerChanged(data);
                });

                it("should parse energy expended value", (): void => {
                    expect(result?.energyExpended).toBe(250);
                });

                it("should include energy expended in result", (): void => {
                    expect(result?.energyExpended).toEqual(250);
                });

                it("should handle zero energy expended", (): void => {
                    triggerHandler.triggerChanged(
                        createHeartRateDataView(120, {
                            hasEnergyExpended: true,
                            energyExpended: 0,
                            rrIntervals: [],
                        }),
                    );
                    expect(result?.energyExpended).toBe(0);
                });
            });

            describe("and energy expended data is not present", (): void => {
                const data = createHeartRateDataView(120, {
                    hasEnergyExpended: false,
                    energyExpended: 0,
                    rrIntervals: [],
                });
                let result: IHeartRate | undefined;
                let triggerHandler: ListenerTrigger<DataView>;

                beforeEach(async (): Promise<void> => {
                    service
                        .streamHeartRate$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            result = heartRate;
                        });

                    triggerHandler = await heartRateValueChangeReady;
                    triggerHandler.triggerChanged(data);
                });

                it("should not include energy expended in result", (): void => {
                    expect(result?.energyExpended).toBeUndefined();
                });
            });

            describe("and RR interval data is present", (): void => {
                const data = createHeartRateDataView(120, {
                    hasRRIntervals: true,
                    energyExpended: 0,
                    rrIntervals: [800],
                });
                let result: IHeartRate | undefined;
                let triggerHandler: ListenerTrigger<DataView>;

                beforeEach(async (): Promise<void> => {
                    service
                        .streamHeartRate$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            result = heartRate;
                        });

                    triggerHandler = await heartRateValueChangeReady;
                    triggerHandler.triggerChanged(data);
                });

                it("should parse single RR interval", (): void => {
                    expect(result?.rrIntervals).toEqual([800]);
                });

                it("should parse multiple RR intervals", (): void => {
                    const expectedIntervals = [800, 820, 790, 810];
                    triggerHandler.triggerChanged(
                        createHeartRateDataView(120, {
                            hasRRIntervals: true,
                            energyExpended: 0,
                            rrIntervals: expectedIntervals,
                        }),
                    );

                    expect(result?.rrIntervals).toEqual(expectedIntervals);
                });

                it("should handle empty RR intervals", (): void => {
                    triggerHandler.triggerChanged(
                        createHeartRateDataView(120, {
                            hasRRIntervals: true,
                            energyExpended: 0,
                            rrIntervals: [],
                        }),
                    );

                    expect(result?.rrIntervals).toHaveLength(0);
                });
            });

            describe("and RR interval data is not present", (): void => {
                const data = createHeartRateDataView(120, {
                    hasRRIntervals: false,
                    energyExpended: 0,
                    rrIntervals: [100],
                });
                let result: IHeartRate | undefined;
                let triggerHandler: ListenerTrigger<DataView>;

                beforeEach(async (): Promise<void> => {
                    service
                        .streamHeartRate$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe((heartRate: IHeartRate | undefined): void => {
                            result = heartRate;
                        });

                    triggerHandler = await heartRateValueChangeReady;
                    triggerHandler.triggerChanged(data);
                });

                it("should not include RR intervals in result", (): void => {
                    expect(result?.rrIntervals).toBeUndefined();
                });
            });

            it("and battery characteristic is not available should set battery level to undefined", async (): Promise<void> => {
                const heartRatePromise = firstValueFrom(
                    service.streamHeartRate$().pipe(skip(1), takeUntil(destroySubject)),
                );

                (await heartRateValueChangeReady).triggerChanged(mockDefaultHrData);
                const heartRate = await heartRatePromise;

                expect(heartRate?.batteryLevel).toBeUndefined();
            });

            it("and battery characteristic is available should merge into heart rate data", async (): Promise<void> => {
                (
                    service as unknown as {
                        batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
                    }
                ).batteryCharacteristic.next(mockBatteryCharacteristic);

                const heartRatePromise = firstValueFrom(
                    service.streamHeartRate$().pipe(skip(1), takeUntil(destroySubject)),
                );

                (await batteryValueChangeReady).triggerChanged(mockDefaultBatteryData);
                (await heartRateValueChangeReady).triggerChanged(mockDefaultHrData);
                const heartRate = await heartRatePromise;

                expect(heartRate?.batteryLevel).toBe(75);
                expect(heartRate?.heartRate).toBe(140);
            });
        });

        describe("when heart rate characteristic errors", (): void => {
            beforeEach(async (): Promise<void> => {
                vi.useFakeTimers();
                (
                    service as unknown as {
                        heartRateCharacteristic: BehaviorSubject<
                            BluetoothRemoteGATTCharacteristic | undefined
                        >;
                    }
                ).heartRateCharacteristic.next(mockHeartRateCharacteristic);

                vi.mocked(mockHeartRateCharacteristic.addEventListener).mockImplementation((): void => {
                    throw new Error("unknown");
                });
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should emit one undefined value", async (): Promise<void> => {
                const heartRate = firstValueFrom(service.streamHeartRate$().pipe(takeUntil(destroySubject)));

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(await heartRate).toBeUndefined();
            });

            it("should still finalize properly", async (): Promise<void> => {
                const results: Array<IHeartRate | undefined> = [];
                const heartRateCharacteristicSpy = vi.spyOn(
                    (
                        service as unknown as {
                            heartRateCharacteristic: BehaviorSubject<
                                BluetoothRemoteGATTCharacteristic | undefined
                            >;
                        }
                    ).heartRateCharacteristic,
                    "next",
                );
                const connectionStatusSpy = vi.spyOn(
                    (
                        service as unknown as {
                            connectionStatusSubject: BehaviorSubject<
                                BluetoothRemoteGATTCharacteristic | undefined
                            >;
                        }
                    ).connectionStatusSubject,
                    "next",
                );
                service
                    .streamHeartRate$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        },
                        error: (): void => {
                            // no-op
                        },
                    });

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(heartRateCharacteristicSpy.mock.calls.length).toBeGreaterThan(4);
                expect(connectionStatusSpy.mock.calls.length).toBeGreaterThan(4);
                expect(results[results.length - 1]).toBeUndefined();
            });

            it("should retry up to 4 times", async (): Promise<void> => {
                const results: Array<IHeartRate | undefined> = [];
                const heartRateCharacteristicSpy = vi.spyOn(
                    (
                        service as unknown as {
                            heartRateCharacteristic: BehaviorSubject<
                                BluetoothRemoteGATTCharacteristic | undefined
                            >;
                        }
                    ).heartRateCharacteristic,
                    "next",
                );
                service
                    .streamHeartRate$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        next: (heartRate: IHeartRate | undefined): void => {
                            results.push(heartRate);
                        },
                        error: (): void => {
                            // no-op
                        },
                    });

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(
                    heartRateCharacteristicSpy.mock.calls.filter(
                        ([args]: [BluetoothRemoteGATTCharacteristic | undefined]): boolean =>
                            args === undefined,
                    ),
                ).toEqual([[undefined], [undefined], [undefined], [undefined], [undefined]]);
            });

            it("should reconnect to heart rate on retryable errors", async (): Promise<void> => {
                service
                    .streamHeartRate$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        error: (): void => {
                            // no-op
                        },
                    });

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(mockHeartRateCharacteristic.service.getCharacteristic).toHaveBeenCalledTimes(4);
            });

            it("should emit only one undefined value", async (): Promise<void> => {
                const heartRate = firstValueFrom(service.streamHeartRate$().pipe(takeUntil(destroySubject)));

                await vi.advanceTimersByTimeAsync(4 * 2000);

                expect(await heartRate).toBeUndefined();
            });
        });
    });
});
