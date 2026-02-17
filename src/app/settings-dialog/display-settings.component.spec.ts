import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatCheckboxHarness } from "@angular/material/checkbox/testing";
import { MatRadioGroupHarness } from "@angular/material/radio/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IDashboardLayoutConfig } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DEFAULT_DASHBOARD_LAYOUT } from "../dashboard/dashboard-tile-definitions";

import { DisplaySettingsComponent } from "./display-settings.component";
import { createMockConfig } from "./settings-dialog.test.helpers";

describe("DisplaySettingsComponent", (): void => {
    let component: DisplaySettingsComponent;
    let fixture: ComponentFixture<DisplaySettingsComponent>;
    let loader: HarnessLoader;
    let mockConfigManager: Pick<ConfigManagerService, "getConfig">;

    beforeEach(async (): Promise<void> => {
        mockConfigManager = {
            getConfig: vi.fn().mockReturnValue(createMockConfig()),
        };

        await TestBed.configureTestingModule({
            imports: [DisplaySettingsComponent],
            providers: [{ provide: ConfigManagerService, useValue: mockConfigManager }],
        }).compileComponents();

        fixture = TestBed.createComponent(DisplaySettingsComponent);
        component = fixture.componentInstance;
        loader = TestbedHarnessEnvironment.loader(fixture);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("as part of form initialization", (): void => {
        it("should initialize showPeakForceInTitle from config", (): void => {
            expect(component.settingsForm.controls.showPeakForceInTitle.value).toBe(true);
            expect(mockConfigManager.getConfig).toHaveBeenCalled();
        });

        it("should initialize unitSystem from config", (): void => {
            expect(component.settingsForm.controls.unitSystem.value).toBe("metric");
            expect(mockConfigManager.getConfig).toHaveBeenCalled();
        });

        it("should initialize showGridLines from config", (): void => {
            expect(component.settingsForm.controls.showGridLines.value).toBe(true);
            expect(mockConfigManager.getConfig).toHaveBeenCalled();
        });

        it("should initialize showAxisLabels from config", (): void => {
            expect(component.settingsForm.controls.showAxisLabels.value).toBe(true);
            expect(mockConfigManager.getConfig).toHaveBeenCalled();
        });

        it("should initialize showPeakForceInTitle unchecked when config is false", (): void => {
            vi.mocked(mockConfigManager.getConfig).mockReturnValue(
                createMockConfig({
                    display: {
                        forceCurve: {
                            showPeakForceInTitle: false,
                        },
                    },
                }),
            );

            const localFixture = TestBed.createComponent(DisplaySettingsComponent);
            const localComponent = localFixture.componentInstance;

            expect(localComponent.settingsForm.controls.showPeakForceInTitle.value).toBe(false);
        });

        it("should initialize unitSystem to imperial when config is imperial", (): void => {
            vi.mocked(mockConfigManager.getConfig).mockReturnValue(
                createMockConfig({
                    display: {
                        general: {
                            unitSystem: "imperial",
                        },
                    },
                }),
            );

            const localFixture = TestBed.createComponent(DisplaySettingsComponent);
            const localComponent = localFixture.componentInstance;

            expect(localComponent.settingsForm.controls.unitSystem.value).toBe("imperial");
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render the checkbox", async (): Promise<void> => {
            const checkbox = await loader.getHarness(MatCheckboxHarness);

            expect(checkbox).toBeTruthy();
        });

        it("should render the unit system radio group", async (): Promise<void> => {
            const radioGroup = await loader.getHarness(MatRadioGroupHarness);

            expect(await radioGroup.getRadioButtons()).toHaveLength(2);
        });
    });

    describe("form validation and state", (): void => {
        it("should mark the form as dirty when checkbox is toggled", async (): Promise<void> => {
            const checkbox = await loader.getHarness(MatCheckboxHarness);

            expect(component.settingsForm.dirty).toBe(false);

            await checkbox.toggle();

            expect(component.settingsForm.dirty).toBe(true);
        });

        it("should mark the form as dirty when unit system is changed", async (): Promise<void> => {
            const radioGroup = await loader.getHarness(MatRadioGroupHarness);

            expect(component.settingsForm.dirty).toBe(false);

            const radioButtons = await radioGroup.getRadioButtons();
            await radioButtons[1].check();
            fixture.detectChanges();

            expect(component.settingsForm.dirty).toBe(true);
        });

        it("should emit validity on changes", async (): Promise<void> => {
            const emitSpy = vi.spyOn(component.isFormValidChange, "emit");
            const checkbox = await loader.getHarness(MatCheckboxHarness);

            await checkbox.toggle();

            expect(emitSpy).toHaveBeenCalled();
        });
    });

    describe("getForm method", (): void => {
        it("should return the settings form", (): void => {
            expect(component.getForm()).toBe(component.settingsForm);
        });
    });

    describe("layout management", (): void => {
        it("should initialize layout from config", (): void => {
            expect(component.layout()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
        });

        it("should initialize isLayoutDirty as false", (): void => {
            expect(component.isLayoutDirty()).toBe(false);
        });

        it("should return the current layout via getLayout", (): void => {
            expect(component.getLayout()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
        });

        it("should update layout on onLayoutChange", (): void => {
            const newLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    },
                ],
            };

            component.onLayoutChange(newLayout);

            expect(component.layout()).toEqual(newLayout);
            expect(component.getLayout()).toEqual(newLayout);
        });

        it("should mark layout as dirty on onLayoutChange", (): void => {
            const newLayout: IDashboardLayoutConfig = { tiles: [] };

            component.onLayoutChange(newLayout);

            expect(component.isLayoutDirty()).toBe(true);
        });

        it("should emit form validity on onLayoutChange", (): void => {
            const emitSpy = vi.spyOn(component.isFormValidChange, "emit");
            const newLayout: IDashboardLayoutConfig = { tiles: [] };

            component.onLayoutChange(newLayout);

            expect(emitSpy).toHaveBeenCalledWith(true);
        });
        describe("onResetLayout method", (): void => {
            it("should reset layout to initial config", (): void => {
                const changed: IDashboardLayoutConfig = { tiles: [] };
                component.onLayoutChange(changed);
                expect(component.getLayout()).toEqual(changed);

                component.onResetLayout();

                expect(component.getLayout()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
            });

            it("should return a new reference when resetting (not the original object)", (): void => {
                component.onLayoutChange({ tiles: [] });
                const originalRef = component.getLayout();

                component.onResetLayout();

                expect(component.getLayout()).not.toBe(originalRef);
                expect(component.getLayout()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
            });

            it("should mark layout as dirty after reset", (): void => {
                component.onResetLayout();

                expect(component.isLayoutDirty()).toBe(true);
            });

            it("should emit form validity after reset", (): void => {
                const emitSpy = vi.spyOn(component.isFormValidChange, "emit");

                component.onResetLayout();

                expect(emitSpy).toHaveBeenCalledWith(true);
            });
        });

        describe("onClearLayout method", (): void => {
            it("should clear the layout to empty tiles", (): void => {
                component.onClearLayout();

                expect(component.getLayout()).toEqual({ tiles: [] });
            });

            it("should mark layout as dirty after clear", (): void => {
                component.onClearLayout();

                expect(component.isLayoutDirty()).toBe(true);
            });

            it("should emit form validity after clear", (): void => {
                const emitSpy = vi.spyOn(component.isFormValidChange, "emit");

                component.onClearLayout();

                expect(emitSpy).toHaveBeenCalledWith(true);
            });
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render the tile layout editor section", (): void => {
            const layoutEditor = fixture.nativeElement.querySelector("app-tile-layout-editor");

            expect(layoutEditor).toBeTruthy();
        });

        it("should render the Dashboard Layout heading", (): void => {
            const headings = fixture.nativeElement.querySelectorAll("h4");
            const layoutHeading = Array.from(headings).find(
                (h: unknown): boolean => (h as HTMLElement).textContent?.trim() === "Dashboard Layout",
            );

            expect(layoutHeading).toBeTruthy();
        });
    });
});
