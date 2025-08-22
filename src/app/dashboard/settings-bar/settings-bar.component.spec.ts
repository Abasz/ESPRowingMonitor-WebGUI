import "zone.js/plugins/zone-patch-rxjs-fake-async";
import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { DatePipe } from "@angular/common";
import { provideZonelessChangeDetection, signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatButtonHarness } from "@angular/material/button/testing";
import { MatDialog } from "@angular/material/dialog";
import { MatIconHarness } from "@angular/material/icon/testing";
import { MatToolbarHarness } from "@angular/material/toolbar/testing";
import { MatTooltipHarness } from "@angular/material/tooltip/testing";
import { BehaviorSubject } from "rxjs";

import { BleServiceFlag, LogLevel } from "../../../common/ble.interfaces";
import {
    HeartRateMonitorMode,
    IErgConnectionStatus,
    IHRConnectionStatus,
    IRowerSettings,
    ISessionSummary,
    StrokeDetectionType,
} from "../../../common/common.interfaces";
import { ConfigManagerService } from "../../../common/services/config-manager.service";
import { DataRecorderService } from "../../../common/services/data-recorder.service";
import { ErgConnectionService } from "../../../common/services/ergometer/erg-connection.service";
import { ErgGenericDataService } from "../../../common/services/ergometer/erg-generic-data.service";
import { ErgSettingsService } from "../../../common/services/ergometer/erg-settings.service";
import { HeartRateService } from "../../../common/services/heart-rate/heart-rate.service";
import { MetricsService } from "../../../common/services/metrics.service";
import { UtilsService } from "../../../common/services/utils.service";

import { SettingsBarComponent } from "./settings-bar.component";

