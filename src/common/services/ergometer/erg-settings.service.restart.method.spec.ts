import { provideZonelessChangeDetection } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";

import {
    BleOpCodes,
    BleResponseOpCodes,
    SETTINGS_CONTROL_POINT,
    SETTINGS_SERVICE,
} from "../../ble.interfaces";
import {
    changedListenerReadyFactory,
    createMockBluetoothDevice,
    createMockCharacteristic,
    createMockControlPointResponseDataView,
    ListenerTrigger,
} from "../ble.test.helpers";

import { ErgConnectionService } from "./erg-connection.service";
import { ErgSettingsService } from "./erg-settings.service";

describe("ErgSettingsService other control-point API", (): void => {
    let service: ErgSettingsService;
    let mockSnackBar: jasmine.SpyObj<MatSnackBar>;
    let mockErgConnectionService: jasmine.SpyObj<ErgConnectionService>;
    let mockBluetoothDevice: jasmine.SpyObj<BluetoothDevice>;

    // characteristics and services
    let mockSettingsCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockStrokeSettingsCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockSettingsControlPointCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;

    // subjects for observables
    let settingsCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
    let strokeSettingsCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;

    let createControlPointValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView>>;

    beforeEach((): void => {
        mockSnackBar = jasmine.createSpyObj<MatSnackBar>("MatSnackBar", ["open"]);

        mockBluetoothDevice = createMockBluetoothDevice("test-device-id", "Test Ergo", true);
        mockSettingsCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockStrokeSettingsCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockSettingsControlPointCharacteristic = createMockCharacteristic(mockBluetoothDevice);

        (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).getPrimaryService
            .withArgs(SETTINGS_SERVICE)
            .and.resolveTo(mockSettingsCharacteristic.service);
        (mockSettingsCharacteristic.service as jasmine.SpyObj<BluetoothRemoteGATTService>).getCharacteristic
            .withArgs(SETTINGS_CONTROL_POINT)
            .and.resolveTo(mockSettingsControlPointCharacteristic);

        settingsCharacteristicSubject = new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(
            undefined,
        );
        strokeSettingsCharacteristicSubject = new BehaviorSubject<
            BluetoothRemoteGATTCharacteristic | undefined
        >(undefined);

        mockErgConnectionService = jasmine.createSpyObj(
            "ErgConnectionService",
            [
                "readSettingsCharacteristic",
                "readStrokeSettingsCharacteristic",
                "readMeasurementCharacteristic",
                "resetSettingsCharacteristic",
                "resetStrokeSettingsCharacteristic",
                "connectToSettings",
                "connectToStrokeSettings",
                "discover",
            ],
            {
                bluetoothDevice: mockBluetoothDevice,
                settingsCharacteristic$: settingsCharacteristicSubject.asObservable(),
                strokeSettingsCharacteristic$: strokeSettingsCharacteristicSubject.asObservable(),
            },
        );

        mockErgConnectionService.readSettingsCharacteristic.and.returnValue(mockSettingsCharacteristic);
        mockErgConnectionService.readStrokeSettingsCharacteristic.and.returnValue(
            mockStrokeSettingsCharacteristic,
        );
        mockErgConnectionService.readMeasurementCharacteristic.and.returnValue(mockSettingsCharacteristic);

        createControlPointValueChangedListenerReady = changedListenerReadyFactory<
            typeof mockSettingsControlPointCharacteristic,
            DataView
        >(mockSettingsControlPointCharacteristic, "characteristicvaluechanged");

        TestBed.configureTestingModule({
            providers: [
                ErgSettingsService,
                { provide: MatSnackBar, useValue: mockSnackBar },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                provideZonelessChangeDetection(),
            ],
        });

        service = TestBed.inject(ErgSettingsService);
    });

    describe("restartDevice method", (): void => {
        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                mockErgConnectionService.readSettingsCharacteristic.and.returnValue(undefined);
                (
                    Object.getOwnPropertyDescriptor(mockSettingsCharacteristic, "service")?.get as jasmine.Spy
                ).and.returnValue(undefined);
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.restartDevice();

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early", async (): Promise<void> => {
                await service.restartDevice();

                expect(
                    mockSettingsControlPointCharacteristic.service.getCharacteristic,
                ).not.toHaveBeenCalledWith(SETTINGS_CONTROL_POINT);
            });
        });

        describe("when service is not available", (): void => {
            beforeEach((): void => {
                (
                    Object.getOwnPropertyDescriptor(mockSettingsCharacteristic, "service")?.get as jasmine.Spy
                ).and.returnValue(undefined);
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.restartDevice();

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early", async (): Promise<void> => {
                await service.restartDevice();

                expect(
                    mockSettingsControlPointCharacteristic.service.getCharacteristic,
                ).not.toHaveBeenCalled();
            });
        });

        describe("when device is connected", (): void => {
            let controlPointTrigger: Promise<ListenerTrigger<DataView>>;

            beforeEach(async (): Promise<void> => {
                controlPointTrigger = createControlPointValueChangedListenerReady(
                    createMockControlPointResponseDataView(
                        BleOpCodes.RestartDevice,
                        BleResponseOpCodes.Successful,
                    ),
                );
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            it("should write restart device command", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).toHaveBeenCalledWith(
                    new Uint8Array([BleOpCodes.RestartDevice]),
                );
            });

            it("should display success message when operation succeeds", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Restarting device", "Dismiss");
            });

            it("should display error message when operation fails", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged(
                    createMockControlPointResponseDataView(
                        BleOpCodes.RestartDevice,
                        BleResponseOpCodes.InvalidParameter,
                    ),
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "An error occurred while restarting device",
                    "Dismiss",
                );
            });

            it("should not stop notifications", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.stopNotifications).not.toHaveBeenCalled();
            });
        });

        describe("when BLE operation throws error", (): void => {
            it("should display timeout error message when TimeoutError thrown", fakeAsync((): void => {
                service.restartDevice().catch((): void => {
                    // no-op
                });

                tick(1000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to set restart device, request timed out",
                    "Dismiss",
                );
            }));

            it("should display generic error message for other errors", async (): Promise<void> => {
                mockSettingsControlPointCharacteristic.writeValueWithoutResponse.and.rejectWith(
                    new Error("BLE error"),
                );
                const triggerHandler = createControlPointValueChangedListenerReady();

                const sut = service.restartDevice();
                (await triggerHandler).triggerChanged(
                    ((): Error => new Error("BLE error"))() as unknown as DataView,
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to set restart device", "Dismiss");
            });
        });
    });
});
