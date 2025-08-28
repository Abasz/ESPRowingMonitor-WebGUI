import { provideZonelessChangeDetection } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject, skip, Subject, takeUntil } from "rxjs";

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
    let mockConfigManager: jasmine.SpyObj<ConfigManagerService>;
    let mockSnackBar: jasmine.SpyObj<MatSnackBar>;
    let mockBluetooth: jasmine.Spy<() => Bluetooth>;
    let mockBluetoothDevice: jasmine.SpyObj<BluetoothDevice>;
    let mockHeartRateCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockBatteryCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;

    let createHeartRateValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView>>;
    let createBatteryValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView<ArrayBufferLike>>>;
    let createDeviceDisconnectListenerReady: () => Promise<ListenerTrigger<void>>;
    let createAdvertisementReceivedListenerReady: () => Promise<ListenerTrigger<BluetoothAdvertisingEvent>>;

    beforeEach((): void => {
        mockConfigManager = jasmine.createSpyObj("ConfigManagerService", ["getItem", "setItem"]);
        mockSnackBar = jasmine.createSpyObj("MatSnackBar", ["open"]);

        mockBluetoothDevice = createMockBluetoothDevice();
        mockHeartRateCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockBatteryCharacteristic = createMockCharacteristic(mockBluetoothDevice);

        createBatteryValueChangedListenerReady = changedListenerReadyFactory<
            typeof mockBatteryCharacteristic,
            DataView
        >(mockBatteryCharacteristic, "characteristicvaluechanged");
        createDeviceDisconnectListenerReady = changedListenerReadyFactory<typeof mockBluetoothDevice, void>(
            mockBluetoothDevice,
            "gattserverdisconnected",
        );
        createAdvertisementReceivedListenerReady = changedListenerReadyFactory<
            typeof mockBluetoothDevice,
            BluetoothAdvertisingEvent
        >(mockBluetoothDevice, "advertisementreceived");
        createHeartRateValueChangedListenerReady = changedListenerReadyFactory<
            typeof mockHeartRateCharacteristic,
            DataView
        >(mockHeartRateCharacteristic, "characteristicvaluechanged");

        // setup default mock returns
        mockConfigManager.getItem.and.returnValue("test-device-id");
        (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).connect.and.resolveTo(
            mockBluetoothDevice.gatt,
        );
        (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).getPrimaryService
            .withArgs(HEART_RATE_SERVICE)
            .and.resolveTo(mockHeartRateCharacteristic.service);
        (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).getPrimaryService
            .withArgs(BATTERY_LEVEL_SERVICE)
            .and.resolveTo(mockBatteryCharacteristic.service);
        (
            mockHeartRateCharacteristic.service as jasmine.SpyObj<BluetoothRemoteGATTService>
        ).getCharacteristic.and.resolveTo(mockHeartRateCharacteristic);
        (
            mockBatteryCharacteristic.service as jasmine.SpyObj<BluetoothRemoteGATTService>
        ).getCharacteristic.and.resolveTo(mockBatteryCharacteristic);
        mockBatteryCharacteristic.readValue.and.resolveTo(createBatteryDataView(20));

        mockBluetooth = spyOnProperty(navigator, "bluetooth", "get").and.returnValue({
            requestDevice: jasmine.createSpy("requestDevice").and.resolveTo(mockBluetoothDevice),
            getDevices: jasmine.createSpy("getDevices").and.resolveTo([mockBluetoothDevice]),
        } as unknown as Bluetooth);

        spyOnProperty(document, "visibilityState", "get").and.returnValue("visible");

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
        it("should return observable of connection status", (): void => {
            const status$ = service.connectionStatus$();
            expect(status$).toBeDefined();

            status$.pipe(takeUntil(destroySubject)).subscribe((status: IHRConnectionStatus): void => {
                expect(status).toEqual(
                    jasmine.objectContaining({
                        status: jasmine.any(String),
                    }),
                );
            });
        });

        it("should emit current connection status", (): void => {
            const statuses: Array<IHRConnectionStatus> = [];

            service
                .connectionStatus$()
                .pipe(takeUntil(destroySubject))
                .subscribe((status: IHRConnectionStatus): void => {
                    statuses.push(status);
                });

            expect(statuses).toContain({ status: "disconnected" });
        });

        it("should emit status changes", (): void => {
            const statuses: Array<IHRConnectionStatus> = [];

            (
                service as unknown as { connectionStatusSubject: BehaviorSubject<IHRConnectionStatus> }
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
            const bluetoothDeviceSpy = service as unknown as { bluetoothDevice: BluetoothDevice | undefined };
            bluetoothDeviceSpy.bluetoothDevice = mockBluetoothDevice;

            await service.disconnectDevice();

            expect(bluetoothDeviceSpy.bluetoothDevice).toBeUndefined();
        });

        describe("when bluetooth device is undefined", (): void => {
            it("should resolve immediately", async (): Promise<void> => {
                await expectAsync(service.disconnectDevice()).toBeResolved();
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
                const abortSpy = spyOn(AbortController.prototype, "abort");
                await service.disconnectDevice();
                expect(abortSpy).toHaveBeenCalled();
            });

            it("should emit disconnected status", async (): Promise<void> => {
                service
                    .connectionStatus$()
                    .pipe(skip(1), takeUntil(destroySubject))
                    .subscribe((status: IHRConnectionStatus): void => {
                        expect(status.status).toBe("disconnected");
                    });

                await service.disconnectDevice();
            });
        });

        it("when bluetooth device is not connected should resolve immediately without calling disconnect", async (): Promise<void> => {
            await service.disconnectDevice();

            expect(mockBluetoothDevice.gatt?.disconnect).not.toHaveBeenCalled();
        });

        describe("when bluetooth device is connected", (): void => {
            beforeEach(async (): Promise<void> => {
                (service as unknown as { bluetoothDevice: BluetoothDevice }).bluetoothDevice =
                    mockBluetoothDevice;
                (
                    Object.getOwnPropertyDescriptor(mockBluetoothDevice.gatt, "connected")?.get as jasmine.Spy
                ).and.returnValue(true);
                (
                    mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>
                ).disconnect.and.returnValue();
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

                await expectAsync(disconnectPromise).toBeResolved();
            });

            it("should reset all state after disconnection", async (): Promise<void> => {
                const disconnectTrigger = createDeviceDisconnectListenerReady();
                const disconnectPromise = service.disconnectDevice();

                (await disconnectTrigger).triggerChanged();
                await disconnectPromise;

                const device = (service as unknown as { bluetoothDevice: BluetoothDevice | undefined })
                    .bluetoothDevice;
                expect(device).toBeUndefined();

                service
                    .connectionStatus$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((status: IHRConnectionStatus): void => {
                        expect(status.status).toBe("disconnected");
                    });
            });
        });
    });

    describe("discover method", (): void => {
        describe("when device selection is successful", (): void => {
            let connectSpy: jasmine.Spy;
            let disconnectSpy: jasmine.Spy;

            beforeEach((): void => {
                connectSpy = spyOn(
                    service as unknown as { connect: () => Promise<void> },
                    "connect",
                ).and.resolveTo();
                disconnectSpy = spyOn(service, "disconnectDevice").and.resolveTo();
                mockBluetooth.and.returnValue({
                    requestDevice: jasmine.createSpy("requestDevice").and.resolveTo(mockBluetoothDevice),
                    getDevices: jasmine.createSpy("getDevices").and.resolveTo([]),
                } as unknown as Bluetooth);
            });

            it("should call disconnectDevice first", async (): Promise<void> => {
                await service.discover();

                expect(disconnectSpy).toHaveBeenCalledBefore(connectSpy);
            });

            it("should request device with correct filters", async (): Promise<void> => {
                await service.discover();

                const bluetooth = navigator.bluetooth as unknown as { requestDevice: jasmine.Spy };
                expect(bluetooth.requestDevice).toHaveBeenCalledWith({
                    acceptAllDevices: false,
                    filters: [{ services: ["heart_rate"] }],
                    optionalServices: ["battery_service"],
                });
            });

            it("should include battery service as optional", async (): Promise<void> => {
                await service.discover();

                const bluetooth = navigator.bluetooth as unknown as { requestDevice: jasmine.Spy };
                const args = bluetooth.requestDevice.calls.argsFor(0)[0];
                expect(args.optionalServices).toContain("battery_service");
            });

            it("should call connect with selected device", async (): Promise<void> => {
                await service.discover();

                expect(connectSpy).toHaveBeenCalledWith(mockBluetoothDevice);
            });

            it("should resolve when connection succeeds", async (): Promise<void> => {
                await expectAsync(service.discover()).toBeResolved();
            });
        });

        describe("when device selection is cancelled", (): void => {
            let reconnectSpy: jasmine.Spy;

            beforeEach((): void => {
                reconnectSpy = spyOn(
                    service as unknown as { reconnect: () => Promise<void> },
                    "reconnect",
                ).and.resolveTo();
                mockBluetooth.and.returnValue({
                    requestDevice: jasmine
                        .createSpy("requestDevice")
                        .and.rejectWith(new Error("User cancelled device selection")),
                    getDevices: jasmine.createSpy("getDevices").and.resolveTo([]),
                } as unknown as Bluetooth);
            });

            it("should call reconnect as fallback", async (): Promise<void> => {
                await service.discover();

                expect(reconnectSpy).toHaveBeenCalled();
            });

            it("should not throw error", async (): Promise<void> => {
                await expectAsync(service.discover()).toBeResolved();
            });
        });

        describe("when device selection throws error", (): void => {
            let reconnectSpy: jasmine.Spy;

            beforeEach((): void => {
                reconnectSpy = spyOn(
                    service as unknown as { reconnect: () => Promise<void> },
                    "reconnect",
                ).and.resolveTo();
                (
                    Object.getOwnPropertyDescriptor(navigator, "bluetooth")?.get as jasmine.Spy<
                        () => Bluetooth
                    >
                ).and.returnValue({
                    requestDevice: jasmine
                        .createSpy("requestDevice")
                        .and.rejectWith(new Error("Bluetooth error")),
                    getDevices: jasmine.createSpy("getDevices").and.resolveTo([]),
                } as unknown as Bluetooth);
            });

            it("should handle error gracefully", async (): Promise<void> => {
                await expectAsync(service.discover()).toBeResolved();
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
                mockConfigManager.getItem.and.returnValue("test-device-id");
            });

            it("should call disconnectDevice first", async (): Promise<void> => {
                const disconnectSpy = spyOn(service, "disconnectDevice").and.resolveTo();

                await service.reconnect();

                expect(disconnectSpy).toHaveBeenCalled();
            });

            it("should get stored device ID from config", async (): Promise<void> => {
                await service.reconnect();

                expect(mockConfigManager.getItem).toHaveBeenCalledWith("heartRateBleId");
            });

            it("should get device by stored ID", async (): Promise<void> => {
                const getDevicesSpy = (navigator.bluetooth as unknown as { getDevices: jasmine.Spy })
                    .getDevices;
                getDevicesSpy.and.resolveTo([mockBluetoothDevice, {}]);

                await service.reconnect();

                expect(getDevicesSpy).toHaveBeenCalled();
                expect(mockBluetoothDevice.watchAdvertisements)
                    .withContext("Empty device was selected from the list")
                    .toHaveBeenCalled();
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

                await expectAsync(advertisementReady).toBeResolved();
            });
        });

        describe("when no paired device exists", (): void => {
            beforeEach((): void => {
                mockConfigManager.getItem.and.returnValue("");
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

                expect(statuses).toHaveSize(3);
                expect(
                    statuses.every(
                        (status: IHRConnectionStatus): boolean => status.status === "disconnected",
                    ),
                ).toBeTrue();
            });
        });

        describe("when watchAdvertisements fails", (): void => {
            beforeEach((): void => {
                mockConfigManager.getItem.and.returnValue("test-device-id");
                (navigator.bluetooth as unknown as { getDevices: jasmine.Spy }).getDevices.and.resolveTo([
                    mockBluetoothDevice,
                ]);
                mockBluetoothDevice.watchAdvertisements.and.rejectWith(new Error("Advertisement failed"));
            });

            it("should handle error by calling reconnect again", async (): Promise<void> => {
                const reconnectSpy = spyOn(service, "reconnect").and.callThrough();

                await service.reconnect();

                expect(reconnectSpy).toHaveBeenCalledTimes(2);
            });

            it("should not throw unhandled error", async (): Promise<void> => {
                await expectAsync(service.reconnect()).toBeResolved();
            });
        });

        describe("when document visibility changes", (): void => {
            beforeEach((): void => {
                mockConfigManager.getItem.and.returnValue("test-device-id");
                (navigator.bluetooth as unknown as { getDevices: jasmine.Spy }).getDevices.and.resolveTo([
                    mockBluetoothDevice,
                ]);
            });

            it("should restart connection on visibility change to visible", async (): Promise<void> => {
                const visibilityChangeReady = visibilityChangeListenerReady();
                await service.reconnect();
                mockBluetoothDevice.watchAdvertisements.calls.reset();

                (await visibilityChangeReady).triggerChanged();

                expect(mockBluetoothDevice.watchAdvertisements).toHaveBeenCalled();
            });

            it("should not restart when visibility changes to hidden", async (): Promise<void> => {
                const visibilityChangeReady = visibilityChangeListenerReady("hidden");
                await service.reconnect();
                mockBluetoothDevice.watchAdvertisements.calls.reset();

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
                mockBluetoothDevice.watchAdvertisements.calls.reset();

                (await visibilityChangeReady).triggerChanged("visible");

                expect(mockBluetoothDevice.watchAdvertisements).not.toHaveBeenCalled();
            });
        });
    });

    describe("streamHRMonitorBatteryLevel$ method", (): void => {
        describe("when battery characteristic is undefined", (): void => {
            it("should start with undefined", (): void => {
                service
                    .streamHRMonitorBatteryLevel$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((batteryLevel: number | undefined): void => {
                        expect(batteryLevel).toBeUndefined();
                    });
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
                    const batteryCharacteristicSpy = spyOn(
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

                    expect(batteryCharacteristicSpy).toHaveBeenCalledOnceWith(undefined);
                });
            });

            describe("when battery readings fail", (): void => {
                beforeEach((): void => {
                    mockBatteryCharacteristic.readValue.and.rejectWith(new Error("Read failed"));
                });

                it("should handle readValue errors", async (): Promise<void> => {
                    const values: Array<number | undefined> = [];
                    const batteryValueChangeReady = createBatteryValueChangedListenerReady();
                    service
                        .streamHRMonitorBatteryLevel$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe({
                            next: (batteryLevel: number | undefined): void => {
                                values.push(batteryLevel);
                            },
                            error: (): void => {
                                fail("Observable should not error");
                            },
                        });

                    (await batteryValueChangeReady).triggerChanged(createBatteryDataView(50));

                    expect(values).toHaveSize(1);
                    expect(values[0]).toBeUndefined();
                });

                it("should still finalize properly", fakeAsync((): void => {
                    const results: Array<number | undefined> = [];
                    const batteryCharacteristicSpy = spyOn(
                        (
                            service as unknown as {
                                batteryCharacteristic: BehaviorSubject<
                                    BluetoothRemoteGATTCharacteristic | undefined
                                >;
                            }
                        ).batteryCharacteristic,
                        "next",
                    );
                    service
                        .streamHRMonitorBatteryLevel$()
                        .pipe(takeUntil(destroySubject))
                        .subscribe((value: number | undefined): void => {
                            results.push(value);
                        });

                    tick(4 * 2000); // flush retries

                    expect(batteryCharacteristicSpy.calls.count()).toBeGreaterThan(4);
                    expect(results[results.length - 1]).toBeUndefined();
                }));
            });
        });

        describe("when battery characteristic errors", (): void => {
            beforeEach((): void => {
                (
                    service as unknown as {
                        batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
                    }
                ).batteryCharacteristic.next(mockBatteryCharacteristic);
                mockBatteryCharacteristic.readValue.and.rejectWith(new Error("Read failed unknown"));
            });

            it("should retry up to 4 times", fakeAsync((): void => {
                const batteryCharacteristicSpy = spyOn(
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
                tick(4 * 2000); // flush retries

                expect(
                    batteryCharacteristicSpy.calls
                        .allArgs()
                        .filter(
                            ([args]: [BluetoothRemoteGATTCharacteristic | undefined]): boolean =>
                                args === undefined,
                        ),
                ).toEqual([[undefined], [undefined], [undefined], [undefined], [undefined]]);
            }));

            it("should reconnect to battery on retryable errors", fakeAsync((): void => {
                service.streamHRMonitorBatteryLevel$().pipe(takeUntil(destroySubject)).subscribe();

                tick(4 * 2000); // flush retries

                expect(mockBatteryCharacteristic.service.getCharacteristic).toHaveBeenCalledTimes(4);
            }));

            it("should emit only two undefined value", fakeAsync((): void => {
                const results: Array<number | undefined> = [];
                service
                    .streamHRMonitorBatteryLevel$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((value: number | undefined): void => {
                        results.push(value);
                    });

                tick(4 * 2000); // flush retries

                expect(results)
                    .withContext("Start with undefined and finalize with undefined")
                    .toEqual([undefined, undefined]);
            }));

            it("should show error snackbar on final error", fakeAsync((): void => {
                service.streamHRMonitorBatteryLevel$().pipe(takeUntil(destroySubject)).subscribe();

                tick(3 * 2000); // flush retries

                expect(mockSnackBar.open).not.toHaveBeenCalled();
                tick(1 * 2000); // flush retries
                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    jasmine.stringContaining("Error while connecting to"),
                    "Dismiss",
                );
            }));
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

                    expect(result?.rrIntervals).toHaveSize(0);
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
                service
                    .streamHeartRate$()
                    .pipe(skip(1), takeUntil(destroySubject))
                    .subscribe((heartRate: IHeartRate | undefined): void => {
                        expect(heartRate?.batteryLevel).toBeUndefined();
                    });

                (await heartRateValueChangeReady).triggerChanged(mockDefaultHrData);
            });

            it("and battery characteristic is available should merge into heart rate data", async (): Promise<void> => {
                (
                    service as unknown as {
                        batteryCharacteristic: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
                    }
                ).batteryCharacteristic.next(mockBatteryCharacteristic);

                service
                    .streamHeartRate$()
                    .pipe(skip(1), takeUntil(destroySubject))
                    .subscribe((heartRate: IHeartRate | undefined): void => {
                        expect(heartRate?.batteryLevel).toBe(75);
                        expect(heartRate?.heartRate).toBe(140);
                    });

                (await batteryValueChangeReady).triggerChanged(mockDefaultBatteryData);
                (await heartRateValueChangeReady).triggerChanged(mockDefaultHrData);
            });
        });

        describe("when heart rate characteristic errors", (): void => {
            beforeEach(async (): Promise<void> => {
                (
                    service as unknown as {
                        heartRateCharacteristic: BehaviorSubject<
                            BluetoothRemoteGATTCharacteristic | undefined
                        >;
                    }
                ).heartRateCharacteristic.next(mockHeartRateCharacteristic);

                mockHeartRateCharacteristic.addEventListener.and.callFake((): void => {
                    throw new Error("unknown");
                });
            });

            it("should emit one undefined value", fakeAsync((): void => {
                const results: Array<IHeartRate | undefined> = [];
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

                tick(4 * 2000); // flush retries

                expect(results).toHaveSize(1);
                expect(results[0]).toBeUndefined();
            }));

            it("should still finalize properly", fakeAsync((): void => {
                const results: Array<IHeartRate | undefined> = [];
                const heartRateCharacteristicSpy = spyOn(
                    (
                        service as unknown as {
                            heartRateCharacteristic: BehaviorSubject<
                                BluetoothRemoteGATTCharacteristic | undefined
                            >;
                        }
                    ).heartRateCharacteristic,
                    "next",
                );
                const connectionStatusSpy = spyOn(
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

                tick(4 * 2000); // flush retries

                expect(heartRateCharacteristicSpy.calls.count()).toBeGreaterThan(4);
                expect(connectionStatusSpy.calls.count()).toBeGreaterThan(4);
                expect(results[results.length - 1]).toBeUndefined();
            }));

            it("should retry up to 4 times", fakeAsync((): void => {
                const results: Array<IHeartRate | undefined> = [];
                const heartRateCharacteristicSpy = spyOn(
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

                tick(4 * 2000); // flush retries

                expect(
                    heartRateCharacteristicSpy.calls
                        .allArgs()
                        .filter(
                            ([args]: [BluetoothRemoteGATTCharacteristic | undefined]): boolean =>
                                args === undefined,
                        ),
                ).toEqual([[undefined], [undefined], [undefined], [undefined], [undefined]]);
            }));

            it("should reconnect to heart rate on retryable errors", fakeAsync((): void => {
                service
                    .streamHeartRate$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe({
                        error: (): void => {
                            // no-op
                        },
                    });

                tick(4 * 2000); // flush retries

                expect(mockHeartRateCharacteristic.service.getCharacteristic).toHaveBeenCalledTimes(4);
            }));

            it("should emit only one undefined value", fakeAsync((): void => {
                const results: Array<IHeartRate | undefined> = [];
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

                tick(4 * 2000); // flush retries

                expect(results).toEqual([undefined]);
            }));
        });
    });
});
