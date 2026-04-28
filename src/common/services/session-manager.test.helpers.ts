import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BehaviorSubject } from "rxjs";
import { vi } from "vitest";

import {
    Config,
    IErgConnectionStatus,
    IGeneralDeviceConfig,
    IGeneralSessionConfig,
    IHeartRate,
    IRawCalculatedMetrics,
} from "../common.interfaces";
import { deepMerge } from "../utils/utility.functions";

import { ConfigManagerService } from "./config-manager.service";
import { DataRecorderService } from "./data-recorder.service";
import { ErgConnectionService } from "./ergometer/erg-connection.service";
import { IntervalsIcuService } from "./intervals-icu.service";
import { MetricsService } from "./metrics.service";
import { SessionManagerService } from "./session-manager.service";

export const mockRawMetrics: IRawCalculatedMetrics = {
    avgStrokePower: 0,
    driveDuration: 0,
    recoveryDuration: 0,
    dragFactor: 0,
    rawDistance: 0,
    rawStrokeCount: 0,
    handleForces: [],
    peakForce: 0,
    peakForcePositionNorm: 0,
    strokeRate: 0,
    speed: 0,
    distPerStroke: 0,
    driveLength: 0,
};

export interface SessionManagerTestContext {
    service: SessionManagerService;
    rawMetricsSubject: BehaviorSubject<IRawCalculatedMetrics>;
    configSubject: BehaviorSubject<Config>;
    heartRateSubject: BehaviorSubject<IHeartRate | undefined>;
    connectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    mockDataRecorderService: Pick<
        DataRecorderService,
        "reset" | "addSessionData" | "addLap" | "currentSessionId"
    >;
    mockMetricsService: Pick<MetricsService, "rawMetrics$" | "heartRateData$">;
    mockErgConnectionService: Pick<ErgConnectionService, "connectionStatus$">;
    mockConfigManagerService: Pick<ConfigManagerService, "configChanged$" | "getGroup">;
    mockIntervalsIcuService: Pick<IntervalsIcuService, "uploadSession">;
    mockSnackBar: Pick<MatSnackBar, "open">;
}

export function setupSessionManagerTestBed(): SessionManagerTestContext {
    const rawMetricsSubject = new BehaviorSubject<IRawCalculatedMetrics>(mockRawMetrics);
    const heartRateSubject = new BehaviorSubject<IHeartRate | undefined>(undefined);
    const connectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>({ status: "disconnected" });

    const mockMetricsService: Pick<MetricsService, "rawMetrics$" | "heartRateData$"> = {
        rawMetrics$: rawMetricsSubject.asObservable(),
        heartRateData$: heartRateSubject.asObservable(),
    };

    const mockDataRecorderService: Pick<
        DataRecorderService,
        "reset" | "addSessionData" | "addLap" | "currentSessionId"
    > = {
        reset: vi.fn().mockResolvedValue(undefined),
        addSessionData: vi.fn().mockResolvedValue(undefined),
        addLap: vi.fn().mockResolvedValue(1),
        currentSessionId: 1700000000000,
    };

    const mockErgConnectionService: Pick<ErgConnectionService, "connectionStatus$"> = {
        connectionStatus$: vi.fn().mockReturnValue(connectionStatusSubject.asObservable()),
    };

    const configSubject = new BehaviorSubject<Config>(new Config());
    const mockConfigManagerService: Pick<ConfigManagerService, "configChanged$" | "getGroup"> = {
        configChanged$: configSubject.asObservable(),
        getGroup: vi.fn().mockReturnValue({
            intervalsIcu: { apiKey: "", athleteId: "", autoUploadEnabled: false },
        }),
    };

    const mockIntervalsIcuService: Pick<IntervalsIcuService, "uploadSession"> = {
        uploadSession: vi.fn().mockResolvedValue(true),
    };

    const mockSnackBar: Pick<MatSnackBar, "open"> = {
        open: vi.fn(),
    };

    TestBed.configureTestingModule({
        providers: [
            SessionManagerService,
            { provide: MetricsService, useValue: mockMetricsService },
            { provide: DataRecorderService, useValue: mockDataRecorderService },
            { provide: ErgConnectionService, useValue: mockErgConnectionService },
            { provide: ConfigManagerService, useValue: mockConfigManagerService },
            { provide: IntervalsIcuService, useValue: mockIntervalsIcuService },
            { provide: MatSnackBar, useValue: mockSnackBar },
        ],
    });

    const service = TestBed.inject(SessionManagerService);

    return {
        service,
        rawMetricsSubject,
        configSubject,
        heartRateSubject,
        connectionStatusSubject,
        mockDataRecorderService,
        mockMetricsService,
        mockErgConnectionService,
        mockConfigManagerService,
        mockIntervalsIcuService,
        mockSnackBar,
    };
}

export const withSessionConfig = (overrides: Partial<IGeneralSessionConfig>): Config =>
    deepMerge(new Config(), { general: { session: overrides } });

export const withDeviceConfig = (overrides: Partial<IGeneralDeviceConfig>): Config =>
    deepMerge(new Config(), { general: { device: overrides } });
