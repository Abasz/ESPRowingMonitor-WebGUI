import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { Observable, of } from "rxjs";

import { ConfigManagerService } from "../../../common/services/config-manager.service";
import { DataRecorderService } from "../../../common/services/data-recorder.service";
import { ErgMetricsService } from "../../../common/services/ergometer/erg-metric-data.service";
import { HeartRateService } from "../../../common/services/heart-rate/heart-rate.service";
import { MetricsService } from "../../../common/services/metrics.service";
import { UtilsService } from "../../../common/services/utils.service";

import { SettingsBarComponent } from "./settings-bar.component";

describe("SettingsBarComponent", (): void => {
    let component: SettingsBarComponent;
    let fixture: ComponentFixture<SettingsBarComponent>;

    beforeEach(async (): Promise<void> => {
        const mockDataService = {
            ergBatteryLevel$: of(80),
            ergConnectionStatus$: of({ status: "connected" }),
            hrConnectionStatus$: of({ status: "connected" }),
            settings: of({ bleServiceFlag: 0, logLevel: 1 }),
        };

        const mockDataRecorderService = {
            getSessionSummaries$: jasmine.createSpy("getSessionSummaries$").and.returnValue(of([])),
        };

        const mockErgMetricsService = {
            discover: jasmine.createSpy("discover").and.returnValue(Promise.resolve()),
        };

        const mockHeartRateService = {
            discover: jasmine.createSpy("discover").and.returnValue(Promise.resolve()),
        };

        const mockMatDialog = {
            open: jasmine
                .createSpy("open")
                .and.returnValue({ afterClosed: (): Observable<boolean> => of(true) }),
        };

        const mockUtilsService = {
            mainSpinner: jasmine.createSpy("mainSpinner").and.returnValue({
                open: jasmine.createSpy("open"),
                close: jasmine.createSpy("close"),
            }),
        };

        const mockConfigManagerService = {
            heartRateMonitorChanged$: of("off"),
        };

        await TestBed.configureTestingModule({
            providers: [
                { provide: MetricsService, useValue: mockDataService },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                { provide: ErgMetricsService, useValue: mockErgMetricsService },
                { provide: HeartRateService, useValue: mockHeartRateService },
                { provide: MatDialog, useValue: mockMatDialog },
                { provide: UtilsService, useValue: mockUtilsService },
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                provideZonelessChangeDetection(),
            ],
            imports: [SettingsBarComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsBarComponent);
        component = fixture.componentInstance;
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });
});
