import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    BleOpCodes,
    BleResponseOpCodes,
    BleServiceFlag,
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

describe("ErgSettingsService general control-point API", (): void => {
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
                provideZonelessChangeDetection(),
            ],
        });

        service = TestBed.inject(ErgSettingsService);
    });

    describe("changeBleServiceType method", (): void => {
        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(undefined);
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.changeBleServiceType(BleServiceFlag.CpsService);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeBleServiceType(BleServiceFlag.CpsService);

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
                await service.changeBleServiceType(BleServiceFlag.CpsService);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeBleServiceType(BleServiceFlag.CpsService);

                expect(
                    mockSettingsControlPointCharacteristic.service.getCharacteristic,
                ).not.toHaveBeenCalled();
            });
        });

        describe("when device is connected", (): void => {
            let controlPointTrigger: Promise<ListenerTrigger<DataView>>;

            beforeEach(async (): Promise<void> => {
                controlPointTrigger = createControlPointValueChangedListenerReady();
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const responsePromise = service.changeBleServiceType(BleServiceFlag.FtmsService);

                const successResponse = createMockControlPointResponseDataView(
                    BleOpCodes.ChangeBleService,
                    BleResponseOpCodes.Successful,
                );
                (await controlPointTrigger).triggerChanged(successResponse);

                await responsePromise;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications on control point", async (): Promise<void> => {
                const responsePromise = service.changeBleServiceType(BleServiceFlag.FtmsService);

                const successResponse = createMockControlPointResponseDataView(
                    BleOpCodes.ChangeBleService,
                    BleResponseOpCodes.Successful,
                );
                (await controlPointTrigger).triggerChanged(successResponse);

                await responsePromise;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            it("should write BLE service change command", async (): Promise<void> => {
                const responsePromise = service.changeBleServiceType(BleServiceFlag.FtmsService);

                const successResponse = createMockControlPointResponseDataView(
                    BleOpCodes.ChangeBleService,
                    BleResponseOpCodes.Successful,
                );
                (await controlPointTrigger).triggerChanged(successResponse);

                await responsePromise;

                expect(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).toHaveBeenCalledWith(
                    new Uint8Array([BleOpCodes.ChangeBleService, BleServiceFlag.FtmsService]),
                );
            });

            describe("when operation succeeds", (): void => {
                it("should call discover on ergConnectionService", async (): Promise<void> => {
                    const responsePromise = service.changeBleServiceType(BleServiceFlag.FtmsService);

                    const successResponse = createMockControlPointResponseDataView(
                        BleOpCodes.ChangeBleService,
                        BleResponseOpCodes.Successful,
                    );
                    (await controlPointTrigger).triggerChanged(successResponse);

                    await responsePromise;

                    expect(mockErgConnectionService.discover).toHaveBeenCalled();
                });

                it("should display success message", async (): Promise<void> => {
                    const responsePromise = service.changeBleServiceType(BleServiceFlag.FtmsService);

                    const successResponse = createMockControlPointResponseDataView(
                        BleOpCodes.ChangeBleService,
                        BleResponseOpCodes.Successful,
                    );
                    (await controlPointTrigger).triggerChanged(successResponse);

                    await responsePromise;

                    expect(mockSnackBar.open).toHaveBeenCalledWith(
                        "BLE service changed, device is restarting",
                        "Dismiss",
                    );
                });

                it("should stop notifications", async (): Promise<void> => {
                    const responsePromise = service.changeBleServiceType(BleServiceFlag.FtmsService);

                    const successResponse = createMockControlPointResponseDataView(
                        BleOpCodes.ChangeBleService,
                        BleResponseOpCodes.Successful,
                    );
                    (await controlPointTrigger).triggerChanged(successResponse);

                    await responsePromise;

                    expect(mockSettingsControlPointCharacteristic.stopNotifications).toHaveBeenCalled();
                });
            });

            describe("when operation fails", (): void => {
                it("should display error message", async (): Promise<void> => {
                    const responsePromise = service.changeBleServiceType(BleServiceFlag.FtmsService);

                    const failureResponse = createMockControlPointResponseDataView(
                        BleOpCodes.ChangeBleService,
                        BleResponseOpCodes.InvalidParameter,
                    );
                    (await controlPointTrigger).triggerChanged(failureResponse);

                    await responsePromise;

                    expect(mockSnackBar.open).toHaveBeenCalledWith(
                        "An error occurred while changing BLE service",
                        "Dismiss",
                    );
                });

                it("should not call discover", async (): Promise<void> => {
                    const responsePromise = service.changeBleServiceType(BleServiceFlag.FtmsService);

                    const failureResponse = createMockControlPointResponseDataView(
                        BleOpCodes.ChangeBleService,
                        BleResponseOpCodes.InvalidParameter,
                    );
                    (await controlPointTrigger).triggerChanged(failureResponse);

                    await responsePromise;

                    expect(mockErgConnectionService.discover).not.toHaveBeenCalled();
                });

                it("should stop notifications", async (): Promise<void> => {
                    const responsePromise = service.changeBleServiceType(BleServiceFlag.FtmsService);

                    const failureResponse = createMockControlPointResponseDataView(
                        BleOpCodes.ChangeBleService,
                        BleResponseOpCodes.InvalidParameter,
                    );
                    (await controlPointTrigger).triggerChanged(failureResponse);

                    await responsePromise;

                    expect(mockSettingsControlPointCharacteristic.stopNotifications).toHaveBeenCalled();
                });
            });
        });

        describe("when BLE operation throws error", (): void => {
            it("should display timeout error message when BLE request times out", async (): Promise<void> => {
                vi.useFakeTimers();
                service.changeBleServiceType(BleServiceFlag.FtmsService).catch((): void => {
                    // no-op
                });

                await vi.advanceTimersByTimeAsync(1000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to change BLE service, request timed out",
                    "Dismiss",
                );
                vi.useRealTimers();
            });

            it("should display generic error message for other errors", async (): Promise<void> => {
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                    new Error("BLE error"),
                );
                const triggerHandler = createControlPointValueChangedListenerReady();

                const sut = service.changeBleServiceType(BleServiceFlag.FtmsService);
                const errData = ((): Error => new Error("BLE error"))() as unknown as DataView;

                (await triggerHandler).triggerChanged(errData);

                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to change BLE service", "Dismiss");
            });
        });
    });

    describe("changeDeltaTimeLogging method", (): void => {
        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(undefined);
                vi.spyOn(mockSettingsCharacteristic, "service", "get").mockReturnValue(
                    undefined as unknown as BluetoothRemoteGATTService,
                );
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.changeDeltaTimeLogging(true);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeDeltaTimeLogging(true);

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
                await service.changeDeltaTimeLogging(true);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeDeltaTimeLogging(true);

                expect(
                    mockSettingsControlPointCharacteristic.service.getCharacteristic,
                ).not.toHaveBeenCalled();
            });
        });

        describe("when device is connected", (): void => {
            let controlPointTrigger: Promise<ListenerTrigger<DataView>>;
            const invalidMessage = createMockControlPointResponseDataView(
                BleOpCodes.SetDeltaTimeLogging,
                BleResponseOpCodes.InvalidParameter,
            );

            beforeEach((): void => {
                controlPointTrigger = createControlPointValueChangedListenerReady(
                    createMockControlPointResponseDataView(
                        BleOpCodes.SetDeltaTimeLogging,
                        BleResponseOpCodes.Successful,
                    ),
                );
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const sut = service.changeDeltaTimeLogging(true);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications", async (): Promise<void> => {
                const sut = service.changeDeltaTimeLogging(true);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            describe("when enabling delta time logging", (): void => {
                it("should write enable command", async (): Promise<void> => {
                    const sut = service.changeDeltaTimeLogging(true);
                    (await controlPointTrigger).triggerChanged();
                    await sut;

                    expect(
                        mockSettingsControlPointCharacteristic.writeValueWithoutResponse,
                    ).toHaveBeenCalledWith(new Uint8Array([BleOpCodes.SetDeltaTimeLogging, 1]));
                });

                it("should display enabled success message when operation succeeds", async (): Promise<void> => {
                    const sut = service.changeDeltaTimeLogging(true);
                    (await controlPointTrigger).triggerChanged();
                    await sut;

                    expect(mockSnackBar.open).toHaveBeenCalledWith("Delta time logging enabled", "Dismiss");
                });

                it("should display error message when operation fails", async (): Promise<void> => {
                    const sut = service.changeDeltaTimeLogging(true);
                    (await controlPointTrigger).triggerChanged(invalidMessage);
                    await sut;

                    expect(mockSnackBar.open).toHaveBeenCalledWith(
                        "An error occurred while changing delta time logging",
                        "Dismiss",
                    );
                });
            });

            describe("when disabling delta time logging", (): void => {
                it("should write disable command", async (): Promise<void> => {
                    const sut = service.changeDeltaTimeLogging(false);
                    (await controlPointTrigger).triggerChanged();
                    await sut;

                    expect(
                        mockSettingsControlPointCharacteristic.writeValueWithoutResponse,
                    ).toHaveBeenCalledWith(new Uint8Array([BleOpCodes.SetDeltaTimeLogging, 0]));
                });

                it("should display disabled success message when operation succeeds", async (): Promise<void> => {
                    const sut = service.changeDeltaTimeLogging(false);
                    (await controlPointTrigger).triggerChanged();
                    await sut;

                    expect(mockSnackBar.open).toHaveBeenCalledWith("Delta time logging disabled", "Dismiss");
                });

                it("should display error message when operation fails", async (): Promise<void> => {
                    const sut = service.changeDeltaTimeLogging(false);
                    (await controlPointTrigger).triggerChanged(invalidMessage);
                    await sut;

                    expect(mockSnackBar.open).toHaveBeenCalledWith(
                        "An error occurred while changing delta time logging",
                        "Dismiss",
                    );
                });
            });

            it("should stop notifications after operation", async (): Promise<void> => {
                const sut = service.changeDeltaTimeLogging(true);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.stopNotifications).toHaveBeenCalled();
            });
        });

        describe("when BLE operation throws error", (): void => {
            it("should display timeout error message when TimeoutError thrown", async (): Promise<void> => {
                vi.useFakeTimers();
                service.changeDeltaTimeLogging(true).catch((): void => {
                    // no-op
                });

                await vi.advanceTimersByTimeAsync(1000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to enabled delta time logging, request timed out",
                    "Dismiss",
                );
                vi.useRealTimers();
            });

            it("should display generic error message for other errors", async (): Promise<void> => {
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                    new Error("BLE error"),
                );
                const triggerHandler = createControlPointValueChangedListenerReady();

                const sut = service.changeDeltaTimeLogging(true);
                (await triggerHandler).triggerChanged(
                    ((): Error => new Error("BLE error"))() as unknown as DataView,
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to enabled delta time logging",
                    "Dismiss",
                );
            });
        });
    });

    describe("changeLogLevel method", (): void => {
        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(undefined);
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.changeLogLevel(1);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeLogLevel(1);

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
                await service.changeLogLevel(1);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early without BLE operations", async (): Promise<void> => {
                await service.changeLogLevel(1);

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
                        BleOpCodes.SetLogLevel,
                        BleResponseOpCodes.Successful,
                    ),
                );
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const sut = service.changeLogLevel(1);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications", async (): Promise<void> => {
                const sut = service.changeLogLevel(1);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            it("should write log level command", async (): Promise<void> => {
                const sut = service.changeLogLevel(2);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).toHaveBeenCalledWith(
                    new Uint8Array([BleOpCodes.SetLogLevel, 2]),
                );
            });

            it("should display success message when operation succeeds", async (): Promise<void> => {
                const sut = service.changeLogLevel(1);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Log level changed", "Dismiss");
            });

            it("should display error message when operation fails", async (): Promise<void> => {
                const sut = service.changeLogLevel(1);
                (await controlPointTrigger).triggerChanged(
                    createMockControlPointResponseDataView(
                        BleOpCodes.SetLogLevel,
                        BleResponseOpCodes.InvalidParameter,
                    ),
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "An error occurred while changing Log level",
                    "Dismiss",
                );
            });
        });

        describe("when BLE operation throws error", (): void => {
            it("should display timeout error message when TimeoutError thrown", async (): Promise<void> => {
                vi.useFakeTimers();
                service.changeLogLevel(1).catch((): void => {
                    // no-op
                });

                await vi.advanceTimersByTimeAsync(1000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to set Log Level, request timed out",
                    "Dismiss",
                );
                vi.useRealTimers();
            });

            it("should display generic error message for other errors", async (): Promise<void> => {
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                    new Error("BLE error"),
                );
                const triggerHandler = createControlPointValueChangedListenerReady();

                const sut = service.changeLogLevel(1);
                (await triggerHandler).triggerChanged(
                    ((): Error => new Error("BLE error"))() as unknown as DataView,
                );

                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to set Log Level", "Dismiss");
            });
        });
    });

    describe("changeLogToSdCard method", (): void => {
        describe("when device is not connected", (): void => {
            beforeEach((): void => {
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockReturnValue(undefined);
            });

            it("should display not connected message", async (): Promise<void> => {
                await service.changeLogToSdCard(true);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early", async (): Promise<void> => {
                await service.changeLogToSdCard(true);

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
                await service.changeLogToSdCard(true);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Ergometer Monitor is not connected",
                    "Dismiss",
                );
            });

            it("should return early", async (): Promise<void> => {
                await service.changeLogToSdCard(true);

                expect(
                    mockSettingsControlPointCharacteristic.service.getCharacteristic,
                ).not.toHaveBeenCalled();
            });
        });

        describe("when device is connected", (): void => {
            let controlPointTrigger: Promise<ListenerTrigger<DataView>>;
            const failureResponse = createMockControlPointResponseDataView(
                BleOpCodes.SetSdCardLogging,
                BleResponseOpCodes.InvalidParameter,
            );

            beforeEach(async (): Promise<void> => {
                controlPointTrigger = createControlPointValueChangedListenerReady(
                    createMockControlPointResponseDataView(
                        BleOpCodes.SetSdCardLogging,
                        BleResponseOpCodes.Successful,
                    ),
                );
            });

            it("should get settings control point characteristic", async (): Promise<void> => {
                const sut = service.changeLogToSdCard(true);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsCharacteristic.service.getCharacteristic).toHaveBeenCalledWith(
                    SETTINGS_CONTROL_POINT,
                );
            });

            it("should start notifications", async (): Promise<void> => {
                const sut = service.changeLogToSdCard(true);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.startNotifications).toHaveBeenCalled();
            });

            describe("when enabling SD card logging", (): void => {
                it("should write enable command", async (): Promise<void> => {
                    const sut = service.changeLogToSdCard(true);
                    (await controlPointTrigger).triggerChanged();
                    await sut;

                    expect(
                        mockSettingsControlPointCharacteristic.writeValueWithoutResponse,
                    ).toHaveBeenCalledWith(new Uint8Array([BleOpCodes.SetSdCardLogging, 1]));
                });

                it("should display enabled success message when operation succeeds", async (): Promise<void> => {
                    const sut = service.changeLogToSdCard(true);
                    (await controlPointTrigger).triggerChanged();
                    await sut;

                    expect(mockSnackBar.open).toHaveBeenCalledWith("Sd Card logging enabled", "Dismiss");
                });

                it("should display error message when operation fails", async (): Promise<void> => {
                    const sut = service.changeLogToSdCard(true);
                    (await controlPointTrigger).triggerChanged(failureResponse);
                    await sut;

                    expect(mockSnackBar.open).toHaveBeenCalledWith(
                        "An error occurred while changing Sd Card logging",
                        "Dismiss",
                    );
                });
            });

            describe("when disabling SD card logging", (): void => {
                it("should write disable command", async (): Promise<void> => {
                    const responsePromise = service.changeLogToSdCard(false);

                    const successResponse = createMockControlPointResponseDataView(
                        BleOpCodes.SetSdCardLogging,
                        BleResponseOpCodes.Successful,
                    );
                    (await controlPointTrigger).triggerChanged(successResponse);

                    await responsePromise;

                    expect(
                        mockSettingsControlPointCharacteristic.writeValueWithoutResponse,
                    ).toHaveBeenCalledWith(new Uint8Array([BleOpCodes.SetSdCardLogging, 0]));
                });

                it("should display disabled success message when operation succeeds", async (): Promise<void> => {
                    const responsePromise = service.changeLogToSdCard(false);

                    const successResponse = createMockControlPointResponseDataView(
                        BleOpCodes.SetSdCardLogging,
                        BleResponseOpCodes.Successful,
                    );
                    (await controlPointTrigger).triggerChanged(successResponse);

                    await responsePromise;

                    expect(mockSnackBar.open).toHaveBeenCalledWith("Sd Card logging disabled", "Dismiss");
                });

                it("should display error message when operation fails", async (): Promise<void> => {
                    const sut = service.changeLogToSdCard(false);
                    (await controlPointTrigger).triggerChanged(failureResponse);
                    await sut;

                    expect(mockSnackBar.open).toHaveBeenCalledWith(
                        "An error occurred while changing Sd Card logging",
                        "Dismiss",
                    );
                });
            });

            it("should stop notifications after operation", async (): Promise<void> => {
                const sut = service.changeLogToSdCard(true);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSettingsControlPointCharacteristic.stopNotifications).toHaveBeenCalled();
            });
        });

        it("should display timeout error message when BLE request times out", async (): Promise<void> => {
            vi.useFakeTimers();
            service.changeLogToSdCard(true).catch((): void => {
                // no-op
            });

            await vi.advanceTimersByTimeAsync(10000);

            expect(mockSnackBar.open).toHaveBeenCalledWith(
                "Failed to enabled Sd Card logging, request timed out",
                "Dismiss",
            );
            vi.useRealTimers();
        });

        it("should display generic error message for other errors", async (): Promise<void> => {
            vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                new Error("BLE error"),
            );
            const triggerHandler = createControlPointValueChangedListenerReady();

            const sut = service.changeLogToSdCard(false);
            (await triggerHandler).triggerChanged(
                ((): Error => new Error("BLE error"))() as unknown as DataView,
            );
            await sut;

            expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to disabled Sd Card logging", "Dismiss");
        });
    });
});
