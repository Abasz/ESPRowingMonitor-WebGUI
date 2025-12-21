import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject, firstValueFrom, skip } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    DEVICE_INFO_SERVICE,
    FIRMWARE_NUMBER_CHARACTERISTIC,
    HARDWARE_REVISION_CHARACTERISTIC,
    IOtaCharacteristics,
    MANUFACTURER_NAME_CHARACTERISTIC,
    MODEL_NUMBER_CHARACTERISTIC,
    OTA_RX_CHARACTERISTIC,
    OTA_SERVICE,
    OTA_TX_CHARACTERISTIC,
} from "../../ble.interfaces";
import { IErgConnectionStatus } from "../../common.interfaces";
import {
    createBatteryDataView,
    createMockBluetoothDevice,
    createMockCharacteristic,
} from "../ble.test.helpers";

import { ErgConnectionService } from "./erg-connection.service";
import { ErgGenericDataService } from "./erg-generic-data.service";

describe("ErgGenericDataService", (): void => {
    let ergGenericDataService: ErgGenericDataService;
    let matSnackBarSpy: Pick<MatSnackBar, "open">;
    let ergConnectionServiceSpy: Pick<
        ErgConnectionService,
        | "connectToBattery"
        | "readBatteryCharacteristic"
        | "resetBatteryCharacteristic"
        | "bluetoothDevice"
        | "batteryCharacteristic$"
        | "connectionStatus$"
    >;
    let connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let batteryCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
    let mockBluetoothDevice: BluetoothDevice;
    let mockBatteryCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockOtaTxCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockOtaRxCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockModelNumberCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockFirmwareNumberCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockManufacturerNameCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockHardwareRevisionCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockOtaService: Pick<BluetoothRemoteGATTService, "getCharacteristic">;
    let mockDeviceInfoService: Pick<BluetoothRemoteGATTService, "getCharacteristic">;

    beforeEach((): void => {
        matSnackBarSpy = {
            open: vi.fn(),
        } as unknown as Pick<MatSnackBar, "open">;

        mockBluetoothDevice = createMockBluetoothDevice();
        mockBatteryCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockOtaTxCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockOtaRxCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockModelNumberCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockFirmwareNumberCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockManufacturerNameCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockHardwareRevisionCharacteristic = createMockCharacteristic(mockBluetoothDevice);

        vi.mocked(mockBatteryCharacteristic.readValue).mockResolvedValue(createBatteryDataView(42));

        connectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>({
            status: "disconnected",
        });

        batteryCharacteristicSubject = new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(
            mockBatteryCharacteristic,
        );

        mockOtaService = {
            getCharacteristic: vi.fn(),
        } as unknown as BluetoothRemoteGATTService;
        vi.mocked(mockBluetoothDevice.gatt!.getPrimaryService).mockImplementation(
            (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                if (service === OTA_SERVICE)
                    return Promise.resolve(mockOtaService as BluetoothRemoteGATTService);
                if (service === DEVICE_INFO_SERVICE)
                    return Promise.resolve(mockDeviceInfoService as BluetoothRemoteGATTService);

                return Promise.reject(new Error(`Service ${service} not found`));
            },
        );
        vi.mocked(mockOtaService.getCharacteristic).mockImplementation(
            (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                if (char === OTA_TX_CHARACTERISTIC) return Promise.resolve(mockOtaTxCharacteristic);
                if (char === OTA_RX_CHARACTERISTIC) return Promise.resolve(mockOtaRxCharacteristic);

                return Promise.reject(new Error(`Characteristic ${char} not found`));
            },
        );

        mockDeviceInfoService = {
            getCharacteristic: vi.fn(),
        } as unknown as BluetoothRemoteGATTService;
        vi.mocked(mockDeviceInfoService.getCharacteristic).mockImplementation(
            (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                if (char === MODEL_NUMBER_CHARACTERISTIC)
                    return Promise.resolve(mockModelNumberCharacteristic);
                if (char === FIRMWARE_NUMBER_CHARACTERISTIC)
                    return Promise.resolve(mockFirmwareNumberCharacteristic);
                if (char === MANUFACTURER_NAME_CHARACTERISTIC)
                    return Promise.resolve(mockManufacturerNameCharacteristic);
                if (char === HARDWARE_REVISION_CHARACTERISTIC)
                    return Promise.resolve(mockHardwareRevisionCharacteristic);

                return Promise.reject(new Error(`Characteristic ${char} not found`));
            },
        );

        ergConnectionServiceSpy = {
            connectToBattery: vi.fn(),
            readBatteryCharacteristic: vi.fn(),
            resetBatteryCharacteristic: vi.fn(),
            bluetoothDevice: mockBluetoothDevice,
            batteryCharacteristic$: batteryCharacteristicSubject.asObservable(),
            connectionStatus$: vi.fn().mockReturnValue(connectionStatusSubject.asObservable()),
        } as unknown as Pick<
            ErgConnectionService,
            | "connectToBattery"
            | "readBatteryCharacteristic"
            | "resetBatteryCharacteristic"
            | "bluetoothDevice"
            | "batteryCharacteristic$"
            | "connectionStatus$"
        >;

        TestBed.configureTestingModule({
            providers: [
                ErgGenericDataService,
                { provide: MatSnackBar, useValue: matSnackBarSpy },
                { provide: ErgConnectionService, useValue: ergConnectionServiceSpy },
                provideZonelessChangeDetection(),
            ],
        });

        ergGenericDataService = TestBed.inject(ErgGenericDataService);
    });

    it("should be created", (): void => {
        expect(ergGenericDataService).toBeTruthy();
    });

    describe("getOtaCharacteristics method", (): void => {
        it("should return OTA characteristics when device is connected", async (): Promise<void> => {
            const result: IOtaCharacteristics = await ergGenericDataService.getOtaCharacteristics();

            expect(vi.mocked(mockBluetoothDevice.gatt!.getPrimaryService)).toHaveBeenCalledWith(OTA_SERVICE);
            expect(result).toBeDefined();
            expect(result.responseCharacteristic).toBeDefined();
            expect(result.sendCharacteristic).toBeDefined();
        });

        describe("should throw error", (): void => {
            describe("when OTA service", (): void => {
                it("is not found", async (): Promise<void> => {
                    vi.mocked(mockBluetoothDevice.gatt!.getPrimaryService).mockImplementation(
                        (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                            if (service === OTA_SERVICE)
                                return Promise.resolve(undefined as unknown as BluetoothRemoteGATTService);
                            if (service === DEVICE_INFO_SERVICE)
                                return Promise.resolve(mockDeviceInfoService as BluetoothRemoteGATTService);

                            return Promise.reject(new Error(`Service ${service} not found`));
                        },
                    );

                    await expect(ergGenericDataService.getOtaCharacteristics()).rejects.toThrowError(
                        "Not able to connect to OTA service",
                    );
                });

                it("RX characteristics are not found", async (): Promise<void> => {
                    vi.mocked(mockOtaService.getCharacteristic).mockImplementation(
                        (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                            if (char === OTA_RX_CHARACTERISTIC)
                                return Promise.resolve(
                                    undefined as unknown as BluetoothRemoteGATTCharacteristic,
                                );
                            if (char === OTA_TX_CHARACTERISTIC)
                                return Promise.resolve(mockOtaTxCharacteristic);

                            return Promise.reject(new Error(`Characteristic ${char} not found`));
                        },
                    );

                    await expect(ergGenericDataService.getOtaCharacteristics()).rejects.toThrowError(
                        "Not able to connect to OTA service",
                    );
                });

                it("when TX characteristics are not found", async (): Promise<void> => {
                    vi.mocked(mockOtaService.getCharacteristic).mockImplementation(
                        (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                            if (char === OTA_RX_CHARACTERISTIC)
                                return Promise.resolve(mockOtaRxCharacteristic);

                            if (char === OTA_TX_CHARACTERISTIC)
                                return Promise.resolve(
                                    undefined as unknown as BluetoothRemoteGATTCharacteristic,
                                );

                            return Promise.reject(new Error(`Characteristic ${char} not found`));
                        },
                    );

                    await expect(ergGenericDataService.getOtaCharacteristics()).rejects.toThrowError(
                        "Not able to connect to OTA service",
                    );
                });
            });

            it("when bluetoothDevice is undefined", async (): Promise<void> => {
                vi.spyOn(ergConnectionServiceSpy, "bluetoothDevice", "get").mockReturnValue(undefined);

                await expect(ergGenericDataService.getOtaCharacteristics()).rejects.toThrow();
            });
        });
    });

    describe("deviceInfo$ observable", (): void => {
        it("should not call readDeviceInfo multiple times for multiple deviceInfo$ subscriptions due to shareReplay", (): void => {
            const getPrimaryServiceSpy = vi.mocked(mockBluetoothDevice.gatt!.getPrimaryService);

            const subscription1 = ergGenericDataService.deviceInfo$.subscribe();
            const subscription2 = ergGenericDataService.deviceInfo$.subscribe();
            const subscription3 = ergGenericDataService.deviceInfo$.subscribe();

            connectionStatusSubject.next({ status: "connected" });

            expect(getPrimaryServiceSpy).toHaveBeenCalledTimes(1);

            subscription1.unsubscribe();
            subscription2.unsubscribe();
            subscription3.unsubscribe();
        });
    });

    describe("deviceInfo signal", (): void => {
        beforeEach((): void => {
            vi.useFakeTimers();
            vi.mocked(mockModelNumberCharacteristic.readValue).mockResolvedValue(
                new DataView(new TextEncoder().encode("Test Model").buffer),
            );
            vi.mocked(mockFirmwareNumberCharacteristic.readValue).mockResolvedValue(
                new DataView(new TextEncoder().encode("v1.2.3").buffer),
            );
            vi.mocked(mockManufacturerNameCharacteristic.readValue).mockResolvedValue(
                new DataView(new TextEncoder().encode("Test Manufacturer").buffer),
            );
            vi.mocked(mockHardwareRevisionCharacteristic.readValue).mockResolvedValue(
                new DataView(new TextEncoder().encode("hw-42").buffer),
            );
        });

        afterEach((): void => {
            vi.useRealTimers();
        });

        it("should initialize with empty device info when disconnected", (): void => {
            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(deviceInfo).toEqual({});
        });

        it("should update device info when connection status changes to connected", async (): Promise<void> => {
            connectionStatusSubject.next({ status: "connected" });
            await vi.advanceTimersByTimeAsync(1000);

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(vi.mocked(mockBluetoothDevice.gatt!.getPrimaryService)).toHaveBeenCalledWith(
                DEVICE_INFO_SERVICE,
            );
            expect(vi.mocked(mockDeviceInfoService.getCharacteristic)).toHaveBeenCalledWith(
                MODEL_NUMBER_CHARACTERISTIC,
            );
            expect(vi.mocked(mockDeviceInfoService.getCharacteristic)).toHaveBeenCalledWith(
                FIRMWARE_NUMBER_CHARACTERISTIC,
            );
            expect(vi.mocked(mockDeviceInfoService.getCharacteristic)).toHaveBeenCalledWith(
                MANUFACTURER_NAME_CHARACTERISTIC,
            );
            expect(vi.mocked(mockDeviceInfoService.getCharacteristic)).toHaveBeenCalledWith(
                HARDWARE_REVISION_CHARACTERISTIC,
            );
            expect(vi.mocked(mockModelNumberCharacteristic.readValue)).toHaveBeenCalled();
            expect(vi.mocked(mockFirmwareNumberCharacteristic.readValue)).toHaveBeenCalled();
            expect(vi.mocked(mockManufacturerNameCharacteristic.readValue)).toHaveBeenCalled();
            expect(vi.mocked(mockHardwareRevisionCharacteristic.readValue)).toHaveBeenCalled();
            expect(deviceInfo.modelNumber).toBe("Test Model");
            expect(deviceInfo.firmwareNumber).toBe("v1.2.3");
            expect(deviceInfo.manufacturerName).toBe("Test Manufacturer");
            expect(deviceInfo.hardwareRevision).toBe("hw-42");
        });

        it("should handle partial read failures gracefully when connected", async (): Promise<void> => {
            vi.mocked(mockFirmwareNumberCharacteristic.readValue).mockRejectedValue(new Error("Read failed"));

            connectionStatusSubject.next({ status: "connected" });
            await vi.advanceTimersByTimeAsync(1000);

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(deviceInfo.modelNumber).toBe("Test Model");
            expect(deviceInfo.firmwareNumber).toBeUndefined();
            expect(deviceInfo.manufacturerName).toBe("Test Manufacturer");
            expect(deviceInfo.hardwareRevision).toBe("hw-42");
        });

        it("should handle all characteristic read failures when connected", async (): Promise<void> => {
            vi.mocked(mockModelNumberCharacteristic.readValue).mockRejectedValue(new Error("Read failed"));
            vi.mocked(mockFirmwareNumberCharacteristic.readValue).mockRejectedValue(
                new Error("Connection lost"),
            );
            vi.mocked(mockManufacturerNameCharacteristic.readValue).mockRejectedValue(
                new Error("Device error"),
            );
            vi.mocked(mockHardwareRevisionCharacteristic.readValue).mockRejectedValue(
                new Error("Device error"),
            );

            connectionStatusSubject.next({ status: "connected" });
            await vi.runAllTimersAsync();

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(deviceInfo.modelNumber).toBeUndefined();
            expect(deviceInfo.firmwareNumber).toBeUndefined();
            expect(deviceInfo.manufacturerName).toBeUndefined();
            expect(deviceInfo.hardwareRevision).toBeUndefined();
        });

        it("should clear device info when connection status changes to disconnected", async (): Promise<void> => {
            connectionStatusSubject.next({ status: "connected" });
            await vi.advanceTimersByTimeAsync(1000);

            let deviceInfo = ergGenericDataService.deviceInfo();
            expect(deviceInfo.modelNumber).toBe("Test Model");

            connectionStatusSubject.next({ status: "disconnected" });
            await vi.runAllTimersAsync();

            deviceInfo = ergGenericDataService.deviceInfo();
            expect(deviceInfo).toEqual({});
        });

        it("should show snack and return empty object when device gatt is undefined", async (): Promise<void> => {
            vi.spyOn(ergConnectionServiceSpy, "bluetoothDevice", "get").mockReturnValue({
                gatt: undefined,
            } as BluetoothDevice);

            connectionStatusSubject.next({ status: "connected" });
            await vi.runAllTimersAsync();

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(vi.mocked(matSnackBarSpy.open)).toHaveBeenCalledWith(
                "Ergometer Monitor is not connected",
                "Dismiss",
            );
            expect(deviceInfo).toEqual({});
        });

        it("should show snack and return empty object when bluetoothDevice is undefined", async (): Promise<void> => {
            vi.spyOn(ergConnectionServiceSpy, "bluetoothDevice", "get").mockReturnValue(undefined);

            connectionStatusSubject.next({ status: "connected" });
            await vi.runAllTimersAsync();

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(vi.mocked(matSnackBarSpy.open)).toHaveBeenCalledWith(
                "Ergometer Monitor is not connected",
                "Dismiss",
            );
            expect(deviceInfo).toEqual({});
        });

        describe("when error occurs", (): void => {
            it("should handle it and show snack message", async (): Promise<void> => {
                const errorMessage = "Service unavailable";

                vi.mocked(mockBluetoothDevice.gatt!.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === DEVICE_INFO_SERVICE) return Promise.reject(new Error(errorMessage));

                        return Promise.reject(new Error(`Service ${service} not found`));
                    },
                );

                connectionStatusSubject.next({ status: "connected" });
                await vi.runAllTimersAsync();

                const deviceInfo = ergGenericDataService.deviceInfo();

                expect(vi.mocked(matSnackBarSpy.open)).toHaveBeenCalledWith(errorMessage, "Dismiss");
                expect(deviceInfo).toEqual({});
            });
        });
    });

    describe("streamMonitorBatteryLevel$ method", (): void => {
        beforeEach((): void => {
            vi.useFakeTimers();
        });

        afterEach((): void => {
            vi.useRealTimers();
        });

        it("should handle characteristics properly", async (): Promise<void> => {
            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            vi.mocked(mockCharacteristic.readValue).mockResolvedValue(createBatteryDataView(42));

            batteryCharacteristicSubject.next(mockCharacteristic);
            const batteryLevel = await firstValueFrom(ergGenericDataService.streamMonitorBatteryLevel$());

            expect(typeof batteryLevel).toBe("number");
            expect(batteryLevel).toEqual(42);
        });

        it("should retry on error and eventually emit after retry", async (): Promise<void> => {
            const results: Array<number> = [];
            batteryCharacteristicSubject.next(undefined);

            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            mockCharacteristic.readValue = vi
                .fn()
                .mockReturnValueOnce(Promise.reject(new Error("unknown error")))
                .mockReturnValueOnce(Promise.resolve(createBatteryDataView(55)))
                .mockReturnValueOnce(Promise.resolve(createBatteryDataView(50)));
            vi.mocked(ergConnectionServiceSpy.readBatteryCharacteristic).mockReturnValue(mockCharacteristic);

            ergGenericDataService.streamMonitorBatteryLevel$().subscribe({
                next: (batteryLevel: number): void => {
                    results.push(batteryLevel);
                },
                error: (err: unknown): void => {
                    throw new Error("Should not error: " + String(err));
                },
            });

            batteryCharacteristicSubject.next(mockCharacteristic);
            await vi.advanceTimersByTimeAsync(5000);
            batteryCharacteristicSubject.next(mockCharacteristic);
            await vi.runAllTimersAsync();
            expect(results).toEqual([55, 50]);
            expect(vi.mocked(ergConnectionServiceSpy.connectToBattery)).toHaveBeenCalled();
        });

        it("should emit 0 and show snackBar on error after retries", async (): Promise<void> => {
            batteryCharacteristicSubject.next(undefined);

            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            mockCharacteristic.readValue = vi.fn().mockImplementation((): Promise<DataView> => {
                throw new Error("fail");
            });
            vi.mocked(ergConnectionServiceSpy.readBatteryCharacteristic).mockReturnValue(mockCharacteristic);

            const batteryLevel = firstValueFrom(ergGenericDataService.streamMonitorBatteryLevel$());

            batteryCharacteristicSubject.next(mockCharacteristic);
            for (let i = 0; i < 4; i++) {
                await vi.advanceTimersByTimeAsync(5000);
                batteryCharacteristicSubject.next(mockCharacteristic);
            }

            expect(await batteryLevel).toBe(0);
            expect(vi.mocked(matSnackBarSpy.open)).toHaveBeenCalledWith(
                "Error while connecting to battery service",
                "Dismiss",
            );
        });

        it("should not emit when readValue returns empty DataView", async (): Promise<void> => {
            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            mockCharacteristic.readValue = vi.fn().mockResolvedValue(new DataView(new ArrayBuffer(0)));
            vi.mocked(ergConnectionServiceSpy.readBatteryCharacteristic).mockReturnValue(mockCharacteristic);
            ergGenericDataService
                .streamMonitorBatteryLevel$()
                .pipe(skip(1))
                .subscribe({
                    next: (batteryLevel: number): void => {
                        throw new Error(`Should not emit, battery level: ${batteryLevel}`);
                    },
                    error: (err: unknown): void => {
                        throw new Error("Should not error: " + String(err));
                    },
                });
            batteryCharacteristicSubject.next(mockCharacteristic);
            await vi.runAllTimersAsync();
            // test passes if no emission occurs
        });

        it("should call resetBatteryCharacteristic on complete", async (): Promise<void> => {
            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            vi.mocked(mockCharacteristic.readValue).mockResolvedValue(createBatteryDataView(42));

            batteryCharacteristicSubject.next(mockCharacteristic);

            await firstValueFrom(ergGenericDataService.streamMonitorBatteryLevel$());

            expect(ergConnectionServiceSpy.resetBatteryCharacteristic).toHaveBeenCalled();
        });
    });
});
