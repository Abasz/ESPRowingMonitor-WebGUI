import { DestroyRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Observable, of } from "rxjs";

import {
    IBaseMetrics,
    IErgConnectionStatus,
    IExtendedMetrics,
    IHeartRate,
    IHRConnectionStatus,
    IRowerSettings,
} from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { ErgMetricsService } from "./ergometer/erg-metric-data.service";
import { HeartRateService } from "./heart-rate/heart-rate.service";
import { MetricsService } from "./metrics.service";

describe("DataService", (): void => {
    let service: MetricsService;

    const mockDataService = {
        ergBatteryLevel$: of(80),
        ergConnectionStatus$: of({ status: "connected" } as IErgConnectionStatus),
        hrConnectionStatus$: of({ status: "connected" } as IHRConnectionStatus),
        rowerSettings: of({ bleServiceFlag: 0, logLevel: 1 } as IRowerSettings),
    };

    const mockDataRecorderService = {
        addDeltaTimes: jasmine.createSpy("addDeltaTimes"),
        addSessionData: jasmine.createSpy("addSessionData"),
        addConnectedDevice: jasmine.createSpy("addConnectedDevice"),
        reset: jasmine.createSpy("reset"),
    };

    const mockErgMetricsService = {
        streamMonitorBatteryLevel$: (): Observable<number> => mockDataService.ergBatteryLevel$,
        connectionStatus$: (): Observable<IErgConnectionStatus> => mockDataService.ergConnectionStatus$,
        streamRowerSettings$: (): Observable<IRowerSettings> => mockDataService.rowerSettings,
        streamExtended$: (): Observable<IExtendedMetrics> =>
            of({ avgStrokePower: 0, driveDuration: 0, recoveryDuration: 0, dragFactor: 0 }),
        streamHandleForces$: (): Observable<Array<number>> => of([] as Array<number>),
        streamMeasurement$: (): Observable<IBaseMetrics> =>
            of({ revTime: 0, distance: 0, strokeTime: 0, strokeCount: 0 }),
        streamDeltaTimes$: (): Observable<Array<number>> => of([0]),
        reconnect: jasmine.createSpy("reconnect"),
        changeBleServiceType: jasmine.createSpy("changeBleServiceType").and.returnValue(Promise.resolve()),
        changeDeltaTimeLogging: jasmine
            .createSpy("changeDeltaTimeLogging")
            .and.returnValue(Promise.resolve()),
        changeLogLevel: jasmine.createSpy("changeLogLevel").and.returnValue(Promise.resolve()),
        changeLogToSdCard: jasmine.createSpy("changeLogToSdCard").and.returnValue(Promise.resolve()),
    };

    const mockHeartRateService = {
        streamHeartRate$: (): Observable<IHeartRate | undefined> => of(undefined),
        connectionStatus$: (): Observable<IHRConnectionStatus> => mockDataService.hrConnectionStatus$,
        discover: jasmine.createSpy("discover").and.returnValue(Promise.resolve()),
    };

    const mockDestroyRef = {
        onDestroy: jasmine.createSpy("onDestroy"),
    };

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [
                { provide: ErgMetricsService, useValue: mockErgMetricsService },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                { provide: HeartRateService, useValue: mockHeartRateService },
                { provide: DestroyRef, useValue: mockDestroyRef },
            ],
        });
        service = TestBed.inject(MetricsService);
    });

    it("should be created", (): void => {
        expect(service).toBeTruthy();
    });
});