describe("SettingsBarComponent", (): void => {
    let component: SettingsBarComponent;
    let fixture: ComponentFixture<SettingsBarComponent>;
    let loader: HarnessLoader;

    let mockMetricsService: jasmine.SpyObj<MetricsService>;
    let mockDataRecorderService: jasmine.SpyObj<DataRecorderService>;
    let mockErgConnectionService: jasmine.SpyObj<ErgConnectionService>;
    let mockErgGenericDataService: jasmine.SpyObj<ErgGenericDataService>;
    let mockErgSettingsService: jasmine.SpyObj<ErgSettingsService>;
    let mockMatDialog: jasmine.SpyObj<MatDialog>;
    let mockUtilsService: jasmine.SpyObj<UtilsService>;
    let mockConfigManagerService: jasmine.SpyObj<ConfigManagerService>;
    let mockHeartRateService: jasmine.SpyObj<HeartRateService>;

    let batteryLevelSubject: BehaviorSubject<number>;
    let ergConnectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let sessionsSubject: BehaviorSubject<Array<ISessionSummary>>;
    let heartRateMonitorModeSubject: BehaviorSubject<HeartRateMonitorMode>;
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
            distance: 5000,
            strokeCount: 150,
        },
    ];

    beforeEach(async (): Promise<void> => {
        batteryLevelSubject = new BehaviorSubject<number>(0);
        ergConnectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>(mockErgConnectionStatus);
        sessionsSubject = new BehaviorSubject<Array<ISessionSummary>>(mockSessionSummaries);
        heartRateMonitorModeSubject = new BehaviorSubject<HeartRateMonitorMode>("off");
        hrConnectionStatusSubject = new BehaviorSubject<IHRConnectionStatus>({
            status: "disconnected",
            deviceName: undefined,
        });
        mockRowerSettingsSignal = signal(mockRowerSettings);

        mockMetricsService = jasmine.createSpyObj("MetricsService", ["reset"], {
            hrConnectionStatus$: hrConnectionStatusSubject.asObservable(),
        });
        mockDataRecorderService = jasmine.createSpyObj("DataRecorderService", ["getSessionSummaries$"]);
        mockErgConnectionService = jasmine.createSpyObj("ErgConnectionService", ["connectionStatus$"]);
        mockErgGenericDataService = jasmine.createSpyObj("ErgGenericDataService", [
            "streamMonitorBatteryLevel$",
        ]);
        mockErgSettingsService = jasmine.createSpyObj("ErgSettingsService", [], {
            rowerSettings: mockRowerSettingsSignal,
        });
        mockMatDialog = jasmine.createSpyObj("MatDialog", ["open"]);
        mockUtilsService = jasmine.createSpyObj("UtilsService", ["mainSpinner"]);
        mockConfigManagerService = jasmine.createSpyObj("ConfigManagerService", [], {
            heartRateMonitorChanged$: heartRateMonitorModeSubject.asObservable(),
        });
        mockHeartRateService = jasmine.createSpyObj("HeartRateService", ["discover"]);

        mockDataRecorderService.getSessionSummaries$.and.returnValue(sessionsSubject.asObservable());
        mockErgConnectionService.connectionStatus$.and.returnValue(ergConnectionStatusSubject.asObservable());
        mockErgGenericDataService.streamMonitorBatteryLevel$.and.returnValue(
            batteryLevelSubject.asObservable(),
        );
        mockUtilsService.mainSpinner.and.returnValue({
            open: jasmine.createSpy("open"),
            close: jasmine.createSpy("close"),
        });

        await TestBed.configureTestingModule({
            imports: [SettingsBarComponent],
            providers: [
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                { provide: ErgGenericDataService, useValue: mockErgGenericDataService },
                { provide: ErgSettingsService, useValue: mockErgSettingsService },
                { provide: MatDialog, useValue: mockMatDialog },
                { provide: UtilsService, useValue: mockUtilsService },
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: HeartRateService, useValue: mockHeartRateService },
                provideZonelessChangeDetection(),
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
            fixture.detectChanges();
            expect(component.batteryLevel()).toBe(0);
        });

        it("should initialize ergConnectionStatus signal", (): void => {
            fixture.detectChanges();
            expect(component.ergConnectionStatus()).toEqual(mockErgConnectionStatus);
        });

        it("should initialize settings signal", (): void => {
            fixture.detectChanges();
            expect(component.settings()).toEqual(mockRowerSettings);
        });

        it("should initialize timeOfDay signal", (): void => {
            fixture.detectChanges();

            const timeOfDay = component.timeOfDay();

            expect(typeof timeOfDay === "number").toBe(true);
        });
    });

    describe("as part of template rendering", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

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

        it("should render reset button", async (): Promise<void> => {
            const buttons = await loader.getAllHarnesses(MatButtonHarness);
            const resetButton = await Promise.all(
                buttons.map(async (btn: MatButtonHarness): Promise<boolean> => {
                    try {
                        await btn.getHarness(MatIconHarness.with({ name: "laps" }));

                        return true;
                    } catch {
                        return false;
                    }
                }),
            );

            expect(resetButton.some(Boolean)).toBe(true);
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
                fixture.detectChanges();
            });

            it("should display BLE service name", (): void => {
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
                fixture.detectChanges();
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
        beforeEach((): void => {
            fixture.detectChanges();
        });

        it("should update when battery level changes", (): void => {
            expect(component.batteryLevel()).toBe(0);

            batteryLevelSubject.next(75);
            expect(component.batteryLevel()).toBe(75);
        });

        it("should display updated battery percentage in tooltip", async (): Promise<void> => {
            batteryLevelSubject.next(42);
            fixture.detectChanges();

            const tooltipHarness = await loader.getHarness(
                MatTooltipHarness.with({ selector: ".battery-level" }),
            );
            await tooltipHarness.show();
            const tooltipText = await tooltipHarness.getTooltipText();
            expect(tooltipText).toBe("42%");
        });

        it("should update battery icon via pipe", async (): Promise<void> => {
            batteryLevelSubject.next(25);
            fixture.detectChanges();

            const batteryIcon = fixture.nativeElement.querySelector(".battery-level");
            expect(batteryIcon.textContent?.trim()).toBeTruthy();
        });
    });

    describe("ergConnectionStatus signal", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

        it("should update when connection status changes", (): void => {
            expect(component.ergConnectionStatus()).toEqual(mockErgConnectionStatus);

            const newStatus: IErgConnectionStatus = {
                status: "connected",
                deviceName: "New Test Device",
            };
            ergConnectionStatusSubject.next(newStatus);
            expect(component.ergConnectionStatus()).toEqual(newStatus);
        });

        it("should show BLE service name when connected", (): void => {
            ergConnectionStatusSubject.next({
                status: "connected",
                deviceName: "Connected Device",
            });
            fixture.detectChanges();

            const textContent = fixture.nativeElement.textContent;
            expect(textContent).toContain("Fitness Machine");
        });

        it("should hide BLE service name when disconnected", (): void => {
            ergConnectionStatusSubject.next({
                status: "disconnected",
                deviceName: undefined,
            });
            fixture.detectChanges();

            const spans = fixture.nativeElement.querySelectorAll("span");
            const lastSpan = spans[spans.length - 3];
            expect(lastSpan.textContent?.trim()).toBe("");
        });
    });

    describe("settings signal", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

        it("should reflect current rower settings", (): void => {
            expect(component.settings()).toEqual(mockRowerSettings);
        });

        it("should update BLE service name display when settings change", (): void => {
            ergConnectionStatusSubject.next({
                status: "connected",
                deviceName: "Connected Device",
            });
            fixture.detectChanges();

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

            fixture.detectChanges();
            expect(fixture.nativeElement.textContent).toContain("Cycling Power");
        });
    });

    describe("timeOfDay signal", (): void => {
        it("should initialize with current time", (): void => {
            fixture.detectChanges();

            const timeOfDay = component.timeOfDay();

            expect(timeOfDay).toBeCloseTo(Date.now(), -3); // within 1 second
        });

        it("should display updated time in template", (): void => {
            // create a writable signal and assign it to the component via a typed unknown cast. This is a workaround for the interval() rxjs operator not emitting in a zoneless app (even in a fakeAsync)
            const datePipe = new DatePipe("en-US");
            const start = Date.now();
            const writable = signal(start);
            (component as unknown as { timeOfDay: WritableSignal<number> }).timeOfDay = writable;
            fixture.detectChanges();

            const initialDisplay: string = fixture.nativeElement.querySelector(".time-of-day").textContent;
            const formattedInitial = datePipe.transform(start, "HH:mm") as string;
            expect(initialDisplay.trim()).toBe(formattedInitial);

            const later = start + 61_000 * 2;
            writable.set(later);
            fixture.detectChanges();

            const updatedDisplay: string = fixture.nativeElement.querySelector(".time-of-day").textContent;
            const formattedLater = datePipe.transform(later, "HH:mm") as string;
            fixture.detectChanges();

            expect(updatedDisplay.trim()).toBe(formattedLater);
            expect(updatedDisplay).not.toBe(initialDisplay);
        });
    });

    describe("openLogbook method", (): void => {
        let mockSpinner: jasmine.SpyObj<{ open: jasmine.Spy; close: jasmine.Spy }>;

        beforeEach((): void => {
            fixture.detectChanges();
            mockSpinner = mockUtilsService.mainSpinner() as jasmine.SpyObj<{
                open: jasmine.Spy;
                close: jasmine.Spy;
            }>;
        });

        it("should open main spinner", (): void => {
            component.openLogbook();
            expect(mockSpinner.open).toHaveBeenCalled();
        });

        it("should call getSessionSummaries$", (): void => {
            component.openLogbook();
            expect(mockDataRecorderService.getSessionSummaries$).toHaveBeenCalled();
        });

        it("should close main spinner on success", (): void => {
            component.openLogbook();
            expect(mockSpinner.close).toHaveBeenCalled();
        });

        it("should open logbook dialog with correct data", (): void => {
            component.openLogbook();
            expect(mockMatDialog.open).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
                    data: mockSessionSummaries,
                }),
            );
        });

        it("should open dialog with correct configuration", (): void => {
            component.openLogbook();
            expect(mockMatDialog.open).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
                    autoFocus: false,
                    maxWidth: "95vw",
                }),
            );
        });

        it("should handle empty session summaries", (): void => {
            sessionsSubject.next([]);
            component.openLogbook();
            expect(mockMatDialog.open).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
                    data: [],
                }),
            );
        });

        it("should handle getSessionSummaries$ error", (): void => {
            mockDataRecorderService.getSessionSummaries$.and.throwError("Test error");
            expect((): void => component.openLogbook()).toThrow();
        });
    });

    describe("reset method", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

        it("should call metricsService reset", (): void => {
            component.reset();
            expect(mockMetricsService.reset).toHaveBeenCalled();
        });
    });

    describe("as part of user interactions", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

        describe("logbook button click", (): void => {
            it("should trigger openLogbook method", async (): Promise<void> => {
                spyOn(component, "openLogbook");

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

        describe("reset button click", (): void => {
            it("should trigger reset method", async (): Promise<void> => {
                spyOn(component, "reset");

                const button = await loader.getHarness(MatButtonHarness.with({ text: "laps" }));
                expect(button).not.toBeNull();

                await button.click();
                expect(component.reset).toHaveBeenCalled();
            });

            it("should have correct tooltip", async (): Promise<void> => {
                const button = await loader.getHarness(MatButtonHarness.with({ text: "laps" }));
                expect(button).not.toBeNull();

                const tooltip = await button.host();
                const tooltipText = await tooltip.getAttribute("matTooltip");
                expect(tooltipText).toBe("Reset");
            });
        });

        describe("battery level icon interaction", (): void => {
            it("should show battery percentage on hover", async (): Promise<void> => {
                batteryLevelSubject.next(73);
                fixture.detectChanges();

                const tooltipHarness = await loader.getHarness(
                    MatTooltipHarness.with({ selector: ".battery-level" }),
                );
                await tooltipHarness.show();
                const tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("73%");
            });

            it("should have correct tooltip delay", async (): Promise<void> => {
                const batteryIcon = fixture.nativeElement.querySelector(".battery-level");
                expect(batteryIcon).toBeTruthy();
                expect(batteryIcon.getAttribute("mattooltipshowdelay")).toBe("1000");
            });
        });
    });

    describe("as part of signal reactivity", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

        describe("multiple signal updates", (): void => {
            it("should handle simultaneous signal updates", (): void => {
                batteryLevelSubject.next(50);
                ergConnectionStatusSubject.next({
                    status: "connected",
                    deviceName: "Multi-test Device",
                });

                fixture.detectChanges();

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

                fixture.detectChanges();

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
            it("should handle null device name", (): void => {
                ergConnectionStatusSubject.next({
                    status: "connected",
                    deviceName: null as unknown as string,
                });
                fixture.detectChanges();

                expect(fixture.nativeElement.textContent).toContain("Fitness Machine");
            });

            it("should handle empty session summaries", (): void => {
                sessionsSubject.next([]);

                component.openLogbook();

                expect(mockMatDialog.open).toHaveBeenCalledWith(
                    jasmine.any(Function),
                    jasmine.objectContaining({
                        data: [],
                    }),
                );
            });
        });

        describe("extreme values", (): void => {
            it("should handle zero battery level", async (): Promise<void> => {
                batteryLevelSubject.next(0);
                fixture.detectChanges();

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
                fixture.detectChanges();

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
                        distance: index * 100,
                        strokeCount: index * 10,
                    }),
                );

                sessionsSubject.next(largeSessions);
                component.openLogbook();

                expect(mockMatDialog.open).toHaveBeenCalledWith(
                    jasmine.any(Function),
                    jasmine.objectContaining({
                        data: largeSessions,
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
                        component.reset();
                    }
                }).not.toThrow();
            });
        });
    });
});
