import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { MatButtonToggleGroupHarness, MatButtonToggleHarness } from "@angular/material/button-toggle/testing";
import { MatOptionHarness } from "@angular/material/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectHarness } from "@angular/material/select/testing";
import { MatTooltipHarness } from "@angular/material/tooltip/testing";
import { SwUpdate } from "@angular/service-worker";
import { of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BleServiceFlag, IDeviceInformation, LogLevel } from "../../../../common/ble.interfaces";
import { Config, IRowerSettings } from "../../../../common/common.interfaces";
import { ConfigManagerService } from "../../../../common/services/config-manager.service";
import { FirmwareUpdateManagerService } from "../../../../common/services/ergometer/firmware-update-manager.service";
import { deepMerge } from "../../../../common/utils/utility.functions";
import { OtaDialogComponent } from "../../ota-settings-dialog/ota-dialog.component";

import { GeneralSettingsComponent } from "./general-settings.component";

describe("GeneralSettingsComponent", (): void => {
    let component: GeneralSettingsComponent;
    let fixture: ComponentFixture<GeneralSettingsComponent>;
    let mockConfigManagerService: Pick<ConfigManagerService, "getGroup">;
    let mockSwUpdate: Pick<SwUpdate, "checkForUpdate" | "isEnabled">;
    let mockMatDialog: Pick<MatDialog, "open">;
    let mockFirmwareUpdateManagerService: Pick<
        FirmwareUpdateManagerService,
        "openFirmwareSelector" | "isUpdateAvailable"
    >;

    let isUpdateAvailableSignal: WritableSignal<undefined | boolean>;

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
        mockConfigManagerService = {
            getGroup: vi.fn(),
        };
        vi.mocked(mockConfigManagerService.getGroup).mockReturnValue(new Config().general);

        mockSwUpdate = {
            checkForUpdate: vi.fn(),
            isEnabled: true,
        };
        vi.mocked(mockSwUpdate.checkForUpdate).mockResolvedValue(false);

        mockMatDialog = {
            open: vi.fn(),
        };
        vi.mocked(mockMatDialog.open).mockReturnValue({
            afterClosed: vi.fn().mockReturnValue(of(undefined)),
        } as unknown as ReturnType<MatDialog["open"]>);

        isUpdateAvailableSignal = signal<undefined | boolean>(undefined);
        mockFirmwareUpdateManagerService = {
            openFirmwareSelector: vi.fn(),
            isUpdateAvailable: isUpdateAvailableSignal,
        };

        await TestBed.configureTestingModule({
            imports: [GeneralSettingsComponent, ReactiveFormsModule],
            providers: [
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: SwUpdate, useValue: mockSwUpdate },
                { provide: MatDialog, useValue: mockMatDialog },
                { provide: FirmwareUpdateManagerService, useValue: mockFirmwareUpdateManagerService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GeneralSettingsComponent);
        component = fixture.componentInstance;

        fixture.componentRef.setInput("rowerSettings", mockRowerSettings);
        fixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
        fixture.componentRef.setInput("isConnected", true);
        // do not call whenStable here because some tests rely on ngOnInit not having been called yet
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

        it("should have access to firmware update manager service", (): void => {
            expect(component.firmwareUpdateManagerService).toBeDefined();
            expect(component.firmwareUpdateManagerService).toBe(mockFirmwareUpdateManagerService);
        });

        it("should set isServiceWorkerAvailable based on navigator", (): void => {
            expect(component.isServiceWorkerAvailable).toBe(
                "serviceWorker" in navigator && !!navigator.serviceWorker,
            );
        });
    });

    describe("as part of template rendering", (): void => {
        it("should display the compile date in the template", async (): Promise<void> => {
            await fixture.whenStable();
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
            describe("when service worker is not available", (): void => {
                let localFixture: ComponentFixture<GeneralSettingsComponent>;

                beforeEach(async (): Promise<void> => {
                    vi.spyOn(navigator, "serviceWorker", "get").mockReturnValue(
                        undefined as unknown as ServiceWorkerContainer,
                    );

                    localFixture = TestBed.createComponent(GeneralSettingsComponent);
                    localFixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                    localFixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                    localFixture.componentRef.setInput("isConnected", true);
                    await localFixture.whenStable();
                });

                afterEach((): void => {
                    vi.restoreAllMocks();
                });

                it("should not display the update button", (): void => {
                    const guiUpdateButton = localFixture.nativeElement.querySelector(
                        "div.tab-content > div[versionInfo] button mat-icon",
                    );

                    expect(guiUpdateButton).toBeNull();
                });

                it("should still display GUI version text", (): void => {
                    const guiVersionSpan = Array.from<HTMLSpanElement>(
                        localFixture.nativeElement.querySelectorAll("div[versionInfo] > span"),
                    ).find((element: HTMLSpanElement): boolean =>
                        element.textContent.includes("GUI Version:"),
                    );

                    expect(guiVersionSpan).toBeTruthy();
                });

                it("should have isServiceWorkerAvailable set to false", (): void => {
                    expect(localFixture.componentInstance.isServiceWorkerAvailable).toBe(false);
                });
            });

            describe("when service worker is available", (): void => {
                let localFixture: ComponentFixture<GeneralSettingsComponent>;
                let localLoader: HarnessLoader;
                let guiUpdateDiv: HTMLDivElement;

                beforeEach(async (): Promise<void> => {
                    vi.spyOn(navigator, "serviceWorker", "get").mockReturnValue(
                        {} as unknown as ServiceWorkerContainer,
                    );

                    localFixture = TestBed.createComponent(GeneralSettingsComponent);
                    localLoader = TestbedHarnessEnvironment.loader(localFixture);
                    localFixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                    localFixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                    localFixture.componentRef.setInput("isConnected", true);
                    await localFixture.whenStable();

                    guiUpdateDiv = Array.from<HTMLSpanElement>(
                        localFixture.nativeElement.querySelectorAll("div[versionInfo] > span"),
                    ).filter((element: HTMLSpanElement): boolean =>
                        element.textContent.includes("GUI Version:"),
                    )[0].parentElement as HTMLDivElement;
                    guiUpdateDiv.setAttribute("data-test-gui-update", "1");
                });

                afterEach((): void => {
                    vi.restoreAllMocks();
                });

                describe("when not checking for updates", (): void => {
                    it("should display correct tooltip text", async (): Promise<void> => {
                        localFixture.componentInstance.isGuiUpdateInProgress.set(false);

                        const tooltip = await localLoader.getHarness(
                            MatTooltipHarness.with({
                                ancestor: "[data-test-gui-update]",
                            }),
                        );

                        await tooltip.show();

                        expect(await tooltip.getTooltipText()).toBe("Check for update");
                    });

                    it("should not add rotating class to icon", (): void => {
                        localFixture.componentInstance.isGuiUpdateInProgress.set(false);

                        const refreshIcon = localFixture.nativeElement.querySelector(
                            "div[versionInfo][data-test-gui-update] mat-icon",
                        );

                        expect(refreshIcon).toBeTruthy();
                        expect(refreshIcon.classList.contains("rotating")).toBe(false);
                    });
                });

                describe("when update check is in progress", (): void => {
                    it("should display correct tooltip text", async (): Promise<void> => {
                        localFixture.componentInstance.isGuiUpdateInProgress.set(true);

                        const tooltip = await localLoader.getHarness(
                            MatTooltipHarness.with({
                                ancestor: "[data-test-gui-update]",
                            }),
                        );

                        await tooltip.show();

                        expect(await tooltip.getTooltipText()).toBe("Checking for update");
                    });

                    it("should add rotating class to icon", async (): Promise<void> => {
                        localFixture.componentInstance.isGuiUpdateInProgress.set(true);
                        await localFixture.whenStable();

                        const refreshIcon = localFixture.nativeElement.querySelector(
                            "div[versionInfo][data-test-gui-update] mat-icon",
                        );

                        expect(refreshIcon).toBeTruthy();
                        expect(refreshIcon.classList.contains("rotating")).toBe(true);
                    });
                });

                it("should call checkForUpdates when GUI update button is clicked", (): void => {
                    vi.spyOn(localFixture.componentInstance, "checkForUpdates");

                    const guiUpdateButton = localFixture.nativeElement.querySelector(
                        "div[versionInfo][data-test-gui-update] button",
                    );
                    guiUpdateButton.click();

                    expect(localFixture.componentInstance.checkForUpdates).toHaveBeenCalled();
                });

                it("should reactively update tooltip text when isGuiUpdateInProgress signal changes", async (): Promise<void> => {
                    localFixture.componentInstance.isGuiUpdateInProgress.set(false);

                    const tooltip = await localLoader.getHarness(
                        MatTooltipHarness.with({
                            ancestor: "[data-test-gui-update]",
                        }),
                    );

                    await tooltip.show();

                    expect(await tooltip.getTooltipText()).toBe("Check for update");

                    localFixture.componentInstance.isGuiUpdateInProgress.set(true);

                    expect(await tooltip.getTooltipText()).toBe("Checking for update");

                    localFixture.componentInstance.isGuiUpdateInProgress.set(false);

                    expect(await tooltip.getTooltipText()).toBe("Check for update");
                });

                it("should reactively update icon rotation when isGuiUpdateInProgress signal changes", async (): Promise<void> => {
                    localFixture.componentInstance.isGuiUpdateInProgress.set(false);

                    let refreshIcon = localFixture.nativeElement.querySelector(
                        "div[versionInfo][data-test-gui-update] mat-icon",
                    );
                    expect(refreshIcon.classList.contains("rotating"), "progress is false").toBe(false);

                    localFixture.componentInstance.isGuiUpdateInProgress.set(true);
                    await localFixture.whenStable();

                    refreshIcon = localFixture.nativeElement.querySelector(
                        "div[versionInfo][data-test-gui-update] mat-icon",
                    );
                    expect(refreshIcon.classList.contains("rotating"), "progress is true").toBe(true);

                    localFixture.componentInstance.isGuiUpdateInProgress.set(false);
                    await localFixture.whenStable();

                    refreshIcon = localFixture.nativeElement.querySelector(
                        "div[versionInfo][data-test-gui-update] mat-icon",
                    );
                    expect(refreshIcon.classList.contains("rotating"), "progress is false again").toBe(false);
                });
            });
        });

        describe("firmware upload button", (): void => {
            it("should be enabled when connected", async (): Promise<void> => {
                fixture.componentRef.setInput("isConnected", true);
                await fixture.whenStable();

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

            it("should be hidden when not connected", async (): Promise<void> => {
                fixture.componentRef.setInput("isConnected", false);
                await fixture.whenStable();

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
            describe("when update is available for custom hardware", (): void => {
                beforeEach(async (): Promise<void> => {
                    isUpdateAvailableSignal.set(true);
                    fixture.componentRef.setInput("deviceInfo", {
                        ...mockDeviceInfo,
                        hardwareRevision: "custom",
                    });
                    fixture.componentRef.setInput("isConnected", true);
                    await fixture.whenStable();
                });

                it("should display firmware update link with deployed_code_update icon", (): void => {
                    const firmwareUpdateLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
                        ".erg-info a[mat-icon-button]",
                    );

                    expect(firmwareUpdateLink).toBeTruthy();
                    expect(firmwareUpdateLink?.getAttribute("href")).toBe(
                        FirmwareUpdateManagerService.FIRMWARE_RELEASE_URL,
                    );
                    expect(firmwareUpdateLink?.querySelector("mat-icon")?.textContent?.trim()).toBe(
                        "deployed_code_update",
                    );
                });

                it("should not show refresh button", (): void => {
                    const refreshButton = Array.from<HTMLElement>(
                        fixture.nativeElement.querySelectorAll(".erg-info button mat-icon"),
                    ).filter((icon: HTMLElement): boolean => icon.textContent?.trim() === "refresh");

                    expect(refreshButton.length).toBe(0);
                });
            });

            describe("when update is available for supported hardware", (): void => {
                beforeEach(async (): Promise<void> => {
                    isUpdateAvailableSignal.set(true);
                    fixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                    fixture.componentRef.setInput("isConnected", true);
                    await fixture.whenStable();
                });

                it("should display update button with deployed_code_update icon", (): void => {
                    const updateIcon = Array.from<HTMLElement>(
                        fixture.nativeElement.querySelectorAll(".erg-info button mat-icon"),
                    ).find(
                        (icon: HTMLElement): boolean => icon.textContent?.trim() === "deployed_code_update",
                    );

                    expect(updateIcon).toBeTruthy();
                });

                it("should call onFirmwareUpdateClick when update button is clicked", (): void => {
                    vi.spyOn(component, "onFirmwareUpdateClick");

                    const updateButton: HTMLButtonElement | null = Array.from<HTMLElement>(
                        fixture.nativeElement.querySelectorAll(".erg-info button mat-icon"),
                    ).filter(
                        (icon: HTMLElement): boolean => icon.textContent?.trim() === "deployed_code_update",
                    )[0].parentElement as HTMLButtonElement;

                    updateButton?.click();

                    expect(component.onFirmwareUpdateClick).toHaveBeenCalled();
                });

                it("should not show GitHub link", (): void => {
                    const githubLink = fixture.nativeElement.querySelector(".erg-info a[mat-icon-button]");

                    expect(githubLink).toBeFalsy();
                });
            });

            describe("when no update is available for supported hardware", (): void => {
                beforeEach(async (): Promise<void> => {
                    isUpdateAvailableSignal.set(false);
                    fixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                    fixture.componentRef.setInput("isConnected", true);
                    await fixture.whenStable();
                });

                it("should display reflash button with compare_arrows icon", (): void => {
                    const reflashButton = Array.from<HTMLElement>(
                        fixture.nativeElement.querySelectorAll(".erg-info button mat-icon"),
                    ).filter((icon: HTMLElement): boolean => icon.textContent?.trim() === "compare_arrows");

                    expect(reflashButton.length).toBeGreaterThan(0);
                });

                it("should call onFirmwareUpdateClick when reflash button is clicked", (): void => {
                    vi.spyOn(component, "onFirmwareUpdateClick");

                    const reflashButton: HTMLButtonElement | null = Array.from<HTMLElement>(
                        fixture.nativeElement.querySelectorAll(".erg-info button mat-icon"),
                    ).filter((icon: HTMLElement): boolean => icon.textContent?.trim() === "compare_arrows")[0]
                        .parentElement as HTMLButtonElement;

                    reflashButton?.click();

                    expect(component.onFirmwareUpdateClick).toHaveBeenCalled();
                });
            });

            it("should show firmware update buttons when connected", async (): Promise<void> => {
                fixture.componentRef.setInput("isConnected", true);
                await fixture.whenStable();

                const firmwareButtons: Array<HTMLElement> = Array.from<HTMLElement>(
                    fixture.nativeElement.querySelectorAll(".erg-info button, .erg-info a"),
                );

                expect(firmwareButtons.length).toBeGreaterThan(0);
            });

            it("should hide firmware update buttons when not connected", async (): Promise<void> => {
                fixture.componentRef.setInput("isConnected", false);
                await fixture.whenStable();

                const firmwareButtons: Array<HTMLElement> = Array.from<HTMLElement>(
                    fixture.nativeElement.querySelectorAll(
                        ".erg-info button:not([class*='upload']), .erg-info a",
                    ),
                );

                expect(firmwareButtons.length).toBe(0);
            });
        });

        describe("hardware revision display", (): void => {
            it("should show hardware revision span when hardwareRevision is defined", async (): Promise<void> => {
                fixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                await fixture.whenStable();

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

            it("should hide hardware revision span when hardwareRevision is undefined", async (): Promise<void> => {
                const deviceInfoWithoutHardware: IDeviceInformation = {
                    ...mockDeviceInfo,
                    hardwareRevision: undefined,
                };

                fixture.componentRef.setInput("deviceInfo", deviceInfoWithoutHardware);
                await fixture.whenStable();

                const spans = fixture.nativeElement.querySelectorAll(
                    ".erg-info span",
                ) as NodeListOf<HTMLSpanElement>;
                const hardwareSpan = Array.from(spans).find(
                    (el: HTMLSpanElement): boolean =>
                        !!el.textContent && el.textContent.includes("Hardware:"),
                );

                expect(hardwareSpan).toBeUndefined();
            });

            it("should hide hardware revision span when hardwareRevision is empty string", async (): Promise<void> => {
                const deviceInfoWithEmptyHardware: IDeviceInformation = {
                    ...mockDeviceInfo,
                    hardwareRevision: "",
                };

                fixture.componentRef.setInput("deviceInfo", deviceInfoWithEmptyHardware);
                await fixture.whenStable();

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

        describe("heart rate monitor toggle options", (): void => {
            describe("when USB is available in navigator", (): void => {
                let localFixture: ComponentFixture<GeneralSettingsComponent>;
                let localLoader: HarnessLoader;

                beforeEach(async (): Promise<void> => {
                    vi.spyOn(navigator, "usb", "get").mockReturnValue({} as USB);

                    localFixture = TestBed.createComponent(GeneralSettingsComponent);
                    localLoader = TestbedHarnessEnvironment.loader(localFixture);
                    localFixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                    localFixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                    localFixture.componentRef.setInput("isConnected", true);
                    await localFixture.whenStable();
                });

                afterEach((): void => {
                    vi.restoreAllMocks();
                });

                it("should have isAntSupported set to true", (): void => {
                    expect(localFixture.componentInstance.isAntSupported).toBe(true);
                });

                it("should display ANT option in heart rate monitor toggle group", async (): Promise<void> => {
                    const toggleGroup = await localLoader.getHarness(
                        MatButtonToggleGroupHarness.with({
                            selector: '[formControlName="heartRateMonitor"]',
                        }),
                    );

                    const toggles = await toggleGroup.getToggles();
                    const texts = await Promise.all(
                        toggles.map(
                            async (t: MatButtonToggleHarness): Promise<string> => (await t.getText()).trim(),
                        ),
                    );

                    expect(texts).toContain("ANT");
                });

                it("should have three options in heart rate monitor toggle group", async (): Promise<void> => {
                    const toggleGroup = await localLoader.getHarness(
                        MatButtonToggleGroupHarness.with({
                            selector: '[formControlName="heartRateMonitor"]',
                        }),
                    );

                    const toggles = await toggleGroup.getToggles();
                    expect(toggles.length).toBe(3);

                    const texts = await Promise.all(
                        toggles.map(
                            async (t: MatButtonToggleHarness): Promise<string> => (await t.getText()).trim(),
                        ),
                    );
                    expect(texts).toEqual(["Off", "BLE", "ANT"]);
                });
            });

            describe("when USB is not available in navigator", (): void => {
                let localFixture: ComponentFixture<GeneralSettingsComponent>;
                let localLoader: HarnessLoader;

                beforeEach(async (): Promise<void> => {
                    vi.spyOn(navigator, "usb", "get").mockReturnValue(undefined as unknown as USB);

                    localFixture = TestBed.createComponent(GeneralSettingsComponent);
                    localLoader = TestbedHarnessEnvironment.loader(localFixture);
                    localFixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                    localFixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                    localFixture.componentRef.setInput("isConnected", true);
                    await localFixture.whenStable();
                });

                afterEach((): void => {
                    vi.restoreAllMocks();
                });

                it("should have isAntSupported set to false", (): void => {
                    expect(localFixture.componentInstance.isAntSupported).toBe(false);
                });

                it("should not display ANT option in heart rate monitor toggle group", async (): Promise<void> => {
                    const toggleGroup = await localLoader.getHarness(
                        MatButtonToggleGroupHarness.with({
                            selector: '[formControlName="heartRateMonitor"]',
                        }),
                    );

                    const toggles = await toggleGroup.getToggles();
                    const texts = await Promise.all(
                        toggles.map(
                            async (t: MatButtonToggleHarness): Promise<string> => (await t.getText()).trim(),
                        ),
                    );

                    expect(texts).not.toContain("ANT");
                });

                it("should have only two options in heart rate monitor toggle group", async (): Promise<void> => {
                    const toggleGroup = await localLoader.getHarness(
                        MatButtonToggleGroupHarness.with({
                            selector: '[formControlName="heartRateMonitor"]',
                        }),
                    );

                    const toggles = await toggleGroup.getToggles();
                    expect(toggles.length).toBe(2);

                    const texts = await Promise.all(
                        toggles.map(
                            async (t: MatButtonToggleHarness): Promise<string> => (await t.getText()).trim(),
                        ),
                    );
                    expect(texts).toEqual(["Off", "BLE"]);
                });
            });
        });

        it("should render auto-session toggle group", async (): Promise<void> => {
            await fixture.whenStable();
            fixture.detectChanges();
            const loader = TestbedHarnessEnvironment.loader(fixture);
            const toggleGroup = await loader.getHarness(
                MatButtonToggleGroupHarness.with({
                    selector: '[formControlName="autoSession"]',
                }),
            );
            const toggles = await toggleGroup.getToggles();
            const texts = await Promise.all(
                toggles.map(
                    async (toggle: MatButtonToggleHarness): Promise<string> =>
                        (await toggle.getText()).trim(),
                ),
            );
            expect(texts).toEqual(["Off", "On Start", "On Start & Pause"]);
        });

        it("should render auto-lap toggle group", async (): Promise<void> => {
            await fixture.whenStable();
            fixture.detectChanges();
            const loader = TestbedHarnessEnvironment.loader(fixture);
            const toggleGroup = await loader.getHarness(
                MatButtonToggleGroupHarness.with({
                    selector: '[formControlName="autoLap"]',
                }),
            );
            const toggles = await toggleGroup.getToggles();
            const texts = await Promise.all(
                toggles.map(
                    async (toggle: MatButtonToggleHarness): Promise<string> =>
                        (await toggle.getText()).trim(),
                ),
            );
            expect(texts).toEqual(["Off", "Distance", "Time"]);
        });

        it("should show distance preset select when autoLap is distance", async (): Promise<void> => {
            await fixture.whenStable();
            component.settingsForm.controls.autoLap.setValue("distance");
            fixture.detectChanges();

            const loader = TestbedHarnessEnvironment.loader(fixture);
            const select = await loader.getHarness(
                MatSelectHarness.with({ selector: '[formControlName="autoLapValue"]' }),
            );
            await select.open();
            const options = await select.getOptions();
            const texts = await Promise.all(
                options.map(
                    async (option: MatOptionHarness): Promise<string> => (await option.getText()).trim(),
                ),
            );
            expect(texts).toEqual(["200 m", "500 m", "1000 m", "2000 m", "5000 m", "10000 m"]);
        });

        it("should show time preset select when autoLap is time", async (): Promise<void> => {
            await fixture.whenStable();
            component.settingsForm.controls.autoLap.setValue("time");
            fixture.detectChanges();

            const loader = TestbedHarnessEnvironment.loader(fixture);
            const select = await loader.getHarness(
                MatSelectHarness.with({ selector: '[formControlName="autoLapValue"]' }),
            );
            await select.open();
            const options = await select.getOptions();
            const texts = await Promise.all(
                options.map(
                    async (option: MatOptionHarness): Promise<string> => (await option.getText()).trim(),
                ),
            );
            expect(texts).toEqual(["1 min", "2 min", "5 min", "10 min", "15 min", "30 min"]);
        });

        it("should not show autoLapValue select when autoLap is off", async (): Promise<void> => {
            await fixture.whenStable();
            component.settingsForm.controls.autoLap.setValue("off");
            fixture.detectChanges();

            const loader = TestbedHarnessEnvironment.loader(fixture);
            const selects = await loader.getAllHarnesses(
                MatSelectHarness.with({ selector: '[formControlName="autoLapValue"]' }),
            );
            expect(selects).toHaveLength(0);
        });
    });

    describe("as part of form initialization", (): void => {
        it("should initialize form with correct default values from rowerSettings", async (): Promise<void> => {
            await fixture.whenStable();

            expect(component.settingsForm.value.bleMode).toBe(BleServiceFlag.CpsService);
            expect(component.settingsForm.value.logLevel).toBe(LogLevel.Info);
            expect(component.settingsForm.value.deltaTimeLogging).toBe(false);
            expect(component.settingsForm.value.logToSdCard).toBe(true);
            expect(component.settingsForm.value.heartRateMonitor).toBe("off");
            expect(component.settingsForm.value.autoSession).toBe("autoStart");
            expect(component.settingsForm.value.autoLap).toBe("off");
            expect(component.settingsForm.value.autoLapValue).toBe(500);
        });

        it("should emit form validity on initialization", async (): Promise<void> => {
            vi.spyOn(component.isFormValidChange, "emit");
            await fixture.whenStable();

            expect(component.isFormValidChange.emit).toHaveBeenCalledWith(true);
        });

        it("should retrieve heart rate monitor setting from ConfigManager", (): void => {
            vi.mocked(mockConfigManagerService.getGroup).mockReturnValue(
                deepMerge(new Config().general, { device: { heartRateMonitor: "ble" } }),
            );

            component.ngOnInit();

            expect(mockConfigManagerService.getGroup).toHaveBeenCalledWith("general");
            expect(component.settingsForm.value.heartRateMonitor).toBe("ble");
        });

        it("should retrieve autoSession setting from ConfigManager", (): void => {
            vi.mocked(mockConfigManagerService.getGroup).mockReturnValue(
                deepMerge(new Config().general, { session: { autoSession: "off" } }),
            );

            component.ngOnInit();

            expect(component.settingsForm.value.autoSession).toBe("off");
        });
    });

    describe("as part of form validation", (): void => {
        it("should validate bleMode field", async (): Promise<void> => {
            await fixture.whenStable();
            const bleModeControl = component.settingsForm.controls.bleMode;

            bleModeControl.setValue(BleServiceFlag.CpsService);

            expect(bleModeControl.valid).toBe(true);

            bleModeControl.setValue(BleServiceFlag.FtmsService);

            expect(bleModeControl.valid).toBe(true);
        });

        it("should validate logLevel field", async (): Promise<void> => {
            await fixture.whenStable();
            const logLevelControl = component.settingsForm.controls.logLevel;

            logLevelControl.setValue(LogLevel.Silent);

            expect(logLevelControl.valid).toBe(true);

            logLevelControl.setValue(LogLevel.Verbose);

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

        it("should update form validity when form value changes", async (): Promise<void> => {
            vi.spyOn(component.isFormValidChange, "emit");

            component.settingsForm.controls.bleMode.setValue(BleServiceFlag.FtmsService);
            await fixture.whenStable();

            expect(component.isFormValidChange.emit).toHaveBeenCalledWith(true);
        });

        it("should emit false when form becomes invalid", async (): Promise<void> => {
            await fixture.whenStable();
            vi.spyOn(component.isFormValidChange, "emit");
            component.settingsForm.controls.logLevel.setValue(10 as unknown as LogLevel);
            await fixture.whenStable();

            expect(component.isFormValidChange.emit).toHaveBeenCalledWith(false);
        });
    });

    describe("as part of form state management", (): void => {
        it("should handle form value changes correctly", async (): Promise<void> => {
            const newSettings = {
                ...mockRowerSettings,
                generalSettings: {
                    ...mockRowerSettings.generalSettings,
                    bleServiceFlag: BleServiceFlag.FtmsService,
                    logLevel: LogLevel.Verbose,
                },
            };

            fixture.componentRef.setInput("rowerSettings", newSettings);
            await fixture.whenStable();

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
                expect(controls[key].disabled, `${key} should be disabled`).toBe(true);
            }
            expect(controls.heartRateMonitor.disabled).toBe(false);
        });

        describe("after ngOnInit", (): void => {
            it("should always enable heartRateMonitor control", async (): Promise<void> => {
                fixture.componentRef.setInput("isConnected", false);
                fixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                await fixture.whenStable();

                expect(component.settingsForm.controls.heartRateMonitor.enabled).toBe(true);
            });

            describe("when connected", (): void => {
                beforeEach(async (): Promise<void> => {
                    fixture.componentRef.setInput("isConnected", true);
                    fixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                    await fixture.whenStable();
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
                beforeEach(async (): Promise<void> => {
                    fixture.componentRef.setInput("isConnected", false);
                    fixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                    await fixture.whenStable();
                    component.ngOnInit();
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
                            expect(controls[key].enabled, `${key} should be enabled`).toBe(true);
                        } else {
                            expect(controls[key].disabled, `${key} should be disabled`).toBe(true);
                        }
                    }
                });
            });
        });
    });

    describe("checkForUpdates method", (): void => {
        it("should exist and be callable", async (): Promise<void> => {
            expect(component.checkForUpdates).toBeDefined();
            await expect(component.checkForUpdates()).resolves.not.toThrow();
        });

        it("should not call swUpdate.checkForUpdate when service worker is disabled", async (): Promise<void> => {
            vi.spyOn(mockSwUpdate, "isEnabled", "get").mockReturnValue(false);

            await component.checkForUpdates();

            expect(mockSwUpdate.checkForUpdate).not.toHaveBeenCalled();
            expect(component.isGuiUpdateInProgress()).toBe(false);
        });

        describe("when service worker is enabled", (): void => {
            beforeEach((): void => {
                vi.spyOn(mockSwUpdate, "isEnabled", "get").mockReturnValue(true);
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
                vi.mocked(mockSwUpdate.checkForUpdate).mockResolvedValue(true);

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
                vi.mocked(mockSwUpdate.checkForUpdate).mockRejectedValue(new Error("Update check failed"));

                await expect(component.checkForUpdates()).rejects.toThrow();
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

        it("should open OTA dialog when file is provided", (): void => {
            const mockFile = new File(["test content"], "firmware.bin", {
                type: "application/octet-stream",
            });
            const input = createInputWithFiles([mockFile]);
            const mockEvent = { currentTarget: input } as unknown as Event;

            component.otaUpdate(mockEvent);

            expect(mockMatDialog.open).toHaveBeenCalledWith(OtaDialogComponent, {
                autoFocus: false,
                disableClose: true,
                data: {
                    firmwareSize: mockFile.size / 1000,
                    file: mockFile,
                },
            });
        });

        it("should return early when no files provided", (): void => {
            const input = createInputWithFiles(null);
            const mockEvent = { currentTarget: input } as unknown as Event;

            component.otaUpdate(mockEvent);

            expect(mockMatDialog.open).not.toHaveBeenCalled();
        });

        it("should handle large file sizes correctly", (): void => {
            const largeFile = new File(["x".repeat(2000000)], "large-firmware.bin");
            const input = createInputWithFiles([largeFile]);
            const mockEvent = { currentTarget: input } as unknown as Event;

            component.otaUpdate(mockEvent);

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

    describe("onFirmwareUpdateClick method", (): void => {
        it("should call openFirmwareSelector with hardware revision", async (): Promise<void> => {
            fixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
            await fixture.whenStable();

            await component.onFirmwareUpdateClick();

            expect(mockFirmwareUpdateManagerService.openFirmwareSelector).toHaveBeenCalledWith("Rev 1");
        });

        it("should not call openFirmwareSelector when hardware revision is undefined", async (): Promise<void> => {
            fixture.componentRef.setInput("deviceInfo", {
                ...mockDeviceInfo,
                hardwareRevision: undefined,
            });
            await fixture.whenStable();

            await component.onFirmwareUpdateClick();

            expect(mockFirmwareUpdateManagerService.openFirmwareSelector).not.toHaveBeenCalled();
        });

        it("should handle empty hardware revision", async (): Promise<void> => {
            fixture.componentRef.setInput("deviceInfo", {
                ...mockDeviceInfo,
                hardwareRevision: "",
            });
            await fixture.whenStable();

            await component.onFirmwareUpdateClick();

            expect(mockFirmwareUpdateManagerService.openFirmwareSelector).not.toHaveBeenCalled();
        });
    });

    describe("isSupportedDevice computed signal", (): void => {
        it("should return true for supported hardware revision", async (): Promise<void> => {
            fixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
            await fixture.whenStable();

            expect(component.isSupportedDevice()).toBe(true);
        });

        it("should return false for custom hardware", async (): Promise<void> => {
            fixture.componentRef.setInput("deviceInfo", {
                ...mockDeviceInfo,
                hardwareRevision: "custom",
            });
            await fixture.whenStable();

            expect(component.isSupportedDevice()).toBe(false);
        });

        it("should return false for CUSTOM in uppercase", async (): Promise<void> => {
            fixture.componentRef.setInput("deviceInfo", {
                ...mockDeviceInfo,
                hardwareRevision: "CUSTOM",
            });
            await fixture.whenStable();

            expect(component.isSupportedDevice()).toBe(false);
        });

        it("should return false when hardware revision is undefined", async (): Promise<void> => {
            fixture.componentRef.setInput("deviceInfo", {
                ...mockDeviceInfo,
                hardwareRevision: undefined,
            });
            await fixture.whenStable();

            expect(component.isSupportedDevice()).toBe(false);
        });

        it("should return false for mixed case 'Custom' hardware", async (): Promise<void> => {
            fixture.componentRef.setInput("deviceInfo", {
                ...mockDeviceInfo,
                hardwareRevision: "Custom",
            });
            await fixture.whenStable();

            expect(component.isSupportedDevice()).toBe(false);
        });
    });

    describe("as part of edge cases & robustness handling", (): void => {
        it("should handle otaUpdate with invalid input element", (): void => {
            const mockEvent = {
                currentTarget: null,
            } as Event;

            component.otaUpdate(mockEvent);

            expect(mockMatDialog.open).not.toHaveBeenCalled();
        });

        it("should handle otaUpdate with non-HTMLInputElement", (): void => {
            const mockEvent = {
                currentTarget: document.createElement("div"),
            } as unknown as Event;

            component.otaUpdate(mockEvent);

            expect(mockMatDialog.open).not.toHaveBeenCalled();
        });
    });

    describe("getForm method", (): void => {
        it("should return the settings form", (): void => {
            const form = component.getForm();

            expect(form).toBe(component.settingsForm);
        });

        it("should return form with correct controls", (): void => {
            const form = component.getForm();

            expect(form.controls.bleMode).toBeDefined();
            expect(form.controls.logLevel).toBeDefined();
            expect(form.controls.heartRateMonitor).toBeDefined();
            expect(form.controls.deltaTimeLogging).toBeDefined();
            expect(form.controls.logToSdCard).toBeDefined();
            expect(form.controls.intervalsApiKey).toBeDefined();
            expect(form.controls.intervalsAthleteId).toBeDefined();
            expect(form.controls.intervalsAutoUpload).toBeDefined();
        });
    });

    describe("Intervals.icu settings", (): void => {
        describe("as part of form initialization", (): void => {
            beforeEach(async (): Promise<void> => {
                await fixture.whenStable();
                fixture.detectChanges();
            });

            it("should initialize API key from config", (): void => {
                expect(component.settingsForm.controls.intervalsApiKey.value).toBe("");
            });

            it("should initialize athlete ID from config", (): void => {
                expect(component.settingsForm.controls.intervalsAthleteId.value).toBe("");
            });

            it("should initialize auto-upload to disabled when API key is empty", (): void => {
                expect(component.settingsForm.controls.intervalsAutoUpload.disabled).toBe(true);
            });

            it("should initialize with non-empty API key when config has one", (): void => {
                vi.mocked(mockConfigManagerService.getGroup).mockReturnValue(
                    deepMerge(new Config().general, { intervalsIcu: { apiKey: "existing-key" } }),
                );

                const localFixture = TestBed.createComponent(GeneralSettingsComponent);
                localFixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                localFixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                localFixture.componentRef.setInput("isConnected", true);

                expect(localFixture.componentInstance.settingsForm.controls.intervalsApiKey.value).toBe(
                    "existing-key",
                );
            });
        });

        describe("hasApiKeyChanged method", (): void => {
            it("should return false when API key has not changed", (): void => {
                expect(component.hasApiKeyChanged()).toBe(false);
            });

            it("should return true when API key value is changed", (): void => {
                component.settingsForm.controls.intervalsApiKey.setValue("new-key");

                expect(component.hasApiKeyChanged()).toBe(true);
            });

            it("should return false when API key is reverted to original value", (): void => {
                component.settingsForm.controls.intervalsApiKey.setValue("new-key");
                component.settingsForm.controls.intervalsApiKey.setValue("");

                expect(component.hasApiKeyChanged()).toBe(false);
            });
        });

        describe("isFirstTimeSetup method", (): void => {
            it("should return true when initial API key is empty", (): void => {
                expect(component.isFirstTimeSetup()).toBe(true);
            });

            it("should return false when initial API key is non-empty", (): void => {
                vi.mocked(mockConfigManagerService.getGroup).mockReturnValue(
                    deepMerge(new Config().general, { intervalsIcu: { apiKey: "existing-key" } }),
                );

                const localFixture = TestBed.createComponent(GeneralSettingsComponent);
                localFixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                localFixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                localFixture.componentRef.setInput("isConnected", true);

                expect(localFixture.componentInstance.isFirstTimeSetup()).toBe(false);
            });
        });

        describe("API key visibility toggle", (): void => {
            it("should start with API key hidden as password type", async (): Promise<void> => {
                await fixture.whenStable();

                const apiKeyInput: HTMLInputElement = fixture.nativeElement.querySelector(
                    '[formControlName="intervalsApiKey"]',
                );

                expect(apiKeyInput.type).toBe("password");
            });

            it("should show API key as text after clicking visibility toggle", async (): Promise<void> => {
                await fixture.whenStable();

                const toggleButton: HTMLButtonElement = fixture.nativeElement.querySelector(
                    '[aria-label="Show API key"]',
                );
                toggleButton.click();
                fixture.detectChanges();

                const apiKeyInput: HTMLInputElement = fixture.nativeElement.querySelector(
                    '[formControlName="intervalsApiKey"]',
                );

                expect(apiKeyInput.type).toBe("text");
            });

            it("should toggle back to password type after second click", async (): Promise<void> => {
                await fixture.whenStable();

                const showButton: HTMLButtonElement = fixture.nativeElement.querySelector(
                    '[aria-label="Show API key"]',
                );
                showButton.click();
                fixture.detectChanges();

                const hideButton: HTMLButtonElement = fixture.nativeElement.querySelector(
                    '[aria-label="Hide API key"]',
                );
                hideButton.click();
                fixture.detectChanges();

                const apiKeyInput: HTMLInputElement = fixture.nativeElement.querySelector(
                    '[formControlName="intervalsApiKey"]',
                );

                expect(apiKeyInput.type).toBe("password");
            });
        });

        describe("athlete ID visibility toggle", (): void => {
            it("should start with athlete ID section hidden", async (): Promise<void> => {
                await fixture.whenStable();

                const athleteIdInput = fixture.nativeElement.querySelector(
                    '[formControlName="intervalsAthleteId"]',
                );

                expect(athleteIdInput).toBeNull();
            });

            it("should show athlete ID section after clicking the person toggle button", async (): Promise<void> => {
                await fixture.whenStable();

                const toggleButton: HTMLButtonElement = fixture.nativeElement.querySelector(
                    '[aria-label="Show athlete ID field"]',
                );
                toggleButton.click();
                fixture.detectChanges();

                const athleteIdInput = fixture.nativeElement.querySelector(
                    '[formControlName="intervalsAthleteId"]',
                );

                expect(athleteIdInput).toBeTruthy();
            });

            it("should hide athlete ID section after clicking the toggle button again", async (): Promise<void> => {
                await fixture.whenStable();

                const showButton: HTMLButtonElement = fixture.nativeElement.querySelector(
                    '[aria-label="Show athlete ID field"]',
                );
                showButton.click();
                fixture.detectChanges();

                const hideButton: HTMLButtonElement = fixture.nativeElement.querySelector(
                    '[aria-label="Hide athlete ID field"]',
                );
                hideButton.click();
                fixture.detectChanges();

                const athleteIdInput = fixture.nativeElement.querySelector(
                    '[formControlName="intervalsAthleteId"]',
                );

                expect(athleteIdInput).toBeNull();
            });
        });

        describe("auto-upload toggle disabled state", (): void => {
            it("should be disabled when API key is empty", async (): Promise<void> => {
                await fixture.whenStable();

                expect(component.settingsForm.controls.intervalsAutoUpload.disabled).toBe(true);
            });

            it("should be enabled when API key has value", async (): Promise<void> => {
                vi.mocked(mockConfigManagerService.getGroup).mockReturnValue(
                    deepMerge(new Config().general, { intervalsIcu: { apiKey: "my-key" } }),
                );

                const localFixture = TestBed.createComponent(GeneralSettingsComponent);
                localFixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                localFixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                localFixture.componentRef.setInput("isConnected", true);
                await localFixture.whenStable();

                expect(
                    localFixture.componentInstance.settingsForm.controls.intervalsAutoUpload.disabled,
                ).toBe(false);
            });

            it("should become enabled when API key is entered", async (): Promise<void> => {
                component.settingsForm.controls.intervalsApiKey.setValue("new-key");
                await fixture.whenStable();

                expect(component.settingsForm.controls.intervalsAutoUpload.disabled).toBe(false);
            });

            it("should become disabled when API key is cleared", async (): Promise<void> => {
                vi.mocked(mockConfigManagerService.getGroup).mockReturnValue(
                    deepMerge(new Config().general, { intervalsIcu: { apiKey: "my-key" } }),
                );

                const localFixture = TestBed.createComponent(GeneralSettingsComponent);
                localFixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                localFixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
                localFixture.componentRef.setInput("isConnected", true);
                await localFixture.whenStable();

                localFixture.componentInstance.settingsForm.controls.intervalsApiKey.setValue("");
                await localFixture.whenStable();

                expect(
                    localFixture.componentInstance.settingsForm.controls.intervalsAutoUpload.disabled,
                ).toBe(true);
            });

            it("should remain disabled after form enable when API key is empty", async (): Promise<void> => {
                fixture.componentRef.setInput("isConnected", true);
                fixture.componentRef.setInput("rowerSettings", mockRowerSettings);
                await fixture.whenStable();

                expect(component.settingsForm.controls.intervalsAutoUpload.disabled).toBe(true);
            });
        });
    });
});
