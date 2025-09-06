import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { MatButtonHarness } from "@angular/material/button/testing";
import { MatDialog } from "@angular/material/dialog";
import { MatTooltipHarness } from "@angular/material/tooltip/testing";
import { BehaviorSubject } from "rxjs";

import { IDeviceInformation } from "../../common/ble.interfaces";
import { IErgConnectionStatus, IRowerSettings } from "../../common/common.interfaces";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { ErgGenericDataService } from "../../common/services/ergometer/erg-generic-data.service";
import { ErgSettingsService } from "../../common/services/ergometer/erg-settings.service";
import { UtilsService } from "../../common/services/utils.service";
import { SettingsDialogComponent } from "../settings-dialog/settings-dialog.component";

import { OpenSettingsButtonComponent } from "./open-settings-button.component";

describe("OpenSettingsButtonComponent", (): void => {
    let component: OpenSettingsButtonComponent;
    let fixture: ComponentFixture<OpenSettingsButtonComponent>;
    let loader: HarnessLoader;
    let mockErgGenericDataService: jasmine.SpyObj<ErgGenericDataService>;
    let mockErgSettingsService: jasmine.SpyObj<ErgSettingsService>;
    let mockErgConnectionService: jasmine.SpyObj<ErgConnectionService>;
    let mockUtilsService: jasmine.SpyObj<UtilsService>;
    let mockDialog: jasmine.SpyObj<MatDialog>;
    let mockMainSpinner: jasmine.SpyObj<{ open: () => void; close: () => void }>;
    let ergConnectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let deviceInfoSubject: BehaviorSubject<IDeviceInformation>;
    let rowerSettingsSignal: jasmine.Spy<() => IRowerSettings>;
    let deviceInfoSignal: jasmine.Spy<() => IDeviceInformation | undefined>;
    let isSecureContextSpy: jasmine.Spy<() => boolean>;
    let navigatorBluetoothSpy: jasmine.Spy<() => Bluetooth | undefined>;

    const mockErgConnectionStatus: IErgConnectionStatus = {
        status: "disconnected",
        deviceName: undefined,
    };

    const mockRowerSettings: IRowerSettings = {
        generalSettings: {
            logDeltaTimes: false,
            logToSdCard: false,
            bleServiceFlag: 0,
            logLevel: 4,
            isRuntimeSettingsEnabled: false,
            isCompiledWithDouble: false,
        },
        rowingSettings: {
            machineSettings: {
                flywheelInertia: 1,
                magicConstant: 1,
                sprocketRadius: 1,
                impulsePerRevolution: 1,
            },
            sensorSignalSettings: {
                rotationDebounceTime: 1,
                rowingStoppedThreshold: 1,
            },
            dragFactorSettings: {
                goodnessOfFitThreshold: 0.1,
                maxDragFactorRecoveryPeriod: 1,
                dragFactorLowerThreshold: 1,
                dragFactorUpperThreshold: 1,
                dragCoefficientsArrayLength: 1,
            },
            strokeDetectionSettings: {
                strokeDetectionType: 0,
                impulseDataArrayLength: 1,
                minimumPoweredTorque: 0,
                minimumDragTorque: 0,
                minimumRecoverySlopeMargin: 0,
                minimumRecoverySlope: 0,
                minimumRecoveryTime: 0,
                minimumDriveTime: 0,
                driveHandleForcesMaxCapacity: 0,
            },
        },
    };

    const mockDeviceInfo: IDeviceInformation = {
        modelNumber: "mock-model",
        firmwareNumber: "1.0.0",
        manufacturerName: "Mock Manufacturer",
    };

    beforeEach(async (): Promise<void> => {
        ergConnectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>(mockErgConnectionStatus);
        deviceInfoSubject = new BehaviorSubject<IDeviceInformation>({});
        rowerSettingsSignal = jasmine.createSpy("rowerSettings").and.returnValue(mockRowerSettings);
        deviceInfoSignal = jasmine.createSpy("deviceInfo").and.returnValue(mockDeviceInfo);
        mockMainSpinner = jasmine.createSpyObj("mainSpinner", ["open", "close"]);

        mockErgGenericDataService = jasmine.createSpyObj("ErgGenericDataService", [], {
            deviceInfo: deviceInfoSignal,
            deviceInfo$: deviceInfoSubject.asObservable(),
        });

        mockErgSettingsService = jasmine.createSpyObj("ErgSettingsService", [], {
            rowerSettings: rowerSettingsSignal,
        });

        mockErgConnectionService = jasmine.createSpyObj("ErgConnectionService", ["connectionStatus$"]);
        mockErgConnectionService.connectionStatus$.and.returnValue(ergConnectionStatusSubject.asObservable());

        mockUtilsService = jasmine.createSpyObj("UtilsService", ["mainSpinner"]);
        mockUtilsService.mainSpinner.and.returnValue(mockMainSpinner);

        mockDialog = jasmine.createSpyObj("MatDialog", ["open"]);

        await TestBed.configureTestingModule({
            imports: [OpenSettingsButtonComponent],
            providers: [
                { provide: ErgGenericDataService, useValue: mockErgGenericDataService },
                { provide: ErgSettingsService, useValue: mockErgSettingsService },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                { provide: UtilsService, useValue: mockUtilsService },
                { provide: MatDialog, useValue: mockDialog },
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        isSecureContextSpy = spyOnProperty(window, "isSecureContext", "get").and.returnValue(true);
        navigatorBluetoothSpy = spyOnProperty(navigator, "bluetooth", "get").and.returnValue(
            {} as unknown as Bluetooth,
        );

        fixture = TestBed.createComponent(OpenSettingsButtonComponent);
        component = fixture.componentInstance;
        loader = TestbedHarnessEnvironment.loader(fixture);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize ergConnectionStatus signal", (): void => {
            fixture.detectChanges();

            expect(component.ergConnectionStatus()).toEqual(mockErgConnectionStatus);
        });

        it("should initialize rowerSettings signal", (): void => {
            fixture.detectChanges();

            expect(component.rowerSettings()).toEqual(mockRowerSettings);
        });

        it("should detect BLE availability when secure context is true", (): void => {
            isSecureContextSpy.and.returnValue(true);
            navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

            const newFixture = TestBed.createComponent(OpenSettingsButtonComponent);
            const newComponent = newFixture.componentInstance;

            expect(newComponent.isBleAvailable).toBe(true);
        });

        it("should detect BLE unavailability when secure context is false", (): void => {
            isSecureContextSpy.and.returnValue(false);

            const newFixture = TestBed.createComponent(OpenSettingsButtonComponent);
            const newComponent = newFixture.componentInstance;

            expect(newComponent.isBleAvailable).toBe(false);
        });

        it("should detect BLE unavailability when bluetooth API is missing", (): void => {
            isSecureContextSpy.and.returnValue(true);
            navigatorBluetoothSpy.and.returnValue(undefined);

            const newFixture = TestBed.createComponent(OpenSettingsButtonComponent);
            const newComponent = newFixture.componentInstance;

            expect(newComponent.isBleAvailable).toBe(false);
        });
    });

    describe("as part of template rendering", (): void => {
        describe("when BLE is available", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(OpenSettingsButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);
                fixture.detectChanges();
            });

            it("should render button element", (): void => {
                const button = fixture.nativeElement.querySelector("button[mat-icon-button]");
                expect(button).toBeTruthy();
            });

            it("should render mat-icon element", (): void => {
                const icon = fixture.nativeElement.querySelector("button mat-icon");
                expect(icon).toBeTruthy();
            });

            it("should display settings icon", (): void => {
                const icon = fixture.nativeElement.querySelector("mat-icon");
                expect(icon.textContent?.trim()).toBe("settings");
            });

            it("should display Settings tooltip", async (): Promise<void> => {
                const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                await tooltipHarness.show();

                const tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("Settings");
            });

            it("should have correct tooltip delay", (): void => {
                const button = fixture.nativeElement.querySelector("button[matTooltipShowDelay]");
                expect(button.getAttribute("mattooltipshowdelay")).toBe("1000");
            });
        });

        it("should not render any content when BLE is not available", (): void => {
            isSecureContextSpy.and.returnValue(false);
            navigatorBluetoothSpy.and.returnValue(undefined);

            fixture = TestBed.createComponent(OpenSettingsButtonComponent);
            component = fixture.componentInstance;
            loader = TestbedHarnessEnvironment.loader(fixture);
            fixture.detectChanges();

            const content = fixture.nativeElement.querySelector("*");
            expect(content).toBeNull();
        });
    });

    describe("as part of user interactions", (): void => {
        describe("openSettings method", (): void => {
            describe("when ergConnectionStatus is not connecting", (): void => {
                beforeEach((): void => {
                    ergConnectionStatusSubject.next({ status: "disconnected", deviceName: undefined });
                    fixture.detectChanges();
                });

                it("should not open main spinner", async (): Promise<void> => {
                    await component.openSettings();

                    expect(mockUtilsService.mainSpinner).not.toHaveBeenCalled();
                    expect(mockMainSpinner.open).not.toHaveBeenCalled();
                });

                it("should open settings dialog immediately", async (): Promise<void> => {
                    await component.openSettings();

                    expect(mockDialog.open).toHaveBeenCalledWith(SettingsDialogComponent, {
                        autoFocus: false,
                        data: {
                            rowerSettings: mockRowerSettings,
                            ergConnectionStatus: jasmine.any(Object),
                            deviceInfo: mockDeviceInfo,
                        },
                    });
                });
            });

            describe("when ergConnectionStatus is connecting", (): void => {
                beforeEach((): void => {
                    ergConnectionStatusSubject.next({ status: "connecting", deviceName: undefined });
                    fixture.detectChanges();
                });

                it("should open main spinner", async (): Promise<void> => {
                    const sut = component.openSettings();

                    ergConnectionStatusSubject.next({ status: "connected", deviceName: "Device" });
                    deviceInfoSubject.next(mockDeviceInfo);
                    await sut;
                    expect(mockUtilsService.mainSpinner).toHaveBeenCalled();
                    expect(mockMainSpinner.open).toHaveBeenCalled();
                });

                describe("and connection becomes other than connected", (): void => {
                    it("should close main spinner", async (): Promise<void> => {
                        const sut = component.openSettings();

                        ergConnectionStatusSubject.next({ status: "disconnected", deviceName: undefined });
                        await sut;
                        expect(mockMainSpinner.close).toHaveBeenCalled();
                    });

                    it("should open settings dialog", async (): Promise<void> => {
                        const sut = component.openSettings();

                        ergConnectionStatusSubject.next({ status: "searching", deviceName: "Device" });
                        await sut;
                        expect(mockDialog.open).toHaveBeenCalledWith(SettingsDialogComponent, {
                            autoFocus: false,
                            data: {
                                rowerSettings: mockRowerSettings,
                                ergConnectionStatus: jasmine.any(Object),
                                deviceInfo: mockDeviceInfo,
                            },
                        });
                    });
                });

                describe("and connection becomes connected should open settings dialog", (): void => {
                    it("when device info becomes available", async (): Promise<void> => {
                        const sut = component.openSettings();

                        ergConnectionStatusSubject.next({ status: "connected", deviceName: "Device" });

                        deviceInfoSubject.next(mockDeviceInfo);

                        await expectAsync(sut).toBeResolved();
                        expect(mockDialog.open).toHaveBeenCalled();
                    });

                    it("when device info timeouts", fakeAsync((): void => {
                        const sut = component.openSettings();

                        ergConnectionStatusSubject.next({ status: "connected", deviceName: "Device" });

                        tick(5000);
                        expect(async (): Promise<void> => await sut).not.toThrow();
                        expect(mockDialog.open).toHaveBeenCalled();
                    }));
                });
            });
        });

        it("should trigger openSettings when clicked", async (): Promise<void> => {
            isSecureContextSpy.and.returnValue(true);
            navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

            fixture = TestBed.createComponent(OpenSettingsButtonComponent);
            component = fixture.componentInstance;
            loader = TestbedHarnessEnvironment.loader(fixture);
            fixture.detectChanges();

            spyOn(component, "openSettings").and.resolveTo();

            const buttonHarness = await loader.getHarness(MatButtonHarness);
            await buttonHarness.click();

            expect(component.openSettings).toHaveBeenCalled();
        });
    });

    describe("as part of signal reactivity", (): void => {
        it("ergConnectionStatus signal should update when ErgConnectionService emits new value", (): void => {
            fixture.detectChanges();
            expect(component.ergConnectionStatus().status).toBe("disconnected");

            ergConnectionStatusSubject.next({ status: "connected", deviceName: "Device" });
            fixture.detectChanges();

            expect(component.ergConnectionStatus().status).toBe("connected");
        });

        it("should provide current rower settings to dialog", async (): Promise<void> => {
            const newSettings = { ...mockRowerSettings, logLevel: "debug" as const };
            rowerSettingsSignal.and.returnValue(newSettings);

            await component.openSettings();

            expect(mockDialog.open).toHaveBeenCalledWith(SettingsDialogComponent, {
                autoFocus: false,
                data: jasmine.objectContaining({
                    rowerSettings: newSettings,
                }),
            });
        });

        describe("deviceInfo signal updates", (): void => {
            it("should provide current device info to dialog", async (): Promise<void> => {
                const newDeviceInfo = { ...mockDeviceInfo, deviceName: "Updated Device" };
                deviceInfoSignal.and.returnValue(newDeviceInfo);

                await component.openSettings();

                expect(mockDialog.open).toHaveBeenCalledWith(SettingsDialogComponent, {
                    autoFocus: false,
                    data: jasmine.objectContaining({
                        deviceInfo: newDeviceInfo,
                    }),
                });
            });

            it("should handle undefined device info", async (): Promise<void> => {
                deviceInfoSignal.and.returnValue(undefined);

                await component.openSettings();

                expect(mockDialog.open).toHaveBeenCalledWith(SettingsDialogComponent, {
                    autoFocus: false,
                    data: jasmine.objectContaining({
                        deviceInfo: undefined,
                    }),
                });
            });
        });
    });

    describe("as part of edge case handling", (): void => {
        describe("with browser compatibility issues", (): void => {
            it("should handle missing isSecureContext", (): void => {
                isSecureContextSpy.and.returnValue(undefined as unknown as boolean);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                const newFixture = TestBed.createComponent(OpenSettingsButtonComponent);
                const newComponent = newFixture.componentInstance;
                newFixture.detectChanges();

                expect(newComponent.isBleAvailable).toBe(false);
            });

            it("should handle missing navigator.bluetooth", (): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue(undefined);

                const newFixture = TestBed.createComponent(OpenSettingsButtonComponent);
                const newComponent = newFixture.componentInstance;

                expect(newComponent.isBleAvailable).toBe(false);
            });
        });

        describe("with service failures", (): void => {
            it("should handle dialog service error", async (): Promise<void> => {
                mockDialog.open.and.throwError("Dialog error");

                await expectAsync(component.openSettings()).toBeRejected();
            });

            it("should handle utils service error", async (): Promise<void> => {
                mockUtilsService.mainSpinner.and.throwError("Utils error");
                ergConnectionStatusSubject.next({ status: "connecting", deviceName: undefined });

                await expectAsync(component.openSettings()).toBeRejected();
            });
        });

        it("should handle multiple rapid status changes", (): void => {
            const statuses: Array<IErgConnectionStatus> = [
                { status: "disconnected", deviceName: undefined },
                { status: "connecting", deviceName: undefined },
                { status: "connected", deviceName: "Device" },
                { status: "disconnected", deviceName: undefined },
            ];

            fixture.detectChanges();

            statuses.forEach((status: IErgConnectionStatus): void => {
                ergConnectionStatusSubject.next(status);
                fixture.detectChanges();
            });

            expect(component.ergConnectionStatus().status).toBe("disconnected");
        });

        describe("with null or undefined values", (): void => {
            it("should handle undefined device name in connection status", async (): Promise<void> => {
                ergConnectionStatusSubject.next({ status: "connected", deviceName: undefined });
                fixture.detectChanges();

                await component.openSettings();

                expect(mockDialog.open).toHaveBeenCalledWith(SettingsDialogComponent, {
                    autoFocus: false,
                    data: jasmine.objectContaining({
                        ergConnectionStatus: jasmine.objectContaining({
                            deviceName: undefined,
                        }),
                    }),
                });
            });

            it("should handle null rower settings", async (): Promise<void> => {
                rowerSettingsSignal.and.returnValue(null as unknown as IRowerSettings);

                await component.openSettings();

                expect(mockDialog.open).toHaveBeenCalledWith(SettingsDialogComponent, {
                    autoFocus: false,
                    data: jasmine.objectContaining({
                        rowerSettings: null,
                    }),
                });
            });
        });
    });
});
