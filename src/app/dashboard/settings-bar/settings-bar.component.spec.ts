import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { DatePipe } from "@angular/common";
import { signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatButtonHarness } from "@angular/material/button/testing";
import { MatDialog } from "@angular/material/dialog";
import { MatIconHarness } from "@angular/material/icon/testing";
import { MatToolbarHarness } from "@angular/material/toolbar/testing";
import { MatTooltipHarness } from "@angular/material/tooltip/testing";
import { BehaviorSubject, of } from "rxjs";
import { map } from "rxjs/operators";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BleServiceFlag, LogLevel } from "../../../common/ble.interfaces";
import {
    Config,
    IErgConnectionStatus,
    IHRConnectionStatus,
    ILogbookDialogData,
    IRowerSettings,
    ISessionSummary,
    SessionState,
    StrokeDetectionType,
} from "../../../common/common.interfaces";
import { ConfigManagerService } from "../../../common/services/config-manager.service";
import { DataRecorderService } from "../../../common/services/data-recorder.service";
import { ErgConnectionService } from "../../../common/services/ergometer/erg-connection.service";
import { ErgGenericDataService } from "../../../common/services/ergometer/erg-generic-data.service";
import { ErgSettingsService } from "../../../common/services/ergometer/erg-settings.service";
import { HeartRateService } from "../../../common/services/heart-rate/heart-rate.service";
import { IntervalsIcuService } from "../../../common/services/intervals-icu.service";
import { MetricsService } from "../../../common/services/metrics.service";
import { SessionManagerService } from "../../../common/services/session-manager.service";
import { UtilsService } from "../../../common/services/utils.service";

import { SettingsBarComponent } from "./settings-bar.component";

