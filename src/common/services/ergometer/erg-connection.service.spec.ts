import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import {
    BATTERY_LEVEL_CHARACTERISTIC,
    BATTERY_LEVEL_SERVICE,
    CYCLING_POWER_CHARACTERISTIC,
    CYCLING_POWER_SERVICE,
    CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC,
    CYCLING_SPEED_AND_CADENCE_SERVICE,
    DELTA_TIMES_CHARACTERISTIC,
    EXTENDED_CHARACTERISTIC,
    EXTENDED_METRICS_SERVICE,
    FITNESS_MACHINE_SERVICE,
    HANDLE_FORCES_CHARACTERISTIC,
    ROWER_DATA_CHARACTERISTIC,
    SETTINGS_CHARACTERISTIC,
    SETTINGS_SERVICE,
    STROKE_SETTINGS_CHARACTERISTIC,
} from "../../ble.interfaces";
import { IErgConnectionStatus } from "../../common.interfaces";
import {
    changedListenerReadyFactory,
    createMockBluetooth,
    createMockBluetoothDevice,
    createMockCharacteristic,
    ListenerTrigger,
} from "../ble.test.helpers";
import { ConfigManagerService } from "../config-manager.service";

import { ErgConnectionService } from "./erg-connection.service";

describe("ErgConnectionService", (): void => {
    let ergConnectionService: ErgConnectionService;
    let matSnackBarSpy: Pick<MatSnackBar, "open">;
    let configManagerServiceSpy: Pick<ConfigManagerService, "getItem" | "setItem">;
    let mockBluetoothDevice: BluetoothDevice;
    let mockBluetooth: Bluetooth | undefined;
    let createDisconnectChangedListenerReady: () => Promise<ListenerTrigger<void>>;
    let mockBatteryCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockCyclingPowerCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockCscCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockRowerDataCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockExtendedCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockHandleForcesCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockDeltaTimesCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockSettingsCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockStrokeSettingsCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockBatteryService: Pick<BluetoothRemoteGATTService, "getCharacteristic">;
    let mockCyclingPowerService: Pick<BluetoothRemoteGATTService, "getCharacteristic">;
    let mockCscService: Pick<BluetoothRemoteGATTService, "getCharacteristic">;
    let mockFitnessService: Pick<BluetoothRemoteGATTService, "getCharacteristic">;
    let mockExtendedService: Pick<BluetoothRemoteGATTService, "getCharacteristic">;
    let mockSettingsService: Pick<BluetoothRemoteGATTService, "getCharacteristic">;
    let connectionSpies: {
        connectToMeasurement: Mock;
        connectToExtended: Mock;
        connectToHandleForces: Mock;
        connectToDeltaTimes: Mock;
        connectToSettings: Mock;
        connectToStrokeSettings: Mock;
        connectToBattery: Mock;
    };

    const setupConnectionSpies = (): typeof connectionSpies => {
        return {
            connectToMeasurement: vi.spyOn(ergConnectionService, "connectToMeasurement").mockResolvedValue(),
            connectToExtended: vi.spyOn(ergConnectionService, "connectToExtended").mockResolvedValue(),
            connectToHandleForces: vi
                .spyOn(ergConnectionService, "connectToHandleForces")
                .mockResolvedValue(),
            connectToDeltaTimes: vi.spyOn(ergConnectionService, "connectToDeltaTimes").mockResolvedValue(),
            connectToSettings: vi.spyOn(ergConnectionService, "connectToSettings").mockResolvedValue(),
            connectToStrokeSettings: vi
                .spyOn(ergConnectionService, "connectToStrokeSettings")
                .mockResolvedValue(),
            connectToBattery: vi.spyOn(ergConnectionService, "connectToBattery").mockResolvedValue(),
        };
    };

    beforeEach((): void => {
        matSnackBarSpy = {
            open: vi.fn(),
        };
        configManagerServiceSpy = {
            getItem: vi.fn(),
            setItem: vi.fn(),
        };

        vi.mocked(configManagerServiceSpy.getItem).mockReturnValue("mock-device-id");

        vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

        mockBluetoothDevice = createMockBluetoothDevice("mock-device-id", "Mock Ergo", true);
        mockBluetooth = createMockBluetooth(mockBluetoothDevice);

        mockBatteryCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockCyclingPowerCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockCscCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockRowerDataCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockExtendedCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockHandleForcesCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockDeltaTimesCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockSettingsCharacteristic = createMockCharacteristic(mockBluetoothDevice);
        mockStrokeSettingsCharacteristic = createMockCharacteristic(mockBluetoothDevice);

        mockBatteryService = {
            getCharacteristic: vi.fn(),
        };
        mockCyclingPowerService = {
            getCharacteristic: vi.fn(),
        };
        mockCscService = {
            getCharacteristic: vi.fn(),
        };
        mockFitnessService = {
            getCharacteristic: vi.fn(),
        };
        mockExtendedService = {
            getCharacteristic: vi.fn(),
        };
        mockSettingsService = {
            getCharacteristic: vi.fn(),
        };

        const gattServer = mockBluetoothDevice.gatt!;
        vi.mocked(gattServer.connect).mockResolvedValue(gattServer);
        vi.mocked(gattServer.getPrimaryService).mockImplementation(
            (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                if (service === BATTERY_LEVEL_SERVICE)
                    return Promise.resolve(mockBatteryService as BluetoothRemoteGATTService);
                if (service === CYCLING_POWER_SERVICE)
                    return Promise.resolve(mockCyclingPowerService as BluetoothRemoteGATTService);
                if (service === CYCLING_SPEED_AND_CADENCE_SERVICE)
                    return Promise.resolve(mockCscService as BluetoothRemoteGATTService);
                if (service === FITNESS_MACHINE_SERVICE)
                    return Promise.resolve(mockFitnessService as BluetoothRemoteGATTService);
                if (service === EXTENDED_METRICS_SERVICE)
                    return Promise.resolve(mockExtendedService as BluetoothRemoteGATTService);
                if (service === SETTINGS_SERVICE)
                    return Promise.resolve(mockSettingsService as BluetoothRemoteGATTService);

                return Promise.reject(new Error(`Service ${service} not found`));
            },
        );

        vi.mocked(mockBatteryService.getCharacteristic).mockImplementation(
            (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                if (char === BATTERY_LEVEL_CHARACTERISTIC) return Promise.resolve(mockBatteryCharacteristic);

                return Promise.reject(new Error(`Characteristic ${char} not found`));
            },
        );

        vi.mocked(mockCyclingPowerService.getCharacteristic).mockImplementation(
            (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                if (char === CYCLING_POWER_CHARACTERISTIC)
                    return Promise.resolve(mockCyclingPowerCharacteristic);

                return Promise.reject(new Error(`Characteristic ${char} not found`));
            },
        );

        vi.mocked(mockCscService.getCharacteristic).mockImplementation(
            (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                if (char === CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC)
                    return Promise.resolve(mockCscCharacteristic);

                return Promise.reject(new Error(`Characteristic ${char} not found`));
            },
        );

        vi.mocked(mockFitnessService.getCharacteristic).mockImplementation(
            (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                if (char === ROWER_DATA_CHARACTERISTIC) return Promise.resolve(mockRowerDataCharacteristic);

                return Promise.reject(new Error(`Characteristic ${char} not found`));
            },
        );

        vi.mocked(mockExtendedService.getCharacteristic).mockImplementation(
            (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                if (char === EXTENDED_CHARACTERISTIC) return Promise.resolve(mockExtendedCharacteristic);
                if (char === HANDLE_FORCES_CHARACTERISTIC)
                    return Promise.resolve(mockHandleForcesCharacteristic);
                if (char === DELTA_TIMES_CHARACTERISTIC) return Promise.resolve(mockDeltaTimesCharacteristic);

                return Promise.reject(new Error(`Characteristic ${char} not found`));
            },
        );

        vi.mocked(mockSettingsService.getCharacteristic).mockImplementation(
            (char: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> => {
                if (char === SETTINGS_CHARACTERISTIC) return Promise.resolve(mockSettingsCharacteristic);
                if (char === STROKE_SETTINGS_CHARACTERISTIC)
                    return Promise.resolve(mockStrokeSettingsCharacteristic);

                return Promise.reject(new Error(`Characteristic ${char} not found`));
            },
        );

        createDisconnectChangedListenerReady = changedListenerReadyFactory(
            mockBluetoothDevice,
            "gattserverdisconnected",
        );

        TestBed.configureTestingModule({
            providers: [
                ErgConnectionService,
                { provide: MatSnackBar, useValue: matSnackBarSpy },
                { provide: ConfigManagerService, useValue: configManagerServiceSpy },
                provideZonelessChangeDetection(),
            ],
        });

        ergConnectionService = TestBed.inject(ErgConnectionService);
        connectionSpies = setupConnectionSpies();
    });

    it("should instantiate and expose initial 'disconnected' status", (): void => {
        const localStatusEvents: Array<IErgConnectionStatus> = [];

        ergConnectionService.connectionStatus$().subscribe((status: IErgConnectionStatus): void => {
            localStatusEvents.push(status);
        });

        expect(ergConnectionService).toBeTruthy();
        expect(localStatusEvents).toHaveLength(1);
        expect(localStatusEvents[0]).toEqual({ status: "disconnected" });
    });

    describe("disconnectDevice method", (): void => {
        describe("when disconnecting an active device", (): void => {
            let disconnectTrigger: Promise<ListenerTrigger<void>>;

            beforeEach(async (): Promise<void> => {
                await ergConnectionService.discover();
                disconnectTrigger = createDisconnectChangedListenerReady();
            });

            it("should call gattServer.disconnect", async (): Promise<void> => {
                const gattServer = mockBluetoothDevice.gatt!;

                const disconnectPromise = ergConnectionService.disconnectDevice();
                (await disconnectTrigger).triggerChanged();
                await disconnectPromise;

                expect(gattServer.disconnect).toHaveBeenCalled();
            });

            it("should clear the internal bluetoothDevice", async (): Promise<void> => {
                const disconnectPromise = ergConnectionService.disconnectDevice();
                (await disconnectTrigger).triggerChanged();
                await disconnectPromise;

                expect(ergConnectionService.bluetoothDevice).toBeUndefined();
            });

            it("should emit 'disconnected' status", async (): Promise<void> => {
                const localStatusEvents: Array<IErgConnectionStatus> = [];
                ergConnectionService.connectionStatus$().subscribe((status: IErgConnectionStatus): void => {
                    localStatusEvents.push(status);
                });

                const disconnectPromise = ergConnectionService.disconnectDevice();
                (await disconnectTrigger).triggerChanged();
                await disconnectPromise;

                expect(localStatusEvents[localStatusEvents.length - 1]).toEqual({
                    status: "disconnected",
                });
            });
        });

        it("should handle disconnect when no device is connected", async (): Promise<void> => {
            const localStatusEvents: Array<IErgConnectionStatus> = [];
            ergConnectionService.connectionStatus$().subscribe((status: IErgConnectionStatus): void => {
                localStatusEvents.push(status);
            });

            await ergConnectionService.disconnectDevice();

            expect(localStatusEvents[localStatusEvents.length - 1]).toEqual({
                status: "disconnected",
            });
        });
    });

    describe("discover method", (): void => {
        it("should request device", async (): Promise<void> => {
            const connectToMeasurementSpy = connectionSpies.connectToMeasurement;

            await ergConnectionService.discover();

            expect(connectToMeasurementSpy).toHaveBeenCalled();
        });

        it("should start the connect flow on successful devce request ", async (): Promise<void> => {
            const connectToMeasurementSpy = connectionSpies.connectToMeasurement;

            await ergConnectionService.discover();

            expect(ergConnectionService.bluetoothDevice?.id).toBe(mockBluetoothDevice.id);
            expect(connectToMeasurementSpy).toHaveBeenCalled();
        });

        it("should fallback to reconnect when user cancels requestDevice", async (): Promise<void> => {
            vi.mocked(mockBluetooth as unknown as Mock).mockReturnValue({
                requestDevice: (): Promise<BluetoothDevice> => Promise.reject(new Error("cancel")),
            } as Bluetooth);
            const reconnectMethodSpy = vi.spyOn(ergConnectionService, "reconnect").mockResolvedValue();

            await ergConnectionService.discover();

            expect(reconnectMethodSpy).toHaveBeenCalled();
        });
    });

    describe("reconnect method", (): void => {
        it("should do nothing when no previously paired device found", async (): Promise<void> => {
            const localStatusEvents: Array<IErgConnectionStatus> = [];
            ergConnectionService.connectionStatus$().subscribe((status: IErgConnectionStatus): void => {
                localStatusEvents.push(status);
            });
            vi.mocked(mockBluetooth as unknown as Mock).mockReturnValue({
                getDevices: (): Promise<Array<BluetoothDevice>> =>
                    Promise.resolve([] as Array<BluetoothDevice>),
            } as Bluetooth);

            await ergConnectionService.reconnect();

            expect(localStatusEvents[localStatusEvents.length - 1]).toEqual(
                expect.objectContaining({ status: "disconnected" }),
            );
        });

        it("should watch advertisements and when document visible emit 'searching'", async (): Promise<void> => {
            const localStatusEvents: Array<IErgConnectionStatus> = [];
            ergConnectionService.connectionStatus$().subscribe((status: IErgConnectionStatus): void => {
                localStatusEvents.push(status);
            });

            await ergConnectionService.reconnect();

            expect(mockBluetoothDevice.watchAdvertisements).toHaveBeenCalled();
            expect(localStatusEvents[localStatusEvents.length - 1].status).toBe("searching");
        });

        it("should retry reconnect when watchAdvertisements throws", async (): Promise<void> => {
            vi.mocked(mockBluetoothDevice).watchAdvertisements.mockRejectedValue(new Error("watch failed"));
            const reconnectMethodSpy = vi.spyOn(ergConnectionService, "reconnect").mockResolvedValue();

            await ergConnectionService.reconnect();

            expect(reconnectMethodSpy).toHaveBeenCalled();
        });
    });

    describe("connection flow", (): void => {
        let localStatusEvents: Array<IErgConnectionStatus>;
        let connectionOrder: Array<string>;

        beforeEach((): void => {
            localStatusEvents = [];
            connectionOrder = [];
            ergConnectionService.connectionStatus$().subscribe((status: IErgConnectionStatus): void => {
                localStatusEvents.push(status);
            });

            connectionSpies.connectToMeasurement.mockImplementation(async (): Promise<void> => {
                connectionOrder.push("measurement");
            });
            connectionSpies.connectToExtended.mockImplementation(async (): Promise<void> => {
                connectionOrder.push("extended");
            });
            connectionSpies.connectToHandleForces.mockImplementation(async (): Promise<void> => {
                connectionOrder.push("handleForces");
            });
            connectionSpies.connectToDeltaTimes.mockImplementation(async (): Promise<void> => {
                connectionOrder.push("deltaTimes");
            });
            connectionSpies.connectToSettings.mockImplementation(async (): Promise<void> => {
                connectionOrder.push("settings");
            });
            connectionSpies.connectToStrokeSettings.mockImplementation(async (): Promise<void> => {
                connectionOrder.push("strokeSettings");
            });
            connectionSpies.connectToBattery.mockImplementation(async (): Promise<void> => {
                connectionOrder.push("battery");
            });
        });

        describe("on successful connection", (): void => {
            it("should call all connectTo* methods", async (): Promise<void> => {
                await ergConnectionService.discover();

                expect(connectionOrder).toHaveLength(7);
                expect(connectionSpies.connectToMeasurement).toHaveBeenCalled();
                expect(connectionSpies.connectToExtended).toHaveBeenCalled();
                expect(connectionSpies.connectToHandleForces).toHaveBeenCalled();
                expect(connectionSpies.connectToDeltaTimes).toHaveBeenCalled();
                expect(connectionSpies.connectToSettings).toHaveBeenCalled();
                expect(connectionSpies.connectToStrokeSettings).toHaveBeenCalled();
                expect(connectionSpies.connectToBattery).toHaveBeenCalled();
            });

            it("should call connectTo* methods in correct order", async (): Promise<void> => {
                await ergConnectionService.discover();

                expect(connectionOrder).toEqual([
                    "measurement",
                    "extended",
                    "handleForces",
                    "deltaTimes",
                    "settings",
                    "strokeSettings",
                    "battery",
                ]);
            });

            it("should set status to connected with device name", async (): Promise<void> => {
                await ergConnectionService.discover();

                const lastStatus: IErgConnectionStatus = localStatusEvents[localStatusEvents.length - 1];
                expect(lastStatus.status).toBe("connected");
                expect(lastStatus.deviceName).toBe("Mock Ergo");
            });

            it("should save device id in config", async (): Promise<void> => {
                await ergConnectionService.discover();

                expect(configManagerServiceSpy.setItem).toHaveBeenCalledWith(
                    "ergoMonitorBleId",
                    mockBluetoothDevice.id,
                );
            });

            it("should show success snack message", async (): Promise<void> => {
                await ergConnectionService.discover();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith("Ergo monitor connected", "Dismiss");
            });

            it("should set disconnect handler", async (): Promise<void> => {
                const disconnectReady = createDisconnectChangedListenerReady();

                await ergConnectionService.discover();

                await expect(disconnectReady).resolves.not.toThrow();
            });
        });

        describe("on connection failure", (): void => {
            let isGattConnectedSpy: Mock<() => boolean>;

            beforeEach((): void => {
                isGattConnectedSpy = vi.spyOn(mockBluetoothDevice.gatt!, "connected", "get");
            });

            it("should set disconnected status when connection error occurs", async (): Promise<void> => {
                connectionSpies.connectToMeasurement.mockRejectedValue(new Error("connection failed"));

                await ergConnectionService.discover();

                const lastStatus: IErgConnectionStatus = localStatusEvents[localStatusEvents.length - 1];
                expect(lastStatus.status).toBe("disconnected");
            });

            it("should show error snack message when connection fails", async (): Promise<void> => {
                connectionSpies.connectToMeasurement.mockRejectedValue(new Error("connection failed"));

                await ergConnectionService.discover();

                expect(matSnackBarSpy.open).toHaveBeenCalled();
            });

            it("should trigger reconnect when gatt is not connected after error", async (): Promise<void> => {
                isGattConnectedSpy.mockReturnValue(false);
                connectionSpies.connectToMeasurement.mockRejectedValue(new Error("connection failed"));
                const reconnectMethodSpy = vi.spyOn(ergConnectionService, "reconnect").mockResolvedValue();

                await ergConnectionService.discover();

                expect(reconnectMethodSpy).toHaveBeenCalled();
            });

            it("should handle gatt.connect returning falsy value", async (): Promise<void> => {
                vi.mocked(mockBluetoothDevice.gatt!.connect).mockResolvedValue(
                    undefined as unknown as BluetoothRemoteGATTServer,
                );

                await ergConnectionService.discover();

                const lastStatus: IErgConnectionStatus = localStatusEvents[localStatusEvents.length - 1];
                expect(lastStatus.status).toBe("disconnected");
                expect(matSnackBarSpy.open).toHaveBeenCalledWith("BLE Connection to EPRM failed", "Dismiss");
            });
        });
    });

    describe("event handling", (): void => {
        let disconnectReady: Promise<ListenerTrigger<void>>;

        beforeEach(async (): Promise<void> => {
            disconnectReady = createDisconnectChangedListenerReady();
            await ergConnectionService.discover();
        });

        it("should handle disconnect via gattserverdisconnected event", async (): Promise<void> => {
            const reconnectMethodSpy = vi.spyOn(ergConnectionService, "reconnect").mockResolvedValue();

            (await disconnectReady).triggerChanged();

            expect(reconnectMethodSpy).toHaveBeenCalled();
            expect(matSnackBarSpy.open).toHaveBeenCalledWith("Ergometer Monitor disconnected", "Dismiss");
        });

        it("should reconnect by handling advertisement event", async (): Promise<void> => {
            const advertisementTrigger = changedListenerReadyFactory(
                mockBluetoothDevice,
                "advertisementreceived",
            )();

            (await disconnectReady).triggerChanged();
            await ergConnectionService.reconnect();
            (await advertisementTrigger).triggerChanged();

            expect(mockBluetoothDevice.watchAdvertisements).toHaveBeenCalled();
            expect(connectionSpies.connectToMeasurement).toHaveBeenCalled();
        });
    });

    describe("individual connectTo* methods", (): void => {
        let mockGattServer: BluetoothRemoteGATTServer;
        let connectedSpy: Mock;

        beforeEach(async (): Promise<void> => {
            vi.useFakeTimers();
            mockGattServer = mockBluetoothDevice.gatt!;
            connectedSpy = vi.spyOn(mockGattServer, "connected", "get");

            connectionSpies.connectToBattery.mockReset();
            connectionSpies.connectToExtended.mockReset();
            connectionSpies.connectToHandleForces.mockReset();
            connectionSpies.connectToDeltaTimes.mockReset();
            connectionSpies.connectToSettings.mockReset();
            connectionSpies.connectToStrokeSettings.mockReset();
            connectionSpies.connectToMeasurement.mockReset();

            // eslint-disable-next-line no-underscore-dangle
            (
                ergConnectionService as unknown as {
                    _bluetoothDevice: BluetoothDevice;
                }
            )._bluetoothDevice = mockBluetoothDevice;
        });

        afterEach((): void => {
            vi.useRealTimers();
        });

        describe("connectToBattery", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = ergConnectionService.connectToBattery(mockGattServer);

                await vi.runAllTimersAsync();

                expect(await result).toBeDefined();
                expect(ergConnectionService.readBatteryCharacteristic()).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(true);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === BATTERY_LEVEL_SERVICE) {
                            return Promise.reject(new Error("Service unavailable device connected - test"));
                        }

                        return Promise.reject(new Error(`Service ${service} not found`));
                    },
                );

                ergConnectionService.connectToBattery(mockGattServer).catch((): void => {
                    // no-op
                });
                await vi.runAllTimersAsync();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Ergo battery service is unavailable",
                    "Dismiss",
                );
            });

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(false);

                vi.mocked(mockGattServer.getPrimaryService).mockImplementationOnce(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === BATTERY_LEVEL_SERVICE) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.reject(new Error(`Service ${service} not found`));
                    },
                );

                await expect(ergConnectionService.connectToBattery(mockGattServer)).rejects.toThrow();
            });
        });

        describe("connectToExtended", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = ergConnectionService.connectToExtended(mockGattServer);

                await vi.runAllTimersAsync();

                expect(await result).toBeDefined();
                expect(ergConnectionService.readExtendedCharacteristic()).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(true);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === EXTENDED_METRICS_SERVICE) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.reject(new Error(`Service ${service} not found`));
                    },
                );

                ergConnectionService.connectToExtended(mockGattServer).catch((): void => {
                    // no-op
                });
                await vi.runAllTimersAsync();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Extended Metrics",
                    "Dismiss",
                );
            });

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(false);
                const gattServer = mockBluetoothDevice.gatt!;
                vi.mocked(gattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === EXTENDED_METRICS_SERVICE) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.reject(new Error(`Service ${service} not found`));
                    },
                );

                await expect(ergConnectionService.connectToExtended(gattServer)).rejects.toThrow();
            });
        });

        describe("connectToHandleForces", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = ergConnectionService.connectToHandleForces(mockGattServer);

                await vi.runAllTimersAsync();

                expect(await result).toBeDefined();
                expect(ergConnectionService.readHandleForceCharacteristic()).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(true);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === EXTENDED_METRICS_SERVICE) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.resolve(mockExtendedService as BluetoothRemoteGATTService);
                    },
                );

                ergConnectionService.connectToHandleForces(mockGattServer).catch((): void => {
                    // no-op
                });
                await vi.runAllTimersAsync();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Handles Forces",
                    "Dismiss",
                );
            });
        });

        describe("connectToDeltaTimes", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = ergConnectionService.connectToDeltaTimes(mockGattServer);

                await vi.runAllTimersAsync();

                expect(await result).toBeDefined();
                expect(ergConnectionService.readDeltaTimesCharacteristic()).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(true);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === EXTENDED_METRICS_SERVICE) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.resolve(mockExtendedService as BluetoothRemoteGATTService);
                    },
                );

                ergConnectionService.connectToDeltaTimes(mockGattServer).catch((): void => {
                    // no-op
                });
                await vi.runAllTimersAsync();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Delta Times",
                    "Dismiss",
                );
            });
        });

        describe("connectToMeasurement", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = ergConnectionService.connectToMeasurement(mockGattServer);

                await vi.runAllTimersAsync();

                expect(await result).toBeDefined();
                expect(ergConnectionService.readMeasurementCharacteristic()).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(true);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (
                            service === CYCLING_POWER_SERVICE ||
                            service === CYCLING_SPEED_AND_CADENCE_SERVICE ||
                            service === FITNESS_MACHINE_SERVICE
                        ) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.resolve(mockCyclingPowerService as BluetoothRemoteGATTService);
                    },
                );

                ergConnectionService.connectToMeasurement(mockGattServer).catch((): void => {
                    // no-op
                });
                await vi.runAllTimersAsync();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Measurement Characteristic",
                    "Dismiss",
                );
            });

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(false);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (
                            service === CYCLING_POWER_SERVICE ||
                            service === CYCLING_SPEED_AND_CADENCE_SERVICE ||
                            service === FITNESS_MACHINE_SERVICE
                        ) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.resolve(mockCyclingPowerService as BluetoothRemoteGATTService);
                    },
                );

                await expect(ergConnectionService.connectToMeasurement(mockGattServer)).rejects.toThrow();
            });
        });

        describe("connectToSettings", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = ergConnectionService.connectToSettings(mockGattServer);

                await vi.runAllTimersAsync();

                expect(await result).toBeDefined();
                expect(ergConnectionService.readSettingsCharacteristic()).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(true);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === SETTINGS_SERVICE) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.resolve(mockSettingsService as BluetoothRemoteGATTService);
                    },
                );

                ergConnectionService.connectToSettings(mockGattServer).catch((): void => {
                    // no-op
                });
                await vi.runAllTimersAsync();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith("Error connecting to Settings", "Dismiss");
            });

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(false);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === SETTINGS_SERVICE) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.resolve(mockSettingsService as BluetoothRemoteGATTService);
                    },
                );

                await expect(ergConnectionService.connectToSettings(mockGattServer)).rejects.toThrow();
            });
        });

        describe("connectToStrokeSettings", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = ergConnectionService.connectToStrokeSettings(mockGattServer);

                await vi.runAllTimersAsync();

                expect(await result).toBeDefined();
                expect(ergConnectionService.readStrokeSettingsCharacteristic()).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(true);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === SETTINGS_SERVICE) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.resolve(mockSettingsService as BluetoothRemoteGATTService);
                    },
                );

                ergConnectionService.connectToStrokeSettings(mockGattServer).catch((): void => {
                    // no-op
                });
                await vi.runAllTimersAsync();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Stroke Detection Settings",
                    "Dismiss",
                );
            });

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.mockReturnValue(false);
                vi.mocked(mockGattServer.getPrimaryService).mockImplementation(
                    (service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> => {
                        if (service === SETTINGS_SERVICE) {
                            return Promise.reject(new Error("Service unavailable - test"));
                        }

                        return Promise.resolve(mockSettingsService as BluetoothRemoteGATTService);
                    },
                );

                await expect(ergConnectionService.connectToStrokeSettings(mockGattServer)).rejects.toThrow();
            });
        });
    });
});
