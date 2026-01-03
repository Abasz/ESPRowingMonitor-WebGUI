import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    let mockSnackBar: Pick<MatSnackBar, "open">;
    let mockErgConnectionService: Pick<
        ErgConnectionService,
        | "readSettingsCharacteristic"
        | "readStrokeSettingsCharacteristic"
        | "readMeasurementCharacteristic"
        | "resetSettingsCharacteristic"
        | "resetStrokeSettingsCharacteristic"
        | "connectToSettings"
        | "connectToStrokeSettings"
        | "disconnectDevice"
        | "discover"
        | "bluetoothDevice"
        | "settingsCharacteristic$"
        | "strokeSettingsCharacteristic$"
    >;
    let mockBluetoothDevice: BluetoothDevice;

    // characteristics and services
    let mockSettingsCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockStrokeSettingsCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockSettingsControlPointCharacteristic: BluetoothRemoteGATTCharacteristic;

    // subjects for observables
    let settingsCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;
    let strokeSettingsCharacteristicSubject: BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>;

    let createControlPointValueChangedListenerReady: (
        broadcastValue?: DataView,
    ) => Promise<ListenerTrigger<DataView>>;

    beforeEach((): void => {
        mockSnackBar = {
            open: vi.fn(),
        };

        mockBluetoothDevice = createMockBluetoothDevice("test-device-id", "Test Ergo", true);
        mockSettingsCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockStrokeSettingsCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockSettingsControlPointCharacteristic = createMockCharacteristic(mockBluetoothDevice);

        vi.mocked(mockBluetoothDevice.gatt!.getPrimaryService).mockImplementation(
            (service: unknown): Promise<BluetoothRemoteGATTService> =>
                service === SETTINGS_SERVICE
                    ? Promise.resolve(mockSettingsCharacteristic.service)
                    : Promise.reject(new Error("Service not found")),
        );
        vi.mocked(mockSettingsCharacteristic.service.getCharacteristic).mockImplementation(
            (char: unknown): Promise<BluetoothRemoteGATTCharacteristic> =>
                char === SETTINGS_CONTROL_POINT
                    ? Promise.resolve(mockSettingsControlPointCharacteristic)
                    : Promise.reject(new Error("Characteristic not found")),
        );

        settingsCharacteristicSubject = new BehaviorSubject<BluetoothRemoteGATTCharacteristic | undefined>(
            undefined,
        );
        strokeSettingsCharacteristicSubject = new BehaviorSubject<
            BluetoothRemoteGATTCharacteristic | undefined
        >(undefined);

        mockErgConnectionService = {
            readSettingsCharacteristic: vi.fn(),
            readStrokeSettingsCharacteristic: vi.fn(),
            readMeasurementCharacteristic: vi.fn(),
            resetSettingsCharacteristic: vi.fn(),
            resetStrokeSettingsCharacteristic: vi.fn(),
            connectToSettings: vi.fn(),
            connectToStrokeSettings: vi.fn(),
            disconnectDevice: vi.fn(),
            discover: vi.fn(),
            bluetoothDevice: mockBluetoothDevice,
            settingsCharacteristic$: settingsCharacteristicSubject.asObservable(),
            strokeSettingsCharacteristic$: strokeSettingsCharacteristicSubject.asObservable(),
        };

        vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(
            mockSettingsCharacteristic,
        );
        vi.mocked(mockErgConnectionService.readStrokeSettingsCharacteristic).mockReturnValue(
            mockStrokeSettingsCharacteristic,
        );
        vi.mocked(mockErgConnectionService.readMeasurementCharacteristic).mockReturnValue(
            mockSettingsCharacteristic,
        );

        createControlPointValueChangedListenerReady = changedListenerReadyFactory(
            mockSettingsControlPointCharacteristic,
            "characteristicvaluechanged",
        );

        TestBed.configureTestingModule({
            providers: [
                ErgSettingsService,
                { provide: MatSnackBar, useValue: mockSnackBar },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
            ],
        });

        service = TestBed.inject(ErgSettingsService);
    });

    describe("restartDevice method", (): void => {
        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(undefined);
                vi.spyOn(mockSettingsCharacteristic, "service", "get").mockReturnValue(
                    undefined as unknown as BluetoothRemoteGATTService,
                );
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
                vi.spyOn(mockSettingsCharacteristic, "service", "get").mockReturnValue(
                    undefined as unknown as BluetoothRemoteGATTService,
                );
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
                vi.useFakeTimers();
                controlPointTrigger = createControlPointValueChangedListenerReady(
                    createMockControlPointResponseDataView(
                        BleOpCodes.RestartDevice,
                        BleResponseOpCodes.Successful,
                    ),
                );
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged();
                await vi.advanceTimersByTimeAsync(1000);
                await sut;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged();
                await vi.advanceTimersByTimeAsync(1000);
                await sut;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            it("should write restart device command", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged();
                await vi.advanceTimersByTimeAsync(1000);
                await sut;

                expect(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).toHaveBeenCalledWith(
                    new Uint8Array([BleOpCodes.RestartDevice]),
                );
            });

            it("should display success message when operation succeeds", async (): Promise<void> => {
                const sut = service.restartDevice();
                (await controlPointTrigger).triggerChanged();
                await vi.advanceTimersByTimeAsync(1000);
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
                await vi.advanceTimersByTimeAsync(1000);
                await sut;

                expect(mockSettingsControlPointCharacteristic.stopNotifications).not.toHaveBeenCalled();
            });
        });

        describe("when BLE operation throws error", (): void => {
            it("should display timeout error message when TimeoutError thrown", async (): Promise<void> => {
                vi.useFakeTimers();
                const restartPromise = service.restartDevice();

                await vi.advanceTimersByTimeAsync(1000);
                await restartPromise;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to set restart device, request timed out",
                    "Dismiss",
                );
                vi.useRealTimers();
            });

            it("should display generic error message for other errors", async (): Promise<void> => {
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
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
