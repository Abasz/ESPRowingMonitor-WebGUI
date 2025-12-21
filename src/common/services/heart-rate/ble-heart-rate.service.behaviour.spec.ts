import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject, firstValueFrom, Subject, takeUntil } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import {
    BATTERY_LEVEL_CHARACTERISTIC,
    BATTERY_LEVEL_SERVICE,
    HEART_RATE_CHARACTERISTIC,
    HEART_RATE_SERVICE,
} from "../../ble.interfaces";
import { IHRConnectionStatus } from "../../common.interfaces";
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
    let mockConfigManager: Pick<ConfigManagerService, "getItem" | "setItem">;
    let mockSnackBar: Pick<MatSnackBar, "open">;
    let mockBluetoothDevice: BluetoothDevice;
    let mockHeartRateCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockBatteryCharacteristic: BluetoothRemoteGATTCharacteristic;

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

        createDeviceDisconnectListenerReady = changedListenerReadyFactory(
            mockBluetoothDevice,
            "gattserverdisconnected",
        );
        createAdvertisementReceivedListenerReady = changedListenerReadyFactory(
            mockBluetoothDevice,
            "advertisementreceived",
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

        vi.spyOn(navigator, "bluetooth", "get").mockReturnValue({
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

    describe("as part of service creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });

        it("should initialize with disconnected connection status", async (): Promise<void> => {
            const status = await firstValueFrom(service.connectionStatus$().pipe(takeUntil(destroySubject)));

            expect(status).toEqual({ status: "disconnected" });
        });

        it("should initialize with undefined characteristics", async (): Promise<void> => {
            const heartRate = await firstValueFrom(
                service.streamHeartRate$().pipe(takeUntil(destroySubject)),
            );

            expect(heartRate).toBeUndefined();

            const batteryLevel = await firstValueFrom(
                service.streamHRMonitorBatteryLevel$().pipe(takeUntil(destroySubject)),
            );

            expect(batteryLevel).toBeUndefined();
        });
    });

    describe("as part of connecting to devices", (): void => {
        beforeEach((): void => {
            vi.useFakeTimers();
        });

        afterEach((): void => {
            vi.useRealTimers();
        });

        describe("when initiating connection", (): void => {
            it("should set connection status to connecting", async (): Promise<void> => {
                const statuses: Array<IHRConnectionStatus> = [];
                service
                    .connectionStatus$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((status: IHRConnectionStatus): void => {
                        statuses.push(status);
                    });

                const discoverPromise = service.discover();
                await vi.runAllTimersAsync();
                await discoverPromise;

                expect(statuses).toContainEqual(expect.objectContaining({ status: "connecting" }));
            });

            it("should store bluetooth device reference", async (): Promise<void> => {
                service.discover();

                await vi.advanceTimersByTimeAsync(2000);

                const storedDevice = (
                    service as unknown as {
                        bluetoothDevice: BluetoothDevice | undefined;
                    }
                ).bluetoothDevice;
                expect(storedDevice).toBe(mockBluetoothDevice);
            });

            it("should call gatt connect", async (): Promise<void> => {
                service.discover();

                await vi.advanceTimersByTimeAsync(2000);

                expect(mockBluetoothDevice.gatt?.connect).toHaveBeenCalled();
            });

            it("should try connect to heart rate characteristic", async (): Promise<void> => {
                service.discover();

                await vi.advanceTimersByTimeAsync(4000);

                expect(mockHeartRateCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    HEART_RATE_CHARACTERISTIC,
                );
            });

            it("should save device ID to config", async (): Promise<void> => {
                service.discover();

                await vi.advanceTimersByTimeAsync(4000);

                expect(mockConfigManager.setItem).toHaveBeenCalledWith(
                    "heartRateBleId",
                    mockBluetoothDevice.id,
                );
            });

            it("should setup disconnect handler", async (): Promise<void> => {
                createDeviceDisconnectListenerReady();
                createAdvertisementReceivedListenerReady();

                service.discover();

                await vi.advanceTimersByTimeAsync(4000);

                expect(mockBluetoothDevice.addEventListener).toHaveBeenCalledWith(
                    "gattserverdisconnected",
                    expect.any(Function),
                    undefined,
                );
            });

            describe("when battery service", (): void => {
                describe("is available", (): void => {
                    it("should try connect to battery level characteristic", async (): Promise<void> => {
                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(mockBatteryCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                            BATTERY_LEVEL_CHARACTERISTIC,
                        );
                    });

                    it("should update battery characteristic subject", async (): Promise<void> => {
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

                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(batteryCharacteristicSpy).toHaveBeenCalledWith(mockBatteryCharacteristic);
                    });

                    it("should complete connection process", async (): Promise<void> => {
                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(mockConfigManager.setItem).toHaveBeenCalledWith(
                            "heartRateBleId",
                            mockBluetoothDevice.id,
                        );
                    });
                });

                describe("is unavailable", (): void => {
                    let mockGattConnected: Mock;
                    beforeEach((): void => {
                        vi.mocked(mockBatteryCharacteristic.service.getCharacteristic).mockRejectedValue(
                            new Error("Heart rate characteristic not available"),
                        );
                        mockGattConnected = vi.spyOn(mockBluetoothDevice.gatt!, "connected", "get");
                        mockGattConnected.mockReturnValue(true);
                    });

                    it("should show unavailable snackbar", async (): Promise<void> => {
                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(mockSnackBar.open).toHaveBeenCalledWith(
                            "HR Monitor battery service is unavailable",
                            "Dismiss",
                        );
                    });

                    it("should throw error when device not connected", async (): Promise<void> => {
                        mockGattConnected.mockReturnValue(false);
                        const reconnectSpy = vi.spyOn(service, "reconnect");

                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(reconnectSpy).toHaveBeenCalledTimes(1);
                    });
                });
            });

            describe("when heart rate service", (): void => {
                describe("is available", (): void => {
                    it("should try connect to heart rate characteristic", async (): Promise<void> => {
                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(mockHeartRateCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                            HEART_RATE_CHARACTERISTIC,
                        );
                    });

                    it("should update heart rate characteristic subject", async (): Promise<void> => {
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

                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(heartRateCharacteristicSpy).toHaveBeenCalledWith(mockHeartRateCharacteristic);
                    });

                    it("should update connection status to connected", async (): Promise<void> => {
                        vi.spyOn(mockBluetoothDevice.gatt!, "connected", "get").mockReturnValue(true);

                        const connectionStatusSpy = vi.spyOn(
                            (
                                service as unknown as {
                                    connectionStatusSubject: BehaviorSubject<IHRConnectionStatus>;
                                }
                            ).connectionStatusSubject,
                            "next",
                        );

                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(connectionStatusSpy).toHaveBeenCalledWith({
                            deviceName: mockBluetoothDevice.name,
                            status: "connected",
                        });
                    });

                    it("should complete connection process", async (): Promise<void> => {
                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(mockConfigManager.setItem).toHaveBeenCalledWith(
                            "heartRateBleId",
                            mockBluetoothDevice.id,
                        );
                    });
                });

                describe("is unavailable", (): void => {
                    let mockGattConnected: Mock;

                    beforeEach((): void => {
                        vi.mocked(mockHeartRateCharacteristic.service.getCharacteristic).mockRejectedValue(
                            new Error("Heart rate characteristic not available"),
                        );
                        mockGattConnected = vi.spyOn(mockBluetoothDevice.gatt!, "connected", "get");
                        mockGattConnected.mockReturnValue(true);
                    });

                    it("should show unavailable snackbar", async (): Promise<void> => {
                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(mockSnackBar.open).toHaveBeenCalledWith(
                            "Error connecting Heart Rate monitor",
                            "Dismiss",
                        );
                    });

                    it("should throw error when device not connected", async (): Promise<void> => {
                        mockGattConnected.mockReturnValue(false);
                        const reconnectSpy = vi.spyOn(service, "reconnect");

                        service.discover();

                        await vi.advanceTimersByTimeAsync(4000);

                        expect(reconnectSpy).toHaveBeenCalledTimes(1);
                    });
                });
            });
        });

        describe("when gatt connection fails", (): void => {
            let reconnectSpy: Mock;

            beforeEach((): void => {
                vi.mocked(mockBluetoothDevice.gatt!.connect).mockRejectedValue(
                    new Error("GATT connection failed"),
                );
                reconnectSpy = vi.spyOn(service, "reconnect").mockResolvedValue();
            });

            it("should set connection status to disconnected", async (): Promise<void> => {
                const statuses: Array<IHRConnectionStatus> = [];
                service
                    .connectionStatus$()
                    .pipe(takeUntil(destroySubject))
                    .subscribe((status: IHRConnectionStatus): void => {
                        statuses.push(status);
                    });

                const discoverPromise = service.discover();
                await vi.runAllTimersAsync();
                await discoverPromise;

                expect(statuses).toContainEqual(expect.objectContaining({ status: "disconnected" }));
            });

            it("should show error snackbar if still connected", async (): Promise<void> => {
                vi.spyOn(mockBluetoothDevice.gatt!, "connected", "get").mockReturnValue(true);

                service.discover();

                await vi.advanceTimersByTimeAsync(4000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    expect.stringContaining("GATT connection failed"),
                    "Dismiss",
                );
            });

            it("should call reconnect if connection is false", async (): Promise<void> => {
                vi.spyOn(mockBluetoothDevice.gatt!, "connected", "get").mockReturnValue(false);

                service.discover();

                await vi.advanceTimersByTimeAsync(4000);

                expect(reconnectSpy).toHaveBeenCalled();
            });
        });

        describe("when characteristic connection fails", (): void => {
            beforeEach((): void => {
                vi.spyOn(mockBluetoothDevice.gatt!, "connected", "get").mockReturnValue(true);
            });

            it("should handle battery characteristic errors", async (): Promise<void> => {
                vi.mocked(mockBatteryCharacteristic.service.getCharacteristic).mockRejectedValue(
                    new Error("Battery characteristic not available"),
                );

                service.discover();

                await vi.advanceTimersByTimeAsync(4000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "HR Monitor battery service is unavailable",
                    "Dismiss",
                );
            });

            it("should still complete connection process", async (): Promise<void> => {
                vi.mocked(mockBatteryCharacteristic.service.getCharacteristic).mockRejectedValue(
                    new Error("Battery characteristic not available"),
                );

                service.discover();

                await vi.advanceTimersByTimeAsync(4000);

                expect(mockConfigManager.setItem).toHaveBeenCalledWith(
                    "heartRateBleId",
                    mockBluetoothDevice.id,
                );

                expect(mockBluetoothDevice.addEventListener).toHaveBeenCalledWith(
                    "gattserverdisconnected",
                    expect.any(Function),
                    undefined,
                );
            });
        });
    });
});
