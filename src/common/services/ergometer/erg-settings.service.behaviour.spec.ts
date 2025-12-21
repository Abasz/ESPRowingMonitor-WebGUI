import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    createMockRowerSettingsDataView,
    createMockStrokeSettingsDataView,
    ListenerTrigger,
} from "../ble.test.helpers";

import { ErgConnectionService } from "./erg-connection.service";
import { ErgSettingsService } from "./erg-settings.service";

describe("ErgSettingsService", (): void => {
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

    let settingsValueChangeTrigger: Promise<ListenerTrigger<DataView>>;
    let strokeSettingsValueChangedTrigger: Promise<ListenerTrigger<DataView>>;

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

        settingsValueChangeTrigger = changedListenerReadyFactory(
            mockSettingsCharacteristic,
            "characteristicvaluechanged",
        )();

        strokeSettingsValueChangedTrigger = changedListenerReadyFactory(
            mockStrokeSettingsCharacteristic,
            "characteristicvaluechanged",
        )();

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

    it("should initialize rowerSettings signal with default values", (): void => {
        const rowerSettings = service.rowerSettings();

        expect(rowerSettings.generalSettings.logDeltaTimes, "generalSettings.logDeltaTimes").toBeUndefined();
        expect(rowerSettings.generalSettings.logToSdCard, "generalSettings.logToSdCard").toBeUndefined();
        expect(rowerSettings.generalSettings.logLevel, "generalSettings.logLevel").toBe(0);
        expect(rowerSettings.generalSettings.bleServiceFlag, "generalSettings.bleServiceFlag").toBe(
            BleServiceFlag.CpsService,
        );
        expect(
            rowerSettings.generalSettings.isRuntimeSettingsEnabled,
            "generalSettings.isRuntimeSettingsEnabled",
        ).toBeUndefined();
        expect(
            rowerSettings.generalSettings.isCompiledWithDouble,
            "generalSettings.isCompiledWithDouble",
        ).toBeUndefined();

        expect(
            rowerSettings.rowingSettings.machineSettings.flywheelInertia,
            "machineSettings.flywheelInertia",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.machineSettings.magicConstant,
            "machineSettings.magicConstant",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.machineSettings.sprocketRadius,
            "machineSettings.sprocketRadius",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.machineSettings.impulsePerRevolution,
            "machineSettings.impulsePerRevolution",
        ).toBe(0);

        expect(
            rowerSettings.rowingSettings.sensorSignalSettings.rotationDebounceTime,
            "sensorSignalSettings.rotationDebounceTime",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.sensorSignalSettings.rowingStoppedThreshold,
            "sensorSignalSettings.rowingStoppedThreshold",
        ).toBe(0);

        expect(
            rowerSettings.rowingSettings.dragFactorSettings.goodnessOfFitThreshold,
            "dragFactorSettings.goodnessOfFitThreshold",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.dragFactorSettings.maxDragFactorRecoveryPeriod,
            "dragFactorSettings.maxDragFactorRecoveryPeriod",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.dragFactorSettings.dragFactorLowerThreshold,
            "dragFactorSettings.dragFactorLowerThreshold",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.dragFactorSettings.dragFactorUpperThreshold,
            "dragFactorSettings.dragFactorUpperThreshold",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.dragFactorSettings.dragCoefficientsArrayLength,
            "dragFactorSettings.dragCoefficientsArrayLength",
        ).toBe(0);

        expect(
            rowerSettings.rowingSettings.strokeDetectionSettings.strokeDetectionType,
            "strokeDetectionSettings.strokeDetectionType",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength,
            "strokeDetectionSettings.impulseDataArrayLength",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.strokeDetectionSettings.minimumPoweredTorque,
            "strokeDetectionSettings.minimumPoweredTorque",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.strokeDetectionSettings.minimumDragTorque,
            "strokeDetectionSettings.minimumDragTorque",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlopeMargin,
            "strokeDetectionSettings.minimumRecoverySlopeMargin",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlope,
            "strokeDetectionSettings.minimumRecoverySlope",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoveryTime,
            "strokeDetectionSettings.minimumRecoveryTime",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.strokeDetectionSettings.minimumDriveTime,
            "strokeDetectionSettings.minimumDriveTime",
        ).toBe(0);
        expect(
            rowerSettings.rowingSettings.strokeDetectionSettings.driveHandleForcesMaxCapacity,
            "strokeDetectionSettings.driveHandleForcesMaxCapacity",
        ).toBe(0);
    });

    describe("rowerSettings signal", (): void => {
        describe("when rower settings endpoint updates", (): void => {
            const mockSettingsData = createMockRowerSettingsDataView(true, false, 2, true, false);

            beforeEach((): void => {
                vi.mocked(mockSettingsCharacteristic.readValue).mockResolvedValue(mockSettingsData);
            });

            it("should update generalSettings portion", async (): Promise<void> => {
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                await settingsValueChangeTrigger;

                const rowerSettings = service.rowerSettings();

                expect(
                    rowerSettings.generalSettings.logDeltaTimes,
                    "rowerSettings.generalSettings.logDeltaTimes",
                ).toBe(true);
                expect(
                    rowerSettings.generalSettings.logToSdCard,
                    "rowerSettings.generalSettings.logToSdCard",
                ).toBe(false);
                expect(rowerSettings.generalSettings.logLevel, "rowerSettings.generalSettings.logLevel").toBe(
                    2,
                );
                expect(
                    rowerSettings.generalSettings.isRuntimeSettingsEnabled,
                    "rowerSettings.generalSettings.isRuntimeSettingsEnabled",
                ).toBe(true);
            });

            it("should update rowingSettings portion", async (): Promise<void> => {
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                await settingsValueChangeTrigger;

                const rowerSettings = service.rowerSettings();

                expect(
                    rowerSettings.rowingSettings.machineSettings.flywheelInertia,
                    "machineSettings.flywheelInertia",
                ).toBeCloseTo(0.097, 5);
                expect(
                    rowerSettings.rowingSettings.machineSettings.magicConstant,
                    "machineSettings.magicConstant",
                ).toBe(2.8);
                expect(
                    rowerSettings.rowingSettings.machineSettings.sprocketRadius,
                    "machineSettings.sprocketRadius",
                ).toBe(0.04);
                expect(
                    rowerSettings.rowingSettings.machineSettings.impulsePerRevolution,
                    "machineSettings.impulsePerRevolution",
                ).toBe(3);

                expect(
                    rowerSettings.rowingSettings.sensorSignalSettings.rotationDebounceTime,
                    "sensorSignalSettings.rotationDebounceTime",
                ).toBe(5);
                expect(
                    rowerSettings.rowingSettings.sensorSignalSettings.rowingStoppedThreshold,
                    "sensorSignalSettings.rowingStoppedThreshold",
                ).toBe(3);

                expect(
                    rowerSettings.rowingSettings.dragFactorSettings.goodnessOfFitThreshold,
                    "dragFactorSettings.goodnessOfFitThreshold",
                ).toBeCloseTo(0.96, 2);
                expect(
                    rowerSettings.rowingSettings.dragFactorSettings.maxDragFactorRecoveryPeriod,
                    "dragFactorSettings.maxDragFactorRecoveryPeriod",
                ).toBe(3);
                expect(
                    rowerSettings.rowingSettings.dragFactorSettings.dragFactorLowerThreshold,
                    "dragFactorSettings.dragFactorLowerThreshold",
                ).toBe(90);
                expect(
                    rowerSettings.rowingSettings.dragFactorSettings.dragFactorUpperThreshold,
                    "dragFactorSettings.dragFactorUpperThreshold",
                ).toBe(220);
                expect(
                    rowerSettings.rowingSettings.dragFactorSettings.dragCoefficientsArrayLength,
                    "dragFactorSettings.dragCoefficientsArrayLength",
                ).toBe(4);
            });
        });

        describe("when stroke detection endpoint updates (legacy firmware with deprecated field)", (): void => {
            const mockStrokeData = createMockStrokeSettingsDataView(2, 16, true, true);

            beforeEach((): void => {
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockResolvedValue(mockStrokeData);
            });

            it("should update generalSettings isCompiledWithDouble", async (): Promise<void> => {
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const rowerSettings = service.rowerSettings();

                expect(
                    rowerSettings.generalSettings.isCompiledWithDouble,
                    "generalSettings.isCompiledWithDouble",
                ).toBe(true);
            });

            it("should update strokeDetectionSettings", async (): Promise<void> => {
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const rowerSettings = service.rowerSettings();

                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.strokeDetectionType,
                    "strokeDetectionSettings.strokeDetectionType",
                ).toBe(2);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength,
                    "strokeDetectionSettings.impulseDataArrayLength",
                ).toBe(16);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumPoweredTorque,
                    "strokeDetectionSettings.minimumPoweredTorque",
                ).toBe(0.15);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumDragTorque,
                    "strokeDetectionSettings.minimumDragTorque",
                ).toBe(0.05);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlopeMargin,
                    "strokeDetectionSettings.minimumRecoverySlopeMargin",
                ).toBe(0);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlope,
                    "strokeDetectionSettings.minimumRecoverySlope",
                ).toBe(-0.1);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoveryTime,
                    "strokeDetectionSettings.minimumRecoveryTime",
                ).toBe(200);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumDriveTime,
                    "strokeDetectionSettings.minimumDriveTime",
                ).toBe(300);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.driveHandleForcesMaxCapacity,
                    "strokeDetectionSettings.driveHandleForcesMaxCapacity",
                ).toBe(50);
            });
        });

        describe("when stroke detection endpoint updates (new firmware without deprecated field)", (): void => {
            const mockStrokeData = createMockStrokeSettingsDataView(2, 16, true, false);

            beforeEach((): void => {
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockResolvedValue(mockStrokeData);
            });

            it("should set minimumRecoverySlopeMargin to NaN for new firmware", async (): Promise<void> => {
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const rowerSettings = service.rowerSettings();

                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlopeMargin,
                    "strokeDetectionSettings.minimumRecoverySlopeMargin should be NaN",
                ).toBeNaN();
            });

            it("should update other strokeDetectionSettings correctly", async (): Promise<void> => {
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const rowerSettings = service.rowerSettings();

                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.strokeDetectionType,
                    "strokeDetectionSettings.strokeDetectionType",
                ).toBe(2);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength,
                    "strokeDetectionSettings.impulseDataArrayLength",
                ).toBe(16);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumPoweredTorque,
                    "strokeDetectionSettings.minimumPoweredTorque",
                ).toBe(0.15);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumDragTorque,
                    "strokeDetectionSettings.minimumDragTorque",
                ).toBe(0.05);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlope,
                    "strokeDetectionSettings.minimumRecoverySlope",
                ).toBe(-0.1);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoveryTime,
                    "strokeDetectionSettings.minimumRecoveryTime",
                ).toBe(200);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.minimumDriveTime,
                    "strokeDetectionSettings.minimumDriveTime",
                ).toBe(300);
                expect(
                    rowerSettings.rowingSettings.strokeDetectionSettings.driveHandleForcesMaxCapacity,
                    "strokeDetectionSettings.driveHandleForcesMaxCapacity",
                ).toBe(50);
            });
        });

        it("should combine data from both sources correctly when both signals update", async (): Promise<void> => {
            const mockSettingsData = createMockRowerSettingsDataView(true, true, 3, false, false);
            const mockStrokeData = createMockStrokeSettingsDataView(1, 12, true, true);

            vi.mocked(mockSettingsCharacteristic.readValue).mockResolvedValue(mockSettingsData);
            vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockResolvedValue(mockStrokeData);

            settingsCharacteristicSubject.next(mockSettingsCharacteristic);
            strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
            await strokeSettingsValueChangedTrigger;
            await settingsValueChangeTrigger;

            const rowerSettings = service.rowerSettings();

            expect(rowerSettings.generalSettings.logDeltaTimes, "generalSettings.logDeltaTimes").toBe(true);
            expect(rowerSettings.generalSettings.logToSdCard, "generalSettings.logToSdCard").toBe(true);
            expect(rowerSettings.generalSettings.logLevel, "generalSettings.logLevel").toBe(3);
            expect(
                rowerSettings.generalSettings.isRuntimeSettingsEnabled,
                "generalSettings.isRuntimeSettingsEnabled",
            ).toBe(false);
            expect(
                rowerSettings.generalSettings.isCompiledWithDouble,
                "generalSettings.isCompiledWithDouble",
            ).toBe(true);

            expect(
                rowerSettings.rowingSettings.strokeDetectionSettings.strokeDetectionType,
                "strokeDetectionSettings.strokeDetectionType",
            ).toBe(1);
            expect(
                rowerSettings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength,
                "strokeDetectionSettings.impulseDataArrayLength",
            ).toBe(12);
        });

        it("should merge initial read with notification updates", async (): Promise<void> => {
            const initialData = createMockRowerSettingsDataView(false, true, 1, false, true);
            vi.mocked(mockSettingsCharacteristic.readValue).mockResolvedValue(initialData);

            settingsCharacteristicSubject.next(mockSettingsCharacteristic);
            const triggerHandler = await settingsValueChangeTrigger;

            const firstSettings = service.rowerSettings();
            triggerHandler.triggerChanged(createMockRowerSettingsDataView(true, false, 2, true, true));
            const secondSettings = service.rowerSettings();

            expect(firstSettings.generalSettings.logToSdCard, "initial read").toBe(true);
            expect(firstSettings.generalSettings.logLevel, "initial read").toBe(1);

            expect(secondSettings.generalSettings.logToSdCard, "subsequent notify").toBe(false);
            expect(secondSettings.generalSettings.logLevel, "subsequent notify").toBe(2);
        });

        describe("when receiving backward compatible 1-byte data", (): void => {
            const oneByteData = createMockRowerSettingsDataView(true, false, 2, undefined, true);

            beforeEach(async (): Promise<void> => {
                vi.mocked(mockSettingsCharacteristic.readValue).mockResolvedValue(oneByteData);

                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                await settingsValueChangeTrigger;
            });

            it("should parse log flags correctly", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.generalSettings.logDeltaTimes, "generalSettings.logDeltaTimes").toBe(true);
                expect(settings.generalSettings.logToSdCard, "generalSettings.logToSdCard").toBe(false);
            });

            it("should extract log level from bits 4-6", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.generalSettings.logLevel, "generalSettings.logLevel").toBe(2);
            });

            it("should merge with default rowing settings", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(
                    settings.rowingSettings.machineSettings.flywheelInertia,
                    "machineSettings.flywheelInertia",
                ).toBe(0);
                expect(
                    settings.rowingSettings.sensorSignalSettings.rotationDebounceTime,
                    "sensorSignalSettings.rotationDebounceTime",
                ).toBe(0);
                expect(
                    settings.rowingSettings.dragFactorSettings.goodnessOfFitThreshold,
                    "dragFactorSettings.goodnessOfFitThreshold",
                ).toBe(0);
            });

            it("should calculate BLE service flag", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.generalSettings.bleServiceFlag, "generalSettings.bleServiceFlag").toBe(
                    BleServiceFlag.CpsService,
                );
            });
        });

        describe("when receiving full settings data", (): void => {
            const fullData = createMockRowerSettingsDataView(true, false, 2, true);

            beforeEach(async (): Promise<void> => {
                vi.mocked(mockSettingsCharacteristic.readValue).mockResolvedValue(fullData);

                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                await settingsValueChangeTrigger;
            });

            it("should parse general settings flags", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.generalSettings.logDeltaTimes, "generalSettings.logDeltaTimes").toBe(true);
                expect(settings.generalSettings.logToSdCard, "generalSettings.logToSdCard").toBe(false);
                expect(settings.generalSettings.logLevel, "generalSettings.logLevel").toBe(2);
            });

            it("should parse runtime settings enabled flag", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(
                    settings.generalSettings.isRuntimeSettingsEnabled,
                    "generalSettings.isRuntimeSettingsEnabled",
                ).toBe(true);
            });

            it("should parse machine settings with correct scaling", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(
                    settings.rowingSettings.machineSettings.flywheelInertia,
                    "machineSettings.flywheelInertia",
                ).toBeCloseTo(0.097, 3);
                expect(
                    settings.rowingSettings.machineSettings.magicConstant,
                    "machineSettings.magicConstant",
                ).toBe(2.8);
                expect(
                    settings.rowingSettings.machineSettings.sprocketRadius,
                    "machineSettings.sprocketRadius",
                ).toBeCloseTo(0.04, 3);
                expect(
                    settings.rowingSettings.machineSettings.impulsePerRevolution,
                    "machineSettings.impulsePerRevolution",
                ).toBe(3);
            });

            it("should parse sensor signal settings", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(
                    settings.rowingSettings.sensorSignalSettings.rotationDebounceTime,
                    "sensorSignalSettings.rotationDebounceTime",
                ).toBe(5);
                expect(
                    settings.rowingSettings.sensorSignalSettings.rowingStoppedThreshold,
                    "sensorSignalSettings.rowingStoppedThreshold",
                ).toBe(3);
            });

            it("should parse drag factor settings with scaling", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(
                    settings.rowingSettings.dragFactorSettings.goodnessOfFitThreshold,
                    "dragFactorSettings.goodnessOfFitThreshold",
                ).toBeCloseTo(0.96, 2);
                expect(
                    settings.rowingSettings.dragFactorSettings.maxDragFactorRecoveryPeriod,
                    "dragFactorSettings.maxDragFactorRecoveryPeriod",
                ).toBe(3);
                expect(
                    settings.rowingSettings.dragFactorSettings.dragFactorLowerThreshold,
                    "dragFactorSettings.dragFactorLowerThreshold",
                ).toBe(90);
                expect(
                    settings.rowingSettings.dragFactorSettings.dragFactorUpperThreshold,
                    "dragFactorSettings.dragFactorUpperThreshold",
                ).toBe(220);
                expect(
                    settings.rowingSettings.dragFactorSettings.dragCoefficientsArrayLength,
                    "dragFactorSettings.dragCoefficientsArrayLength",
                ).toBe(4);
            });
        });

        describe("when receiving stroke detection characteristic data (legacy format)", (): void => {
            const mockStrokeData = createMockStrokeSettingsDataView(2, 16, true, true);

            it("should merge initial read with notification updates", async (): Promise<void> => {
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockResolvedValue(mockStrokeData);

                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const settings = service.rowerSettings();
                expect(
                    settings.rowingSettings.strokeDetectionSettings.strokeDetectionType,
                    "strokeDetectionSettings.strokeDetectionType",
                ).toBe(2);
                expect(
                    settings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength,
                    "strokeDetectionSettings.impulseDataArrayLength",
                ).toBe(16);
            });

            it("should parse stroke settings correctly", async (): Promise<void> => {
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockResolvedValue(mockStrokeData);

                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const settings = service.rowerSettings();
                // bit-packed values
                expect(
                    settings.rowingSettings.strokeDetectionSettings.strokeDetectionType,
                    "strokeDetectionSettings.strokeDetectionType",
                ).toBe(2);
                expect(
                    settings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength,
                    "strokeDetectionSettings.impulseDataArrayLength",
                ).toBe(16);
                expect(
                    settings.generalSettings.isCompiledWithDouble,
                    "generalSettings.isCompiledWithDouble",
                ).toBe(true);

                // torque values with scaling
                expect(
                    settings.rowingSettings.strokeDetectionSettings.minimumPoweredTorque,
                    "strokeDetectionSettings.minimumPoweredTorque",
                ).toBe(0.15);
                expect(
                    settings.rowingSettings.strokeDetectionSettings.minimumDragTorque,
                    "strokeDetectionSettings.minimumDragTorque",
                ).toBe(0.05);

                expect(
                    settings.rowingSettings.strokeDetectionSettings.minimumRecoverySlopeMargin,
                    "strokeDetectionSettings.minimumRecoverySlopeMargin",
                ).toBe(0);
                expect(
                    settings.rowingSettings.strokeDetectionSettings.minimumRecoverySlope,
                    "strokeDetectionSettings.minimumRecoverySlope",
                ).toBe(-0.1);

                // packed timing values
                expect(
                    settings.rowingSettings.strokeDetectionSettings.minimumRecoveryTime,
                    "strokeDetectionSettings.minimumRecoveryTime",
                ).toBe(200);
                expect(
                    settings.rowingSettings.strokeDetectionSettings.minimumDriveTime,
                    "strokeDetectionSettings.minimumDriveTime",
                ).toBe(300);

                // uint8 values
                expect(
                    settings.rowingSettings.strokeDetectionSettings.driveHandleForcesMaxCapacity,
                    "strokeDetectionSettings.driveHandleForcesMaxCapacity",
                ).toBe(50);
            });
        });

        describe("when settings characteristic stream errors", (): void => {
            beforeEach((): void => {
                vi.useFakeTimers();
                vi.mocked(mockSettingsCharacteristic.readValue).mockResolvedValue(
                    createMockRowerSettingsDataView(),
                );
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should retry connection up to 4 times", async (): Promise<void> => {
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                vi.mocked(mockSettingsCharacteristic.readValue).mockRejectedValue(new Error("Read failed"));

                await vi.advanceTimersByTimeAsync(2000);
                (await settingsValueChangeTrigger).triggerChanged();
                await vi.advanceTimersByTimeAsync(2000 * 3);

                expect(mockErgConnectionService.readSettingsCharacteristic).toHaveBeenCalledTimes(4);
                await vi.runAllTimersAsync();
            });

            it("should delay retry by 2000ms", async (): Promise<void> => {
                vi.mocked(mockSettingsCharacteristic.readValue).mockRejectedValue(new Error("Read failed"));
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                await vi.advanceTimersByTimeAsync(1); // let the initial async operation fail
                vi.mocked(mockErgConnectionService.readSettingsCharacteristic).mockClear();

                await vi.advanceTimersByTimeAsync(1998);

                expect(
                    mockErgConnectionService.readSettingsCharacteristic,
                    "before timeout",
                ).not.toHaveBeenCalled();
                await vi.advanceTimersByTimeAsync(1);
                expect(
                    mockErgConnectionService.readSettingsCharacteristic,
                    "after timeout",
                ).toHaveBeenCalled();
            });

            it("should attempt reconnection and maintain rowerSettings when settings error contains 'unknown'", async (): Promise<void> => {
                vi.mocked(mockSettingsCharacteristic.readValue).mockRejectedValue(
                    new Error("Read failed unknown"),
                );
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);

                await vi.advanceTimersByTimeAsync(1);

                expect(mockErgConnectionService.connectToSettings).toHaveBeenCalled();
                await vi.runAllTimersAsync();
            });

            it("should not attempt reconnection when settings error does not contain 'unknown'", async (): Promise<void> => {
                vi.mocked(mockSettingsCharacteristic.readValue).mockRejectedValue(
                    new Error("different error"),
                );
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);

                await vi.advanceTimersByTimeAsync(2000 * 5);

                expect(mockErgConnectionService.connectToSettings).not.toHaveBeenCalled();
                await vi.runAllTimersAsync();
            });
        });

        describe("when stroke settings characteristic stream errors", (): void => {
            beforeEach((): void => {
                vi.useFakeTimers();
                // ensure there's an initial readable DataView so the stream starts
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockResolvedValue(
                    createMockRowerSettingsDataView(),
                );
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should retry connection up to 4 times", async (): Promise<void> => {
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockRejectedValue(
                    new Error("Stroke read failed"),
                );

                await vi.advanceTimersByTimeAsync(2000);
                (await strokeSettingsValueChangedTrigger).triggerChanged();
                await vi.advanceTimersByTimeAsync(2000 * 3);

                expect(mockErgConnectionService.readStrokeSettingsCharacteristic).toHaveBeenCalledTimes(4);
                await vi.runAllTimersAsync();
            });

            it("should delay retry by 2000ms", async (): Promise<void> => {
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockRejectedValue(
                    new Error("Stroke read failed"),
                );
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await vi.advanceTimersByTimeAsync(1); // let the initial async operation fail
                vi.mocked(mockErgConnectionService.readStrokeSettingsCharacteristic).mockClear();

                await vi.advanceTimersByTimeAsync(1998);
                expect(
                    mockErgConnectionService.readStrokeSettingsCharacteristic,
                    "before timeout",
                ).not.toHaveBeenCalled();

                await vi.advanceTimersByTimeAsync(1);
                expect(
                    mockErgConnectionService.readStrokeSettingsCharacteristic,
                    "after timeout",
                ).toHaveBeenCalled();
            });

            it("should attempt reconnection via connectToStrokeSettings when stroke error contains 'unknown'", async (): Promise<void> => {
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockRejectedValue(
                    new Error("Stroke read failed unknown"),
                );
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);

                await vi.advanceTimersByTimeAsync(1);

                expect(mockErgConnectionService.connectToStrokeSettings).toHaveBeenCalled();
                await vi.runAllTimersAsync();
            });

            it("should not attempt reconnection when stroke error does not contain 'unknown'", async (): Promise<void> => {
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockRejectedValue(
                    new Error("different stroke error"),
                );
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);

                await vi.advanceTimersByTimeAsync(2000 * 5);

                expect(mockErgConnectionService.connectToStrokeSettings).not.toHaveBeenCalled();
                await vi.runAllTimersAsync();
            });
        });

        describe("when characteristics are undefined", (): void => {
            beforeEach((): void => {
                vi.useFakeTimers();
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should filter undefined settings characteristic without affecting rowerSettings", async (): Promise<void> => {
                settingsCharacteristicSubject.next(undefined);

                await vi.advanceTimersByTimeAsync(2000);
                expect(mockSettingsCharacteristic.readValue).not.toHaveBeenCalled();
            });

            it("should filter undefined stroke characteristic without affecting rowerSettings", async (): Promise<void> => {
                strokeSettingsCharacteristicSubject.next(undefined);

                await vi.advanceTimersByTimeAsync(2000);
                expect(mockStrokeSettingsCharacteristic.readValue).not.toHaveBeenCalled();
            });
        });
    });
    describe("as part of edge cases & robustness handling", (): void => {
        describe("signal initialization edge cases", (): void => {
            beforeEach((): void => {
                vi.useFakeTimers();
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should handle malformed settings data", async (): Promise<void> => {
                const initialSettings = service.rowerSettings();
                const malformedData = new DataView(new ArrayBuffer(2));
                vi.mocked(mockSettingsCharacteristic.readValue).mockResolvedValue(malformedData);
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);

                await vi.advanceTimersByTimeAsync(1);

                expect(mockErgConnectionService.readSettingsCharacteristic).toHaveBeenCalled();
                expect(service.rowerSettings(), "rowerSettings").toEqual(initialSettings);
            });

            it("should handle malformed stroke settings data", async (): Promise<void> => {
                const initialSettings = service.rowerSettings();
                const malformedStrokeData = new DataView(new ArrayBuffer(3));
                vi.mocked(mockStrokeSettingsCharacteristic.readValue).mockResolvedValue(malformedStrokeData);
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);

                await vi.advanceTimersByTimeAsync(1);

                expect(mockErgConnectionService.readStrokeSettingsCharacteristic).toHaveBeenCalled();
                expect(service.rowerSettings(), "rowerSettings").toEqual(initialSettings);
            });
        });

        describe("BLE operation edge cases", (): void => {
            it("should handle getCharacteristic rejection when calling changeBleServiceType", async (): Promise<void> => {
                vi.mocked(mockSettingsCharacteristic.service.getCharacteristic).mockRejectedValue(
                    new Error("Characteristic not found"),
                );

                await service.changeBleServiceType(BleServiceFlag.FtmsService);

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to change BLE service", "Dismiss");
            });

            it("should handle startNotifications failure when calling changeDeltaTimeLogging", async (): Promise<void> => {
                const controlPointTrigger = createControlPointValueChangedListenerReady();
                vi.mocked(mockSettingsControlPointCharacteristic.startNotifications).mockReturnValue(
                    Promise.reject(new Error("Notifications failed")),
                );

                const sut = service.changeDeltaTimeLogging(true);
                const handler = await controlPointTrigger;
                handler.triggerChanged();
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to enabled delta time logging",
                    "Dismiss",
                );
            });

            it("should handle writeValueWithoutResponse failure when calling changeLogLevel", async (): Promise<void> => {
                vi.mocked(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).mockRejectedValue(
                    new Error("Write failed"),
                );
                const controlPointTrigger = createControlPointValueChangedListenerReady();

                const sut = service.changeLogLevel(2);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to set Log Level", "Dismiss");
            });

            it("should handle response timeout when calling changeLogToSdCard", async (): Promise<void> => {
                vi.useFakeTimers();
                service.changeLogToSdCard(true).catch((): void => {
                    // no-op
                });

                await vi.advanceTimersByTimeAsync(1000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to enabled Sd Card logging, request timed out",
                    "Dismiss",
                );
                vi.useRealTimers();
            });

            it("should handle stopNotifications failure when calling changeMachineSettings", async (): Promise<void> => {
                const machineSettings = {
                    flywheelInertia: 0.097,
                    magicConstant: 2.8,
                    sprocketRadius: 0.04,
                    impulsePerRevolution: 3,
                };
                const controlPointTrigger = createControlPointValueChangedListenerReady();
                vi.mocked(mockSettingsControlPointCharacteristic.stopNotifications).mockRejectedValue(
                    new Error("Stop notifications failed"),
                );

                const sut = service.changeMachineSettings(machineSettings);
                (await controlPointTrigger).triggerChanged(
                    createMockControlPointResponseDataView(
                        BleOpCodes.SetMachineSettings,
                        BleResponseOpCodes.Successful,
                    ),
                );
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Machine settings changed", "Dismiss");
                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to set machine settings", "Dismiss");

                expect(mockSettingsControlPointCharacteristic.writeValueWithoutResponse).toHaveBeenCalled();
            });
        });
    });
});
