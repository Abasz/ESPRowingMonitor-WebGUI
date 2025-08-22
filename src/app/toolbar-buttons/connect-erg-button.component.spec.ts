import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatButtonHarness } from "@angular/material/button/testing";
import { MatIconHarness } from "@angular/material/icon/testing";
import { MatTooltipHarness } from "@angular/material/tooltip/testing";
import { BehaviorSubject } from "rxjs";

import { BleServiceNames } from "../../common/ble.interfaces";
import { IErgConnectionStatus } from "../../common/common.interfaces";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";

import { ConnectErgButtonComponent } from "./connect-erg-button.component";

describe("ConnectErgButtonComponent", (): void => {
    let component: ConnectErgButtonComponent;
    let fixture: ComponentFixture<ConnectErgButtonComponent>;
    let loader: HarnessLoader;
    let mockErgConnectionService: jasmine.SpyObj<ErgConnectionService>;
    let ergConnectionStatusSubject: BehaviorSubject<IErgConnectionStatus>;
    let isSecureContextSpy: jasmine.Spy<() => boolean>;
    let navigatorBluetoothSpy: jasmine.Spy<() => Bluetooth | undefined>;

    const mockErgConnectionStatus: IErgConnectionStatus = {
        status: "disconnected",
        deviceName: undefined,
    };

    beforeEach(async (): Promise<void> => {
        ergConnectionStatusSubject = new BehaviorSubject<IErgConnectionStatus>(mockErgConnectionStatus);

        mockErgConnectionService = jasmine.createSpyObj("ErgConnectionService", [
            "discover",
            "connectionStatus$",
        ]);
        mockErgConnectionService.discover.and.resolveTo();

        mockErgConnectionService.connectionStatus$.and.returnValue(ergConnectionStatusSubject.asObservable());

        await TestBed.configureTestingModule({
            imports: [ConnectErgButtonComponent],
            providers: [
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        isSecureContextSpy = spyOnProperty(window, "isSecureContext", "get").and.returnValue(true);
        navigatorBluetoothSpy = spyOnProperty(navigator, "bluetooth", "get").and.returnValue(
            {} as unknown as Bluetooth,
        );

        fixture = TestBed.createComponent(ConnectErgButtonComponent);
        component = fixture.componentInstance;
        loader = TestbedHarnessEnvironment.loader(fixture);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize BleConnectionStatusIcons property", (): void => {
            expect(component.BleConnectionStatusIcons).toEqual({
                connected: "bluetooth_connected",
                connecting: "bluetooth_connected",
                searching: "bluetooth_searching",
                disconnected: "bluetooth",
            });
        });

        it("should initialize BleServiceNames property", (): void => {
            expect(component.BleServiceNames).toBe(BleServiceNames);
        });

        it("should initialize ergConnectionStatus signal", (): void => {
            fixture.detectChanges();

            expect(component.ergConnectionStatus()).toEqual(mockErgConnectionStatus);
        });

        it("should detect BLE availability correctly when secure context", (): void => {
            expect(component.isBleAvailable).toBe(true);
        });

        it("should detect BLE unavailability when not secure context", (): void => {
            isSecureContextSpy.and.returnValue(false);

            const newFixture = TestBed.createComponent(ConnectErgButtonComponent);
            const newComponent = newFixture.componentInstance;

            expect(newComponent.isBleAvailable).toBe(false);
        });

        it("should detect BLE unavailability when bluetooth API missing", (): void => {
            navigatorBluetoothSpy.and.returnValue(undefined);

            const newFixture = TestBed.createComponent(ConnectErgButtonComponent);
            const newComponent = newFixture.componentInstance;

            expect(newComponent.isBleAvailable).toBe(false);
        });
    });

    describe("as part of template rendering", (): void => {
        describe("when BLE is available", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                // recreate the fixture so component reads the updated globals
                fixture = TestBed.createComponent(ConnectErgButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);
            });

            it("should render button element", async (): Promise<void> => {
                fixture.detectChanges();

                const buttonHarness = await loader.getHarness(MatButtonHarness);
                expect(buttonHarness).toBeTruthy();
            });

            it("should render mat-icon element", async (): Promise<void> => {
                fixture.detectChanges();

                const iconHarness = await loader.getHarness(MatIconHarness);
                expect(iconHarness).toBeTruthy();
            });

            describe("with disconnected status", (): void => {
                beforeEach((): void => {
                    ergConnectionStatusSubject.next({ status: "disconnected", deviceName: undefined });
                });

                it("should display correct icon", async (): Promise<void> => {
                    fixture.detectChanges();

                    const iconHarness = await loader.getHarness(MatIconHarness);
                    const iconName = await iconHarness.getName();
                    expect(iconName).toBe("bluetooth");
                });

                it("should display default tooltip", async (): Promise<void> => {
                    fixture.detectChanges();

                    const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                    await tooltipHarness.show();
                    const tooltipText = await tooltipHarness.getTooltipText();
                    expect(tooltipText).toBe("Connect ESPRM");
                });

                it("should not have blink CSS class", (): void => {
                    fixture.detectChanges();

                    const matIcon = fixture.nativeElement.querySelector("mat-icon");
                    expect(matIcon.classList.contains("blink")).toBe(false);
                });
            });

            describe("with connecting status", (): void => {
                beforeEach((): void => {
                    ergConnectionStatusSubject.next({ status: "connecting", deviceName: undefined });
                });

                it("should display correct icon", async (): Promise<void> => {
                    fixture.detectChanges();

                    const iconHarness = await loader.getHarness(MatIconHarness);
                    const iconName = await iconHarness.getName();
                    expect(iconName).toBe("bluetooth_connected");
                });

                it("should display default tooltip", async (): Promise<void> => {
                    fixture.detectChanges();

                    const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                    await tooltipHarness.show();
                    const tooltipText = await tooltipHarness.getTooltipText();
                    expect(tooltipText).toBe("Connect ESPRM");
                });

                it("should have blink CSS class", (): void => {
                    fixture.detectChanges();

                    const matIcon = fixture.nativeElement.querySelector("mat-icon");
                    expect(matIcon.classList.contains("blink")).toBe(true);
                });
            });

            describe("with connected status", (): void => {
                beforeEach((): void => {
                    ergConnectionStatusSubject.next({ status: "connected", deviceName: "Test Device" });
                });

                it("should display correct icon", async (): Promise<void> => {
                    fixture.detectChanges();

                    const iconHarness = await loader.getHarness(MatIconHarness);
                    const iconName = await iconHarness.getName();
                    expect(iconName).toBe("bluetooth_connected");
                });

                it("should display device name in tooltip", async (): Promise<void> => {
                    fixture.detectChanges();

                    const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                    await tooltipHarness.show();
                    const tooltipText = await tooltipHarness.getTooltipText();
                    expect(tooltipText).toBe("Test Device");
                });

                it("should not have blink CSS class", (): void => {
                    fixture.detectChanges();

                    const matIcon = fixture.nativeElement.querySelector("mat-icon");
                    expect(matIcon.classList.contains("blink")).toBe(false);
                });
            });

            describe("with searching status", (): void => {
                beforeEach((): void => {
                    ergConnectionStatusSubject.next({ status: "searching", deviceName: undefined });
                });

                it("should display correct icon", async (): Promise<void> => {
                    fixture.detectChanges();

                    const iconHarness = await loader.getHarness(MatIconHarness);
                    const iconName = await iconHarness.getName();
                    expect(iconName).toBe("bluetooth_searching");
                });

                it("should display searching tooltip", async (): Promise<void> => {
                    fixture.detectChanges();

                    const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                    await tooltipHarness.show();
                    const tooltipText = await tooltipHarness.getTooltipText();
                    expect(tooltipText).toBe("Searching");
                });

                it("should not have blink CSS class", (): void => {
                    fixture.detectChanges();

                    const matIcon = fixture.nativeElement.querySelector("mat-icon");
                    expect(matIcon.classList.contains("blink")).toBe(false);
                });
            });
        });

        describe("when BLE is not available", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(false);
                navigatorBluetoothSpy.and.returnValue(undefined);

                // recreate the fixture so component reads the updated globals
                fixture = TestBed.createComponent(ConnectErgButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);
            });

            it("should not render any content", (): void => {
                fixture.detectChanges();

                const content = fixture.nativeElement.querySelector("*");
                expect(content).toBeNull();
            });
        });
    });

    describe("ergoMonitorDiscovery method", (): void => {
        it("should call ergConnectionService discover method", async (): Promise<void> => {
            await component.ergoMonitorDiscovery();

            expect(mockErgConnectionService.discover).toHaveBeenCalled();
        });

        it("should handle successful discovery", async (): Promise<void> => {
            mockErgConnectionService.discover.and.resolveTo();

            await expectAsync(component.ergoMonitorDiscovery()).toBeResolved();
        });

        it("should handle discovery failure", async (): Promise<void> => {
            const error = new Error("Discovery failed");
            mockErgConnectionService.discover.and.rejectWith(error);

            await expectAsync(component.ergoMonitorDiscovery()).toBeRejected();
        });
    });

    describe("as part of user interactions", (): void => {
        describe("button click interaction", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(ConnectErgButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);
                fixture.detectChanges();
            });

            it("should trigger ergoMonitorDiscovery when clicked", async (): Promise<void> => {
                spyOn(component, "ergoMonitorDiscovery").and.resolveTo();

                const buttonHarness = await loader.getHarness(MatButtonHarness);
                await buttonHarness.click();

                expect(component.ergoMonitorDiscovery).toHaveBeenCalled();
            });

            it("should have correct tooltip delay", (): void => {
                const button = fixture.nativeElement.querySelector("button[matTooltipShowDelay]");
                expect(button.getAttribute("mattooltipshowdelay")).toBe("1000");
            });
        });
    });

    describe("as part of signal reactivity", (): void => {
        describe("ergConnectionStatus signal updates", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(ConnectErgButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);
            });

            it("should update when ErgConnectionService emits new value", (): void => {
                fixture.detectChanges();
                expect(component.ergConnectionStatus()).toEqual({
                    status: "disconnected",
                    deviceName: undefined,
                });

                ergConnectionStatusSubject.next({
                    status: "connected",
                    deviceName: "New Device",
                });
                fixture.detectChanges();

                expect(component.ergConnectionStatus()).toEqual({
                    status: "connected",
                    deviceName: "New Device",
                });
            });

            it("should update tooltip when device name changes", async (): Promise<void> => {
                fixture.detectChanges();

                let tooltipHarness = await loader.getHarness(MatTooltipHarness);
                await tooltipHarness.show();
                let tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("Connect ESPRM");

                ergConnectionStatusSubject.next({ status: "connected", deviceName: "Updated Device" });
                fixture.detectChanges();

                tooltipHarness = await loader.getHarness(MatTooltipHarness);
                await tooltipHarness.show();
                tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("Updated Device");
            });

            it("should update icon when status changes", async (): Promise<void> => {
                fixture.detectChanges();
                let iconHarness = await loader.getHarness(MatIconHarness);
                let iconName = await iconHarness.getName();
                expect(iconName).toBe("bluetooth");

                ergConnectionStatusSubject.next({ status: "searching", deviceName: undefined });
                fixture.detectChanges();

                iconHarness = await loader.getHarness(MatIconHarness);
                iconName = await iconHarness.getName();
                expect(iconName).toBe("bluetooth_searching");
            });

            it("should update CSS class when connecting status changes", (): void => {
                fixture.detectChanges();
                let matIcon = fixture.nativeElement.querySelector("mat-icon");
                expect(matIcon.classList.contains("blink")).toBe(false);

                ergConnectionStatusSubject.next({ status: "connecting", deviceName: undefined });
                fixture.detectChanges();

                matIcon = fixture.nativeElement.querySelector("mat-icon");
                expect(matIcon.classList.contains("blink")).toBe(true);
            });
        });
    });

    describe("as part of edge case handling", (): void => {
        describe("with null or undefined connection status", (): void => {
            beforeEach((): void => {
                isSecureContextSpy.and.returnValue(true);
                navigatorBluetoothSpy.and.returnValue({} as unknown as Bluetooth);

                fixture = TestBed.createComponent(ConnectErgButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);
            });

            it("should handle null device name gracefully", async (): Promise<void> => {
                ergConnectionStatusSubject.next({
                    status: "connected",
                    deviceName: null as unknown as string,
                });
                fixture.detectChanges();

                const tooltipHarness = await loader.getHarness(MatTooltipHarness);
                await tooltipHarness.show();
                const tooltipText = await tooltipHarness.getTooltipText();
                expect(tooltipText).toBe("Connect ESPRM");
            });

            it("should handle undefined connection status gracefully", async (): Promise<void> => {
                ergConnectionStatusSubject.next({
                    status: "disconnected",
                    deviceName: undefined,
                });
                fixture.detectChanges();

                const iconHarness = await loader.getHarness(MatIconHarness);
                const iconName = await iconHarness.getName();
                expect(iconName).toBe("bluetooth");
            });
        });

        describe("with rapid status changes", (): void => {
            beforeEach((): void => {
                fixture = TestBed.createComponent(ConnectErgButtonComponent);
                component = fixture.componentInstance;
                loader = TestbedHarnessEnvironment.loader(fixture);
            });

            it("should handle multiple rapid status changes", async (): Promise<void> => {
                ergConnectionStatusSubject.next({
                    status: "connecting",
                    deviceName: undefined,
                });
                ergConnectionStatusSubject.next({
                    status: "connected",
                    deviceName: "Device 1",
                });
                ergConnectionStatusSubject.next({
                    status: "disconnected",
                    deviceName: undefined,
                });
                fixture.detectChanges();

                expect(component.ergConnectionStatus().status).toBe("disconnected");
                const iconHarness = await loader.getHarness(MatIconHarness);
                const iconName = await iconHarness.getName();
                expect(iconName).toBe("bluetooth");
            });

            it("should handle concurrent discovery calls", async (): Promise<void> => {
                const discoveryPromise1 = component.ergoMonitorDiscovery();
                const discoveryPromise2 = component.ergoMonitorDiscovery();

                await Promise.all([discoveryPromise1, discoveryPromise2]);

                expect(mockErgConnectionService.discover).toHaveBeenCalledTimes(2);
            });
        });

        describe("with browser compatibility issues", (): void => {
            it("should handle missing isSecureContext", (): void => {
                isSecureContextSpy.and.returnValue(undefined as unknown as boolean);

                const newFixture = TestBed.createComponent(ConnectErgButtonComponent);
                const newComponent = newFixture.componentInstance;

                expect(newComponent.isBleAvailable).toBe(false);
            });

            it("should handle missing navigator.bluetooth", (): void => {
                navigatorBluetoothSpy.and.returnValue(undefined);

                const newFixture = TestBed.createComponent(ConnectErgButtonComponent);
                const newComponent = newFixture.componentInstance;

                expect(newComponent.isBleAvailable).toBe(false);
            });
        });
    });
});