describe("SettingsBarComponent", (): void => {
    let component: SettingsBarComponent;
    let fixture: ComponentFixture<SettingsBarComponent>;
    let loader: HarnessLoader;

    let mockSessionManagerService: Pick<
        SessionManagerService,
        "start" | "stop" | "pause" | "addLap" | "sessionState"
    >;
    let mockSessionState: WritableSignal<SessionState>;
    let mockMetricsService: Pick<MetricsService, "hrConnectionStatus$">;
    let mockDataRecorderService: Pick<DataRecorderService, "getSessionSummaries$">;
    let mockErgConnectionService: Pick<ErgConnectionService, "connectionStatus$">;
    let mockErgGenericDataService: Pick<ErgGenericDataService, "streamMonitorBatteryLevel$">;
    let mockErgSettingsService: Pick<ErgSettingsService, "rowerSettings">;
    let mockMatDialog: Pick<MatDialog, "open">;
    let mockUtilsService: Pick<UtilsService, "mainSpinner">;
    let mockConfigManagerService: Pick<ConfigManagerService, "configChanged$">;
    let mockHeartRateService: Pick<HeartRateService, "discover">;

    let mockIntervalsIcuService: Pick<IntervalsIcuService, "getUploadedSessionIds$">;

    let batteryLevelSubject: BehaviorSubject<number>;
    let ergConnectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let sessionsSubject: BehaviorSubject<Array<ISessionSummary>>;
    let configSubject: BehaviorSubject<Config>;
    let hrConnectionStatusSubject: BehaviorSubject<IHRConnectionStatus>;
    let mockRowerSettingsSignal: ReturnType<typeof signal<IRowerSettings>>;

    const mockErgConnectionStatus: IErgConnectionStatus = {
        status: "disconnected",
        deviceName: "Test Device",
    };

    const mockRowerSettings: IRowerSettings = {
        generalSettings: {
            logDeltaTimes: true,
            logToSdCard: false,
            bleServiceFlag: BleServiceFlag.FtmsService,
            logLevel: LogLevel.Info,
            isRuntimeSettingsEnabled: true,
            isCompiledWithDouble: false,
        },
        rowingSettings: {
            machineSettings: {
                flywheelInertia: 0.1,
                magicConstant: 2.8,
                sprocketRadius: 0.04,
                impulsePerRevolution: 3,
            },
            sensorSignalSettings: {
                rotationDebounceTime: 50,
                rowingStoppedThreshold: 3000,
            },
            dragFactorSettings: {
                goodnessOfFitThreshold: 0.96,
                maxDragFactorRecoveryPeriod: 1000,
                dragFactorLowerThreshold: 50,
                dragFactorUpperThreshold: 230,
                dragCoefficientsArrayLength: 200,
            },
            strokeDetectionSettings: {
                strokeDetectionType: StrokeDetectionType.Both,
                impulseDataArrayLength: 20,
                minimumPoweredTorque: 0.1,
                minimumDragTorque: 0.05,
                minimumRecoverySlopeMargin: 0.012,
                minimumRecoverySlope: 0.0036,
                minimumRecoveryTime: 300,
                minimumDriveTime: 300,
                driveHandleForcesMaxCapacity: 300,
            },
        },
    };

    const mockSessionSummaries: Array<ISessionSummary> = [
        {
            sessionId: 1,
            deviceName: "Test Device",
            startTime: Date.now() - 1200000, // 20 minutes ago
            finishTime: Date.now(),
            elapsedTime: 1200, // 20 minutes
            distance: 5000,
            strokeCount: 150,
        },
    ];

    beforeEach(async (): Promise<void> => {
        batteryLevelSubject = new BehaviorSubject<number>(0);
        ergConnectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>(mockErgConnectionStatus);
        sessionsSubject = new BehaviorSubject<Array<ISessionSummary>>(mockSessionSummaries);
        configSubject = new BehaviorSubject<Config>(new Config());
        hrConnectionStatusSubject = new BehaviorSubject<IHRConnectionStatus>({
            status: "disconnected",
            deviceName: undefined,
        });
        mockRowerSettingsSignal = signal(mockRowerSettings);

        mockSessionState = signal<SessionState>("stopped");
        mockSessionManagerService = {
            start: vi.fn(),
            stop: vi.fn(),
            pause: vi.fn(),
            addLap: vi.fn(),
            sessionState: mockSessionState,
        };

        mockMetricsService = {
            hrConnectionStatus$: hrConnectionStatusSubject.asObservable(),
        };

        mockDataRecorderService = {
            getSessionSummaries$: vi.fn(),
        };

        mockErgConnectionService = {
            connectionStatus$: vi.fn(),
        };
        mockErgGenericDataService = {
            streamMonitorBatteryLevel$: vi.fn(),
        };
        mockErgSettingsService = {
            rowerSettings: mockRowerSettingsSignal,
        };
        mockMatDialog = {
            open: vi.fn(),
        };
        mockUtilsService = {
            mainSpinner: vi.fn(),
        };
        mockConfigManagerService = {
            configChanged$: configSubject.asObservable(),
        };
        mockHeartRateService = {
            discover: vi.fn(),
        };
        mockIntervalsIcuService = {
            getUploadedSessionIds$: vi.fn().mockReturnValue(of([])),
        };

        vi.mocked(mockDataRecorderService.getSessionSummaries$).mockReturnValue(
            sessionsSubject.asObservable(),
        );
        vi.mocked(mockErgConnectionService.connectionStatus$).mockReturnValue(
            ergConnectionStatusSubject.asObservable(),
        );
        vi.mocked(mockErgGenericDataService.streamMonitorBatteryLevel$).mockReturnValue(
            batteryLevelSubject.asObservable(),
        );
        vi.mocked(mockUtilsService.mainSpinner).mockReturnValue({
            open: vi.fn(),
            close: vi.fn(),
        });

        await TestBed.configureTestingModule({
            imports: [SettingsBarComponent],
            providers: [
                { provide: SessionManagerService, useValue: mockSessionManagerService },
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                { provide: ErgGenericDataService, useValue: mockErgGenericDataService },
                { provide: ErgSettingsService, useValue: mockErgSettingsService },
                { provide: MatDialog, useValue: mockMatDialog },
                { provide: UtilsService, useValue: mockUtilsService },
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: HeartRateService, useValue: mockHeartRateService },
                { provide: IntervalsIcuService, useValue: mockIntervalsIcuService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsBarComponent);
        component = fixture.componentInstance;
        loader = TestbedHarnessEnvironment.loader(fixture);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize BleServiceFlag property", (): void => {
            expect(component.BleServiceFlag).toBe(BleServiceFlag);
        });

        it("should initialize BleServiceNames property", (): void => {
            expect(component.BleServiceNames).toBeDefined();
        });

        it("should initialize batteryLevel signal", (): void => {
            expect(component.batteryLevel()).toBe(0);
        });

        it("should initialize ergConnectionStatus signal", (): void => {
            expect(component.ergConnectionStatus()).toEqual(mockErgConnectionStatus);
        });

        it("should initialize settings signal", (): void => {
            expect(component.settings()).toEqual(mockRowerSettings);
        });

        it("should initialize timeOfDay signal", (): void => {
            const timeOfDay = component.timeOfDay();

            expect(typeof timeOfDay === "number").toBe(true);
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render mat-toolbar element", async (): Promise<void> => {
            const toolbarHarness = await loader.getHarness(MatToolbarHarness);
            expect(toolbarHarness).toBeTruthy();
        });

        it("should render battery level icon", async (): Promise<void> => {
            const batteryIcon = fixture.nativeElement.querySelector(".battery-level");
            expect(batteryIcon).toBeTruthy();
            expect(batteryIcon.tagName.toLowerCase()).toBe("mat-icon");
        });

        it("should display battery level tooltip", async (): Promise<void> => {
            const batteryIcon = fixture.nativeElement.querySelector(".battery-level");
            expect(batteryIcon).toBeTruthy();

            const tooltipHarness = await loader.getHarness(
                MatTooltipHarness.with({ selector: ".battery-level" }),
            );
            await tooltipHarness.show();
            const tooltipText = await tooltipHarness.getTooltipText();
            expect(tooltipText).toBe("0%");
        });

        it("should render logbook button", async (): Promise<void> => {
            const buttons = await loader.getAllHarnesses(MatButtonHarness);
            const logbookButton = await Promise.all(
                buttons.map(async (btn: MatButtonHarness): Promise<boolean> => {
                    try {
                        await btn.getHarness(MatIconHarness.with({ name: "sports_score" }));

                        return true;
                    } catch {
                        return false;
                    }
                }),
            );

            expect(logbookButton.some(Boolean)).toBe(true);
        });

        it("should render start button when not running", async (): Promise<void> => {
            const buttons = await loader.getAllHarnesses(MatButtonHarness);
            const startButton = await Promise.all(
                buttons.map(async (btn: MatButtonHarness): Promise<boolean> => {
                    try {
                        await btn.getHarness(MatIconHarness.with({ name: "play_circle" }));

                        return true;
                    } catch {
                        return false;
                    }
                }),
            );

            expect(startButton.some(Boolean)).toBe(true);
        });

        it("should render stop button when running", async (): Promise<void> => {
            mockSessionState.set("running");
            fixture.detectChanges();

            const buttons = await loader.getAllHarnesses(MatButtonHarness);
            const stopButton = await Promise.all(
                buttons.map(async (btn: MatButtonHarness): Promise<boolean> => {
                    try {
                        await btn.getHarness(MatIconHarness.with({ name: "stop_circle" }));

                        return true;
                    } catch {
                        return false;
                    }
                }),
            );

            expect(stopButton.some(Boolean)).toBe(true);
        });

        it("should render child components", (): void => {
            const openSettingsButton = fixture.nativeElement.querySelector("app-open-settings-button");
            const connectErgButton = fixture.nativeElement.querySelector("app-connect-erg-button");
            const connectHeartRateButton = fixture.nativeElement.querySelector(
                "app-connect-heart-rate-button",
            );

            expect(openSettingsButton).toBeTruthy();
            expect(connectErgButton).toBeTruthy();
            expect(connectHeartRateButton).toBeTruthy();
        });

        it("should display time of day", async (): Promise<void> => {
            await fixture.whenStable();
            const datePipe = new DatePipe("en-US");
            const timeSpan = fixture.nativeElement.querySelector(".time-of-day");
            expect(timeSpan).toBeTruthy();

            const expectedTime = datePipe.transform(Date.now(), "HH:mm");
            expect(timeSpan.textContent.trim()).toContain(expectedTime);
        });

        it("should display title", (): void => {
            const titleSpan = fixture.nativeElement.querySelector(".title");
            expect(titleSpan).toBeTruthy();
            expect(titleSpan.textContent.trim()).toBe("ESP Rowing Monitor");
        });

        describe("with connected ergometer", (): void => {
            beforeEach((): void => {
                ergConnectionStatusSubject.next({
                    status: "connected",
                    deviceName: "Test Connected Device",
                });
            });

            it("should display BLE service name", async (): Promise<void> => {
                await fixture.whenStable();
                const serviceNameText = fixture.nativeElement.textContent;
                expect(serviceNameText).toContain("Fitness Machine");
            });
        });

        describe("with disconnected ergometer", (): void => {
            beforeEach((): void => {
                ergConnectionStatusSubject.next({
                    status: "disconnected",
                    deviceName: undefined,
                });
            });

            it("should not display BLE service name", (): void => {
                const spans = fixture.nativeElement.querySelectorAll("span");
                const hasEmptyServiceSpan = Array.from(spans as NodeListOf<HTMLElement>).some(
                    (span: HTMLElement): boolean => span.textContent?.trim() === "",
                );

                expect(hasEmptyServiceSpan).toBe(true);
            });
        });
    });

    describe("batteryLevel signal", (): void => {
        it("should update when battery level changes", (): void => {
            expect(component.batteryLevel()).toBe(0);

            batteryLevelSubject.next(75);
            expect(component.batteryLevel()).toBe(75);
        });

        it("should display updated battery percentage in tooltip", async (): Promise<void> => {
            batteryLevelSubject.next(42);

            const tooltipHarness = await loader.getHarness(
                MatTooltipHarness.with({ selector: ".battery-level" }),
            );
            await tooltipHarness.show();
            const tooltipText = await tooltipHarness.getTooltipText();
            expect(tooltipText).toBe("42%");
        });

        it("should update battery icon via pipe", async (): Promise<void> => {
            batteryLevelSubject.next(25);
            await fixture.whenStable();

            const batteryIcon = fixture.nativeElement.querySelector(".battery-level");
            expect(batteryIcon.textContent?.trim()).toBeTruthy();
        });
    });

    describe("ergConnectionStatus signal", (): void => {
        it("should update when connection status changes", (): void => {
            expect(component.ergConnectionStatus()).toEqual(mockErgConnectionStatus);

            const newStatus: IErgConnectionStatus = {
                status: "connected",
                deviceName: "New Test Device",
            };
            ergConnectionStatusSubject.next(newStatus);
            expect(component.ergConnectionStatus()).toEqual(newStatus);
        });

        it("should show BLE service name when connected", async (): Promise<void> => {
            ergConnectionStatusSubject.next({
                status: "connected",
                deviceName: "Connected Device",
            });
            await fixture.whenStable();

            const textContent = fixture.nativeElement.textContent;
            expect(textContent).toContain("Fitness Machine");
        });

        it("should hide BLE service name when disconnected", (): void => {
            ergConnectionStatusSubject.next({
                status: "disconnected",
                deviceName: undefined,
            });

            const spans = fixture.nativeElement.querySelectorAll("span");
            const lastSpan = spans[spans.length - 3];
            expect(lastSpan.textContent?.trim()).toBe("");
        });
    });

    describe("settings signal", (): void => {
        it("should reflect current rower settings", (): void => {
            expect(component.settings()).toEqual(mockRowerSettings);
        });

        it("should update BLE service name display when settings change", async (): Promise<void> => {
            ergConnectionStatusSubject.next({
                status: "connected",
                deviceName: "Connected Device",
            });
            await fixture.whenStable();

            let textContent = fixture.nativeElement.textContent;
            expect(textContent).toContain("Fitness Machine");

            const updatedSettings = {
                ...mockRowerSettings,
                generalSettings: {
                    ...mockRowerSettings.generalSettings,
                    bleServiceFlag: BleServiceFlag.CpsService,
                },
            };
            mockRowerSettingsSignal.set(updatedSettings);
            await fixture.whenStable();
            expect(fixture.nativeElement.textContent).toContain("Cycling Power");
        });
    });

    describe("timeOfDay signal", (): void => {
        it("should initialize with current time", (): void => {
            const timeOfDay = component.timeOfDay();

            expect(timeOfDay).toBeCloseTo(Date.now(), -3); // within 1 second
        });

        it("should display updated time in template", async (): Promise<void> => {
            // create a writable signal and assign it to the component via a typed unknown cast. This is a workaround for the interval() rxjs operator not emitting in a zoneless app (even in a fakeAsync)
            const datePipe = new DatePipe("en-US");
            const start = Date.now();
            const writable = signal(start);
            (component as unknown as { timeOfDay: WritableSignal<number> }).timeOfDay = writable;
            await fixture.whenStable();

            const initialDisplay: string = fixture.nativeElement.querySelector(".time-of-day").textContent;
            const formattedInitial = datePipe.transform(start, "HH:mm") as string;
            expect(initialDisplay.trim()).toBe(formattedInitial);

            const later = start + 61_000 * 2;
            writable.set(later);
            await fixture.whenStable();

            const updatedDisplay: string = fixture.nativeElement.querySelector(".time-of-day").textContent;
            const formattedLater = datePipe.transform(later, "HH:mm") as string;

            expect(updatedDisplay.trim()).toBe(formattedLater);
            expect(updatedDisplay).not.toBe(initialDisplay);
        });
    });

    describe("openLogbook method", (): void => {
        let mockSpinner: { close(): void; open(): void };

        beforeEach((): void => {
            mockSpinner = mockUtilsService.mainSpinner();
        });

        it("should open main spinner", (): void => {
            component.openLogbook();
            expect(mockSpinner.open).toHaveBeenCalled();
        });

        it("should call getSessionSummaries$", (): void => {
            component.openLogbook();
            expect(mockDataRecorderService.getSessionSummaries$).toHaveBeenCalled();
        });

        it("should call getUploadedSessionIds$", (): void => {
            component.openLogbook();
            expect(mockIntervalsIcuService.getUploadedSessionIds$).toHaveBeenCalled();
        });

        it("should close main spinner on success", (): void => {
            component.openLogbook();
            expect(mockSpinner.close).toHaveBeenCalled();
        });

        it("should open logbook dialog with correct data", (): void => {
            component.openLogbook();
            expect(mockMatDialog.open).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    data: {
                        summaries: mockSessionSummaries,
                        uploadedSessionIds: [],
                    } satisfies ILogbookDialogData,
                }),
            );
        });

        it("should forward non-empty uploaded session IDs to dialog data", (): void => {
            vi.mocked(mockIntervalsIcuService.getUploadedSessionIds$).mockReturnValue(of([101, 202]));

            component.openLogbook();

            expect(mockMatDialog.open).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    data: {
                        summaries: mockSessionSummaries,
                        uploadedSessionIds: [101, 202],
                    } satisfies ILogbookDialogData,
                }),
            );
        });

        it("should open dialog with correct configuration", (): void => {
            component.openLogbook();
            expect(mockMatDialog.open).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    autoFocus: false,
                    maxWidth: "95vw",
                }),
            );
        });

        it("should handle empty session summaries", (): void => {
            sessionsSubject.next([]);
            component.openLogbook();
            expect(mockMatDialog.open).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    data: { summaries: [], uploadedSessionIds: [] } satisfies ILogbookDialogData,
                }),
            );
        });

        describe("when error occurs", (): void => {
            it("should close spinner", (): void => {
                const testError = new Error("Database error");
                vi.mocked(mockDataRecorderService.getSessionSummaries$).mockReturnValue(
                    new BehaviorSubject<Array<ISessionSummary>>([]).pipe(
                        map((): Array<ISessionSummary> => {
                            throw testError;
                        }),
                    ),
                );

                component.openLogbook();

                expect(mockSpinner.close).toHaveBeenCalled();
            });

            it("should not open dialog", (): void => {
                const testError = new Error("Data access error");
                vi.mocked(mockDataRecorderService.getSessionSummaries$).mockReturnValue(
                    new BehaviorSubject<Array<ISessionSummary>>([]).pipe(
                        map((): Array<ISessionSummary> => {
                            throw testError;
                        }),
                    ),
                );

                component.openLogbook();

                expect(mockMatDialog.open).not.toHaveBeenCalled();
            });

            it("should close spinner and not open dialog when uploaded IDs loading fails", (): void => {
                const testError = new Error("Uploaded IDs error");
                vi.mocked(mockIntervalsIcuService.getUploadedSessionIds$).mockReturnValue(
                    new BehaviorSubject<Array<number>>([]).pipe(
                        map((): Array<number> => {
                            throw testError;
                        }),
                    ),
                );

                component.openLogbook();

                expect(mockSpinner.close).toHaveBeenCalled();
                expect(mockMatDialog.open).not.toHaveBeenCalled();
            });
        });
    });

    describe("startSession method", (): void => {
        it("should call sessionManager start", (): void => {
            component.startSession();
            expect(mockSessionManagerService.start).toHaveBeenCalled();
        });
    });

    describe("stopSession method", (): void => {
        it("should call sessionManager stop", (): void => {
            component.stopSession();
            expect(mockSessionManagerService.stop).toHaveBeenCalled();
        });
    });

    describe("addLap method", (): void => {
        it("should call sessionManager addLap", (): void => {
            component.addLap();
            expect(mockSessionManagerService.addLap).toHaveBeenCalled();
        });
    });

    describe("as part of user interactions", (): void => {
        describe("logbook button click", (): void => {
            it("should trigger openLogbook method", async (): Promise<void> => {
                vi.spyOn(component, "openLogbook");

                const buttons = await loader.getHarness(MatButtonHarness.with({ text: "sports_score" }));
                expect(buttons).not.toBeNull();

                await buttons.click();
                expect(component.openLogbook).toHaveBeenCalled();
            });

            it("should have correct tooltip", async (): Promise<void> => {
                const button = await loader.getHarness(MatButtonHarness.with({ text: "sports_score" }));
                expect(button).not.toBeNull();

                const tooltip = await button.host();
                const tooltipText = await tooltip.getAttribute("matTooltip");
                expect(tooltipText).toBe("Logbook");
            });
        });

        describe("start button click", (): void => {
            it("should trigger startSession method", async (): Promise<void> => {
                vi.spyOn(component, "startSession");

                const button = await loader.getHarness(MatButtonHarness.with({ text: "play_circle" }));
                expect(button).not.toBeNull();

                await button.click();
                expect(component.startSession).toHaveBeenCalled();
            });

            it("should have correct tooltip", async (): Promise<void> => {
                const button = await loader.getHarness(MatButtonHarness.with({ text: "play_circle" }));
                expect(button).not.toBeNull();

                const tooltip = await button.host();
                const tooltipText = await tooltip.getAttribute("matTooltip");
                expect(tooltipText).toBe("Start");
            });
        });

        describe("stop button click", (): void => {
            beforeEach((): void => {
                mockSessionState.set("running");
                fixture.detectChanges();
            });

            it("should trigger stopSession method", async (): Promise<void> => {
                vi.spyOn(component, "stopSession");

                const button = await loader.getHarness(MatButtonHarness.with({ text: "stop_circle" }));
                expect(button).not.toBeNull();

                await button.click();
                expect(component.stopSession).toHaveBeenCalled();
            });

            it("should have correct tooltip", async (): Promise<void> => {
                const button = await loader.getHarness(MatButtonHarness.with({ text: "stop_circle" }));
                expect(button).not.toBeNull();

                const tooltip = await button.host();
                const tooltipText = await tooltip.getAttribute("matTooltip");
                expect(tooltipText).toBe("Stop");
            });
        });

        describe("lap button click", (): void => {
            beforeEach((): void => {
                mockSessionState.set("running");
                fixture.detectChanges();
            });

            it("should trigger addLap method", async (): Promise<void> => {
                vi.spyOn(component, "addLap");

                const button = await loader.getHarness(MatButtonHarness.with({ text: "laps" }));
                expect(button).not.toBeNull();

                await button.click();
                expect(component.addLap).toHaveBeenCalled();
            });

            it("should have correct tooltip", async (): Promise<void> => {
                const button = await loader.getHarness(MatButtonHarness.with({ text: "laps" }));
                expect(button).not.toBeNull();

                const tooltip = await button.host();
                const tooltipText = await tooltip.getAttribute("matTooltip");
                expect(tooltipText).toBe("Lap");
            });

            it("should not show lap button when stopped", async (): Promise<void> => {
                mockSessionState.set("stopped");
                fixture.detectChanges();

                const buttons = await loader.getAllHarnesses(MatButtonHarness.with({ text: "laps" }));
                expect(buttons.length).toBe(0);
            });
        });

        describe("battery level icon interaction", (): void => {
            it("should show battery percentage on hover", async (): Promise<void> => {
                batteryLevelSubject.next(73);

                const tooltipHarness = await loader.getHarness(
                    MatTooltipHarness.with({ selector: ".battery-level" }),
                );
                await tooltipHarness.show();
                const tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("73%");
            });

            it("should have correct tooltip delay", (): void => {
                const batteryIcon = fixture.nativeElement.querySelector(".battery-level");
                expect(batteryIcon).toBeTruthy();
                expect(batteryIcon.getAttribute("mattooltipshowdelay")).toBe("1000");
            });
        });
    });

    describe("as part of signal reactivity", (): void => {
        describe("multiple signal updates", (): void => {
            it("should handle simultaneous signal updates", async (): Promise<void> => {
                batteryLevelSubject.next(50);
                ergConnectionStatusSubject.next({
                    status: "connected",
                    deviceName: "Multi-test Device",
                });
                await fixture.whenStable();

                expect(component.batteryLevel()).toBe(50);
                expect(component.ergConnectionStatus().status).toBe("connected");
                expect(fixture.nativeElement.textContent).toContain("Fitness Machine");
            });

            it("should maintain correct template state", async (): Promise<void> => {
                batteryLevelSubject.next(25);
                ergConnectionStatusSubject.next({
                    status: "connecting",
                    deviceName: "Connecting Device",
                });

                const tooltipHarness = await loader.getHarness(
                    MatTooltipHarness.with({ selector: ".battery-level" }),
                );
                await tooltipHarness.show();
                const tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("25%");

                const serviceText = fixture.nativeElement.textContent;
                expect(serviceText).not.toContain("Fitness Machine");
            });
        });

        describe("rapid signal changes", (): void => {
            it("should handle rapid battery level changes", (): void => {
                const levels = [10, 20, 30, 40, 50];

                levels.forEach((level: number): void => {
                    batteryLevelSubject.next(level);
                });

                expect(component.batteryLevel()).toBe(50);
            });

            it("should handle rapid connection status changes", (): void => {
                const statuses: Array<IErgConnectionStatus> = [
                    { status: "connecting", deviceName: "Device1" },
                    { status: "connected", deviceName: "Device2" },
                    { status: "disconnected", deviceName: undefined },
                ];

                statuses.forEach((status: IErgConnectionStatus): void => {
                    ergConnectionStatusSubject.next(status);
                });

                expect(component.ergConnectionStatus().status).toBe("disconnected");
            });
        });
    });

    describe("as part of edge cases", (): void => {
        describe("null and undefined values", (): void => {
            it("should handle null device name", async (): Promise<void> => {
                ergConnectionStatusSubject.next({
                    status: "connected",
                    deviceName: null as unknown as string,
                });
                await fixture.whenStable();

                expect(fixture.nativeElement.textContent).toContain("Fitness Machine");
            });

            it("should handle empty session summaries", (): void => {
                sessionsSubject.next([]);

                component.openLogbook();

                expect(mockMatDialog.open).toHaveBeenCalledWith(
                    expect.any(Function),
                    expect.objectContaining({
                        data: { summaries: [], uploadedSessionIds: [] } satisfies ILogbookDialogData,
                    }),
                );
            });
        });

        describe("extreme values", (): void => {
            it("should handle zero battery level", async (): Promise<void> => {
                batteryLevelSubject.next(0);

                const tooltipHarness = await loader.getHarness(
                    MatTooltipHarness.with({ selector: ".battery-level" }),
                );
                await tooltipHarness.show();
                const tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("0%");
                expect(component.batteryLevel()).toBe(0);
            });

            it("should handle maximum battery level", async (): Promise<void> => {
                batteryLevelSubject.next(100);

                const tooltipHarness = await loader.getHarness(
                    MatTooltipHarness.with({ selector: ".battery-level" }),
                );
                await tooltipHarness.show();
                const tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("100%");
                expect(component.batteryLevel()).toBe(100);
            });

            it("should handle large number of sessions", (): void => {
                const largeSessions = Array.from(
                    { length: 1000 },
                    (_: unknown, index: number): ISessionSummary => ({
                        sessionId: index,
                        deviceName: `Device ${index}`,
                        startTime: Date.now() - index * 1000,
                        finishTime: Date.now(),
                        elapsedTime: index * 1000,
                        distance: index * 100,
                        strokeCount: index * 10,
                    }),
                );

                sessionsSubject.next(largeSessions);
                component.openLogbook();

                expect(mockMatDialog.open).toHaveBeenCalledWith(
                    expect.any(Function),
                    expect.objectContaining({
                        data: {
                            summaries: largeSessions,
                            uploadedSessionIds: [],
                        } satisfies ILogbookDialogData,
                    }),
                );
            });
        });

        describe("timing edge cases", (): void => {
            it("should handle component destruction during async operation", (): void => {
                component.openLogbook();

                fixture.destroy();

                expect((): void => {
                    sessionsSubject.next(mockSessionSummaries);
                }).not.toThrow();
            });

            it("should handle rapid method calls", (): void => {
                expect((): void => {
                    for (let i = 0; i < 10; i++) {
                        component.openLogbook();
                        component.startSession();
                    }
                }).not.toThrow();
            });
        });
    });
});
