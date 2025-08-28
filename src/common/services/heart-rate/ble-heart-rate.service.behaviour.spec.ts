import { provideZonelessChangeDetection } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject, Subject, takeUntil } from "rxjs";

import {
    BATTERY_LEVEL_CHARACTERISTIC,
    BATTERY_LEVEL_SERVICE,
    HEART_RATE_CHARACTERISTIC,
    HEART_RATE_SERVICE,
} from "../../ble.interfaces";
import { IHeartRate, IHRConnectionStatus } from "../../common.interfaces";
import {
    changedListenerReadyFactory,
    createBatteryDataView,
    createMockBluetoothDevice,
    createMockCharacteristic,
    ListenerTrigger,
} from "../ble.test.helpers";
import { ConfigManagerService } from "../config-manager.service";

import { BLEHeartRateService } from "./ble-heart-rate.service";

describe("BLEHeartRateService", (): void => {
    const destroySubject: Subject<void> = new Subject<void>();

    let service: BLEHeartRateService;
    let mockConfigManager: jasmine.SpyObj<ConfigManagerService>;
    let mockSnackBar: jasmine.SpyObj<MatSnackBar>;
    let mockBluetoothDevice: jasmine.SpyObj<BluetoothDevice>;
    let mockHeartRateCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockBatteryCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;

    let createDeviceDisconnectListenerReady: () => Promise<ListenerTrigger<void>>;
    let createAdvertisementReceivedListenerReady: () => Promise<ListenerTrigger<BluetoothAdvertisingEvent>>;

    beforeEach((): void => {
        mockConfigManager = jasmine.createSpyObj("ConfigManagerService", ["getItem", "setItem"]);
        mockSnackBar = jasmine.createSpyObj("MatSnackBar", ["open"]);

        mockBluetoothDevice = createMockBluetoothDevice();
        mockHeartRateCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockBatteryCharacteristic = createMockCharacteristic(mockBluetoothDevice);

        createDeviceDisconnectListenerReady = changedListenerReadyFactory<typeof mockBluetoothDevice, void>(
            mockBluetoothDevice,
            "gattserverdisconnected",
        );
        createAdvertisementReceivedListenerReady = changedListenerReadyFactory<
            typeof mockBluetoothDevice,
            BluetoothAdvertisingEvent
        >(mockBluetoothDevice, "advertisementreceived");

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

        spyOnProperty(navigator, "bluetooth", "get").and.returnValue({
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

    describe("as part of service creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });

        it("should initialize with disconnected connection status", (): void => {
            service
                .connectionStatus$()
                .pipe(takeUntil(destroySubject))
                .subscribe((status: IHRConnectionStatus): void => {
                    expect(status).toEqual({ status: "disconnected" });
                });
        });

        it("should initialize with undefined characteristics", (): void => {
            service
                .streamHeartRate$()
                .pipe(takeUntil(destroySubject))
                .subscribe((heartRate: IHeartRate | undefined): void => {
                    expect(heartRate).toBeUndefined();
                });

            service
                .streamHRMonitorBatteryLevel$()
                .pipe(takeUntil(destroySubject))
                .subscribe((batteryLevel: number | undefined): void => {
                    expect(batteryLevel).toBeUndefined();
                });
        });
    });

    describe("as part of connecting to devices", (): void => {
        describe("when initiating connection", (): void => {
            it("should set connection status to connecting", fakeAsync((): void => {
                const statuses: Array<IHRConnectionStatus> = [];
                service
                    .connectionStatus$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((status: IHRConnectionStatus): void => {
                        statuses.push(status);
                    });

                service.discover();

                tick(2000);

                expect(statuses).toContain(jasmine.objectContaining({ status: "connecting" }));
            }));

            it("should store bluetooth device reference", fakeAsync((): void => {
                service.discover();

                tick(2000);

                const storedDevice = (service as unknown as { bluetoothDevice: BluetoothDevice | undefined })
                    .bluetoothDevice;
                expect(storedDevice).toBe(mockBluetoothDevice);
            }));

            it("should call gatt connect", fakeAsync((): void => {
                service.discover();

                tick(2000);

                expect(mockBluetoothDevice.gatt?.connect).toHaveBeenCalled();
            }));

            it("should try connect to heart rate characteristic", fakeAsync((): void => {
                service.discover();

                tick(4000);

                expect(mockHeartRateCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    HEART_RATE_CHARACTERISTIC,
                );
            }));

            it("should save device ID to config", fakeAsync((): void => {
                service.discover();

                tick(4000);

                expect(mockConfigManager.setItem).toHaveBeenCalledWith(
                    "heartRateBleId",
                    mockBluetoothDevice.id,
                );
            }));

            it("should setup disconnect handler", fakeAsync((): void => {
                createDeviceDisconnectListenerReady();
                createAdvertisementReceivedListenerReady();

                service.discover();

                tick(4000);

                expect(mockBluetoothDevice.addEventListener).toHaveBeenCalledWith(
                    "gattserverdisconnected",
                    jasmine.any(Function),
                    undefined,
                );
            }));

            describe("when battery service", (): void => {
                describe("is available", (): void => {
                    it("should try connect to battery level characteristic", fakeAsync((): void => {
                        service.discover();

                        tick(4000);

                        expect(mockBatteryCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                            BATTERY_LEVEL_CHARACTERISTIC,
                        );
                    }));

                    it("should update battery characteristic subject", fakeAsync((): void => {
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

                        service.discover();

                        tick(4000);

                        expect(batteryCharacteristicSpy).toHaveBeenCalledWith(mockBatteryCharacteristic);
                    }));

                    it("should complete connection process", fakeAsync((): void => {
                        service.discover();

                        tick(4000);

                        expect(mockConfigManager.setItem).toHaveBeenCalledWith(
                            "heartRateBleId",
                            mockBluetoothDevice.id,
                        );
                    }));
                });

                describe("is unavailable", (): void => {
                    let mockGattConnected: jasmine.Spy<() => boolean>;
                    beforeEach((): void => {
                        (
                            mockBatteryCharacteristic.service as jasmine.SpyObj<BluetoothRemoteGATTService>
                        ).getCharacteristic.and.rejectWith(
                            new Error("Heart rate characteristic not available"),
                        );
                        mockGattConnected = Object.getOwnPropertyDescriptor(
                            mockBluetoothDevice.gatt,
                            "connected",
                        )?.get as jasmine.Spy<() => boolean>;
                        mockGattConnected.and.returnValue(true);
                    });

                    it("should show unavailable snackbar", fakeAsync((): void => {
                        service.discover();

                        tick(4000);

                        expect(mockSnackBar.open).toHaveBeenCalledWith(
                            "HR Monitor battery service is unavailable",
                            "Dismiss",
                        );
                    }));

                    it("should throw error when device not connected", fakeAsync((): void => {
                        mockGattConnected.and.returnValue(false);
                        const reconnectSpy = spyOn(service, "reconnect");

                        service.discover();

                        tick(4000);

                        expect(reconnectSpy).toHaveBeenCalledTimes(1);
                    }));
                });
            });

            describe("when heart rate service", (): void => {
                describe("is available", (): void => {
                    it("should try connect to heart rate characteristic", fakeAsync((): void => {
                        service.discover();

                        tick(4000);

                        expect(mockHeartRateCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                            HEART_RATE_CHARACTERISTIC,
                        );
                    }));

                    it("should update heart rate characteristic subject", fakeAsync((): void => {
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

                        service.discover();

                        tick(4000);

                        expect(heartRateCharacteristicSpy).toHaveBeenCalledWith(mockHeartRateCharacteristic);
                    }));

                    it("should update connection status to connected", fakeAsync((): void => {
                        (
                            Object.getOwnPropertyDescriptor(mockBluetoothDevice.gatt, "connected")
                                ?.get as jasmine.Spy<() => boolean>
                        ).and.returnValue(true);

                        const connectionStatusSpy = spyOn(
                            (
                                service as unknown as {
                                    connectionStatusSubject: BehaviorSubject<IHRConnectionStatus>;
                                }
                            ).connectionStatusSubject,
                            "next",
                        );

                        service.discover();

                        tick(4000);

                        expect(connectionStatusSpy).toHaveBeenCalledWith({
                            deviceName: mockBluetoothDevice.name,
                            status: "connected",
                        });
                    }));

                    it("should complete connection process", fakeAsync((): void => {
                        service.discover();

                        tick(4000);

                        expect(mockConfigManager.setItem).toHaveBeenCalledWith(
                            "heartRateBleId",
                            mockBluetoothDevice.id,
                        );
                    }));
                });

                describe("is unavailable", (): void => {
                    let mockGattConnected: jasmine.Spy<() => boolean>;

                    beforeEach((): void => {
                        (
                            mockHeartRateCharacteristic.service as jasmine.SpyObj<BluetoothRemoteGATTService>
                        ).getCharacteristic.and.rejectWith(
                            new Error("Heart rate characteristic not available"),
                        );
                        mockGattConnected = Object.getOwnPropertyDescriptor(
                            mockBluetoothDevice.gatt,
                            "connected",
                        )?.get as jasmine.Spy<() => boolean>;
                        mockGattConnected.and.returnValue(true);
                    });

                    it("should show unavailable snackbar", fakeAsync((): void => {
                        service.discover();

                        tick(4000);

                        expect(mockSnackBar.open).toHaveBeenCalledWith(
                            "Error connecting Heart Rate monitor",
                            "Dismiss",
                        );
                    }));

                    it("should throw error when device not connected", fakeAsync((): void => {
                        mockGattConnected.and.returnValue(false);
                        const reconnectSpy = spyOn(service, "reconnect");

                        service.discover();

                        tick(4000);

                        expect(reconnectSpy).toHaveBeenCalledTimes(1);
                    }));
                });
            });
        });

        describe("when gatt connection fails", (): void => {
            let reconnectSpy: jasmine.Spy;

            beforeEach((): void => {
                (
                    mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>
                ).connect.and.rejectWith(new Error("GATT connection failed"));
                reconnectSpy = spyOn(service, "reconnect").and.resolveTo();
            });

            it("should set connection status to disconnected", fakeAsync((): void => {
                const statuses: Array<IHRConnectionStatus> = [];
                service
                    .connectionStatus$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((status: IHRConnectionStatus): void => {
                        statuses.push(status);
                    });

                service.discover();

                tick(4000);

                expect(statuses).toContain(jasmine.objectContaining({ status: "disconnected" }));
            }));

            it("should show error snackbar if still connected", fakeAsync((): void => {
                (
                    Object.getOwnPropertyDescriptor(
                        mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>,
                        "connected",
                    )?.get as jasmine.Spy
                ).and.returnValue(true);

                service.discover();

                tick(4000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    jasmine.stringContaining("GATT connection failed"),
                    "Dismiss",
                );
            }));

            it("should call reconnect if connection is false", fakeAsync((): void => {
                (
                    Object.getOwnPropertyDescriptor(
                        mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>,
                        "connected",
                    )?.get as jasmine.Spy
                ).and.returnValue(false);

                service.discover();

                tick(4000);

                expect(reconnectSpy).toHaveBeenCalled();
            }));
        });

        describe("when characteristic connection fails", (): void => {
            beforeEach((): void => {
                (
                    Object.getOwnPropertyDescriptor(
                        mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>,
                        "connected",
                    )?.get as jasmine.Spy
                ).and.returnValue(true);
            });

            it("should handle battery characteristic errors", fakeAsync((): void => {
                (
                    mockBatteryCharacteristic.service as jasmine.SpyObj<BluetoothRemoteGATTService>
                ).getCharacteristic.and.rejectWith(new Error("Battery characteristic not available"));

                service.discover();

                tick(4000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "HR Monitor battery service is unavailable",
                    "Dismiss",
                );
            }));

            it("should still complete connection process", fakeAsync((): void => {
                (
                    mockBatteryCharacteristic.service as jasmine.SpyObj<BluetoothRemoteGATTService>
                ).getCharacteristic.and.rejectWith(new Error("Battery characteristic not available"));

                service.discover();

                tick(4000);

                expect(mockConfigManager.setItem).toHaveBeenCalledWith(
                    "heartRateBleId",
                    mockBluetoothDevice.id,
                );

                expect(mockBluetoothDevice.addEventListener).toHaveBeenCalledWith(
                    "gattserverdisconnected",
                    jasmine.any(Function),
                    undefined,
                );
            }));
        });
    });
});
