import { provideZonelessChangeDetection } from "@angular/core";
import { fakeAsync, flush, TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";

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
    let matSnackBarSpy: jasmine.SpyObj<MatSnackBar>;
    let configManagerServiceSpy: jasmine.SpyObj<ConfigManagerService>;
    let mockBluetoothDevice: jasmine.SpyObj<BluetoothDevice>;
    let mockBluetooth: jasmine.Spy<() => Bluetooth | undefined>;
    let createDisconnectChangedListenerReady: () => Promise<ListenerTrigger<void>>;
    let mockBatteryCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockCyclingPowerCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockCscCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockRowerDataCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockExtendedCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockHandleForcesCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockDeltaTimesCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockSettingsCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockStrokeSettingsCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockBatteryService: jasmine.SpyObj<BluetoothRemoteGATTService>;
    let mockCyclingPowerService: jasmine.SpyObj<BluetoothRemoteGATTService>;
    let mockCscService: jasmine.SpyObj<BluetoothRemoteGATTService>;
    let mockFitnessService: jasmine.SpyObj<BluetoothRemoteGATTService>;
    let mockExtendedService: jasmine.SpyObj<BluetoothRemoteGATTService>;
    let mockSettingsService: jasmine.SpyObj<BluetoothRemoteGATTService>;
    let connectionSpies: {
        connectToMeasurement: jasmine.Spy;
        connectToExtended: jasmine.Spy;
        connectToHandleForces: jasmine.Spy;
        connectToDeltaTimes: jasmine.Spy;
        connectToSettings: jasmine.Spy;
        connectToStrokeSettings: jasmine.Spy;
        connectToBattery: jasmine.Spy;
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

    beforeEach((): void => {
        matSnackBarSpy = jasmine.createSpyObj<MatSnackBar>("MatSnackBar", ["open"]);
        configManagerServiceSpy = jasmine.createSpyObj<ConfigManagerService>("ConfigManagerService", [
            "getItem",
            "setItem",
        ]);

        configManagerServiceSpy.getItem.and.returnValue("mock-device-id");

        spyOnProperty(document, "visibilityState", "get").and.returnValue("visible");

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

        mockBatteryService = jasmine.createSpyObj<BluetoothRemoteGATTService>("BluetoothRemoteGATTService", [
            "getCharacteristic",
        ]);
        mockCyclingPowerService = jasmine.createSpyObj<BluetoothRemoteGATTService>(
            "BluetoothRemoteGATTService",
            ["getCharacteristic"],
        );
        mockCscService = jasmine.createSpyObj<BluetoothRemoteGATTService>("BluetoothRemoteGATTService", [
            "getCharacteristic",
        ]);
        mockFitnessService = jasmine.createSpyObj<BluetoothRemoteGATTService>("BluetoothRemoteGATTService", [
            "getCharacteristic",
        ]);
        mockExtendedService = jasmine.createSpyObj<BluetoothRemoteGATTService>("BluetoothRemoteGATTService", [
            "getCharacteristic",
        ]);
        mockSettingsService = jasmine.createSpyObj<BluetoothRemoteGATTService>("BluetoothRemoteGATTService", [
            "getCharacteristic",
        ]);

        const gattServer = mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>;
        gattServer.connect.and.resolveTo(gattServer);
        gattServer.getPrimaryService.withArgs(BATTERY_LEVEL_SERVICE).and.resolveTo(mockBatteryService);
        gattServer.getPrimaryService.withArgs(CYCLING_POWER_SERVICE).and.resolveTo(mockCyclingPowerService);
        gattServer.getPrimaryService
            .withArgs(CYCLING_SPEED_AND_CADENCE_SERVICE)
            .and.resolveTo(mockCscService);
        gattServer.getPrimaryService.withArgs(FITNESS_MACHINE_SERVICE).and.resolveTo(mockFitnessService);
        gattServer.getPrimaryService.withArgs(EXTENDED_METRICS_SERVICE).and.resolveTo(mockExtendedService);
        gattServer.getPrimaryService.withArgs(SETTINGS_SERVICE).and.resolveTo(mockSettingsService);

        mockBatteryService.getCharacteristic
            .withArgs(BATTERY_LEVEL_CHARACTERISTIC)
            .and.resolveTo(mockBatteryCharacteristic);

        mockCyclingPowerService.getCharacteristic
            .withArgs(CYCLING_POWER_CHARACTERISTIC)
            .and.resolveTo(mockCyclingPowerCharacteristic);

        mockCscService.getCharacteristic
            .withArgs(CYCLING_SPEED_AND_CADENCE_CHARACTERISTIC)
            .and.resolveTo(mockCscCharacteristic);

        mockFitnessService.getCharacteristic
            .withArgs(ROWER_DATA_CHARACTERISTIC)
            .and.resolveTo(mockRowerDataCharacteristic);

        mockExtendedService.getCharacteristic
            .withArgs(EXTENDED_CHARACTERISTIC)
            .and.resolveTo(mockExtendedCharacteristic);
        mockExtendedService.getCharacteristic
            .withArgs(HANDLE_FORCES_CHARACTERISTIC)
            .and.resolveTo(mockHandleForcesCharacteristic);
        mockExtendedService.getCharacteristic
            .withArgs(DELTA_TIMES_CHARACTERISTIC)
            .and.resolveTo(mockDeltaTimesCharacteristic);

        mockSettingsService.getCharacteristic
            .withArgs(SETTINGS_CHARACTERISTIC)
            .and.resolveTo(mockSettingsCharacteristic);
        mockSettingsService.getCharacteristic
            .withArgs(STROKE_SETTINGS_CHARACTERISTIC)
            .and.resolveTo(mockStrokeSettingsCharacteristic);

        createDisconnectChangedListenerReady = changedListenerReadyFactory<typeof mockBluetoothDevice, void>(
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
        expect(localStatusEvents).toHaveSize(1);
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
                const gattServer = mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>;

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
            mockBluetooth.and.returnValue({
                requestDevice: (): Promise<BluetoothDevice> => Promise.reject(new Error("cancel")),
            } as Bluetooth);
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
            mockBluetooth.and.returnValue({
                getDevices: (): Promise<Array<BluetoothDevice>> =>
                    Promise.resolve([] as Array<BluetoothDevice>),
            } as Bluetooth);

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

            await ergConnectionService.reconnect();

            expect(mockBluetoothDevice.watchAdvertisements).toHaveBeenCalled();
            expect(localStatusEvents[localStatusEvents.length - 1].status).toBe("searching");
        });

        it("should retry reconnect when watchAdvertisements throws", async (): Promise<void> => {
            mockBluetoothDevice.watchAdvertisements.and.rejectWith(new Error("watch failed"));
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
                const disconnectReady = createDisconnectChangedListenerReady();

                await ergConnectionService.discover();

                await expectAsync(disconnectReady).toBeResolved();
            });
        });

        describe("on connection failure", (): void => {
            let isGattConnectedSpy: jasmine.Spy<() => boolean>;

            beforeEach((): void => {
                isGattConnectedSpy = Object.getOwnPropertyDescriptor(mockBluetoothDevice.gatt, "connected")
                    ?.get as jasmine.Spy;
            });

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
                isGattConnectedSpy.and.returnValue(false);
                connectionSpies.connectToMeasurement.and.rejectWith(new Error("connection failed"));
                const reconnectMethodSpy = spyOn(ergConnectionService, "reconnect").and.resolveTo();

                await ergConnectionService.discover();

                expect(reconnectMethodSpy).toHaveBeenCalled();
            });

            it("should handle gatt.connect returning falsy value", async (): Promise<void> => {
                (mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>).connect.and.resolveTo(
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
            const reconnectMethodSpy = spyOn(ergConnectionService, "reconnect").and.resolveTo();

            (await disconnectReady).triggerChanged();

            expect(reconnectMethodSpy).toHaveBeenCalled();
            expect(matSnackBarSpy.open).toHaveBeenCalledWith("Ergometer Monitor disconnected", "Dismiss");
        });

        it("should reconnect by handling advertisement event", async (): Promise<void> => {
            const advertisementTrigger = changedListenerReadyFactory<typeof mockBluetoothDevice, void>(
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
        let mockGattServer: jasmine.SpyObj<BluetoothRemoteGATTServer>;
        let connectedSpy: jasmine.Spy<() => boolean>;

        beforeEach(async (): Promise<void> => {
            mockGattServer = mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>;
            connectedSpy = Object.getOwnPropertyDescriptor(mockGattServer, "connected")?.get as jasmine.Spy;

            connectionSpies.connectToBattery.and.callThrough();
            connectionSpies.connectToExtended.and.callThrough();
            connectionSpies.connectToHandleForces.and.callThrough();
            connectionSpies.connectToDeltaTimes.and.callThrough();
            connectionSpies.connectToSettings.and.callThrough();
            connectionSpies.connectToStrokeSettings.and.callThrough();
            connectionSpies.connectToMeasurement.and.callThrough();

            // eslint-disable-next-line no-underscore-dangle
            (ergConnectionService as unknown as { _bluetoothDevice: BluetoothDevice })._bluetoothDevice =
                mockBluetoothDevice;
        });

        describe("connectToBattery", (): void => {
            it("should connect successfully when service is available", fakeAsync((): void => {
                ergConnectionService
                    .connectToBattery(mockGattServer)
                    .then((result: void | BluetoothRemoteGATTCharacteristic): void => {
                        expect(result).toBeDefined();
                    });

                flush();
                expect(ergConnectionService.readBatteryCharacteristic()).toBeDefined();
            }));

            it("should show snackbar when service is unavailable but device is connected", fakeAsync((): void => {
                connectedSpy.and.returnValue(true);
                mockGattServer.getPrimaryService
                    .withArgs(BATTERY_LEVEL_SERVICE)
                    .and.rejectWith(new Error("Service unavailable device connected - test"));

                ergConnectionService.connectToBattery(mockGattServer).catch((): void => {
                    // no-op
                });
                flush();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Ergo battery service is unavailable",
                    "Dismiss",
                );
            }));

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.and.returnValue(false);
                mockGattServer.getPrimaryService
                    .withArgs(BATTERY_LEVEL_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                await expectAsync(ergConnectionService.connectToBattery(mockGattServer)).toBeRejected();
            });
        });

        describe("connectToExtended", (): void => {
            it("should connect successfully when service is available", fakeAsync((): void => {
                ergConnectionService
                    .connectToExtended(mockGattServer)
                    .then((result: void | BluetoothRemoteGATTCharacteristic): void => {
                        expect(result).toBeDefined();
                    });

                flush();

                expect(ergConnectionService.readExtendedCharacteristic()).toBeDefined();
            }));

            it("should show snackbar when service is unavailable but device is connected", fakeAsync((): void => {
                connectedSpy.and.returnValue(true);
                mockGattServer.getPrimaryService
                    .withArgs(EXTENDED_METRICS_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                ergConnectionService.connectToExtended(mockGattServer).catch((): void => {
                    // no-op
                });
                flush();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Extended Metrics",
                    "Dismiss",
                );
            }));

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.and.returnValue(false);
                const gattServer = mockBluetoothDevice.gatt as jasmine.SpyObj<BluetoothRemoteGATTServer>;
                gattServer.getPrimaryService
                    .withArgs(EXTENDED_METRICS_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                await expectAsync(ergConnectionService.connectToExtended(gattServer)).toBeRejected();
            });
        });

        describe("connectToHandleForces", (): void => {
            it("should connect successfully when service is available", fakeAsync((): void => {
                ergConnectionService
                    .connectToHandleForces(mockGattServer)
                    .then((result: void | BluetoothRemoteGATTCharacteristic): void => {
                        expect(result).toBeDefined();
                    });
                flush();

                expect(ergConnectionService.readHandleForceCharacteristic()).toBeDefined();
            }));

            it("should show snackbar when service is unavailable but device is connected", fakeAsync((): void => {
                connectedSpy.and.returnValue(true);
                mockGattServer.getPrimaryService
                    .withArgs(EXTENDED_METRICS_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                ergConnectionService.connectToHandleForces(mockGattServer).catch((): void => {
                    // no-op
                });
                flush();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Handles Forces",
                    "Dismiss",
                );
            }));
        });

        describe("connectToDeltaTimes", (): void => {
            it("should connect successfully when service is available", fakeAsync((): void => {
                ergConnectionService
                    .connectToDeltaTimes(mockGattServer)
                    .then((result: void | BluetoothRemoteGATTCharacteristic): void => {
                        expect(result).toBeDefined();
                    });
                flush();

                expect(ergConnectionService.readDeltaTimesCharacteristic()).toBeDefined();
            }));

            it("should show snackbar when service is unavailable but device is connected", fakeAsync((): void => {
                connectedSpy.and.returnValue(true);
                mockGattServer.getPrimaryService
                    .withArgs(EXTENDED_METRICS_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                ergConnectionService.connectToDeltaTimes(mockGattServer).catch((): void => {
                    // no-op
                });
                flush();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Delta Times",
                    "Dismiss",
                );
            }));
        });

        describe("connectToMeasurement", (): void => {
            it("should connect successfully when service is available", fakeAsync((): void => {
                ergConnectionService
                    .connectToMeasurement(mockGattServer)
                    .then((result: void | BluetoothRemoteGATTCharacteristic): void => {
                        expect(result).toBeDefined();
                    });

                flush();
                expect(ergConnectionService.readMeasurementCharacteristic()).toBeDefined();
            }));

            it("should show snackbar when service is unavailable but device is connected", fakeAsync((): void => {
                connectedSpy.and.returnValue(true);
                mockGattServer.getPrimaryService
                    .withArgs(CYCLING_POWER_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));
                mockGattServer.getPrimaryService
                    .withArgs(CYCLING_SPEED_AND_CADENCE_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));
                mockGattServer.getPrimaryService
                    .withArgs(FITNESS_MACHINE_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                ergConnectionService.connectToMeasurement(mockGattServer).catch((): void => {
                    // no-op
                });
                flush();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Measurement Characteristic",
                    "Dismiss",
                );
            }));

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.and.returnValue(false);
                mockGattServer.getPrimaryService
                    .withArgs(CYCLING_POWER_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));
                mockGattServer.getPrimaryService
                    .withArgs(CYCLING_SPEED_AND_CADENCE_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));
                mockGattServer.getPrimaryService
                    .withArgs(FITNESS_MACHINE_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                await expectAsync(ergConnectionService.connectToMeasurement(mockGattServer)).toBeRejected();
            });
        });

        describe("connectToSettings", (): void => {
            it("should connect successfully when service is available", fakeAsync((): void => {
                ergConnectionService
                    .connectToSettings(mockGattServer)
                    .then((result: void | BluetoothRemoteGATTCharacteristic): void => {
                        expect(result).toBeDefined();
                    });
                flush();

                expect(ergConnectionService.readSettingsCharacteristic()).toBeDefined();
            }));

            it("should show snackbar when service is unavailable but device is connected", fakeAsync((): void => {
                connectedSpy.and.returnValue(true);
                mockGattServer.getPrimaryService
                    .withArgs(SETTINGS_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                ergConnectionService.connectToSettings(mockGattServer).catch((): void => {
                    // no-op
                });
                flush();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith("Error connecting to Settings", "Dismiss");
            }));

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.and.returnValue(false);
                mockGattServer.getPrimaryService
                    .withArgs(SETTINGS_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                await expectAsync(ergConnectionService.connectToSettings(mockGattServer)).toBeRejected();
            });
        });

        describe("connectToStrokeSettings", (): void => {
            it("should connect successfully when service is available", fakeAsync((): void => {
                ergConnectionService
                    .connectToStrokeSettings(mockGattServer)
                    .then((result: void | BluetoothRemoteGATTCharacteristic): void => {
                        expect(result).toBeDefined();
                    });
                flush();

                expect(ergConnectionService.readStrokeSettingsCharacteristic()).toBeDefined();
            }));

            it("should show snackbar when service is unavailable but device is connected", fakeAsync((): void => {
                connectedSpy.and.returnValue(true);
                mockGattServer.getPrimaryService
                    .withArgs(SETTINGS_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                ergConnectionService.connectToStrokeSettings(mockGattServer).catch((): void => {
                    // no-op
                });
                flush();

                expect(matSnackBarSpy.open).toHaveBeenCalledWith(
                    "Error connecting to Stroke Detection Settings",
                    "Dismiss",
                );
            }));

            it("should propagate error when device is disconnected", async (): Promise<void> => {
                connectedSpy.and.returnValue(false);
                mockGattServer.getPrimaryService
                    .withArgs(SETTINGS_SERVICE)
                    .and.rejectWith(new Error("Service unavailable - test"));

                await expectAsync(
                    ergConnectionService.connectToStrokeSettings(mockGattServer),
                ).toBeRejected();
            });
        });
    });
});
