import { provideZonelessChangeDetection } from "@angular/core";
import { fakeAsync, flush, TestBed, tick } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";

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

    let settingsValueChangeTrigger: Promise<ListenerTrigger<DataView>>;
    let strokeSettingsValueChangedTrigger: Promise<ListenerTrigger<DataView>>;

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

        settingsValueChangeTrigger = changedListenerReadyFactory<typeof mockSettingsCharacteristic, DataView>(
            mockSettingsCharacteristic,
            "characteristicvaluechanged",
        )();

        strokeSettingsValueChangedTrigger = changedListenerReadyFactory<
            typeof mockStrokeSettingsCharacteristic,
            DataView
        >(mockStrokeSettingsCharacteristic, "characteristicvaluechanged")();

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

    it("should initialize rowerSettings signal with default values", (): void => {
        const rowerSettings = service.rowerSettings();

        expect(rowerSettings.generalSettings.logDeltaTimes)
            .withContext("generalSettings.logDeltaTimes")
            .toBeUndefined();
        expect(rowerSettings.generalSettings.logToSdCard)
            .withContext("generalSettings.logToSdCard")
            .toBeUndefined();
        expect(rowerSettings.generalSettings.logLevel).withContext("generalSettings.logLevel").toBe(0);
        expect(rowerSettings.generalSettings.bleServiceFlag)
            .withContext("generalSettings.bleServiceFlag")
            .toBe(BleServiceFlag.CpsService);
        expect(rowerSettings.generalSettings.isRuntimeSettingsEnabled)
            .withContext("generalSettings.isRuntimeSettingsEnabled")
            .toBeUndefined();
        expect(rowerSettings.generalSettings.isCompiledWithDouble)
            .withContext("generalSettings.isCompiledWithDouble")
            .toBeUndefined();

        expect(rowerSettings.rowingSettings.machineSettings.flywheelInertia)
            .withContext("machineSettings.flywheelInertia")
            .toBe(0);
        expect(rowerSettings.rowingSettings.machineSettings.magicConstant)
            .withContext("machineSettings.magicConstant")
            .toBe(0);
        expect(rowerSettings.rowingSettings.machineSettings.sprocketRadius)
            .withContext("machineSettings.sprocketRadius")
            .toBe(0);
        expect(rowerSettings.rowingSettings.machineSettings.impulsePerRevolution)
            .withContext("machineSettings.impulsePerRevolution")
            .toBe(0);

        expect(rowerSettings.rowingSettings.sensorSignalSettings.rotationDebounceTime)
            .withContext("sensorSignalSettings.rotationDebounceTime")
            .toBe(0);
        expect(rowerSettings.rowingSettings.sensorSignalSettings.rowingStoppedThreshold)
            .withContext("sensorSignalSettings.rowingStoppedThreshold")
            .toBe(0);

        expect(rowerSettings.rowingSettings.dragFactorSettings.goodnessOfFitThreshold)
            .withContext("dragFactorSettings.goodnessOfFitThreshold")
            .toBe(0);
        expect(rowerSettings.rowingSettings.dragFactorSettings.maxDragFactorRecoveryPeriod)
            .withContext("dragFactorSettings.maxDragFactorRecoveryPeriod")
            .toBe(0);
        expect(rowerSettings.rowingSettings.dragFactorSettings.dragFactorLowerThreshold)
            .withContext("dragFactorSettings.dragFactorLowerThreshold")
            .toBe(0);
        expect(rowerSettings.rowingSettings.dragFactorSettings.dragFactorUpperThreshold)
            .withContext("dragFactorSettings.dragFactorUpperThreshold")
            .toBe(0);
        expect(rowerSettings.rowingSettings.dragFactorSettings.dragCoefficientsArrayLength)
            .withContext("dragFactorSettings.dragCoefficientsArrayLength")
            .toBe(0);

        expect(rowerSettings.rowingSettings.strokeDetectionSettings.strokeDetectionType)
            .withContext("strokeDetectionSettings.strokeDetectionType")
            .toBe(0);
        expect(rowerSettings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength)
            .withContext("strokeDetectionSettings.impulseDataArrayLength")
            .toBe(0);
        expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumPoweredTorque)
            .withContext("strokeDetectionSettings.minimumPoweredTorque")
            .toBe(0);
        expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumDragTorque)
            .withContext("strokeDetectionSettings.minimumDragTorque")
            .toBe(0);
        expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlopeMargin)
            .withContext("strokeDetectionSettings.minimumRecoverySlopeMargin")
            .toBe(0);
        expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlope)
            .withContext("strokeDetectionSettings.minimumRecoverySlope")
            .toBe(0);
        expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoveryTime)
            .withContext("strokeDetectionSettings.minimumRecoveryTime")
            .toBe(0);
        expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumDriveTime)
            .withContext("strokeDetectionSettings.minimumDriveTime")
            .toBe(0);
        expect(rowerSettings.rowingSettings.strokeDetectionSettings.driveHandleForcesMaxCapacity)
            .withContext("strokeDetectionSettings.driveHandleForcesMaxCapacity")
            .toBe(0);
    });

    describe("rowerSettings signal", (): void => {
        describe("when rower settings endpoint updates", (): void => {
            const mockSettingsData = createMockRowerSettingsDataView(true, false, 2, true, false);

            beforeEach((): void => {
                mockSettingsCharacteristic.readValue.and.resolveTo(mockSettingsData);
            });

            it("should update generalSettings portion", async (): Promise<void> => {
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                await settingsValueChangeTrigger;

                const rowerSettings = service.rowerSettings();

                expect(rowerSettings.generalSettings.logDeltaTimes)
                    .withContext("rowerSettings.generalSettings.logDeltaTimes")
                    .toBe(true);
                expect(rowerSettings.generalSettings.logToSdCard)
                    .withContext("rowerSettings.generalSettings.logToSdCard")
                    .toBe(false);
                expect(rowerSettings.generalSettings.logLevel)
                    .withContext("rowerSettings.generalSettings.logLevel")
                    .toBe(2);
                expect(rowerSettings.generalSettings.isRuntimeSettingsEnabled)
                    .withContext("rowerSettings.generalSettings.isRuntimeSettingsEnabled")
                    .toBe(true);
            });

            it("should update rowingSettings portion", async (): Promise<void> => {
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                await settingsValueChangeTrigger;

                const rowerSettings = service.rowerSettings();

                expect(rowerSettings.rowingSettings.machineSettings.flywheelInertia)
                    .withContext("machineSettings.flywheelInertia")
                    .toBeCloseTo(0.097, 5);
                expect(rowerSettings.rowingSettings.machineSettings.magicConstant)
                    .withContext("machineSettings.magicConstant")
                    .toBe(2.8);
                expect(rowerSettings.rowingSettings.machineSettings.sprocketRadius)
                    .withContext("machineSettings.sprocketRadius")
                    .toBe(0.04);
                expect(rowerSettings.rowingSettings.machineSettings.impulsePerRevolution)
                    .withContext("machineSettings.impulsePerRevolution")
                    .toBe(3);

                expect(rowerSettings.rowingSettings.sensorSignalSettings.rotationDebounceTime)
                    .withContext("sensorSignalSettings.rotationDebounceTime")
                    .toBe(5);
                expect(rowerSettings.rowingSettings.sensorSignalSettings.rowingStoppedThreshold)
                    .withContext("sensorSignalSettings.rowingStoppedThreshold")
                    .toBe(3);

                expect(rowerSettings.rowingSettings.dragFactorSettings.goodnessOfFitThreshold)
                    .withContext("dragFactorSettings.goodnessOfFitThreshold")
                    .toBeCloseTo(0.96, 2);
                expect(rowerSettings.rowingSettings.dragFactorSettings.maxDragFactorRecoveryPeriod)
                    .withContext("dragFactorSettings.maxDragFactorRecoveryPeriod")
                    .toBe(3);
                expect(rowerSettings.rowingSettings.dragFactorSettings.dragFactorLowerThreshold)
                    .withContext("dragFactorSettings.dragFactorLowerThreshold")
                    .toBe(90);
                expect(rowerSettings.rowingSettings.dragFactorSettings.dragFactorUpperThreshold)
                    .withContext("dragFactorSettings.dragFactorUpperThreshold")
                    .toBe(220);
                expect(rowerSettings.rowingSettings.dragFactorSettings.dragCoefficientsArrayLength)
                    .withContext("dragFactorSettings.dragCoefficientsArrayLength")
                    .toBe(4);
            });
        });

        describe("when stroke detection endpoint updates", (): void => {
            const mockStrokeData = createMockStrokeSettingsDataView(2, 16, true);

            beforeEach((): void => {
                mockStrokeSettingsCharacteristic.readValue.and.resolveTo(mockStrokeData);
            });

            it("should update generalSettings isCompiledWithDouble", async (): Promise<void> => {
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const rowerSettings = service.rowerSettings();

                expect(rowerSettings.generalSettings.isCompiledWithDouble)
                    .withContext("generalSettings.isCompiledWithDouble")
                    .toBe(true);
            });

            it("should update strokeDetectionSettings", async (): Promise<void> => {
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const rowerSettings = service.rowerSettings();

                expect(rowerSettings.rowingSettings.strokeDetectionSettings.strokeDetectionType)
                    .withContext("strokeDetectionSettings.strokeDetectionType")
                    .toBe(2);
                expect(rowerSettings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength)
                    .withContext("strokeDetectionSettings.impulseDataArrayLength")
                    .toBe(16);
                expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumPoweredTorque)
                    .withContext("strokeDetectionSettings.minimumPoweredTorque")
                    .toBe(0.15);
                expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumDragTorque)
                    .withContext("strokeDetectionSettings.minimumDragTorque")
                    .toBe(0.05);
                expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlopeMargin)
                    .withContext("strokeDetectionSettings.minimumRecoverySlopeMargin")
                    .toBeCloseTo(0.035, 5);
                expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoverySlope)
                    .withContext("strokeDetectionSettings.minimumRecoverySlope")
                    .toBe(-0.1);
                expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumRecoveryTime)
                    .withContext("strokeDetectionSettings.minimumRecoveryTime")
                    .toBe(200);
                expect(rowerSettings.rowingSettings.strokeDetectionSettings.minimumDriveTime)
                    .withContext("strokeDetectionSettings.minimumDriveTime")
                    .toBe(300);
                expect(rowerSettings.rowingSettings.strokeDetectionSettings.driveHandleForcesMaxCapacity)
                    .withContext("strokeDetectionSettings.driveHandleForcesMaxCapacity")
                    .toBe(50);
            });
        });

        it("should combine data from both sources correctly when both signals update", async (): Promise<void> => {
            const mockSettingsData = createMockRowerSettingsDataView(true, true, 3, false, false);
            const mockStrokeData = createMockStrokeSettingsDataView(1, 12, true);

            mockSettingsCharacteristic.readValue.and.resolveTo(mockSettingsData);
            mockStrokeSettingsCharacteristic.readValue.and.resolveTo(mockStrokeData);

            settingsCharacteristicSubject.next(mockSettingsCharacteristic);
            strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
            await strokeSettingsValueChangedTrigger;
            await settingsValueChangeTrigger;

            const rowerSettings = service.rowerSettings();

            expect(rowerSettings.generalSettings.logDeltaTimes)
                .withContext("generalSettings.logDeltaTimes")
                .toBe(true);
            expect(rowerSettings.generalSettings.logToSdCard)
                .withContext("generalSettings.logToSdCard")
                .toBe(true);
            expect(rowerSettings.generalSettings.logLevel).withContext("generalSettings.logLevel").toBe(3);
            expect(rowerSettings.generalSettings.isRuntimeSettingsEnabled)
                .withContext("generalSettings.isRuntimeSettingsEnabled")
                .toBe(false);
            expect(rowerSettings.generalSettings.isCompiledWithDouble)
                .withContext("generalSettings.isCompiledWithDouble")
                .toBe(true);

            expect(rowerSettings.rowingSettings.strokeDetectionSettings.strokeDetectionType)
                .withContext("strokeDetectionSettings.strokeDetectionType")
                .toBe(1);
            expect(rowerSettings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength)
                .withContext("strokeDetectionSettings.impulseDataArrayLength")
                .toBe(12);
        });

        it("should merge initial read with notification updates", async (): Promise<void> => {
            const initialData = createMockRowerSettingsDataView(false, true, 1, false, true);
            mockSettingsCharacteristic.readValue.and.resolveTo(initialData);

            settingsCharacteristicSubject.next(mockSettingsCharacteristic);
            const triggerHandler = await settingsValueChangeTrigger;

            const firstSettings = service.rowerSettings();
            triggerHandler.triggerChanged(createMockRowerSettingsDataView(true, false, 2, true, true));
            const secondSettings = service.rowerSettings();

            expect(firstSettings.generalSettings.logToSdCard).withContext("initial read").toBe(true);
            expect(firstSettings.generalSettings.logLevel).withContext("initial read").toBe(1);

            expect(secondSettings.generalSettings.logToSdCard).withContext("subsequent notify").toBe(false);
            expect(secondSettings.generalSettings.logLevel).withContext("subsequent notify").toBe(2);
        });

        describe("when receiving backward compatible 1-byte data", (): void => {
            const oneByteData = createMockRowerSettingsDataView(true, false, 2, undefined, true);

            beforeEach(async (): Promise<void> => {
                mockSettingsCharacteristic.readValue.and.resolveTo(oneByteData);

                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                await settingsValueChangeTrigger;
            });

            it("should parse log flags correctly", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.generalSettings.logDeltaTimes)
                    .withContext("generalSettings.logDeltaTimes")
                    .toBe(true);
                expect(settings.generalSettings.logToSdCard)
                    .withContext("generalSettings.logToSdCard")
                    .toBe(false);
            });

            it("should extract log level from bits 4-6", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.generalSettings.logLevel).withContext("generalSettings.logLevel").toBe(2);
            });

            it("should merge with default rowing settings", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.rowingSettings.machineSettings.flywheelInertia)
                    .withContext("machineSettings.flywheelInertia")
                    .toBe(0);
                expect(settings.rowingSettings.sensorSignalSettings.rotationDebounceTime)
                    .withContext("sensorSignalSettings.rotationDebounceTime")
                    .toBe(0);
                expect(settings.rowingSettings.dragFactorSettings.goodnessOfFitThreshold)
                    .withContext("dragFactorSettings.goodnessOfFitThreshold")
                    .toBe(0);
            });

            it("should calculate BLE service flag", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.generalSettings.bleServiceFlag)
                    .withContext("generalSettings.bleServiceFlag")
                    .toBe(BleServiceFlag.CpsService);
            });
        });

        describe("when receiving full settings data", (): void => {
            const fullData = createMockRowerSettingsDataView(true, false, 2, true);

            beforeEach(async (): Promise<void> => {
                mockSettingsCharacteristic.readValue.and.resolveTo(fullData);

                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                await settingsValueChangeTrigger;
            });

            it("should parse general settings flags", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.generalSettings.logDeltaTimes)
                    .withContext("generalSettings.logDeltaTimes")
                    .toBe(true);
                expect(settings.generalSettings.logToSdCard)
                    .withContext("generalSettings.logToSdCard")
                    .toBe(false);
                expect(settings.generalSettings.logLevel).withContext("generalSettings.logLevel").toBe(2);
            });

            it("should parse runtime settings enabled flag", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.generalSettings.isRuntimeSettingsEnabled)
                    .withContext("generalSettings.isRuntimeSettingsEnabled")
                    .toBe(true);
            });

            it("should parse machine settings with correct scaling", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.rowingSettings.machineSettings.flywheelInertia)
                    .withContext("machineSettings.flywheelInertia")
                    .toBeCloseTo(0.097, 3);
                expect(settings.rowingSettings.machineSettings.magicConstant)
                    .withContext("machineSettings.magicConstant")
                    .toBe(2.8);
                expect(settings.rowingSettings.machineSettings.sprocketRadius)
                    .withContext("machineSettings.sprocketRadius")
                    .toBeCloseTo(0.04, 3);
                expect(settings.rowingSettings.machineSettings.impulsePerRevolution)
                    .withContext("machineSettings.impulsePerRevolution")
                    .toBe(3);
            });

            it("should parse sensor signal settings", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.rowingSettings.sensorSignalSettings.rotationDebounceTime)
                    .withContext("sensorSignalSettings.rotationDebounceTime")
                    .toBe(5);
                expect(settings.rowingSettings.sensorSignalSettings.rowingStoppedThreshold)
                    .withContext("sensorSignalSettings.rowingStoppedThreshold")
                    .toBe(3);
            });

            it("should parse drag factor settings with scaling", async (): Promise<void> => {
                const settings = service.rowerSettings();
                expect(settings.rowingSettings.dragFactorSettings.goodnessOfFitThreshold)
                    .withContext("dragFactorSettings.goodnessOfFitThreshold")
                    .toBeCloseTo(0.96, 2);
                expect(settings.rowingSettings.dragFactorSettings.maxDragFactorRecoveryPeriod)
                    .withContext("dragFactorSettings.maxDragFactorRecoveryPeriod")
                    .toBe(3);
                expect(settings.rowingSettings.dragFactorSettings.dragFactorLowerThreshold)
                    .withContext("dragFactorSettings.dragFactorLowerThreshold")
                    .toBe(90);
                expect(settings.rowingSettings.dragFactorSettings.dragFactorUpperThreshold)
                    .withContext("dragFactorSettings.dragFactorUpperThreshold")
                    .toBe(220);
                expect(settings.rowingSettings.dragFactorSettings.dragCoefficientsArrayLength)
                    .withContext("dragFactorSettings.dragCoefficientsArrayLength")
                    .toBe(4);
            });
        });

        describe("when receiving stroke detection characteristic data", (): void => {
            const mockStrokeData = createMockStrokeSettingsDataView(2, 16, true);

            it("should merge initial read with notification updates", async (): Promise<void> => {
                mockStrokeSettingsCharacteristic.readValue.and.resolveTo(mockStrokeData);

                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const settings = service.rowerSettings();
                expect(settings.rowingSettings.strokeDetectionSettings.strokeDetectionType)
                    .withContext("strokeDetectionSettings.strokeDetectionType")
                    .toBe(2);
                expect(settings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength)
                    .withContext("strokeDetectionSettings.impulseDataArrayLength")
                    .toBe(16);
            });

            it("should parse stroke settings correctly", async (): Promise<void> => {
                mockStrokeSettingsCharacteristic.readValue.and.resolveTo(mockStrokeData);

                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                await strokeSettingsValueChangedTrigger;

                const settings = service.rowerSettings();
                // bit-packed values
                expect(settings.rowingSettings.strokeDetectionSettings.strokeDetectionType)
                    .withContext("strokeDetectionSettings.strokeDetectionType")
                    .toBe(2);
                expect(settings.rowingSettings.strokeDetectionSettings.impulseDataArrayLength)
                    .withContext("strokeDetectionSettings.impulseDataArrayLength")
                    .toBe(16);
                expect(settings.generalSettings.isCompiledWithDouble)
                    .withContext("generalSettings.isCompiledWithDouble")
                    .toBe(true);

                // torque values with scaling
                expect(settings.rowingSettings.strokeDetectionSettings.minimumPoweredTorque)
                    .withContext("strokeDetectionSettings.minimumPoweredTorque")
                    .toBe(0.15);
                expect(settings.rowingSettings.strokeDetectionSettings.minimumDragTorque)
                    .withContext("strokeDetectionSettings.minimumDragTorque")
                    .toBe(0.05);

                // float32 and scaled values
                expect(settings.rowingSettings.strokeDetectionSettings.minimumRecoverySlopeMargin)
                    .withContext("strokeDetectionSettings.minimumRecoverySlopeMargin")
                    .toBeCloseTo(0.035, 3);
                expect(settings.rowingSettings.strokeDetectionSettings.minimumRecoverySlope)
                    .withContext("strokeDetectionSettings.minimumRecoverySlope")
                    .toBe(-0.1);

                // packed timing values
                expect(settings.rowingSettings.strokeDetectionSettings.minimumRecoveryTime)
                    .withContext("strokeDetectionSettings.minimumRecoveryTime")
                    .toBe(200);
                expect(settings.rowingSettings.strokeDetectionSettings.minimumDriveTime)
                    .withContext("strokeDetectionSettings.minimumDriveTime")
                    .toBe(300);

                // uint8 values
                expect(settings.rowingSettings.strokeDetectionSettings.driveHandleForcesMaxCapacity)
                    .withContext("strokeDetectionSettings.driveHandleForcesMaxCapacity")
                    .toBe(50);
            });
        });

        describe("when settings characteristic stream errors", (): void => {
            beforeEach((): void => {
                mockSettingsCharacteristic.readValue.and.resolveTo(createMockRowerSettingsDataView());
            });
            it("should retry connection up to 4 times", fakeAsync((): void => {
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                mockSettingsCharacteristic.readValue.and.rejectWith(new Error("Read failed"));
                settingsValueChangeTrigger.then((handler: ListenerTrigger<DataView>): void => {
                    handler.triggerChanged();
                });

                tick(2000 * 4);

                expect(mockErgConnectionService.readSettingsCharacteristic).toHaveBeenCalledTimes(4);
                flush();
            }));

            it("should delay retry by 2000ms", fakeAsync((): void => {
                mockSettingsCharacteristic.readValue.and.rejectWith(new Error("Read failed"));
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);
                flush();
                mockErgConnectionService.readSettingsCharacteristic.calls.reset();

                tick(1999);

                expect(mockErgConnectionService.readSettingsCharacteristic)
                    .withContext("before timeout")
                    .not.toHaveBeenCalled();
                tick(1);
                expect(mockErgConnectionService.readSettingsCharacteristic)
                    .withContext("after timeout")
                    .toHaveBeenCalled();
            }));

            it("should attempt reconnection and maintain rowerSettings when settings error contains 'unknown'", fakeAsync((): void => {
                mockSettingsCharacteristic.readValue.and.rejectWith(new Error("Read failed unknown"));
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);

                tick(1);

                expect(mockErgConnectionService.connectToSettings).toHaveBeenCalled();
                flush();
            }));

            it("should not attempt reconnection when settings error does not contain 'unknown'", fakeAsync((): void => {
                mockSettingsCharacteristic.readValue.and.rejectWith(new Error("different error"));
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);

                tick(2000 * 5);

                expect(mockErgConnectionService.connectToSettings).not.toHaveBeenCalled();
                flush();
            }));
        });

        describe("when stroke settings characteristic stream errors", (): void => {
            beforeEach((): void => {
                // ensure there's an initial readable DataView so the stream starts
                mockStrokeSettingsCharacteristic.readValue.and.resolveTo(createMockRowerSettingsDataView());
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
            });

            it("should retry connection up to 4 times", fakeAsync((): void => {
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                mockStrokeSettingsCharacteristic.readValue.and.rejectWith(new Error("Stroke read failed"));

                // arrange trigger to simulate a later notify if needed
                strokeSettingsValueChangedTrigger.then((handler: ListenerTrigger<DataView>): void => {
                    handler.triggerChanged();
                });

                tick(2000 * 4);

                expect(mockErgConnectionService.readStrokeSettingsCharacteristic).toHaveBeenCalledTimes(4);
                flush();
            }));

            it("should delay retry by 2000ms", fakeAsync((): void => {
                mockStrokeSettingsCharacteristic.readValue.and.rejectWith(new Error("Stroke read failed"));
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);
                flush();
                mockErgConnectionService.readStrokeSettingsCharacteristic.calls.reset();

                tick(1999);
                expect(mockErgConnectionService.readStrokeSettingsCharacteristic)
                    .withContext("before timeout")
                    .not.toHaveBeenCalled();

                tick(1);
                expect(mockErgConnectionService.readStrokeSettingsCharacteristic)
                    .withContext("after timeout")
                    .toHaveBeenCalled();
            }));

            it("should attempt reconnection via connectToStrokeSettings when stroke error contains 'unknown'", fakeAsync((): void => {
                mockStrokeSettingsCharacteristic.readValue.and.rejectWith(
                    new Error("Stroke read failed unknown"),
                );
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);

                tick(1);

                expect(mockErgConnectionService.connectToStrokeSettings).toHaveBeenCalled();
                flush();
            }));

            it("should not attempt reconnection when stroke error does not contain 'unknown'", fakeAsync((): void => {
                mockStrokeSettingsCharacteristic.readValue.and.rejectWith(
                    new Error("different stroke error"),
                );
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);

                tick(2000 * 5);

                expect(mockErgConnectionService.connectToStrokeSettings).not.toHaveBeenCalled();
                flush();
            }));
        });

        describe("when characteristics are undefined", (): void => {
            it("should filter undefined settings characteristic without affecting rowerSettings", fakeAsync((): void => {
                settingsCharacteristicSubject.next(undefined);

                tick(2000);
                expect(mockSettingsCharacteristic.readValue).not.toHaveBeenCalled();
            }));

            it("should filter undefined stroke characteristic without affecting rowerSettings", fakeAsync((): void => {
                strokeSettingsCharacteristicSubject.next(undefined);

                tick(2000);
                expect(mockStrokeSettingsCharacteristic.readValue).not.toHaveBeenCalled();
            }));
        });
    });
    describe("as part of edge cases & robustness handling", (): void => {
        describe("signal initialization edge cases", (): void => {
            it("should handle malformed settings data", fakeAsync((): void => {
                const initialSettings = service.rowerSettings();
                const malformedData = new DataView(new ArrayBuffer(2));
                mockSettingsCharacteristic.readValue.and.resolveTo(malformedData);
                settingsCharacteristicSubject.next(mockSettingsCharacteristic);

                tick(1);

                expect(mockErgConnectionService.readSettingsCharacteristic).toHaveBeenCalled();
                expect(service.rowerSettings()).withContext("rowerSettings").toEqual(initialSettings);
            }));

            it("should handle malformed stroke settings data", fakeAsync((): void => {
                const initialSettings = service.rowerSettings();
                const malformedStrokeData = new DataView(new ArrayBuffer(3));
                mockStrokeSettingsCharacteristic.readValue.and.resolveTo(malformedStrokeData);
                strokeSettingsCharacteristicSubject.next(mockStrokeSettingsCharacteristic);

                tick(1);

                expect(mockErgConnectionService.readStrokeSettingsCharacteristic).toHaveBeenCalled();
                expect(service.rowerSettings()).withContext("rowerSettings").toEqual(initialSettings);
            }));
        });

        describe("BLE operation edge cases", (): void => {
            it("should handle getCharacteristic rejection when calling changeBleServiceType", async (): Promise<void> => {
                (
                    mockSettingsCharacteristic.service as jasmine.SpyObj<BluetoothRemoteGATTService>
                ).getCharacteristic
                    .withArgs(SETTINGS_CONTROL_POINT)
                    .and.rejectWith(new Error("Characteristic not found"));

                await service.changeBleServiceType(BleServiceFlag.FtmsService);

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to change BLE service", "Dismiss");
            });

            it("should handle startNotifications failure when calling changeDeltaTimeLogging", async (): Promise<void> => {
                const controlPointTrigger = createControlPointValueChangedListenerReady();
                mockSettingsControlPointCharacteristic.startNotifications.and.returnValue(
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
                mockSettingsControlPointCharacteristic.writeValueWithoutResponse.and.rejectWith(
                    new Error("Write failed"),
                );
                const controlPointTrigger = createControlPointValueChangedListenerReady();

                const sut = service.changeLogLevel(2);
                (await controlPointTrigger).triggerChanged();
                await sut;

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to set Log Level", "Dismiss");
            });

            it("should handle response timeout when calling changeLogToSdCard", fakeAsync((): void => {
                service.changeLogToSdCard(true).catch((): void => {
                    // no-op
                });

                tick(1000);

                expect(mockSnackBar.open).toHaveBeenCalledWith(
                    "Failed to enabled Sd Card logging, request timed out",
                    "Dismiss",
                );
            }));

            it("should handle stopNotifications failure when calling changeMachineSettings", async (): Promise<void> => {
                const machineSettings = {
                    flywheelInertia: 0.097,
                    magicConstant: 2.8,
                    sprocketRadius: 0.04,
                    impulsePerRevolution: 3,
                };
                const controlPointTrigger = createControlPointValueChangedListenerReady();
                mockSettingsControlPointCharacteristic.stopNotifications.and.rejectWith(
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
