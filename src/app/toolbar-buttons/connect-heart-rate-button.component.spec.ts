import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatButtonHarness } from "@angular/material/button/testing";
import { MatTooltipHarness } from "@angular/material/tooltip/testing";
import { BehaviorSubject } from "rxjs";

import { BleServiceNames } from "../../common/ble.interfaces";
import { HeartRateMonitorMode, IHRConnectionStatus } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { HeartRateService } from "../../common/services/heart-rate/heart-rate.service";
import { MetricsService } from "../../common/services/metrics.service";

import { ConnectHeartRateButtonComponent } from "./connect-heart-rate-button.component";

describe("ConnectHeartRateButtonComponent", (): void => {
    let component: ConnectHeartRateButtonComponent;
    let fixture: ComponentFixture<ConnectHeartRateButtonComponent>;
    let loader: HarnessLoader;
    let mockConfigManagerService: jasmine.SpyObj<ConfigManagerService>;
    let mockMetricsService: jasmine.SpyObj<MetricsService>;
    let mockHeartRateService: jasmine.SpyObj<HeartRateService>;
    let heartRateMonitorSubject: BehaviorSubject<HeartRateMonitorMode>;
    let hrConnectionStatusSubject: BehaviorSubject<IHRConnectionStatus>;
    let isSecureContextSpy: jasmine.Spy<() => boolean>;
    let navigatorBluetoothSpy: jasmine.Spy<() => Bluetooth | undefined>;

    const mockHRConnectionStatus: IHRConnectionStatus = {
        status: "disconnected",
        deviceName: undefined,
    };

    beforeEach(async (): Promise<void> => {
        heartRateMonitorSubject = new BehaviorSubject<HeartRateMonitorMode>("off");
        hrConnectionStatusSubject = new BehaviorSubject<IHRConnectionStatus>(mockHRConnectionStatus);

        mockConfigManagerService = jasmine.createSpyObj("ConfigManagerService", [], {
            heartRateMonitorChanged$: heartRateMonitorSubject.asObservable(),
        });

        mockMetricsService = jasmine.createSpyObj("MetricsService", [], {
            hrConnectionStatus$: hrConnectionStatusSubject.asObservable(),
        });

        mockHeartRateService = jasmine.createSpyObj("HeartRateService", ["discover"]);
        mockHeartRateService.discover.and.resolveTo();

        await TestBed.configureTestingModule({
            imports: [ConnectHeartRateButtonComponent],
            providers: [
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: HeartRateService, useValue: mockHeartRateService },
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        // install spies on the prototypes once so tests can override .and.returnValue(...) without re-spying
        isSecureContextSpy = spyOnProperty(window, "isSecureContext", "get").and.returnValue(true);
        navigatorBluetoothSpy = spyOnProperty(navigator, "bluetooth", "get").and.returnValue(
            {} as unknown as Bluetooth,
        );

        fixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
        component = fixture.componentInstance;
        loader = TestbedHarnessEnvironment.loader(fixture);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize BleServiceNames property", (): void => {
            expect(component.BleServiceNames).toBe(BleServiceNames);
        });

        it("should initialize heartRateMonitorMode signal", (): void => {
            fixture.detectChanges();
            expect(component.heartRateMonitorMode()).toBe("off");
        });

        it("should initialize hrConnectionStatus signal", (): void => {
            fixture.detectChanges();
            expect(component.hrConnectionStatus()).toEqual(mockHRConnectionStatus);
        });

        it("should detect BLE availability correctly when secure context", (): void => {
            isSecureContextSpy.and.returnValue(true);
            navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

            const newFixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
            const newComponent = newFixture.componentInstance;

            expect(newComponent.isBleAvailable).toBe(true);
        });

        it("should detect BLE unavailability when not secure context", (): void => {
            isSecureContextSpy.and.returnValue(false);

            const newFixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
            const newComponent = newFixture.componentInstance;

            expect(newComponent.isBleAvailable).toBe(false);
        });

        it("should detect BLE unavailability when bluetooth API missing", (): void => {
            isSecureContextSpy.and.returnValue(true);
            navigatorBluetoothSpy.and.returnValue(undefined);

            const newFixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
            const newComponent = newFixture.componentInstance;

            expect(newComponent.isBleAvailable).toBe(false);
        });
    });

    describe("as part of template rendering", (): void => {
        describe("when BLE is available", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);
            });

            it("and heart rate monitor mode is off should not render button", (): void => {
                heartRateMonitorSubject.next("off");
                fixture.detectChanges();

                const button = fixture.nativeElement.querySelector("button[mat-icon-button]");
                expect(button).toBeNull();
            });

            describe("and heart rate monitor mode is not off", (): void => {
                beforeEach((): void => {
                    heartRateMonitorSubject.next("ant");
                    hrConnectionStatusSubject.next({ status: "disconnected", deviceName: undefined });
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

                describe("with disconnected status", (): void => {
                    beforeEach((): void => {
                        hrConnectionStatusSubject.next({ status: "disconnected", deviceName: undefined });
                        fixture.detectChanges();
                    });

                    it("should display favorite icon", (): void => {
                        const icon = fixture.nativeElement.querySelector("mat-icon");
                        expect(icon.textContent?.trim()).toBe("favorite");
                    });

                    it("should display Connect HRM tooltip", async (): Promise<void> => {
                        const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                        await tooltipHarness.show();

                        const tooltipText = await tooltipHarness.getTooltipText();
                        expect(tooltipText).toBe("Connect HRM");
                    });

                    it("should not apply blink class", (): void => {
                        const icon = fixture.nativeElement.querySelector("mat-icon");
                        expect(icon.classList.contains("blink")).toBe(false);
                    });
                });

                describe("with connecting status", (): void => {
                    beforeEach((): void => {
                        hrConnectionStatusSubject.next({ status: "connecting", deviceName: undefined });
                        fixture.detectChanges();
                    });

                    it("should display ecg_heart icon", (): void => {
                        const icon = fixture.nativeElement.querySelector("mat-icon");
                        expect(icon.textContent?.trim()).toBe("ecg_heart");
                    });

                    it("should apply blink class", (): void => {
                        const icon = fixture.nativeElement.querySelector("mat-icon");
                        expect(icon.classList.contains("blink")).toBe(true);
                    });

                    it("should display Connect HRM tooltip when no device name", async (): Promise<void> => {
                        const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                        await tooltipHarness.show();

                        const tooltipText = await tooltipHarness.getTooltipText();
                        expect(tooltipText).toBe("Connect HRM");
                    });
                });

                describe("with connected status", (): void => {
                    beforeEach((): void => {
                        hrConnectionStatusSubject.next({
                            status: "connected",
                            deviceName: "Heart Rate Device",
                        });
                        fixture.detectChanges();
                    });

                    it("should display ecg_heart icon", (): void => {
                        const icon = fixture.nativeElement.querySelector("mat-icon");
                        expect(icon.textContent?.trim()).toBe("ecg_heart");
                    });

                    it("should not apply blink class", (): void => {
                        const icon = fixture.nativeElement.querySelector("mat-icon");
                        expect(icon.classList.contains("blink")).toBe(false);
                    });

                    it("should display device name in tooltip", async (): Promise<void> => {
                        const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                        await tooltipHarness.show();

                        const tooltipText = await tooltipHarness.getTooltipText();
                        expect(tooltipText).toBe("Heart Rate Device");
                    });
                });

                describe("with searching status", (): void => {
                    beforeEach((): void => {
                        hrConnectionStatusSubject.next({ status: "searching", deviceName: undefined });
                        fixture.detectChanges();
                    });

                    it("should display ecg_heart icon", (): void => {
                        const icon = fixture.nativeElement.querySelector("mat-icon");
                        expect(icon.textContent?.trim()).toBe("ecg_heart");
                    });

                    it("should not apply blink class", (): void => {
                        const icon = fixture.nativeElement.querySelector("mat-icon");
                        expect(icon.classList.contains("blink")).toBe(false);
                    });

                    it("should display Searching tooltip", async (): Promise<void> => {
                        const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                        await tooltipHarness.show();

                        const tooltipText = await tooltipHarness.getTooltipText();
                        expect(tooltipText).toBe("Searching");
                    });
                });
            });
        });

        describe("when BLE is not available", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(false);
                navigatorBluetoothSpy.and.returnValue(undefined);

                fixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);

                heartRateMonitorSubject.next("ant");
                fixture.detectChanges();
            });

            it("should not render any content", (): void => {
                const content = fixture.nativeElement.querySelector("*");
                expect(content).toBeNull();
            });
        });
    });

    describe("as part of user interactions", (): void => {
        describe("heartRateMonitorDiscovery method", (): void => {
            it("should call heartRateService discover method", async (): Promise<void> => {
                await component.heartRateMonitorDiscovery();

                expect(mockHeartRateService.discover).toHaveBeenCalled();
            });

            it("should handle successful discovery", async (): Promise<void> => {
                mockHeartRateService.discover.and.resolveTo();

                await expectAsync(component.heartRateMonitorDiscovery()).toBeResolved();
            });

            it("should handle discovery failure", async (): Promise<void> => {
                const error = new Error("Discovery failed");
                mockHeartRateService.discover.and.rejectWith(error);

                await expectAsync(component.heartRateMonitorDiscovery()).toBeRejected();
            });
        });

        describe("button click interaction", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);

                heartRateMonitorSubject.next("ant");
                hrConnectionStatusSubject.next({ status: "disconnected", deviceName: undefined });
                fixture.detectChanges();
            });

            it("should trigger heartRateMonitorDiscovery when clicked", async (): Promise<void> => {
                spyOn(component, "heartRateMonitorDiscovery").and.resolveTo();

                const buttonHarness = await loader.getHarness(MatButtonHarness);
                await buttonHarness.click();

                expect(component.heartRateMonitorDiscovery).toHaveBeenCalled();
            });

            it("should have correct tooltip delay", (): void => {
                const button = fixture.nativeElement.querySelector("button[matTooltipShowDelay]");
                expect(button.getAttribute("mattooltipshowdelay")).toBe("1000");
            });
        });
    });

    describe("as part of signal reactivity", (): void => {
        describe("heartRateMonitorMode signal updates", (): void => {
            it("should update when ConfigManagerService emits new value", (): void => {
                fixture.detectChanges();
                expect(component.heartRateMonitorMode()).toBe("off");

                heartRateMonitorSubject.next("ant");
                fixture.detectChanges();

                expect(component.heartRateMonitorMode()).toBe("ant");
            });

            it("should reflect in template when mode changes to off", (): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);

                heartRateMonitorSubject.next("ant");
                fixture.detectChanges();

                let button = fixture.nativeElement.querySelector("button[mat-icon-button]");
                expect(button).toBeTruthy();

                heartRateMonitorSubject.next("off");
                fixture.detectChanges();

                button = fixture.nativeElement.querySelector("button[mat-icon-button]");
                expect(button).toBeNull();
            });

            it("should reflect in template when mode changes to on", (): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);

                heartRateMonitorSubject.next("off");
                fixture.detectChanges();

                let button = fixture.nativeElement.querySelector("button[mat-icon-button]");
                expect(button).toBeNull();

                heartRateMonitorSubject.next("ant");
                fixture.detectChanges();

                button = fixture.nativeElement.querySelector("button[mat-icon-button]");
                expect(button).toBeTruthy();
            });
        });

        describe("hrConnectionStatus signal updates", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);

                heartRateMonitorSubject.next("ant");
            });

            it("should update when MetricsService emits new status", (): void => {
                fixture.detectChanges();
                expect(component.hrConnectionStatus().status).toBe("disconnected");

                hrConnectionStatusSubject.next({ status: "connected", deviceName: "Device" });
                fixture.detectChanges();

                expect(component.hrConnectionStatus().status).toBe("connected");
            });

            it("should update tooltip when device name changes", async (): Promise<void> => {
                hrConnectionStatusSubject.next({ status: "connected", deviceName: undefined });
                fixture.detectChanges();

                let tooltipHarness = await loader.getHarness(MatTooltipHarness);
                await tooltipHarness.show();
                expect(await tooltipHarness.getTooltipText()).toBe("Connect HRM");

                hrConnectionStatusSubject.next({ status: "connected", deviceName: "My Device" });
                fixture.detectChanges();

                tooltipHarness = await loader.getHarness(MatTooltipHarness);
                await tooltipHarness.show();
                expect(await tooltipHarness.getTooltipText()).toBe("My Device");
            });

            it("should update icon when status changes", (): void => {
                hrConnectionStatusSubject.next({ status: "disconnected", deviceName: undefined });
                fixture.detectChanges();

                let icon = fixture.nativeElement.querySelector("mat-icon");
                expect(icon.textContent?.trim()).toBe("favorite");

                hrConnectionStatusSubject.next({ status: "connected", deviceName: "Device" });
                fixture.detectChanges();

                icon = fixture.nativeElement.querySelector("mat-icon");
                expect(icon.textContent?.trim()).toBe("ecg_heart");
            });

            it("should update CSS class when connecting status changes", (): void => {
                hrConnectionStatusSubject.next({ status: "disconnected", deviceName: undefined });
                fixture.detectChanges();

                let icon = fixture.nativeElement.querySelector("mat-icon");
                expect(icon.classList.contains("blink")).toBe(false);

                hrConnectionStatusSubject.next({ status: "connecting", deviceName: undefined });
                fixture.detectChanges();

                icon = fixture.nativeElement.querySelector("mat-icon");
                expect(icon.classList.contains("blink")).toBe(true);
            });
        });
    });

    describe("as part of host binding behavior", (): void => {
        describe("display style binding", (): void => {
            it("should set display to contents when heart rate monitor is off", (): void => {
                heartRateMonitorSubject.next("off");
                fixture.detectChanges();

                const hostElement = fixture.nativeElement;
                const computedStyle = getComputedStyle(hostElement);
                expect(computedStyle.display).toBe("contents");
            });

            it("should set display to block when heart rate monitor is not off", (): void => {
                heartRateMonitorSubject.next("ant");
                fixture.detectChanges();

                const hostElement = fixture.nativeElement;
                const computedStyle = getComputedStyle(hostElement);
                expect(computedStyle.display).toBe("block");
            });
        });
    });

    describe("as part of edge case handling", (): void => {
        describe("with null or undefined connection status", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);

                heartRateMonitorSubject.next("ant");
                fixture.detectChanges();
            });

            it("should handle null device name gracefully", async (): Promise<void> => {
                hrConnectionStatusSubject.next({ status: "connected", deviceName: undefined });
                fixture.detectChanges();

                const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                await tooltipHarness.show();

                const tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("Connect HRM");
            });

            it("should handle undefined connection status", (): void => {
                hrConnectionStatusSubject.next({ status: "disconnected", deviceName: undefined });
                fixture.detectChanges();

                expect(component.hrConnectionStatus().status).toBe("disconnected");
                expect(component.hrConnectionStatus().deviceName).toBeUndefined();
            });
        });

        describe("with rapid status changes", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(false);
                navigatorBluetoothSpy.and.returnValue(undefined);

                fixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);

                heartRateMonitorSubject.next("ant");
                fixture.detectChanges();
            });

            it("should handle multiple rapid status changes", async (): Promise<void> => {
                const statuses: Array<IHRConnectionStatus> = [
                    { status: "disconnected", deviceName: undefined },
                    { status: "connecting", deviceName: undefined },
                    { status: "connected", deviceName: "Device" },
                    { status: "disconnected", deviceName: undefined },
                ];

                statuses.forEach((status: IHRConnectionStatus): void => {
                    hrConnectionStatusSubject.next(status);
                    fixture.detectChanges();
                });

                expect(component.hrConnectionStatus().status).toBe("disconnected");
            });

            it("should handle concurrent discovery calls", async (): Promise<void> => {
                const spy = spyOn(component, "heartRateMonitorDiscovery").and.callThrough();

                const promises = [
                    component.heartRateMonitorDiscovery(),
                    component.heartRateMonitorDiscovery(),
                    component.heartRateMonitorDiscovery(),
                ];

                await Promise.all(promises);

                expect(spy).toHaveBeenCalledTimes(3);
                expect(mockHeartRateService.discover).toHaveBeenCalledTimes(3);
            });
        });

        describe("with browser compatibility issues", (): void => {
            it("should handle missing isSecureContext", (): void => {
                isSecureContextSpy.and.returnValue(undefined as unknown as boolean);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                const newFixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                const newComponent = newFixture.componentInstance;

                expect(newComponent.isBleAvailable).toBe(false);
            });

            it("should handle missing navigator.bluetooth", (): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue(undefined);

                const newFixture = TestBed.createComponent(ConnectHeartRateButtonComponent);
                const newComponent = newFixture.componentInstance;

                expect(newComponent.isBleAvailable).toBe(false);
            });
        });
    });
});
