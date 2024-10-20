import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { SwUpdate } from "@angular/service-worker";

import { IRowerSettings } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DataService } from "../../common/services/data.service";

import { SettingsDialogComponent } from "./settings-dialog.component";

describe("SettingsDialogComponent", (): void => {
    let component: SettingsDialogComponent;
    let fixture: ComponentFixture<SettingsDialogComponent>;

    beforeEach(async (): Promise<void> => {
        const mockDialogData: IRowerSettings = {
            bleServiceFlag: 0,
            logLevel: 1,
            logToSdCard: false,
            logDeltaTimes: false,
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
                { provide: DataService, useValue: mockDataService },
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
