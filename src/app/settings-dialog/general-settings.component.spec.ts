import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { MatTooltipHarness } from "@angular/material/tooltip/testing";
import { SwUpdate } from "@angular/service-worker";
import { of } from "rxjs";

import { BleServiceFlag, IDeviceInformation, LogLevel } from "../../common/ble.interfaces";
import { IRowerSettings } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { FirmwareUpdateCheckerService } from "../../common/services/ergometer/firmware-update-checker.service";
import { OtaDialogComponent } from "../ota-settings-dialog/ota-dialog.component";

import { GeneralSettingsComponent } from "./general-settings.component";

describe("GeneralSettingsComponent", (): void => {
    let component: GeneralSettingsComponent;
    let fixture: ComponentFixture<GeneralSettingsComponent>;
    let loader: HarnessLoader;
    let mockConfigManagerService: jasmine.SpyObj<ConfigManagerService>;
    let mockSwUpdate: jasmine.SpyObj<SwUpdate>;
    let mockMatDialog: jasmine.SpyObj<MatDialog>;
    let mockFirmwareUpdateCheckerService: jasmine.SpyObj<FirmwareUpdateCheckerService>;

    const mockRowerSettings: IRowerSettings = {
        generalSettings: {
            logDeltaTimes: false,
            logToSdCard: true,
            bleServiceFlag: BleServiceFlag.CpsService,
            logLevel: LogLevel.Info,
            isRuntimeSettingsEnabled: true,
            isCompiledWithDouble: false,
        },
        rowingSettings: {
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
            strokeDetectionSettings: {
                strokeDetectionType: 0,
                impulseDataArrayLength: 500,
                minimumPoweredTorque: 10,
                minimumDragTorque: 1,
                minimumRecoverySlopeMargin: 0.05,
                minimumRecoverySlope: 0,
                minimumRecoveryTime: 200,
                minimumDriveTime: 300,
                driveHandleForcesMaxCapacity: 500,
            },
        },
    };

    const mockDeviceInfo: IDeviceInformation = {
        modelNumber: "Test Model",
        firmwareNumber: "1.0.0",
        manufacturerName: "Test Manufacturer",
        hardwareRevision: "Rev 1",
    };

    beforeEach(async (): Promise<void> => {
        mockConfigManagerService = jasmine.createSpyObj<ConfigManagerService>("ConfigManagerService", [
            "getItem",
        ]);
        mockConfigManagerService.getItem.and.returnValue("off");

        mockSwUpdate = jasmine.createSpyObj<SwUpdate>("SwUpdate", ["checkForUpdate"]);
        mockSwUpdate.checkForUpdate.and.resolveTo(false);

        mockMatDialog = jasmine.createSpyObj<MatDialog>("MatDialog", ["open"]);
        mockMatDialog.open.and.returnValue({
            afterClosed: jasmine.createSpy("afterClosed").and.returnValue(of(undefined)),
        } as unknown as ReturnType<MatDialog["open"]>);

        mockFirmwareUpdateCheckerService = jasmine.createSpyObj<FirmwareUpdateCheckerService>(
            "FirmwareUpdateCheckerService",
            ["checkForFirmwareUpdate", "isUpdateAvailable"],
        );
        mockFirmwareUpdateCheckerService.checkForFirmwareUpdate.and.resolveTo();
        mockFirmwareUpdateCheckerService.isUpdateAvailable.and.returnValue(undefined);

        await TestBed.configureTestingModule({
            imports: [GeneralSettingsComponent, ReactiveFormsModule],
            providers: [
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: SwUpdate, useValue: mockSwUpdate },
                { provide: MatDialog, useValue: mockMatDialog },
                { provide: FirmwareUpdateCheckerService, useValue: mockFirmwareUpdateCheckerService },
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GeneralSettingsComponent);
        component = fixture.componentInstance;
        loader = TestbedHarnessEnvironment.loader(fixture);

        fixture.componentRef.setInput("rowerSettings", mockRowerSettings);
        fixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
        fixture.componentRef.setInput("isConnected", true);
    });

    describe("as part of component creation", (): void => {
        it("should create component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize isGuiUpdateInProgress signal to false", (): void => {
            expect(component.isGuiUpdateInProgress()).toBe(false);
        });

        it("should have valid form by default", (): void => {
            expect(component.settingsForm.valid).toBe(true);
        });

        it("should expose enum types for template use", (): void => {
            expect(component.BleServiceFlag).toBe(BleServiceFlag);
            expect(component.LogLevel).toBe(LogLevel);
        });

        it("should have readonly compile date info", (): void => {
            expect(component.compileDate).toBeDefined();
            expect(component.compileDate instanceof Date).toBe(true);
        });

        it("should have access to firmware update checker service", (): void => {
            expect(component.firmwareUpdateCheckerService).toBeDefined();
            expect(component.firmwareUpdateCheckerService).toBe(mockFirmwareUpdateCheckerService);
        });
    });

    describe("as part of template rendering", (): void => {
        it("should display the compile date in the template", (): void => {
            fixture.detectChanges();
            const nativeElement = fixture.debugElement.nativeElement;
            const spans = nativeElement.querySelectorAll("span") as NodeListOf<HTMLSpanElement>;
            const guiVersionSpan = Array.from(spans).find(
                (el: HTMLSpanElement): boolean => !!el.textContent && el.textContent.includes("GUI Version:"),
            );
            expect(guiVersionSpan).toBeDefined();

            const compileDate = component.compileDate;
            const pad2 = (n: number): string => n.toString().padStart(2, "0");
            const expectedDate = compileDate
                ? `${pad2(compileDate.getFullYear() % 100)}${pad2(compileDate.getMonth() + 1)}${pad2(compileDate.getDate())}${pad2(compileDate.getHours())}${pad2(compileDate.getMinutes())}${pad2(compileDate.getSeconds())}`
                : "";

            expect(guiVersionSpan && guiVersionSpan.textContent).toContain(expectedDate);
        });

        describe("GUI software update button", (): void => {
            let guiUpdateDiv: HTMLDivElement;

            beforeEach((): void => {
                fixture.detectChanges();

                guiUpdateDiv = Array.from<HTMLSpanElement>(
                    fixture.nativeElement.querySelectorAll("div[versionInfo] > span"),
                ).filter((element: HTMLSpanElement): boolean =>
                    element.textContent.includes("GUI Version:"),
                )[0].parentElement as HTMLDivElement;
                guiUpdateDiv.setAttribute("data-test-gui-update", "1");
            });

            describe("when not checking for updates", (): void => {
                it("should display correct tooltip text", async (): Promise<void> => {
                    component.isGuiUpdateInProgress.set(false);
                    const tooltip = await loader.getHarness(
                        MatTooltipHarness.with({
                            ancestor: "[data-test-gui-update]",
                        }),
                    );

                    await tooltip.show();

                    expect(await tooltip.getTooltipText()).toBe("Check for update");
                });

                it("should not add rotating class to icon", (): void => {
                    component.isGuiUpdateInProgress.set(false);
                    fixture.detectChanges();

                    const refreshIcon = fixture.nativeElement.querySelector(
                        "div[versionInfo][data-test-gui-update] mat-icon",
                    );
                    expect(refreshIcon).toBeTruthy();
                    expect(refreshIcon.classList.contains("rotating")).toBe(false);
                });
            });

            describe("when update check is in progress", (): void => {
                it("should display correct tooltip text", async (): Promise<void> => {
                    component.isGuiUpdateInProgress.set(true);
                    fixture.detectChanges();

                    const tooltip = await loader.getHarness(
                        MatTooltipHarness.with({
                            ancestor: "[data-test-gui-update]",
                        }),
                    );

                    await tooltip.show();

                    expect(await tooltip.getTooltipText()).toBe("Checking for update");
                });

                it("should add rotating class to icon", (): void => {
                    component.isGuiUpdateInProgress.set(true);
                    fixture.detectChanges();

                    const refreshIcon = fixture.nativeElement.querySelector(
                        "div[versionInfo][data-test-gui-update] mat-icon",
                    );
                    expect(refreshIcon).toBeTruthy();
                    expect(refreshIcon.classList.contains("rotating")).toBe(true);
                });
            });

            it("should call checkForUpdates when GUI update button is clicked", (): void => {
                spyOn(component, "checkForUpdates");
                fixture.detectChanges();

                const guiUpdateButton = fixture.nativeElement.querySelector(
                    "div[versionInfo][data-test-gui-update] button",
                );
                guiUpdateButton.click();

                expect(component.checkForUpdates).toHaveBeenCalled();
            });

            it("should reactively update tooltip text when isGuiUpdateInProgress signal changes", async (): Promise<void> => {
                component.isGuiUpdateInProgress.set(false);
                fixture.detectChanges();

                const tooltip = await loader.getHarness(
                    MatTooltipHarness.with({
                        ancestor: "[data-test-gui-update]",
                    }),
                );

                await tooltip.show();

                expect(await tooltip.getTooltipText()).toBe("Check for update");

                component.isGuiUpdateInProgress.set(true);
                fixture.detectChanges();

                expect(await tooltip.getTooltipText()).toBe("Checking for update");

                component.isGuiUpdateInProgress.set(false);
                fixture.detectChanges();

                expect(await tooltip.getTooltipText()).toBe("Check for update");
            });

            it("should reactively update icon rotation when isGuiUpdateInProgress signal changes", (): void => {
                component.isGuiUpdateInProgress.set(false);
                fixture.detectChanges();

                let refreshIcon = fixture.nativeElement.querySelector(
                    "div[versionInfo][data-test-gui-update] mat-icon",
                );
                expect(refreshIcon.classList.contains("rotating"))
                    .withContext("progress is false")
                    .toBe(false);

                component.isGuiUpdateInProgress.set(true);
                fixture.detectChanges();

                refreshIcon = fixture.nativeElement.querySelector(
                    "div[versionInfo][data-test-gui-update] mat-icon",
                );
                expect(refreshIcon.classList.contains("rotating")).withContext("progress is true").toBe(true);

                component.isGuiUpdateInProgress.set(false);
                fixture.detectChanges();

                refreshIcon = fixture.nativeElement.querySelector(
                    "div[versionInfo][data-test-gui-update] mat-icon",
                );
                expect(refreshIcon.classList.contains("rotating"))
                    .withContext("progress is false again")
                    .toBe(false);
            });
        });

        describe("firmware upload button", (): void => {
            it("should be enabled when connected", (): void => {
                fixture.componentRef.setInput("isConnected", true);
                fixture.detectChanges();

                const btns = Array.from(
                    fixture.debugElement.nativeElement.querySelectorAll(
                        "button.small-icon-button[mat-icon-button]",
                    ),
                ) as Array<HTMLElement>;
                const uploadBtn = btns.find(
                    (btn: HTMLElement): boolean =>
                        btn.querySelector("mat-icon")?.textContent?.trim() === "upload_file",
                );

                expect(uploadBtn).toBeDefined();
                if (uploadBtn) {
                    expect((uploadBtn as HTMLButtonElement).disabled).toBe(false);
                }
            });

            it("should be hidden when not connected", (): void => {
                fixture.componentRef.setInput("isConnected", false);
                fixture.detectChanges();

                const btns = Array.from(
                    fixture.debugElement.nativeElement.querySelectorAll(
                        "button.small-icon-button[mat-icon-button]",
                    ),
                ) as Array<HTMLElement>;
                const uploadBtn = btns.find(
                    (btn: HTMLElement): boolean =>
                        btn.querySelector("mat-icon")?.textContent?.trim() === "upload_file",
                );

                expect(uploadBtn).toBeUndefined();
            });
        });

        describe("firmware update button", (): void => {
            it("should call checkForFirmwareUpdate when clicked", (): void => {
                mockFirmwareUpdateCheckerService.isUpdateAvailable.and.returnValue(false);
                fixture.componentRef.setInput("isConnected", true);
                fixture.detectChanges();

                const refreshButton: HTMLButtonElement | undefined = Array.from<HTMLButtonElement>(
                    fixture.nativeElement.querySelectorAll(".erg-info button mat-icon"),
                ).filter((btn: HTMLButtonElement): boolean => btn.textContent === "refresh")[0];

                expect(refreshButton).toBeDefined();
                refreshButton?.click();

                expect(mockFirmwareUpdateCheckerService.checkForFirmwareUpdate).toHaveBeenCalled();
            });

            it("should display firmware update link when an update is available", (): void => {
                mockFirmwareUpdateCheckerService.isUpdateAvailable.and.returnValue(true);
                fixture.componentRef.setInput("isConnected", true);
                fixture.detectChanges();

                const firmwareUpdateButton: HTMLAnchorElement | undefined =
                    fixture.nativeElement.querySelector(".erg-info a");

                expect(firmwareUpdateButton).toBeTruthy();
                expect(firmwareUpdateButton?.getAttribute("href")).toBe(
                    FirmwareUpdateCheckerService.FIRMWARE_RELEASE_URL,
                );

                const refreshButton = Array.from<HTMLButtonElement>(
                    fixture.nativeElement.querySelector(
                        "div.erg-info button.small-icon-button[mat-icon-button]",
                    ) as NodeListOf<HTMLButtonElement>,
                ).filter(
                    (btn: HTMLButtonElement): boolean =>
                        btn.querySelector("mat-icon")?.textContent?.trim() === "refresh",
                );
                expect(refreshButton.length).toBe(0);
            });

            describe("should show rotating icon", (): void => {
                it("when update check is in progress at initial open", (): void => {
                    mockFirmwareUpdateCheckerService.isUpdateAvailable.and.returnValue(undefined);

                    fixture.componentRef.setInput("isConnected", true);
                    fixture.detectChanges();

                    const refreshIcon = fixture.nativeElement.querySelector('mat-icon[class*="rotating"]');
                    expect(refreshIcon).toBeTruthy();
                });

                it("when update firmware button is clicked", (): void => {
                    mockFirmwareUpdateCheckerService.isUpdateAvailable.and.returnValue(false);
                    mockFirmwareUpdateCheckerService.checkForFirmwareUpdate.and.callFake(
                        (): Promise<void> => {
                            mockFirmwareUpdateCheckerService.isUpdateAvailable.and.returnValue(undefined);

                            return Promise.resolve();
                        },
                    );

                    fixture.componentRef.setInput("isConnected", true);
                    fixture.detectChanges();
                    const refreshButton =
                        fixture.nativeElement.querySelectorAll("button.small-icon-button")[1];
                    refreshButton.click();

                    fixture.detectChanges();

                    const refreshIcon = fixture.nativeElement.querySelector('mat-icon[class*="rotating"]');
                    expect(refreshIcon).toBeTruthy();
                });
            });

            it("should not show rotating icon when not checking for updates", (): void => {
                mockFirmwareUpdateCheckerService.isUpdateAvailable.and.returnValue(false);

                fixture.componentRef.setInput("isConnected", true);
                fixture.detectChanges();

                const refreshIcon = fixture.nativeElement.querySelector("mat-icon.rotating");
                expect(refreshIcon).toBeFalsy();
            });

            it("should enable firmware update button when connected", (): void => {
                fixture.componentRef.setInput("isConnected", true);
                fixture.detectChanges();

                const firmwareUpdateButton: Array<HTMLButtonElement> = Array.from<HTMLButtonElement>(
                    fixture.nativeElement.querySelectorAll(".erg-info button mat-icon"),
                ).filter((btn: HTMLButtonElement): boolean => btn.textContent === "refresh");

                expect(firmwareUpdateButton.length).toBe(1);
            });

            it("should hide firmware update button when not connected", (): void => {
                fixture.componentRef.setInput("isConnected", false);
                fixture.detectChanges();

                const firmwareUpdateButton: Array<HTMLButtonElement> = Array.from<HTMLButtonElement>(
                    fixture.nativeElement.querySelectorAll(".erg-info button mat-icon"),
                ).filter((btn: HTMLButtonElement): boolean => btn.textContent === "refresh");

                expect(firmwareUpdateButton.length).toBe(0);
            });
        });

        describe("hardware revision display", (): void => {
            it("should show hardware revision span when hardwareRevision is defined", (): void => {
                fixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                fixture.detectChanges();

                const spans = fixture.nativeElement.querySelectorAll(
                    ".erg-info span",
                ) as NodeListOf<HTMLSpanElement>;
                const hardwareSpan = Array.from(spans).find(
                    (el: HTMLSpanElement): boolean =>
                        !!el.textContent && el.textContent.includes("Hardware:"),
                );

                expect(hardwareSpan).toBeDefined();
                expect(hardwareSpan?.textContent).toContain("Hardware: Rev 1");
            });

            it("should hide hardware revision span when hardwareRevision is undefined", (): void => {
                const deviceInfoWithoutHardware: IDeviceInformation = {
                    ...mockDeviceInfo,
                    hardwareRevision: undefined,
                };

                fixture.componentRef.setInput("deviceInfo", deviceInfoWithoutHardware);
                fixture.detectChanges();

                const spans = fixture.nativeElement.querySelectorAll(
                    ".erg-info span",
                ) as NodeListOf<HTMLSpanElement>;
                const hardwareSpan = Array.from(spans).find(
                    (el: HTMLSpanElement): boolean =>
                        !!el.textContent && el.textContent.includes("Hardware:"),
                );

                expect(hardwareSpan).toBeUndefined();
            });

            it("should hide hardware revision span when hardwareRevision is empty string", (): void => {
                const deviceInfoWithEmptyHardware: IDeviceInformation = {
                    ...mockDeviceInfo,
                    hardwareRevision: "",
                };

                fixture.componentRef.setInput("deviceInfo", deviceInfoWithEmptyHardware);
                fixture.detectChanges();

                const spans = fixture.nativeElement.querySelectorAll(
                    ".erg-info span",
                ) as NodeListOf<HTMLSpanElement>;
                const hardwareSpan = Array.from(spans).find(
                    (el: HTMLSpanElement): boolean =>
                        !!el.textContent && el.textContent.includes("Hardware:"),
                );

                expect(hardwareSpan).toBeUndefined();
            });
        });
    });

    describe("as part of form initialization", (): void => {
        it("should initialize form with correct default values from rowerSettings", (): void => {
            fixture.detectChanges();

            expect(component.settingsForm.value.bleMode).toBe(BleServiceFlag.CpsService);
            expect(component.settingsForm.value.logLevel).toBe(LogLevel.Info);
            expect(component.settingsForm.value.deltaTimeLogging).toBe(false);
            expect(component.settingsForm.value.logToSdCard).toBe(true);
            expect(component.settingsForm.value.heartRateMonitor).toBe("off");
        });

        it("should emit form validity on initialization", (): void => {
            spyOn(component.isFormValidChange, "emit");

            fixture.detectChanges();

            expect(component.isFormValidChange.emit).toHaveBeenCalledWith(true);
        });

        it("should retrieve heart rate monitor setting from ConfigManager", (): void => {
            mockConfigManagerService.getItem.and.returnValue("ble");

            component.ngOnInit();

            expect(mockConfigManagerService.getItem).toHaveBeenCalledWith("heartRateMonitor");
            expect(component.settingsForm.value.heartRateMonitor).toBe("ble");
        });
    });

    describe("as part of form validation", (): void => {
        it("should validate bleMode field", (): void => {
            const bleModeControl = component.settingsForm.controls.bleMode;

            bleModeControl.setValue(BleServiceFlag.CpsService);
            fixture.detectChanges();

            expect(bleModeControl.valid).toBe(true);

            bleModeControl.setValue(BleServiceFlag.FtmsService);
            fixture.detectChanges();

            expect(bleModeControl.valid).toBe(true);
        });

        it("should validate logLevel field", (): void => {
            const logLevelControl = component.settingsForm.controls.logLevel;

            logLevelControl.setValue(LogLevel.Silent);
            fixture.detectChanges();

            expect(logLevelControl.valid).toBe(true);

            logLevelControl.setValue(LogLevel.Verbose);
            fixture.detectChanges();

            expect(logLevelControl.valid).toBe(true);
        });

        it("should validate heartRateMonitor field", (): void => {
            const heartRateControl = component.settingsForm.controls.heartRateMonitor;

            heartRateControl.setValue("off");
            expect(heartRateControl.valid).toBe(true);

            heartRateControl.setValue("ble");
            expect(heartRateControl.valid).toBe(true);

            heartRateControl.setValue("ant");
            expect(heartRateControl.valid).toBe(true);
        });

        it("should update form validity when form value changes", (): void => {
            fixture.detectChanges();
            spyOn(component.isFormValidChange, "emit");

            component.settingsForm.controls.bleMode.setValue(BleServiceFlag.FtmsService);
            fixture.detectChanges();

            expect(component.isFormValidChange.emit).toHaveBeenCalledWith(true);
        });

        it("should emit false when form becomes invalid", (): void => {
            fixture.detectChanges();
            spyOn(component.isFormValidChange, "emit");
            component.settingsForm.controls.logLevel.setValue(10 as unknown as LogLevel);

            fixture.detectChanges();

            expect(component.isFormValidChange.emit).toHaveBeenCalledWith(false);
        });
    });

    describe("as part of form state management", (): void => {
        it("should handle form value changes correctly", (): void => {
            const newSettings = {
                ...mockRowerSettings,
                generalSettings: {
                    ...mockRowerSettings.generalSettings,
                    bleServiceFlag: BleServiceFlag.FtmsService,
                    logLevel: LogLevel.Verbose,
                },
            };

            fixture.componentRef.setInput("rowerSettings", newSettings);

            fixture.detectChanges();

            expect(component.settingsForm.value.bleMode).toBe(BleServiceFlag.FtmsService);
            expect(component.settingsForm.value.logLevel).toBe(LogLevel.Verbose);
        });

        it("before ngOnInit should have all controls disabled apart from heartRateMonitor", (): void => {
            const controls = component.settingsForm.controls;
            const keys: Array<keyof typeof controls> = [
                "bleMode",
                "logLevel",
                "deltaTimeLogging",
                "logToSdCard",
            ];
            for (const key of keys) {
                expect(controls[key].disabled).withContext(`${key} should be disabled`).toBe(true);
            }
            expect(controls.heartRateMonitor.disabled).toBe(false);
        });

        describe("after ngOnInit", (): void => {
            it("should always enable heartRateMonitor control", (): void => {
                fixture.componentRef.setInput("isConnected", false);
                fixture.componentRef.setInput("rowerSettings", mockRowerSettings);

                fixture.detectChanges();

                expect(component.settingsForm.controls.heartRateMonitor.enabled).toBe(true);
            });

            describe("when connected", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("isConnected", true);
                    fixture.componentRef.setInput("rowerSettings", mockRowerSettings);

                    fixture.detectChanges();
                });

                it("should enable controls with defined values", (): void => {
                    expect(component.settingsForm.controls.logToSdCard.enabled).toBe(true);
                    expect(component.settingsForm.controls.deltaTimeLogging.enabled).toBe(true);
                    expect(component.settingsForm.controls.bleMode.enabled).toBe(true);
                    expect(component.settingsForm.controls.logLevel.enabled).toBe(true);
                });

                it("should disable controls with undefined values", (): void => {
                    const settingsWithUndefined = {
                        ...mockRowerSettings,
                        generalSettings: {
                            ...mockRowerSettings.generalSettings,
                            logToSdCard: undefined,
                            logDeltaTimes: undefined,
                        },
                    };
                    fixture.componentRef.setInput("rowerSettings", settingsWithUndefined);
                    component.ngOnInit();
                    expect(component.settingsForm.controls.logToSdCard.disabled).toBe(true);
                    expect(component.settingsForm.controls.deltaTimeLogging.disabled).toBe(true);
                });
            });

            describe("when not connected", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("isConnected", false);
                    fixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                    fixture.detectChanges();
                });

                it("should disable all controls except heartRateMonitor", (): void => {
                    const controls = component.settingsForm.controls;
                    const keys: Array<keyof typeof controls> = [
                        "bleMode",
                        "logLevel",
                        "heartRateMonitor",
                        "deltaTimeLogging",
                        "logToSdCard",
                    ];
                    for (const key of keys) {
                        if (key === "heartRateMonitor") {
                            expect(controls[key].enabled).withContext(`${key} should be enabled`).toBe(true);
                        } else {
                            expect(controls[key].disabled)
                                .withContext(`${key} should be disabled`)
                                .toBe(true);
                        }
                    }
                });
            });
        });
    });

    describe("checkForUpdates method", (): void => {
        it("should exist and be callable", async (): Promise<void> => {
            expect(component.checkForUpdates).toBeDefined();
            await expectAsync(component.checkForUpdates()).not.toBeRejected();
        });

        it("should not call swUpdate.checkForUpdate in development mode", async (): Promise<void> => {
            (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = true;

            await component.checkForUpdates();

            expect(mockSwUpdate.checkForUpdate).not.toHaveBeenCalled();
            expect(component.isGuiUpdateInProgress()).toBe(false);
        });

        describe("when in production mode", (): void => {
            beforeEach((): void => {
                (globalThis as unknown as { ngDevMode: boolean }).ngDevMode = false;
            });

            it("should set isGuiUpdateInProgress to true before checking for updates", async (): Promise<void> => {
                expect(component.isGuiUpdateInProgress()).toBe(false);

                const checkPromise = component.checkForUpdates();
                expect(component.isGuiUpdateInProgress()).toBe(true);

                await checkPromise;
                expect(component.isGuiUpdateInProgress()).toBe(false);
                expect(mockSwUpdate.checkForUpdate).toHaveBeenCalled();
            });

            it("should set isGuiUpdateInProgress to false after update check completes", async (): Promise<void> => {
                mockSwUpdate.checkForUpdate.and.resolveTo(true);

                await component.checkForUpdates();

                expect(component.isGuiUpdateInProgress()).toBe(false);
                expect(mockSwUpdate.checkForUpdate).toHaveBeenCalled();
            });

            it("should return early if update is already in progress", async (): Promise<void> => {
                component.isGuiUpdateInProgress.set(true);

                await component.checkForUpdates();

                expect(mockSwUpdate.checkForUpdate).not.toHaveBeenCalled();
                expect(component.isGuiUpdateInProgress()).toBe(true);
            });

            it("should reset isGuiUpdateInProgress even if update check fails", async (): Promise<void> => {
                mockSwUpdate.checkForUpdate.and.rejectWith(new Error("Update check failed"));

                await expectAsync(component.checkForUpdates()).toBeRejected();
                expect(component.isGuiUpdateInProgress()).toBe(false);
            });
        });
    });

    describe("otaUpdate method", (): void => {
        const createInputWithFiles = (files: Array<File> | null): HTMLInputElement => {
            const input = document.createElement("input");
            Object.defineProperty(input, "files", {
                value: files
                    ? {
                          0: files[0],
                          length: files.length,
                          item: (i: number): File => files[i],
                          [Symbol.iterator]: function* (): IterableIterator<File> {
                              for (let i = 0; i < files.length; i++) yield files[i];
                          },
                      }
                    : null,
                writable: true,
            });

            return input;
        };

        it("should open OTA dialog when file is provided", async (): Promise<void> => {
            const mockFile = new File(["test content"], "firmware.bin", {
                type: "application/octet-stream",
            });
            const input = createInputWithFiles([mockFile]);
            const mockEvent = { currentTarget: input } as unknown as Event;

            await component.otaUpdate(mockEvent);

            expect(mockMatDialog.open).toHaveBeenCalledWith(OtaDialogComponent, {
                autoFocus: false,
                disableClose: true,
                data: {
                    firmwareSize: mockFile.size / 1000,
                    file: mockFile,
                },
            });
        });

        it("should return early when no files provided", async (): Promise<void> => {
            const input = createInputWithFiles(null);
            const mockEvent = { currentTarget: input } as unknown as Event;

            await component.otaUpdate(mockEvent);

            expect(mockMatDialog.open).not.toHaveBeenCalled();
        });

        it("should handle large file sizes correctly", async (): Promise<void> => {
            const largeFile = new File(["x".repeat(2000000)], "large-firmware.bin");
            const input = createInputWithFiles([largeFile]);
            const mockEvent = { currentTarget: input } as unknown as Event;

            await component.otaUpdate(mockEvent);

            expect(mockMatDialog.open).toHaveBeenCalledWith(OtaDialogComponent, {
                autoFocus: false,
                disableClose: true,
                data: {
                    firmwareSize: largeFile.size / 1000,
                    file: largeFile,
                },
            });
        });
    });

    describe("as part of edge cases & robustness handling", (): void => {
        it("should handle otaUpdate with invalid input element", async (): Promise<void> => {
            const mockEvent = {
                currentTarget: null,
            } as Event;

            await component.otaUpdate(mockEvent);

            expect(mockMatDialog.open).not.toHaveBeenCalled();
        });

        it("should handle otaUpdate with non-HTMLInputElement", async (): Promise<void> => {
            const mockEvent = {
                currentTarget: document.createElement("div"),
            } as unknown as Event;

            await component.otaUpdate(mockEvent);

            expect(mockMatDialog.open).not.toHaveBeenCalled();
        });
    });
});
