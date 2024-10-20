import { TestBed } from "@angular/core/testing";
import { MatIconRegistry } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SwUpdate } from "@angular/service-worker";
import { Observable, of } from "rxjs";

import { ICalculatedMetrics, IErgConnectionStatus, IHeartRate } from "../common/common.interfaces";
import { DataRecorderService } from "../common/services/data-recorder.service";
import { DataService } from "../common/services/data.service";
import { UtilsService } from "../common/services/utils.service";

import { AppComponent } from "./app.component";

describe("AppComponent", (): void => {
    beforeEach(async (): Promise<void> => {
        const mockDataService = {
            heartRateData$: of({ heartRate: 75 } as IHeartRate),
            allMetrics$: of({
                activityStartTime: new Date(),
                avgStrokePower: 0,
                driveDuration: 0,
                recoveryDuration: 0,
                dragFactor: 0,
                distance: 0,
                strokeCount: 0,
                handleForces: [],
                peakForce: 0,
                strokeRate: 0,
                speed: 0,
                distPerStroke: 0,
            } as ICalculatedMetrics),
            ergConnectionStatus$: of({ status: "connected" } as IErgConnectionStatus),
            getActivityStartTime: (): Date => new Date(),
            ergBatteryLevel$: of(80),
            hrConnectionStatus$: of({ status: "connected" }),
            settings: of({ bleServiceFlag: 0, logLevel: 1 }),
        };

        const mockUtilsService = {
            enableWakeLock: jasmine.createSpy("enableWakeLock"),
            disableWackeLock: jasmine.createSpy("disableWackeLock"),
        };

        const mockMatSnackBar = {
            open: jasmine.createSpy("open").and.returnValue({
                onAction: (): Observable<void> => of(),
            }),
        };

        const mockMatIconRegistry = {
            setDefaultFontSetClass: jasmine.createSpy("setDefaultFontSetClass"),
        };

        const mockSwUpdate = {
            versionUpdates: of({ type: "VERSION_READY" }),
            checkForUpdate: (): Promise<void> => Promise.resolve(),
        };

        const mockDataRecorderService = {
            getSessionSummaries$: jasmine.createSpy("getSessionSummaries$").and.returnValue(of([])),
        };

        await TestBed.configureTestingModule({
            providers: [
                { provide: DataService, useValue: mockDataService },
                { provide: UtilsService, useValue: mockUtilsService },
                { provide: MatSnackBar, useValue: mockMatSnackBar },
                { provide: MatIconRegistry, useValue: mockMatIconRegistry },
                { provide: SwUpdate, useValue: mockSwUpdate },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
            ],
            imports: [AppComponent],
        }).compileComponents();
    });

    it("should create the app", (): void => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });
});
