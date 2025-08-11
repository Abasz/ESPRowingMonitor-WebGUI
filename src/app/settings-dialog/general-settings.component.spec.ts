import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { SwUpdate } from "@angular/service-worker";
import { of } from "rxjs";

import { BleServiceFlag, IDeviceInformation, LogLevel } from "../../common/ble.interfaces";
import { IRowerSettings } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { OtaDialogComponent } from "../ota-settings-dialog/ota-dialog.component";

import { GeneralSettingsComponent } from "./general-settings.component";

describe("GeneralSettingsComponent", (): void => {
    let component: GeneralSettingsComponent;
    let fixture: ComponentFixture<GeneralSettingsComponent>;
    let mockConfigManagerService: jasmine.SpyObj<ConfigManagerService>;
    let mockSwUpdate: jasmine.SpyObj<SwUpdate>;
    let mockMatDialog: jasmine.SpyObj<MatDialog>;

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

        await TestBed.configureTestingModule({
            imports: [GeneralSettingsComponent, ReactiveFormsModule],
            providers: [
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: SwUpdate, useValue: mockSwUpdate },
                { provide: MatDialog, useValue: mockMatDialog },
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GeneralSettingsComponent);
        component = fixture.componentInstance;

        fixture.componentRef.setInput("rowerSettings", mockRowerSettings);
        fixture.componentRef.setInput("deviceInfo", mockDeviceInfo);
        fixture.componentRef.setInput("isConnected", true);
    });

    it("should create component", (): void => {
        expect(component).toBeTruthy();
    });

    it("should initialize form with correct default values from rowerSettings", (): void => {
        fixture.detectChanges();

        expect(component.settingsForm.value.bleMode).toBe(BleServiceFlag.CpsService);
        expect(component.settingsForm.value.logLevel).toBe(LogLevel.Info);
        expect(component.settingsForm.value.deltaTimeLogging).toBe(false);
        expect(component.settingsForm.value.logToSdCard).toBe(true);
        expect(component.settingsForm.value.heartRateMonitor).toBe("off");
    });

    it("should have valid form by default", (): void => {
        expect(component.settingsForm.valid).toBe(true);
    });

    it("should emit form validity on initialization", (): void => {
        spyOn(component.isFormValidChange, "emit");

        fixture.detectChanges();

        expect(component.isFormValidChange.emit).toHaveBeenCalledWith(true);
    });

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

    describe("Form Enable/Disable Logic", (): void => {
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

                it("should enable the firmware upload button", (): void => {
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

                it("should disable the firmware upload button", (): void => {
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
                        expect((uploadBtn as HTMLButtonElement).disabled).toBe(true);
                    }
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

    describe("Form Validators & Validation should validate ", (): void => {
        it("bleMode field", (): void => {
            const bleModeControl = component.settingsForm.controls.bleMode;

            bleModeControl.setValue(BleServiceFlag.CpsService);
            fixture.detectChanges();

            expect(bleModeControl.valid).toBe(true);

            bleModeControl.setValue(BleServiceFlag.FtmsService);
            fixture.detectChanges();

            expect(bleModeControl.valid).toBe(true);
        });

        it("logLevel field", (): void => {
            const logLevelControl = component.settingsForm.controls.logLevel;

            logLevelControl.setValue(LogLevel.Silent);
            fixture.detectChanges();

            expect(logLevelControl.valid).toBe(true);

            logLevelControl.setValue(LogLevel.Verbose);
            fixture.detectChanges();

            expect(logLevelControl.valid).toBe(true);
        });

        it("heartRateMonitor field", (): void => {
            const heartRateControl = component.settingsForm.controls.heartRateMonitor;

            heartRateControl.setValue("off");
            expect(heartRateControl.valid).toBe(true);

            heartRateControl.setValue("ble");
            expect(heartRateControl.valid).toBe(true);

            heartRateControl.setValue("ant");
            expect(heartRateControl.valid).toBe(true);
        });
    });

    describe("Update Management (checkForUpdates/otaUpdate)", (): void => {
        describe("checkForUpdates", (): void => {
            it("should exist and be callable", (): void => {
                expect(component.checkForUpdates).toBeDefined();
                expect((): void => component.checkForUpdates()).not.toThrow();
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
    });

    describe("Utility Methods", (): void => {
        it("should have readonly compile date info", (): void => {
            expect(component.compileDate).toBeDefined();
            expect(component.compileDate instanceof Date).toBe(true);
        });

        it("should expose enum types for template use", (): void => {
            expect(component.BleServiceFlag).toBe(BleServiceFlag);
            expect(component.LogLevel).toBe(LogLevel);
        });
    });

    describe("Form Value Integration", (): void => {
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
    });

    describe("ConfigManager Integration", (): void => {
        it("should retrieve heart rate monitor setting from ConfigManager", (): void => {
            mockConfigManagerService.getItem.and.returnValue("ble");

            component.ngOnInit();

            expect(mockConfigManagerService.getItem).toHaveBeenCalledWith("heartRateMonitor");
            expect(component.settingsForm.value.heartRateMonitor).toBe("ble");
        });
    });

    describe("Edge Cases & Robustness", (): void => {
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
