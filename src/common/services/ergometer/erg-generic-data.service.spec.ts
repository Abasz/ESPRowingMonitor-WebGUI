import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Observable, of, Subject } from "rxjs";

import {
    DEVICE_INFO_SERVICE,
    IDeviceInformation,
    IOtaCharacteristics,
    OTA_SERVICE,
} from "../../ble.interfaces";

import { ErgConnectionService } from "./erg-connection.service";
import { ErgGenericDataService } from "./erg-generic-data.service";

describe("ErgGenericDataService", (): void => {
    let ergGenericDataService: ErgGenericDataService;
    let matSnackBarSpy: jasmine.SpyObj<MatSnackBar>;
    let ergConnectionServiceSpy: jasmine.SpyObj<ErgConnectionService>;
    let bluetoothDeviceGetterSpy: jasmine.Spy<() => BluetoothDevice | undefined>;
    let batteryCharacteristicGetterSpy: jasmine.Spy<() => Observable<BluetoothRemoteGATTCharacteristic>>;

    const createMockBluetoothDevice = (overrides: Partial<BluetoothDevice> = {}): BluetoothDevice => {
        const baseBluetoothDevice: Partial<BluetoothDevice> = {
            id: "mock-device-id",
            name: "Mock Ergo",
            addEventListener: jasmine.createSpy("device.addEventListener"),
            removeEventListener: jasmine.createSpy("device.removeEventListener"),
        };

        const gattServer = {
            connected: true,
            getPrimaryService: jasmine
                .createSpy("getPrimaryService")
                .and.callFake((serviceId: string): Promise<BluetoothRemoteGATTService> => {
                    if (serviceId === DEVICE_INFO_SERVICE || serviceId === OTA_SERVICE) {
                        return Promise.resolve({
                            getCharacteristic: jasmine.createSpy("getCharacteristic").and.callFake(
                                (_characteristicId: string): Promise<BluetoothRemoteGATTCharacteristic> =>
                                    Promise.resolve({
                                        service: {
                                            device: baseBluetoothDevice as BluetoothDevice,
                                        },
                                        readValue: jasmine
                                            .createSpy("readValue")
                                            .and.returnValue(
                                                Promise.resolve(new DataView(new ArrayBuffer(1))),
                                            ),
                                        startNotifications: jasmine
                                            .createSpy("startNotifications")
                                            .and.resolveTo(),
                                    } as unknown as BluetoothRemoteGATTCharacteristic),
                            ),
                        } as unknown as BluetoothRemoteGATTService);
                    }

                    return Promise.reject(new Error("Service not found"));
                }),
        };

        return { ...baseBluetoothDevice, gatt: gattServer, ...overrides } as BluetoothDevice;
    };

    const createMockCharacteristic = (): BluetoothRemoteGATTCharacteristic => {
        return {
            service: {
                device: createMockBluetoothDevice(),
            },
            readValue: jasmine.createSpy("readValue").and.callFake((): Promise<DataView> => {
                const dv = new DataView(new ArrayBuffer(1));
                dv.setUint8(0, 42);

                return Promise.resolve(dv);
            }),
            startNotifications: jasmine.createSpy("startNotifications").and.resolveTo(),
            addEventListener: jasmine.createSpy("characteristic.addEventListener"),
            removeEventListener: jasmine.createSpy("characteristic.removeEventListener"),
            oncharacteristicvaluechanged: undefined,
        } as unknown as BluetoothRemoteGATTCharacteristic;
    };

    beforeEach((): void => {
        matSnackBarSpy = jasmine.createSpyObj<MatSnackBar>("MatSnackBar", ["open"]);
        ergConnectionServiceSpy = jasmine.createSpyObj<ErgConnectionService>(
            "ErgConnectionService",
            ["connectToBattery", "readBatteryCharacteristic", "resetBatteryCharacteristic"],
            ["bluetoothDevice", "batteryCharacteristic$"],
        );

        // setup property spies with default behavior
        bluetoothDeviceGetterSpy = (
            (
                Object.getOwnPropertyDescriptor(
                    ergConnectionServiceSpy,
                    "bluetoothDevice",
                ) as PropertyDescriptor
            ).get! as jasmine.Spy
        ).and.returnValue(createMockBluetoothDevice());

        batteryCharacteristicGetterSpy = (
            (
                Object.getOwnPropertyDescriptor(
                    ergConnectionServiceSpy,
                    "batteryCharacteristic$",
                ) as PropertyDescriptor
            ).get! as jasmine.Spy
        ).and.returnValue(of(createMockCharacteristic()));

        TestBed.configureTestingModule({
            providers: [
                ErgGenericDataService,
                { provide: MatSnackBar, useValue: matSnackBarSpy },
                { provide: ErgConnectionService, useValue: ergConnectionServiceSpy },
            ],
        });

        ergGenericDataService = TestBed.inject(ErgGenericDataService);
    });

    it("should be created", (): void => {
        expect(ergGenericDataService).toBeTruthy();
    });

    describe("getOtaCharacteristics method", (): void => {
        it("should return OTA characteristics when device is connected", async (): Promise<void> => {
            const mockDevice = createMockBluetoothDevice();
            bluetoothDeviceGetterSpy.and.returnValue(mockDevice);

            const result: IOtaCharacteristics = await ergGenericDataService.getOtaCharacteristics();

            expect(mockDevice.gatt?.getPrimaryService).toHaveBeenCalledWith(OTA_SERVICE);
            expect(result).toBeDefined();
            expect(result.responseCharacteristic).toBeDefined();
            expect(result.sendCharacteristic).toBeDefined();
        });

        describe("should throw error", (): void => {
            it("when OTA service characteristics are not found", async (): Promise<void> => {
                const mockDevice = createMockBluetoothDevice();
                const mockService = {
                    getCharacteristic: jasmine.createSpy("getCharacteristic").and.resolveTo(undefined),
                };

                (mockDevice.gatt?.getPrimaryService as jasmine.Spy).and.returnValue(
                    Promise.resolve(mockService),
                );

                bluetoothDeviceGetterSpy.and.returnValue(mockDevice);

                await expectAsync(ergGenericDataService.getOtaCharacteristics()).toBeRejectedWithError(
                    "Not able to connect to OTA service",
                );
            });

            it("when bluetoothDevice is undefined", async (): Promise<void> => {
                bluetoothDeviceGetterSpy.and.returnValue(undefined);

                await expectAsync(ergGenericDataService.getOtaCharacteristics()).toBeRejected();
            });
        });
    });

    describe("readDeviceInfo method", (): void => {
        it("should return device information when device is connected", async (): Promise<void> => {
            const mockDevice = createMockBluetoothDevice();
            bluetoothDeviceGetterSpy.and.returnValue(mockDevice);

            const result: IDeviceInformation = await ergGenericDataService.readDeviceInfo();

            expect(mockDevice.gatt?.getPrimaryService).toHaveBeenCalledWith(DEVICE_INFO_SERVICE);
            expect(result).toBeDefined();
        });

        it("should show snack and return empty object when device is not connected", async (): Promise<void> => {
            bluetoothDeviceGetterSpy.and.returnValue({ gatt: undefined } as BluetoothDevice);

            const result: IDeviceInformation = await ergGenericDataService.readDeviceInfo();

            expect(matSnackBarSpy.open).toHaveBeenCalledWith("Ergometer Monitor is not connected", "Dismiss");
            expect(result).toEqual({});
        });

        it("should show snack and return empty object when bluetoothDevice is undefined", async (): Promise<void> => {
            bluetoothDeviceGetterSpy.and.returnValue(undefined);

            const result: IDeviceInformation = await ergGenericDataService.readDeviceInfo();

            expect(matSnackBarSpy.open).toHaveBeenCalledWith("Ergometer Monitor is not connected", "Dismiss");
            expect(result).toEqual({});
        });

        describe("when error occurs", (): void => {
            it("should handle it and show snack message", async (): Promise<void> => {
                const mockDevice = createMockBluetoothDevice();
                const errorMessage = "Service unavailable";

                (mockDevice.gatt?.getPrimaryService as jasmine.Spy).and.returnValue(
                    Promise.reject(new Error(errorMessage)),
                );

                bluetoothDeviceGetterSpy.and.returnValue(mockDevice);

                spyOn(console, "error");

                const result: IDeviceInformation = await ergGenericDataService.readDeviceInfo();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(errorMessage, "Dismiss");
                expect(console.error).toHaveBeenCalledWith("readDeviceInfo:", jasmine.any(Error));
                expect(result).toEqual({});
            });
        });
    });

    describe("streamMonitorBatteryLevel$ method", (): void => {
        it("should handle characteristics properly", (done: DoneFn): void => {
            const mockCharacteristic = createMockCharacteristic();
            batteryCharacteristicGetterSpy.and.returnValue(of(mockCharacteristic));

            ergGenericDataService.streamMonitorBatteryLevel$().subscribe({
                next: (batteryLevel: number): void => {
                    expect(typeof batteryLevel).toBe("number");
                    expect(batteryLevel).toEqual(42);
                    done();
                },
            });
        });

        it("should retry on error and eventually emit after retry", fakeAsync((): void => {
            const batteryCharacteristicSubject = new Subject<BluetoothRemoteGATTCharacteristic>();
            batteryCharacteristicGetterSpy.and.returnValue(batteryCharacteristicSubject.asObservable());
            const mockCharacteristic = createMockCharacteristic();
            mockCharacteristic.readValue = jasmine.createSpy("readValue").and.returnValues(
                Promise.reject(new Error("unknown error")),
                ((): Promise<DataView<ArrayBuffer>> => {
                    const buffer = new ArrayBuffer(1);
                    const view = new DataView(buffer);
                    view.setUint8(0, 55);

                    return Promise.resolve(view);
                })(),
            );
            ergConnectionServiceSpy.readBatteryCharacteristic.and.returnValue(mockCharacteristic);

            ergGenericDataService.streamMonitorBatteryLevel$().subscribe({
                next: (batteryLevel: number): void => {
                    expect(batteryLevel).toBe(55);
                    expect(ergConnectionServiceSpy.connectToBattery).toHaveBeenCalled();
                },
                complete: (): void => {
                    fail("Should not complete");
                },
                error: (err: unknown): void => {
                    fail("Should not error: " + String(err));
                },
            });

            batteryCharacteristicSubject.next(mockCharacteristic);
            tick(5001);
            batteryCharacteristicSubject.next(mockCharacteristic);
        }));

        it("should emit 0 and show snackBar on error after retries", fakeAsync((): void => {
            const batteryCharacteristicSubject = new Subject<BluetoothRemoteGATTCharacteristic>();
            batteryCharacteristicGetterSpy.and.returnValue(batteryCharacteristicSubject.asObservable());
            const mockCharacteristic = createMockCharacteristic();
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
                tick(5001);
                batteryCharacteristicSubject.next(mockCharacteristic);
            }
        }));

        it("should not emit when readValue returns empty DataView", (): void => {
            const batteryCharacteristicSubject = new Subject<BluetoothRemoteGATTCharacteristic>();
            batteryCharacteristicGetterSpy.and.returnValue(batteryCharacteristicSubject.asObservable());
            const mockCharacteristic = createMockCharacteristic();
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
            expect().nothing();
            batteryCharacteristicSubject.next(mockCharacteristic);
        });

        it("should call resetBatteryCharacteristic on complete", (done: DoneFn): void => {
            const mockCharacteristic = createMockCharacteristic();
            batteryCharacteristicGetterSpy.and.returnValue(of(mockCharacteristic));

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
