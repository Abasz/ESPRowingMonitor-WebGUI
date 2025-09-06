import { provideZonelessChangeDetection } from "@angular/core";
import { fakeAsync, flush, TestBed, tick } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";

import {
    DEVICE_INFO_SERVICE,
    FIRMWARE_NUMBER_CHARACTERISTIC,
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
    let matSnackBarSpy: jasmine.SpyObj<MatSnackBar>;
    let ergConnectionServiceSpy: jasmine.SpyObj<ErgConnectionService>;
    let bluetoothDeviceSpy: jasmine.Spy<() => BluetoothDevice | undefined>;
    let connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let batteryCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
    let mockBluetoothDevice: jasmine.SpyObj<BluetoothDevice>;
    let mockBatteryCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockOtaTxCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockOtaRxCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockModelNumberCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockFirmwareNumberCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockManufacturerNameCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockOtaService: jasmine.SpyObj<BluetoothRemoteGATTService>;
    let mockDeviceInfoService: jasmine.SpyObj<BluetoothRemoteGATTService>;

    beforeEach((): void => {
        matSnackBarSpy = jasmine.createSpyObj<MatSnackBar>("MatSnackBar", ["open"]);

        mockBluetoothDevice = createMockBluetoothDevice();
        mockBatteryCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockOtaTxCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockOtaRxCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockModelNumberCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockFirmwareNumberCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockManufacturerNameCharacteristic = createMockCharacteristic(mockBluetoothDevice);

        mockBatteryCharacteristic.readValue.and.resolveTo(createBatteryDataView(42));

        connectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>({
            status: "disconnected",
        });

        batteryCharacteristicSubject = new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(
            mockBatteryCharacteristic,
        );

        mockOtaService = jasmine.createSpyObj<BluetoothRemoteGATTService>("BluetoothRemoteGATTService", [
            "getCharacteristic",
        ]);
        (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).getPrimaryService
            .withArgs(OTA_SERVICE)
            .and.resolveTo(mockOtaService);
        mockOtaService.getCharacteristic
            .withArgs(OTA_TX_CHARACTERISTIC)
            .and.resolveTo(mockOtaTxCharacteristic);
        mockOtaService.getCharacteristic
            .withArgs(OTA_RX_CHARACTERISTIC)
            .and.resolveTo(mockOtaRxCharacteristic);

        mockDeviceInfoService = jasmine.createSpyObj<BluetoothRemoteGATTService>(
            "BluetoothRemoteGATTService",
            ["getCharacteristic"],
        );
        (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).getPrimaryService
            .withArgs(DEVICE_INFO_SERVICE)
            .and.resolveTo(mockDeviceInfoService);
        mockDeviceInfoService.getCharacteristic
            .withArgs(MODEL_NUMBER_CHARACTERISTIC)
            .and.resolveTo(mockModelNumberCharacteristic);
        mockDeviceInfoService.getCharacteristic
            .withArgs(FIRMWARE_NUMBER_CHARACTERISTIC)
            .and.resolveTo(mockFirmwareNumberCharacteristic);
        mockDeviceInfoService.getCharacteristic
            .withArgs(MANUFACTURER_NAME_CHARACTERISTIC)
            .and.resolveTo(mockManufacturerNameCharacteristic);

        ergConnectionServiceSpy = jasmine.createSpyObj<ErgConnectionService>(
            "ErgConnectionService",
            ["connectToBattery", "readBatteryCharacteristic", "resetBatteryCharacteristic"],
            {
                bluetoothDevice: mockBluetoothDevice,
                batteryCharacteristic$: batteryCharacteristicSubject.asObservable(),
                connectionStatus$: jasmine
                    .createSpy("connectionStatus$")
                    .and.returnValue(connectionStatusSubject.asObservable()),
            },
        );

        bluetoothDeviceSpy = Object.getOwnPropertyDescriptor(ergConnectionServiceSpy, "bluetoothDevice")
            ?.get as jasmine.Spy<() => BluetoothDevice | undefined>;

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

            expect(
                (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).getPrimaryService,
            ).toHaveBeenCalledWith(OTA_SERVICE);
            expect(result).toBeDefined();
            expect(result.responseCharacteristic).toBeDefined();
            expect(result.sendCharacteristic).toBeDefined();
        });

        describe("should throw error", (): void => {
            describe("when OTA service", (): void => {
                it("is not found", async (): Promise<void> => {
                    (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).getPrimaryService
                        .withArgs(OTA_SERVICE)
                        .and.resolveTo(undefined);

                    await expectAsync(ergGenericDataService.getOtaCharacteristics()).toBeRejectedWithError(
                        "Not able to connect to OTA service",
                    );
                });

                it("RX characteristics are not found", async (): Promise<void> => {
                    mockOtaService.getCharacteristic.withArgs(OTA_RX_CHARACTERISTIC).and.resolveTo(undefined);

                    await expectAsync(ergGenericDataService.getOtaCharacteristics()).toBeRejectedWithError(
                        "Not able to connect to OTA service",
                    );
                });

                it("when TX characteristics are not found", async (): Promise<void> => {
                    mockOtaService.getCharacteristic.withArgs(OTA_TX_CHARACTERISTIC).and.resolveTo(undefined);

                    await expectAsync(ergGenericDataService.getOtaCharacteristics()).toBeRejectedWithError(
                        "Not able to connect to OTA service",
                    );
                });
            });

            it("when bluetoothDevice is undefined", async (): Promise<void> => {
                bluetoothDeviceSpy.and.returnValue(undefined);

                await expectAsync(ergGenericDataService.getOtaCharacteristics()).toBeRejected();
            });
        });
    });

    describe("deviceInfo$ observable", (): void => {
        it("should not call readDeviceInfo multiple times for multiple deviceInfo$ subscriptions due to shareReplay", (): void => {
            const getPrimaryServiceSpy = (
                mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>
            ).getPrimaryService as jasmine.Spy;

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
            mockModelNumberCharacteristic.readValue.and.resolveTo(
                new DataView(new TextEncoder().encode("Test Model").buffer),
            );
            mockFirmwareNumberCharacteristic.readValue.and.resolveTo(
                new DataView(new TextEncoder().encode("v1.2.3").buffer),
            );
            mockManufacturerNameCharacteristic.readValue.and.resolveTo(
                new DataView(new TextEncoder().encode("Test Manufacturer").buffer),
            );
        });

        it("should initialize with empty device info when disconnected", (): void => {
            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(deviceInfo).toEqual({});
        });

        it("should update device info when connection status changes to connected", fakeAsync((): void => {
            connectionStatusSubject.next({ status: "connected" });
            tick(1000);

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(
                (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).getPrimaryService,
            ).toHaveBeenCalledWith(DEVICE_INFO_SERVICE);
            expect(mockDeviceInfoService.getCharacteristic).toHaveBeenCalledWith(MODEL_NUMBER_CHARACTERISTIC);
            expect(mockDeviceInfoService.getCharacteristic).toHaveBeenCalledWith(
                FIRMWARE_NUMBER_CHARACTERISTIC,
            );
            expect(mockDeviceInfoService.getCharacteristic).toHaveBeenCalledWith(
                MANUFACTURER_NAME_CHARACTERISTIC,
            );
            expect(mockModelNumberCharacteristic.readValue).toHaveBeenCalled();
            expect(mockFirmwareNumberCharacteristic.readValue).toHaveBeenCalled();
            expect(mockManufacturerNameCharacteristic.readValue).toHaveBeenCalled();
            expect(deviceInfo.modelNumber).toBe("Test Model");
            expect(deviceInfo.firmwareNumber).toBe("v1.2.3");
            expect(deviceInfo.manufacturerName).toBe("Test Manufacturer");
        }));

        it("should handle partial read failures gracefully when connected", fakeAsync((): void => {
            mockFirmwareNumberCharacteristic.readValue.and.rejectWith(new Error("Read failed"));

            connectionStatusSubject.next({ status: "connected" });
            tick(1000);

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(deviceInfo.modelNumber).toBe("Test Model");
            expect(deviceInfo.firmwareNumber).toBeUndefined();
            expect(deviceInfo.manufacturerName).toBe("Test Manufacturer");
        }));

        it("should handle all characteristic read failures when connected", fakeAsync((): void => {
            mockModelNumberCharacteristic.readValue.and.rejectWith(new Error("Read failed"));
            mockFirmwareNumberCharacteristic.readValue.and.rejectWith(new Error("Connection lost"));
            mockManufacturerNameCharacteristic.readValue.and.rejectWith(new Error("Device error"));

            connectionStatusSubject.next({ status: "connected" });
            tick();

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(deviceInfo.modelNumber).toBeUndefined();
            expect(deviceInfo.firmwareNumber).toBeUndefined();
            expect(deviceInfo.manufacturerName).toBeUndefined();
        }));

        it("should clear device info when connection status changes to disconnected", fakeAsync((): void => {
            connectionStatusSubject.next({ status: "connected" });
            tick(1000);

            let deviceInfo = ergGenericDataService.deviceInfo();
            expect(deviceInfo.modelNumber).toBe("Test Model");

            connectionStatusSubject.next({ status: "disconnected" });
            tick();

            deviceInfo = ergGenericDataService.deviceInfo();
            expect(deviceInfo).toEqual({});
        }));

        it("should show snack and return empty object when device gatt is undefined", fakeAsync((): void => {
            bluetoothDeviceSpy.and.returnValue({ gatt: undefined } as BluetoothDevice);

            connectionStatusSubject.next({ status: "connected" });
            tick();

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(matSnackBarSpy.open).toHaveBeenCalledWith("Ergometer Monitor is not connected", "Dismiss");
            expect(deviceInfo).toEqual({});
        }));

        it("should show snack and return empty object when bluetoothDevice is undefined", fakeAsync((): void => {
            bluetoothDeviceSpy.and.returnValue(undefined);

            connectionStatusSubject.next({ status: "connected" });
            tick();

            const deviceInfo = ergGenericDataService.deviceInfo();

            expect(matSnackBarSpy.open).toHaveBeenCalledWith("Ergometer Monitor is not connected", "Dismiss");
            expect(deviceInfo).toEqual({});
        }));

        describe("when error occurs", (): void => {
            it("should handle it and show snack message", fakeAsync((): void => {
                const errorMessage = "Service unavailable";

                (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).getPrimaryService
                    .withArgs(DEVICE_INFO_SERVICE)
                    .and.rejectWith(new Error(errorMessage));

                connectionStatusSubject.next({ status: "connected" });
                tick();

                const deviceInfo = ergGenericDataService.deviceInfo();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(errorMessage, "Dismiss");
                expect(deviceInfo).toEqual({});
            }));
        });
    });

    describe("streamMonitorBatteryLevel$ method", (): void => {
        it("should handle characteristics properly", (done: DoneFn): void => {
            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            mockCharacteristic.readValue.and.resolveTo(createBatteryDataView(42));

            batteryCharacteristicSubject.next(mockCharacteristic);

            ergGenericDataService.streamMonitorBatteryLevel$().subscribe({
                next: (batteryLevel: number): void => {
                    expect(typeof batteryLevel).toBe("number");
                    expect(batteryLevel).toEqual(42);
                    done();
                },
            });
        });

        it("should retry on error and eventually emit after retry", fakeAsync((): void => {
            const results: Array<number> = [];
            batteryCharacteristicSubject.next(undefined);

            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            mockCharacteristic.readValue = jasmine
                .createSpy("readValue")
                .and.returnValues(
                    Promise.reject(new Error("unknown error")),
                    Promise.resolve(createBatteryDataView(55)),
                    Promise.resolve(createBatteryDataView(50)),
                );
            ergConnectionServiceSpy.readBatteryCharacteristic.and.returnValue(mockCharacteristic);

            ergGenericDataService.streamMonitorBatteryLevel$().subscribe({
                next: (batteryLevel: number): void => {
                    results.push(batteryLevel);
                },
                error: (err: unknown): void => {
                    fail("Should not error: " + String(err));
                },
            });

            batteryCharacteristicSubject.next(mockCharacteristic);
            tick(5000);
            batteryCharacteristicSubject.next(mockCharacteristic);
            flush();
            expect(results).toEqual([55, 50]);
            expect(ergConnectionServiceSpy.connectToBattery).toHaveBeenCalled();
        }));

        it("should emit 0 and show snackBar on error after retries", fakeAsync((): void => {
            batteryCharacteristicSubject.next(undefined);

            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            mockCharacteristic.readValue = jasmine.createSpy("readValue").and.throwError("fail");
            ergConnectionServiceSpy.readBatteryCharacteristic.and.returnValue(mockCharacteristic);

            ergGenericDataService.streamMonitorBatteryLevel$().subscribe({
                next: (batteryLevel: number): void => {
                    expect(batteryLevel).toBe(0);
                    expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                        "Error while connecting to battery service",
                        "Dismiss",
                    );
                },
                error: (err: unknown): void => {
                    fail("Should not error: " + String(err));
                },
            });

            batteryCharacteristicSubject.next(mockCharacteristic);
            for (let i = 0; i < 4; i++) {
                tick(5000);
                batteryCharacteristicSubject.next(mockCharacteristic);
            }
        }));

        it("should not emit when readValue returns empty DataView", fakeAsync((): void => {
            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            mockCharacteristic.readValue = jasmine
                .createSpy("readValue")
                .and.resolveTo(new DataView(new ArrayBuffer(0)));
            ergConnectionServiceSpy.readBatteryCharacteristic.and.returnValue(mockCharacteristic);
            ergGenericDataService.streamMonitorBatteryLevel$().subscribe({
                next: (batteryLevel: number): void => {
                    fail(`Should not emit, battery level: ${batteryLevel}`);
                },
                error: (err: unknown): void => {
                    fail("Should not error: " + String(err));
                },
            });
            batteryCharacteristicSubject.next(mockCharacteristic);
            expect().nothing();
        }));

        it("should call resetBatteryCharacteristic on complete", (done: DoneFn): void => {
            const mockCharacteristic = createMockCharacteristic(mockBluetoothDevice);
            mockCharacteristic.readValue.and.resolveTo(createBatteryDataView(42));

            batteryCharacteristicSubject.next(mockCharacteristic);

            const subscription = ergGenericDataService.streamMonitorBatteryLevel$().subscribe({
                next: (): void => {
                    subscription.unsubscribe();

                    expect(ergConnectionServiceSpy.resetBatteryCharacteristic).toHaveBeenCalled();
                    done();
                },
                error: (): void => {
                    done.fail("Should not error");
                },
            });
        });
    });
});
