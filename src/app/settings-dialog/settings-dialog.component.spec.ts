import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { SwUpdate } from "@angular/service-worker";

import { IDeviceInformation } from "../../common/ble.interfaces";
import {
    IErgConnectionStatus,
    IRowerSettings,
    IStrokeDetectionSettings,
    StrokeDetectionType,
} from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { MetricsService } from "../../common/services/metrics.service";

import { SettingsDialogComponent } from "./settings-dialog.component";

describe("SettingsDialogComponent", (): void => {
    let component: SettingsDialogComponent;
    let fixture: ComponentFixture<SettingsDialogComponent>;

    beforeEach(async (): Promise<void> => {
        const mockRowerSettings: IRowerSettings = {
            bleServiceFlag: 0,
            logLevel: 1,
            logToSdCard: false,
            logDeltaTimes: false,
            isRuntimeSettingsEnabled: false,
            machineSettings: {
                flywheelInertia: 0.05,
                magicConstant: 2.8,
                sprocketRadius: 1.5,
                impulsePerRevolution: 11,
            },
            sensorSignalSettings: {
                rotationDebounceTime: 25,
                rowingStoppedThreshold: 3000,
            },
            dragFactorSettings: {
                goodnessOfFitThreshold: 0.96,
                maxDragFactorRecoveryPeriod: 8,
                dragFactorLowerThreshold: 90,
                dragFactorUpperThreshold: 220,
                dragCoefficientsArrayLength: 4,
            },
        };

        const mockStrokeDetectionSettings: IStrokeDetectionSettings = {
            strokeDetectionType: StrokeDetectionType.Torque,
            impulseDataArrayLength: 6,
            minimumPoweredTorque: 0.01,
            minimumDragTorque: 0.005,
            minimumRecoverySlopeMargin: 0.05,
            minimumRecoverySlope: 0.1,
            minimumRecoveryTime: 400,
            minimumDriveTime: 200,
            driveHandleForcesMaxCapacity: 20,
            isCompiledWithDouble: true,
        };

        const mockErgConnectionStatus: IErgConnectionStatus = {
            deviceName: "Test Device",
            status: "connected",
        };

        const mockDeviceInfo: IDeviceInformation = {
            modelNumber: "Test Model",
            firmwareNumber: "1.0.0",
            manufacturerName: "Test Manufacturer",
        };

        const mockDialogData = {
            rowerSettings: mockRowerSettings,
            strokeDetectionSettings: mockStrokeDetectionSettings,
            ergConnectionStatus: mockErgConnectionStatus,
            deviceInfo: mockDeviceInfo,
        };

        const mockMatDialogRef = {
            close: jasmine.createSpy("close"),
        };

        const mockSwUpdate = {
            checkForUpdate: jasmine.createSpy("checkForUpdate"),
        };

        const mockConfigManagerService = {
            getItem: jasmine.createSpy("getItem").and.returnValue("ble"),
            setItem: jasmine.createSpy("setItem"),
        };

        const mockDataService = {
            changeLogLevel: jasmine.createSpy("changeLogLevel").and.returnValue(Promise.resolve()),
            changeDeltaTimeLogging: jasmine
                .createSpy("changeDeltaTimeLogging")
                .and.returnValue(Promise.resolve()),
            changeLogToSdCard: jasmine.createSpy("changeLogToSdCard").and.returnValue(Promise.resolve()),
            changeBleServiceType: jasmine
                .createSpy("changeBleServiceType")
                .and.returnValue(Promise.resolve()),
        };

        const test = TestBed.configureTestingModule({
            providers: [
                { provide: SwUpdate, useValue: mockSwUpdate },
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: MetricsService, useValue: mockDataService },
                { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
                { provide: MatDialogRef, useValue: mockMatDialogRef },
            ],
            imports: [SettingsDialogComponent],
        });

        await test.compileComponents();

        fixture = TestBed.createComponent(SettingsDialogComponent);
        component = fixture.componentInstance;
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });
});
