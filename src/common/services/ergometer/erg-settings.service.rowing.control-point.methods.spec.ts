import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    BleOpCodes,
    BleResponseOpCodes,
    SETTINGS_CONTROL_POINT,
    SETTINGS_SERVICE,
} from "../../ble.interfaces";
import {
    IDragFactorSettings,
    IMachineSettings,
    ISensorSignalSettings,
    IStrokeDetectionSettings,
} from "../../common.interfaces";
import {
    changedListenerReadyFactory,
    createMockBluetoothDevice,
    createMockCharacteristic,
    createMockControlPointResponseDataView,
    ListenerTrigger,
} from "../ble.test.helpers";

import { ErgConnectionService } from "./erg-connection.service";
import { ErgSettingsService } from "./erg-settings.service";

describe("ErgSettingsService rowing control-point API", (): void => {
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

    describe("changeMachineSettings method", (): void => {
        const mockMachineSettings: IMachineSettings = {
            flywheelInertia: 0.097,
            magicConstant: 2.8,
            sprocketRadius: 0.04,
            impulsePerRevolution: 3,
        };

        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(undefined);
                vi.spyOn(mockErgConnectionService, "bluetoothDevice", "get").mockReturnValue(undefined);
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.changeMachineSettings(mockMachineSettings);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeMachineSettings(mockMachineSettings);

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
                await service.changeMachineSettings(mockMachineSettings);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early", async (): Promise<void> => {
                await service.changeMachineSettings(mockMachineSettings);

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
                        BleOpCodes.SetMachineSettings,
                        BleResponseOpCodes.Successful,
                    ),
                );
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const sut = service.changeMachineSettings(mockMachineSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications", async (): Promise<void> => {
                const sut = service.changeMachineSettings(mockMachineSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            it("should write machine settings command with correct payload", async (): Promise<void> => {
                const sut = service.changeMachineSettings(mockMachineSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                const expectedPayload = new DataView(new ArrayBuffer(9));
                expectedPayload.setUint8(0, BleOpCodes.SetMachineSettings);
                expectedPayload.setFloat32(1, mockMachineSettings.flywheelInertia, true);
                expectedPayload.setUint8(5, Math.round(mockMachineSettings.magicConstant * 35) & 0xff);
                expectedPayload.setUint8(6, mockMachineSettings.impulsePerRevolution & 0xff);
                expectedPayload.setUint16(7, Math.round(mockMachineSettings.sprocketRadius * 1000), true);

                expect(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).toHaveBeenCalledWith(
                    expectedPayload,
                );
            });

            it("should display success message when operation succeeds", async (): Promise<void> => {
                const sut = service.changeMachineSettings(mockMachineSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Machine settings changed", "Dismiss");
            });

            it("should display error message with response code when operation fails", async (): Promise<void> => {
                const responsePromise = service.changeMachineSettings(mockMachineSettings);

                const failureResponse = createMockControlPointResponseDataView(
                    BleOpCodes.SetMachineSettings,
                    BleResponseOpCodes.InvalidParameter,
                );
                (await controlPointTrigger).triggerChanged(failureResponse);

                await responsePromise;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    `An error occurred while changing machine settings (${BleResponseOpCodes[BleResponseOpCodes.InvalidParameter]})`,
                    "Dismiss",
                );
            });

            it("should stop notifications after operation", async (): Promise<void> => {
                const responsePromise = service.changeMachineSettings(mockMachineSettings);
                (await controlPointTrigger).triggerChanged();
                await responsePromise;

                expect(mockSettingsControlPointCharacteristic.stopNotifications).toHaveBeenCalled();
            });
        });

        describe("when BLE operation throws error", (): void => {
            it("should display timeout message when TimeoutError thrown", async (): Promise<void> => {
                vi.useFakeTimers();
                service.changeMachineSettings(mockMachineSettings).catch((): void => {
                    // no-op
                });

                await vi.advanceTimersByTimeAsync(10000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to set machine settings, request timed out",
                    "Dismiss",
                );
                vi.useRealTimers();
            });

            it("should display generic error message for other errors", async (): Promise<void> => {
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                    new Error("BLE error"),
                );

                const triggerHandler = createControlPointValueChangedListenerReady();

                const sut = service.changeMachineSettings(mockMachineSettings);
                (await triggerHandler).triggerChanged(
                    ((): Error => new Error("BLE error"))() as unknown as DataView,
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to set machine settings", "Dismiss");
            });
        });
    });

    describe("changeSensorSignalSettings method", (): void => {
        const mockSensorSignalSettings: ISensorSignalSettings = {
            rotationDebounceTime: 5,
            rowingStoppedThreshold: 3,
        };

        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(undefined);
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.changeSensorSignalSettings(mockSensorSignalSettings);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeSensorSignalSettings(mockSensorSignalSettings);

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
                await service.changeSensorSignalSettings(mockSensorSignalSettings);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeSensorSignalSettings(mockSensorSignalSettings);

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
                        BleOpCodes.SetSensorSignalSettings,
                        BleResponseOpCodes.Successful,
                    ),
                );
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const sut = service.changeSensorSignalSettings(mockSensorSignalSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications", async (): Promise<void> => {
                const sut = service.changeSensorSignalSettings(mockSensorSignalSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            it("should write sensor signal settings command with correct payload", async (): Promise<void> => {
                const sut = service.changeSensorSignalSettings(mockSensorSignalSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                const expectedPayload = new DataView(new ArrayBuffer(3));
                expectedPayload.setUint8(0, BleOpCodes.SetSensorSignalSettings);
                expectedPayload.setUint8(1, mockSensorSignalSettings.rotationDebounceTime);
                expectedPayload.setUint8(2, mockSensorSignalSettings.rowingStoppedThreshold);

                expect(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).toHaveBeenCalledWith(
                    expectedPayload,
                );
            });

            it("should display success message when operation succeeds", async (): Promise<void> => {
                const sut = service.changeSensorSignalSettings(mockSensorSignalSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Sensor signal settings changed", "Dismiss");
            });

            it("should display error message with response code when operation fails", async (): Promise<void> => {
                const sut = service.changeSensorSignalSettings(mockSensorSignalSettings);

                (await controlPointTrigger).triggerChanged(
                    createMockControlPointResponseDataView(
                        BleOpCodes.SetSensorSignalSettings,
                        BleResponseOpCodes.InvalidParameter,
                    ),
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    `An error occurred while changing sensor signal settings (${BleResponseOpCodes[BleResponseOpCodes.InvalidParameter]})`,
                    "Dismiss",
                );
            });

            it("should stop notifications after operation", async (): Promise<void> => {
                const sut = service.changeSensorSignalSettings(mockSensorSignalSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.stopNotifications).toHaveBeenCalled();
            });
        });

        describe("when BLE operation throws error", (): void => {
            it("should display timeout error message when TimeoutError thrown", async (): Promise<void> => {
                vi.useFakeTimers();
                service.changeSensorSignalSettings(mockSensorSignalSettings).catch((): void => {
                    // no-op
                });

                await vi.advanceTimersByTimeAsync(1000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to set sensor signal settings, request timed out",
                    "Dismiss",
                );
                vi.useRealTimers();
            });

            it("should display generic error message when other error thrown", async (): Promise<void> => {
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                    new Error("BLE error"),
                );
                const triggerHandler = createControlPointValueChangedListenerReady();

                const sut = service.changeSensorSignalSettings(mockSensorSignalSettings);
                (await triggerHandler).triggerChanged(
                    ((): Error => new Error("BLE error"))() as unknown as DataView,
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to set sensor signal settings",
                    "Dismiss",
                );
            });
        });
    });

    describe("changeDragFactorSettings method", (): void => {
        const mockDragFactorSettings: IDragFactorSettings = {
            goodnessOfFitThreshold: 0.96,
            maxDragFactorRecoveryPeriod: 3,
            dragFactorLowerThreshold: 90,
            dragFactorUpperThreshold: 220,
            dragCoefficientsArrayLength: 4,
        };

        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(undefined);
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.changeDragFactorSettings(mockDragFactorSettings);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeDragFactorSettings(mockDragFactorSettings);

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
                await service.changeDragFactorSettings(mockDragFactorSettings);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeDragFactorSettings(mockDragFactorSettings);

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
                        BleOpCodes.SetDragFactorSettings,
                        BleResponseOpCodes.Successful,
                    ),
                );
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const sut = service.changeDragFactorSettings(mockDragFactorSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications", async (): Promise<void> => {
                const sut = service.changeDragFactorSettings(mockDragFactorSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            it("should write drag factor settings command with correct payload", async (): Promise<void> => {
                const sut = service.changeDragFactorSettings(mockDragFactorSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                const expectedPayload = new DataView(new ArrayBuffer(8));
                expectedPayload.setUint8(0, BleOpCodes.SetDragFactorSettings);
                expectedPayload.setUint8(
                    1,
                    Math.round(mockDragFactorSettings.goodnessOfFitThreshold * 255) & 0xff,
                );
                expectedPayload.setUint8(2, mockDragFactorSettings.maxDragFactorRecoveryPeriod & 0xff);
                expectedPayload.setUint16(3, mockDragFactorSettings.dragFactorLowerThreshold, true);
                expectedPayload.setUint16(5, mockDragFactorSettings.dragFactorUpperThreshold, true);
                expectedPayload.setUint8(7, mockDragFactorSettings.dragCoefficientsArrayLength & 0xff);

                expect(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).toHaveBeenCalledWith(
                    expectedPayload,
                );
            });

            it("should display success message when operation succeeds", async (): Promise<void> => {
                const sut = service.changeDragFactorSettings(mockDragFactorSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Drag factor settings changed", "Dismiss");
            });

            it("should display error message with response code when operation fails", async (): Promise<void> => {
                const sut = service.changeDragFactorSettings(mockDragFactorSettings);

                const failureResponse = createMockControlPointResponseDataView(
                    BleOpCodes.SetDragFactorSettings,
                    BleResponseOpCodes.InvalidParameter,
                );
                (await controlPointTrigger).triggerChanged(failureResponse);
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    `An error occurred while changing machine settings (${BleResponseOpCodes[BleResponseOpCodes.InvalidParameter]})`,
                    "Dismiss",
                );
            });

            it("should stop notifications after operation", async (): Promise<void> => {
                const sut = service.changeDragFactorSettings(mockDragFactorSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.stopNotifications).toHaveBeenCalled();
            });
        });

        describe("when BLE operation throws error", (): void => {
            it("should display timeout error message when TimeoutError thrown", async (): Promise<void> => {
                vi.useFakeTimers();
                service.changeDragFactorSettings(mockDragFactorSettings).catch((): void => {
                    // no-op
                });

                await vi.advanceTimersByTimeAsync(1000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to set machine settings, request timed out",
                    "Dismiss",
                );
                vi.useRealTimers();
            });

            it("should re-throw TimeoutError", async (): Promise<void> => {
                vi.useFakeTimers();
                let thrownError: Error | undefined;

                service.changeDragFactorSettings(mockDragFactorSettings).catch((error: Error): void => {
                    thrownError = error;
                });

                await vi.advanceTimersByTimeAsync(1000);

                expect(thrownError?.name).toBe("TimeoutError");
                vi.useRealTimers();
            });

            it("should display generic error message when other error thrown", async (): Promise<void> => {
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                    new Error("BLE error"),
                );

                const triggerHandler = createControlPointValueChangedListenerReady();

                const sut = service.changeDragFactorSettings(mockDragFactorSettings);
                (await triggerHandler).triggerChanged(
                    ((): Error => new Error("BLE error"))() as unknown as DataView,
                );
                await expect(sut).rejects.toThrow();

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to set machine settings", "Dismiss");
            });

            it("should re-throw other errors", async (): Promise<void> => {
                const testError = new Error("BLE error");
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                    testError,
                );
                const triggerHandler = createControlPointValueChangedListenerReady();

                const sut = service.changeDragFactorSettings(mockDragFactorSettings);
                (await triggerHandler).triggerChanged(testError as unknown as DataView);

                await expect(sut).rejects.toEqual(testError);
            });
        });
    });

    describe("changeStrokeSettings method", (): void => {
        const mockStrokeDetectionSettings: Omit<IStrokeDetectionSettings, "isCompiledWithDouble"> = {
            strokeDetectionType: 1,
            impulseDataArrayLength: 8,
            minimumPoweredTorque: 0.15,
            minimumDragTorque: 0.05,
            minimumRecoverySlopeMargin: 0.035,
            minimumRecoverySlope: -0.1,
            minimumRecoveryTime: 200,
            minimumDriveTime: 300,
            driveHandleForcesMaxCapacity: 50,
        };

        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(undefined);
                vi.spyOn(mockSettingsCharacteristic, "service", "get").mockReturnValue(
                    undefined as unknown as BluetoothRemoteGATTService,
                );
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.changeStrokeSettings(mockStrokeDetectionSettings);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early", async (): Promise<void> => {
                await service.changeStrokeSettings(mockStrokeDetectionSettings);

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
                await service.changeStrokeSettings(mockStrokeDetectionSettings);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early", async (): Promise<void> => {
                await service.changeStrokeSettings(mockStrokeDetectionSettings);

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
                        BleOpCodes.SetStrokeDetectionSettings,
                        BleResponseOpCodes.Successful,
                    ),
                );
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const sut = service.changeStrokeSettings(mockStrokeDetectionSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications", async (): Promise<void> => {
                const sut = service.changeStrokeSettings(mockStrokeDetectionSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            it("should write stroke settings command with correct payload structure", async (): Promise<void> => {
                const sut = service.changeStrokeSettings(mockStrokeDetectionSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).toHaveBeenCalled();
                const writeCallArgs = vi.mocked(
                    mockSettingsControlPointCharacteristic.writeValueWithoutResponse,
                ).mock.calls[0];
                const payload = writeCallArgs[0] as DataView;

                expect(payload.byteLength, "SetStrokeDetectionSettings: payload.byteLength").toBe(16);
                expect(payload.getUint8(0), "SetStrokeDetectionSettings: opcode").toBe(
                    BleOpCodes.SetStrokeDetectionSettings,
                );

                // verify payload structure: strokeDetectionType (2 bits) + impulseDataArrayLength (6 bits)
                const expectedByte1 =
                    (mockStrokeDetectionSettings.strokeDetectionType & 0x03) |
                    ((mockStrokeDetectionSettings.impulseDataArrayLength & 0x3f) << 2);
                expect(
                    payload.getUint8(1),
                    "SetStrokeDetectionSettings: strokeDetectionType+impulseDataArrayLength",
                ).toBe(expectedByte1);

                // verify torque values (scaled to int16)
                expect(payload.getInt16(2, true), "SetStrokeDetectionSettings: minimumPoweredTorque").toBe(
                    Math.round(mockStrokeDetectionSettings.minimumPoweredTorque * 10000),
                );
                expect(payload.getInt16(4, true), "SetStrokeDetectionSettings: minimumDragTorque").toBe(
                    Math.round(mockStrokeDetectionSettings.minimumDragTorque * 10000),
                );

                // verify recovery slope margin (float32)
                expect(
                    payload.getFloat32(6, true),
                    "SetStrokeDetectionSettings: minimumRecoverySlopeMargin",
                ).toBeCloseTo(mockStrokeDetectionSettings.minimumRecoverySlopeMargin!, 5);

                // verify recovery slope (scaled to int16)
                expect(payload.getInt16(10, true), "SetStrokeDetectionSettings: minimumRecoverySlope").toBe(
                    Math.round(mockStrokeDetectionSettings.minimumRecoverySlope * 1000),
                );

                // verify timing values (packed into 3 bytes)
                const recoveryTimeBits = mockStrokeDetectionSettings.minimumRecoveryTime & 0x0fff;
                const driveTimeBits = (mockStrokeDetectionSettings.minimumDriveTime & 0x0fff) << 12;
                const expectedTimingValue = recoveryTimeBits | driveTimeBits;
                expect(payload.getUint8(12), "SetStrokeDetectionSettings: timingByte0").toBe(
                    expectedTimingValue & 0xff,
                );
                expect(payload.getUint8(13), "SetStrokeDetectionSettings: timingByte1").toBe(
                    (expectedTimingValue >> 8) & 0xff,
                );
                expect(payload.getUint8(14), "SetStrokeDetectionSettings: timingByte2").toBe(
                    (expectedTimingValue >> 16) & 0xff,
                );

                // verify drive handle forces capacity
                expect(payload.getUint8(15), "SetStrokeDetectionSettings: driveHandleForcesMaxCapacity").toBe(
                    mockStrokeDetectionSettings.driveHandleForcesMaxCapacity,
                );
            });

            it("should display success message when operation succeeds", async (): Promise<void> => {
                const sut = service.changeStrokeSettings(mockStrokeDetectionSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Stroke detection settings changed",
                    "Dismiss",
                );
            });

            it("should display error message with response code when operation fails", async (): Promise<void> => {
                const sut = service.changeStrokeSettings(mockStrokeDetectionSettings);
                (await controlPointTrigger).triggerChanged(
                    createMockControlPointResponseDataView(
                        BleOpCodes.SetStrokeDetectionSettings,
                        BleResponseOpCodes.InvalidParameter,
                    ),
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "An error occurred while changing stroke detection settings (InvalidParameter",
                    "Dismiss",
                );
            });

            it("should stop notifications after operation", async (): Promise<void> => {
                const sut = service.changeStrokeSettings(mockStrokeDetectionSettings);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.stopNotifications).toHaveBeenCalled();
            });
        });

        describe("when BLE operation throws error", (): void => {
            it("should display timeout error message when TimeoutError thrown", async (): Promise<void> => {
                vi.useFakeTimers();
                service.changeStrokeSettings(mockStrokeDetectionSettings).catch((): void => {
                    // no-op
                });

                await vi.advanceTimersByTimeAsync(1000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to set stroke detection settings, request timed out",
                    "Dismiss",
                );
                vi.useRealTimers();
            });

            it("should display generic error message for other errors", async (): Promise<void> => {
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                    new Error("BLE error"),
                );
                const triggerHandler = createControlPointValueChangedListenerReady();

                const sut = service.changeStrokeSettings(mockStrokeDetectionSettings);
                (await triggerHandler).triggerChanged(
                    ((): Error => new Error("BLE error"))() as unknown as DataView,
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to set stroke detection settings",
                    "Dismiss",
                );
            });
        });
    });
});
