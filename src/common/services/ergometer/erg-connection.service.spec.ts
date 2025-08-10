import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";

import { IErgConnectionStatus } from "../../common.interfaces";
import { ConfigManagerService } from "../config-manager.service";

import { ErgConnectionService } from "./erg-connection.service";

describe("ErgConnectionService", (): void => {
    let ergConnectionService: ErgConnectionService;
    let matSnackBarSpy: jasmine.SpyObj<MatSnackBar>;
    let configManagerServiceSpy: jasmine.SpyObj<ConfigManagerService>;

    let navigatorSpy: jasmine.Spy<() => Navigator | undefined>;
    let mockBluetoothDevice: BluetoothDevice;
    let connectionSpies: {
        connectToMeasurement: jasmine.Spy;
        connectToExtended: jasmine.Spy;
        connectToHandleForces: jasmine.Spy;
        connectToDeltaTimes: jasmine.Spy;
        connectToSettings: jasmine.Spy;
        connectToStrokeSettings: jasmine.Spy;
        connectToBattery: jasmine.Spy;
    };

    const createMockBluetoothDevice = (overrides: Partial<BluetoothDevice> = {}): BluetoothDevice => {
        let baseBluetoothDevice: Partial<BluetoothDevice> = {
            id: "mock-device-id",
            name: "Mock Ergo",
            watchAdvertisements: jasmine.createSpy("watchAdvertisements").and.resolveTo(),
        };

        const gattServer = {
            connected: true,
            connect: jasmine
                .createSpy("connect")
                .and.callFake(
                    (): Promise<BluetoothRemoteGATTServer> =>
                        Promise.resolve(gattServer as unknown as BluetoothRemoteGATTServer),
                ),
            disconnect: (): void => {
                // noop; replaced by spy in tests
            },
            getPrimaryService: jasmine.createSpy("getPrimaryService").and.callFake(
                (): Promise<BluetoothRemoteGATTService> =>
                    Promise.resolve({
                        getCharacteristic: jasmine.createSpy("getCharacteristic").and.callFake(
                            (): Promise<BluetoothRemoteGATTCharacteristic> =>
                                Promise.resolve({
                                    service: {
                                        device:
                                            (baseBluetoothDevice as BluetoothDevice) ??
                                            ({} as BluetoothDevice),
                                    },
                                    startNotifications: jasmine
                                        .createSpy("startNotifications")
                                        .and.resolveTo(),
                                } as unknown as BluetoothRemoteGATTCharacteristic),
                        ),
                    } as unknown as BluetoothRemoteGATTService),
            ),
        };

        return { ...baseBluetoothDevice, gatt: gattServer, ...overrides } as BluetoothDevice;
    };

    const setupConnectionSpies = (): typeof connectionSpies => {
        return {
            connectToMeasurement: spyOn(ergConnectionService, "connectToMeasurement").and.resolveTo(),
            connectToExtended: spyOn(ergConnectionService, "connectToExtended").and.resolveTo(),
            connectToHandleForces: spyOn(ergConnectionService, "connectToHandleForces").and.resolveTo(),
            connectToDeltaTimes: spyOn(ergConnectionService, "connectToDeltaTimes").and.resolveTo(),
            connectToSettings: spyOn(ergConnectionService, "connectToSettings").and.resolveTo(),
            connectToStrokeSettings: spyOn(ergConnectionService, "connectToStrokeSettings").and.resolveTo(),
            connectToBattery: spyOn(ergConnectionService, "connectToBattery").and.resolveTo(),
        };
    };

    const setupMockNavigator = (device: BluetoothDevice): void => {
        navigatorSpy.and.returnValue({
            bluetooth: {
                requestDevice: (): Promise<BluetoothDevice> => Promise.resolve(device),
                getDevices: (): Promise<Array<BluetoothDevice>> => Promise.resolve([device]),
            },
        } as Navigator);
    };

    const setupDisconnectHandler = (device: BluetoothDevice): jasmine.Spy => {
        let gattServerDisconnectedHandler: ((this: BluetoothDevice, ev: Event) => unknown) | null = null;
        Object.defineProperty(device, "ongattserverdisconnected", {
            get: (): typeof gattServerDisconnectedHandler => gattServerDisconnectedHandler,
            set: (handlerFunction: (this: BluetoothDevice, ev: Event) => unknown): void => {
                gattServerDisconnectedHandler = handlerFunction;
            },
            configurable: true,
        });

        const gattServer = device.gatt as BluetoothRemoteGATTServer;

        return spyOn(gattServer, "disconnect").and.callFake((): void => {
            if (gattServerDisconnectedHandler) {
                gattServerDisconnectedHandler.call(device, new Event("gattserverdisconnected"));
            }
        });
    };

    beforeEach((): void => {
        matSnackBarSpy = jasmine.createSpyObj<MatSnackBar>("MatSnackBar", ["open"]);
        configManagerServiceSpy = jasmine.createSpyObj<ConfigManagerService>("ConfigManagerService", [
            "getItem",
            "setItem",
        ]);

        configManagerServiceSpy.getItem.and.returnValue("mock-device-id");

        spyOnProperty(document, "visibilityState", "get").and.returnValue("visible");

        navigatorSpy = spyOnProperty(globalThis, "navigator", "get").and.returnValue({} as Navigator);

        TestBed.configureTestingModule({
            providers: [
                ErgConnectionService,
                { provide: MatSnackBar, useValue: matSnackBarSpy },
                { provide: ConfigManagerService, useValue: configManagerServiceSpy },
            ],
        });

        ergConnectionService = TestBed.inject(ErgConnectionService);
        mockBluetoothDevice = createMockBluetoothDevice();
        connectionSpies = setupConnectionSpies();
    });

    it("should instantiate and expose initial 'disconnected' status", (): void => {
        const localStatusEvents: Array<IErgConnectionStatus> = [];
        ergConnectionService.connectionStatus$().subscribe((status: IErgConnectionStatus): void => {
            localStatusEvents.push(status);
        });

        expect(ergConnectionService).toBeTruthy();
        expect(localStatusEvents).toHaveSize(1);
        expect(localStatusEvents[0]).toEqual({ status: "disconnected" });
    });

    describe("disconnectDevice method", (): void => {
        describe("when disconnecting an active device", (): void => {
            beforeEach(async (): Promise<void> => {
                setupMockNavigator(mockBluetoothDevice);
                await ergConnectionService.discover();
            });

            it("should call gattServer.disconnect", async (): Promise<void> => {
                const disconnectSpy = setupDisconnectHandler(mockBluetoothDevice);

                await ergConnectionService.disconnectDevice();

                expect(disconnectSpy).toHaveBeenCalled();
            });

            it("should clear the internal bluetoothDevice", async (): Promise<void> => {
                setupDisconnectHandler(mockBluetoothDevice);

                await ergConnectionService.disconnectDevice();

                expect(ergConnectionService.bluetoothDevice).toBeUndefined();
            });

            it("should emit 'disconnected' status", async (): Promise<void> => {
                const localStatusEvents: Array<IErgConnectionStatus> = [];
                ergConnectionService.connectionStatus$().subscribe((status: IErgConnectionStatus): void => {
                    localStatusEvents.push(status);
                });
                setupDisconnectHandler(mockBluetoothDevice);

                await ergConnectionService.disconnectDevice();

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
        it("should request device and on success start the connect flow", async (): Promise<void> => {
            setupMockNavigator(mockBluetoothDevice);
            const connectToMeasurementSpy = connectionSpies.connectToMeasurement;

            await ergConnectionService.discover();

            expect(ergConnectionService.bluetoothDevice?.id).toBe(mockBluetoothDevice.id);
            expect(connectToMeasurementSpy).toHaveBeenCalled();
        });

        it("should fallback to reconnect when user cancels requestDevice", async (): Promise<void> => {
            navigatorSpy.and.returnValue({
                bluetooth: {
                    requestDevice: (): Promise<BluetoothDevice> => Promise.reject(new Error("cancel")),
                },
            } as Navigator);
            const reconnectMethodSpy = spyOn(ergConnectionService, "reconnect").and.resolveTo();

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
            navigatorSpy.and.returnValue({
                bluetooth: {
                    getDevices: (): Promise<Array<BluetoothDevice>> =>
                        Promise.resolve([] as Array<BluetoothDevice>),
                },
            } as Navigator);

            await ergConnectionService.reconnect();

            expect(localStatusEvents[localStatusEvents.length - 1]).toEqual(
                jasmine.objectContaining({ status: "disconnected" }),
            );
        });

        it("should watch advertisements and when document visible emit 'searching'", async (): Promise<void> => {
            const localStatusEvents: Array<IErgConnectionStatus> = [];
            ergConnectionService.connectionStatus$().subscribe((status: IErgConnectionStatus): void => {
                localStatusEvents.push(status);
            });
            navigatorSpy.and.returnValue({
                bluetooth: {
                    getDevices: (): Promise<Array<BluetoothDevice>> => Promise.resolve([mockBluetoothDevice]),
                },
            } as Navigator);

            await ergConnectionService.reconnect();
            // flush microtasks from resolved watchAdvertisements
            await Promise.resolve();

            expect(mockBluetoothDevice.watchAdvertisements).toHaveBeenCalled();
            expect(
                localStatusEvents.find(
                    (status: IErgConnectionStatus): boolean => status.status === "searching",
                ),
            ).toBeTruthy();
        });

        it("should retry reconnect when watchAdvertisements throws", async (): Promise<void> => {
            const mockDeviceWithError = createMockBluetoothDevice({
                watchAdvertisements: jasmine
                    .createSpy("watchAdvertisements")
                    .and.rejectWith(new Error("watch failed")),
            });
            navigatorSpy.and.returnValue({
                bluetooth: {
                    getDevices: (): Promise<Array<BluetoothDevice>> => Promise.resolve([mockDeviceWithError]),
                },
            } as Navigator);
            const reconnectMethodSpy = spyOn(ergConnectionService, "reconnect").and.resolveTo();

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
            setupMockNavigator(mockBluetoothDevice);

            // setup spies to track connection order
            connectionSpies.connectToMeasurement.and.callFake(async (): Promise<void> => {
                connectionOrder.push("measurement");
            });
            connectionSpies.connectToExtended.and.callFake(async (): Promise<void> => {
                connectionOrder.push("extended");
            });
            connectionSpies.connectToHandleForces.and.callFake(async (): Promise<void> => {
                connectionOrder.push("handleForces");
            });
            connectionSpies.connectToDeltaTimes.and.callFake(async (): Promise<void> => {
                connectionOrder.push("deltaTimes");
            });
            connectionSpies.connectToSettings.and.callFake(async (): Promise<void> => {
                connectionOrder.push("settings");
            });
            connectionSpies.connectToStrokeSettings.and.callFake(async (): Promise<void> => {
                connectionOrder.push("strokeSettings");
            });
            connectionSpies.connectToBattery.and.callFake(async (): Promise<void> => {
                connectionOrder.push("battery");
            });
        });

        describe("on successful connection", (): void => {
            it("should call all connectTo* methods", async (): Promise<void> => {
                await ergConnectionService.discover();

                expect(connectionOrder).toHaveSize(7);
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
                await ergConnectionService.discover();

                expect(typeof mockBluetoothDevice.ongattserverdisconnected).toBe("function");
            });
        });

        describe("on connection failure", (): void => {
            it("should set disconnected status when connection error occurs", async (): Promise<void> => {
                connectionSpies.connectToMeasurement.and.rejectWith(new Error("connection failed"));

                await ergConnectionService.discover();

                const lastStatus: IErgConnectionStatus = localStatusEvents[localStatusEvents.length - 1];
                expect(lastStatus.status).toBe("disconnected");
            });

            it("should show error snack message when connection fails", async (): Promise<void> => {
                connectionSpies.connectToMeasurement.and.rejectWith(new Error("connection failed"));

                await ergConnectionService.discover();

                expect(matSnackBarSpy.open).toHaveBeenCalled();
            });

            it("should trigger reconnect when gatt is not connected after error", async (): Promise<void> => {
                const mockDisconnectedDevice = createMockBluetoothDevice({
                    gatt: {
                        connected: false,
                        connect: jasmine.createSpy("connect").and.resolveTo({}),
                    } as unknown as BluetoothRemoteGATTServer,
                });
                setupMockNavigator(mockDisconnectedDevice);
                connectionSpies.connectToMeasurement.and.rejectWith(new Error("connection failed"));
                const reconnectMethodSpy = spyOn(ergConnectionService, "reconnect").and.returnValue(
                    Promise.resolve(),
                );

                await ergConnectionService.discover();

                expect(reconnectMethodSpy).toHaveBeenCalled();
            });

            it("should handle gatt.connect returning falsy value", async (): Promise<void> => {
                const mockFailedDevice = createMockBluetoothDevice({
                    gatt: {
                        connected: true,
                        connect: jasmine.createSpy("connect").and.resolveTo(undefined),
                    } as unknown as BluetoothRemoteGATTServer,
                });
                setupMockNavigator(mockFailedDevice);

                await ergConnectionService.discover();

                const lastStatus: IErgConnectionStatus = localStatusEvents[localStatusEvents.length - 1];
                expect(lastStatus.status).toBe("disconnected");
                expect(matSnackBarSpy.open).toHaveBeenCalledWith("BLE Connection to EPRM failed", "Dismiss");
            });
        });
    });

    describe("event handling", (): void => {
        beforeEach(async (): Promise<void> => {
            setupMockNavigator(mockBluetoothDevice);
            await ergConnectionService.discover();
        });

        it("should handle disconnect via gattserverdisconnected event", async (): Promise<void> => {
            const reconnectMethodSpy = spyOn(ergConnectionService, "reconnect").and.resolveTo();

            mockBluetoothDevice.ongattserverdisconnected?.call(
                mockBluetoothDevice,
                new Event("gattserverdisconnected"),
            );

            expect(reconnectMethodSpy).toHaveBeenCalled();
            expect(matSnackBarSpy.open).toHaveBeenCalledWith("Ergometer Monitor disconnected", "Dismiss");
        });

        it("should reconnect by handling advertisement event", async (): Promise<void> => {
            navigatorSpy.and.returnValue({
                bluetooth: {
                    getDevices: (): Promise<Array<BluetoothDevice>> => Promise.resolve([mockBluetoothDevice]),
                },
            } as Navigator);
            const gattServer = mockBluetoothDevice.gatt as BluetoothRemoteGATTServer;
            spyOn(gattServer, "disconnect").and.callFake((): void => {
                if (typeof mockBluetoothDevice.ongattserverdisconnected === "function") {
                    mockBluetoothDevice.ongattserverdisconnected.call(
                        mockBluetoothDevice,
                        new Event("gattserverdisconnected"),
                    );
                }
            });

            await ergConnectionService.reconnect();

            expect(mockBluetoothDevice.watchAdvertisements).toHaveBeenCalled();

            if (mockBluetoothDevice.onadvertisementreceived) {
                mockBluetoothDevice.onadvertisementreceived.call(mockBluetoothDevice, {
                    device: mockBluetoothDevice,
                } as unknown as BluetoothAdvertisingEvent);
            }

            expect(connectionSpies.connectToMeasurement).toHaveBeenCalled();
        });
    });

    describe("individual connectTo* methods", (): void => {
        let mockGattServer: BluetoothRemoteGATTServer;

        beforeEach((): void => {
            mockGattServer = mockBluetoothDevice.gatt as BluetoothRemoteGATTServer;
            // reset spies to their original implementation for these tests
            connectionSpies.connectToBattery.and.callThrough();
            connectionSpies.connectToExtended.and.callThrough();
            connectionSpies.connectToHandleForces.and.callThrough();
            connectionSpies.connectToDeltaTimes.and.callThrough();
            connectionSpies.connectToSettings.and.callThrough();
            connectionSpies.connectToStrokeSettings.and.callThrough();
            connectionSpies.connectToMeasurement.and.callThrough();
        });

        describe("connectToBattery", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = await ergConnectionService.connectToBattery(mockGattServer);

                expect(result).toBeDefined();
                expect(ergConnectionService.readBatteryCharacteristic()).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: true,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: true } },
                    writable: true,
                });

                const result = await ergConnectionService.connectToBattery(mockGattWithError);

                expect(result).toBeUndefined();
                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Ergo battery service is unavailable",
                    "Dismiss",
                );
            });

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: false,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: false } },
                    writable: true,
                });

                await expectAsync(ergConnectionService.connectToBattery(mockGattWithError)).toBeRejected();
            });
        });

        describe("connectToExtended", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = await ergConnectionService.connectToExtended(mockGattServer);

                expect(result).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: true,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: true } },
                    writable: true,
                });

                const result = await ergConnectionService.connectToExtended(mockGattWithError);

                expect(result).toBeUndefined();
                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Extended Metrics",
                    "Dismiss",
                );
            });
        });

        describe("connectToHandleForces", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = await ergConnectionService.connectToHandleForces(mockGattServer);

                expect(result).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: true,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: true } },
                    writable: true,
                });

                const result = await ergConnectionService.connectToHandleForces(mockGattWithError);

                expect(result).toBeUndefined();
                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Handles Forces",
                    "Dismiss",
                );
            });
        });

        describe("connectToDeltaTimes", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = await ergConnectionService.connectToDeltaTimes(mockGattServer);

                expect(result).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: true,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: true } },
                    writable: true,
                });

                const result = await ergConnectionService.connectToDeltaTimes(mockGattWithError);

                expect(result).toBeUndefined();
                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Delta Times",
                    "Dismiss",
                );
            });
        });

        describe("connectToMeasurement", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = await ergConnectionService.connectToMeasurement(mockGattServer);

                expect(result).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: true,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: true } },
                    writable: true,
                });

                const result = await ergConnectionService.connectToMeasurement(mockGattWithError);

                expect(result).toBeUndefined();
                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Measurement Characteristic",
                    "Dismiss",
                );
            });

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: false,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: false } },
                    writable: true,
                });

                await expectAsync(
                    ergConnectionService.connectToMeasurement(mockGattWithError),
                ).toBeRejected();
            });
        });

        describe("connectToSettings", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = await ergConnectionService.connectToSettings(mockGattServer);

                expect(result).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: true,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: true } },
                    writable: true,
                });

                const result = await ergConnectionService.connectToSettings(mockGattWithError);

                expect(result).toBeUndefined();
                expect(matSnackBarSpy.open).toHaveBeenCalledWith("Error connecting to Settings", "Dismiss");
            });

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: false,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: false } },
                    writable: true,
                });

                await expectAsync(ergConnectionService.connectToSettings(mockGattWithError)).toBeRejected();
            });
        });

        describe("connectToStrokeSettings", (): void => {
            it("should connect successfully when service is available", async (): Promise<void> => {
                const result = await ergConnectionService.connectToStrokeSettings(mockGattServer);

                expect(result).toBeDefined();
            });

            it("should show snackbar when service is unavailable but device is connected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: true,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: true } },
                    writable: true,
                });

                const result = await ergConnectionService.connectToStrokeSettings(mockGattWithError);

                expect(result).toBeUndefined();
                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Stroke Detection Settings",
                    "Dismiss",
                );
            });

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                const mockGattWithError = createMockBluetoothDevice({
                    gatt: {
                        connected: false,
                        getPrimaryService: jasmine
                            .createSpy("getPrimaryService")
                            .and.rejectWith(new Error("Service unavailable - test")),
                    } as unknown as BluetoothRemoteGATTServer,
                }).gatt as BluetoothRemoteGATTServer;
                Object.defineProperty(ergConnectionService, "_bluetoothDevice", {
                    value: { gatt: { connected: false } },
                    writable: true,
                });

                await expectAsync(
                    ergConnectionService.connectToStrokeSettings(mockGattWithError),
                ).toBeRejected();
            });
        });
    });
});
