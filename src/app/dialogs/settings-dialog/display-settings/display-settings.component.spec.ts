import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatButtonToggleGroupHarness } from "@angular/material/button-toggle/testing";
import { MatCheckboxHarness } from "@angular/material/checkbox/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDashboardLayoutConfig } from "../../../../common/common.interfaces";
import { ConfigManagerService } from "../../../../common/services/config-manager.service";
import {
    DEFAULT_LANDSCAPE_LAYOUT,
    DEFAULT_PORTRAIT_LAYOUT,
    LANDSCAPE_GRID_COLUMNS,
    LANDSCAPE_GRID_ROWS,
    PORTRAIT_GRID_COLUMNS,
    PORTRAIT_GRID_ROWS,
} from "../../../dashboard/dashboard-tile-definitions";
import { createMockConfig } from "../settings-dialog.test.helpers";

import { DisplaySettingsComponent } from "./display-settings.component";

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

    afterEach((): void => {
        vi.restoreAllMocks();
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

        it("should render the unit system toggle group", async (): Promise<void> => {
            const toggleGroup = await loader.getHarness(
                MatButtonToggleGroupHarness.with({ selector: '[formControlName="unitSystem"]' }),
            );

            expect(await toggleGroup.getToggles()).toHaveLength(2);
        });

        it("should render the tile layout editor section", (): void => {
            fixture.detectChanges();

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

    describe("form validation and state", (): void => {
        it("should mark the form as dirty when checkbox is toggled", async (): Promise<void> => {
            const checkbox = await loader.getHarness(MatCheckboxHarness);

            expect(component.settingsForm.dirty).toBe(false);

            await checkbox.toggle();

            expect(component.settingsForm.dirty).toBe(true);
        });

        it("should mark the form as dirty when unit system is changed", async (): Promise<void> => {
            const toggleGroup = await loader.getHarness(
                MatButtonToggleGroupHarness.with({ selector: '[formControlName="unitSystem"]' }),
            );

            expect(component.settingsForm.dirty).toBe(false);

            const toggles = await toggleGroup.getToggles();
            await toggles[1].check();
            fixture.detectChanges();

            expect(component.settingsForm.dirty).toBe(true);
        });

        it("should mark the form as dirty when averaging mode is changed", async (): Promise<void> => {
            const toggleGroup = await loader.getHarness(
                MatButtonToggleGroupHarness.with({ selector: '[formControlName="averagingMode"]' }),
            );

            expect(component.settingsForm.dirty).toBe(false);

            const toggles = await toggleGroup.getToggles();
            await toggles[1].check();
            fixture.detectChanges();

            expect(component.settingsForm.dirty).toBe(true);
        });

        it("should emit validity on changes", async (): Promise<void> => {
            const emitSpy = vi.spyOn(component.isFormValidChange, "emit");
            const checkbox = await loader.getHarness(MatCheckboxHarness);

            await checkbox.toggle();

            expect(emitSpy).toHaveBeenCalledWith(true);
        });
    });

    describe("getForm method", (): void => {
        it("should return the settings form", (): void => {
            expect(component.getForm()).toBe(component.settingsForm);
        });
    });

    describe("averaging configuration", (): void => {
        it("should initialize averagingMode from config", (): void => {
            expect(component.settingsForm.controls.averagingMode.value).toBe("off");
        });

        it("should initialize averagingWindowSize from config", (): void => {
            expect(component.settingsForm.controls.averagingWindowSize.value).toBe(3);
        });

        it("should disable the slider when averagingMode is off", (): void => {
            expect(component.isAveragingSliderDisabled()).toBe(true);
        });

        it("should enable the slider when averagingMode is set to performance", (): void => {
            component.settingsForm.controls.averagingMode.setValue("performance");

            expect(component.isAveragingSliderDisabled()).toBe(false);
        });

        it("should enable the slider when averagingMode is set to all", (): void => {
            component.settingsForm.controls.averagingMode.setValue("all");

            expect(component.isAveragingSliderDisabled()).toBe(false);
        });

        it("should return the correct averaging config via getAveragingConfig", (): void => {
            component.settingsForm.controls.averagingMode.setValue("performance");
            component.settingsForm.controls.averagingWindowSize.setValue(5);

            expect(component.getAveragingConfig()).toEqual({ mode: "performance", windowSize: 5 });
        });

        it("should initialize with custom averaging config from config", (): void => {
            vi.mocked(mockConfigManager.getConfig).mockReturnValue(
                createMockConfig({
                    display: {
                        averaging: {
                            mode: "all",
                            windowSize: 4,
                        },
                    },
                }),
            );

            const localFixture = TestBed.createComponent(DisplaySettingsComponent);
            const localComponent = localFixture.componentInstance;

            expect(localComponent.settingsForm.controls.averagingMode.value).toBe("all");
            expect(localComponent.settingsForm.controls.averagingWindowSize.value).toBe(4);
        });
    });

    describe("layout management", (): void => {
        it("should initialize landscape layout from config", (): void => {
            expect(component.landscapeLayout()).toEqual(DEFAULT_LANDSCAPE_LAYOUT);
        });

        it("should initialize portrait layout from config", (): void => {
            expect(component.portraitLayout()).toEqual(DEFAULT_PORTRAIT_LAYOUT);
        });

        it("should initialize orientationLock from config", (): void => {
            expect(component.orientationLock()).toBe("auto");
        });

        it("should initialize isLayoutDirty as false", (): void => {
            expect(component.isLayoutDirty()).toBe(false);
        });

        it("should return the current layout config via getLayoutConfig", (): void => {
            expect(component.getLayoutConfig()).toEqual({
                landscape: DEFAULT_LANDSCAPE_LAYOUT,
                portrait: DEFAULT_PORTRAIT_LAYOUT,
                orientationLock: "auto",
            });
        });

        it("should update landscape layout on onLayoutChange when editing landscape", (): void => {
            const newLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    },
                ],
            };

            component.onLayoutChange(newLayout);

            expect(component.landscapeLayout()).toEqual(newLayout);
            expect(component.getLayoutConfig().landscape).toEqual(newLayout);
        });

        it("should update portrait layout on onLayoutChange when editing portrait", (): void => {
            component.onEditOrientationChange("portrait");

            const newLayout: IDashboardLayoutConfig = { tiles: [] };
            component.onLayoutChange(newLayout);

            expect(component.portraitLayout()).toEqual(newLayout);
            expect(component.getLayoutConfig().portrait).toEqual(newLayout);
        });

        it("should not affect portrait layout when changing landscape layout", (): void => {
            const newLayout: IDashboardLayoutConfig = {
                tiles: [
                    {
                        id: "distance",
                        position: { rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 2 },
                    },
                ],
            };

            component.onLayoutChange(newLayout);

            expect(component.portraitLayout()).toEqual(DEFAULT_PORTRAIT_LAYOUT);
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

        it("should mark layout as dirty on onOrientationLockChange", (): void => {
            component.onOrientationLockChange("portrait");

            expect(component.orientationLock()).toBe("portrait");
            expect(component.isLayoutDirty()).toBe(true);
        });

        it("should sync editorTabSelection when onOrientationLockChange is called with a non-auto value", (): void => {
            component.onOrientationLockChange("portrait");

            expect(component.editorOrientationSelection()).toBe("portrait");
        });

        it("should not change editorTabSelection when onOrientationLockChange is called with auto", (): void => {
            component.onEditOrientationChange("portrait");
            component.onOrientationLockChange("auto");

            expect(component.editorOrientationSelection()).toBe("portrait");
        });

        it("should emit form validity on onOrientationLockChange", (): void => {
            const emitSpy = vi.spyOn(component.isFormValidChange, "emit");

            component.onOrientationLockChange("landscape");

            expect(emitSpy).toHaveBeenCalledWith(true);
        });

        it("should default editorTabSelection to landscape", (): void => {
            expect(component.editorOrientationSelection()).toBe("landscape");
        });

        it("should switch editorTabSelection via onEditOrientationChange", (): void => {
            component.onEditOrientationChange("portrait");

            expect(component.editorOrientationSelection()).toBe("portrait");
        });

        it("should switch editorTabSelection back to landscape via onEditOrientationChange", (): void => {
            component.onEditOrientationChange("portrait");
            component.onEditOrientationChange("landscape");

            expect(component.editorOrientationSelection()).toBe("landscape");
        });

        describe("isEditorPortraitMode", (): void => {
            it("should return false by default (auto lock + landscape editorOrientationSelection)", (): void => {
                expect(component.isEditorPortraitMode()).toBe(false);
            });

            it("should return true when orientationLock is portrait regardless of editorOrientationSelection", (): void => {
                component.onOrientationLockChange("portrait");

                expect(component.isEditorPortraitMode()).toBe(true);
            });

            it("should return false when orientationLock is landscape regardless of editorOrientationSelection", (): void => {
                component.onEditOrientationChange("portrait");
                component.onOrientationLockChange("landscape");

                expect(component.isEditorPortraitMode()).toBe(false);
            });

            it("should return true when auto lock and editorOrientationSelection is portrait", (): void => {
                component.onEditOrientationChange("portrait");

                expect(component.isEditorPortraitMode()).toBe(true);
            });
        });

        describe("currentEditorLayout computed signal", (): void => {
            it("should return landscapeLayout in tileLayout when isEditorPortraitMode is false", (): void => {
                expect(component.currentEditorLayout().tileLayout).toBe(component.landscapeLayout());
            });

            it("should return portraitLayout in tileLayout when isEditorPortraitMode is true", (): void => {
                component.onEditOrientationChange("portrait");

                expect(component.currentEditorLayout().tileLayout).toBe(component.portraitLayout());
            });

            it("should return landscape grid dimensions when orientation is landscape", (): void => {
                expect(component.currentEditorLayout()).toEqual({
                    tileLayout: component.landscapeLayout(),
                    rows: LANDSCAPE_GRID_ROWS,
                    columns: LANDSCAPE_GRID_COLUMNS,
                });
            });

            it("should return portrait grid dimensions when orientation is portrait", (): void => {
                component.onEditOrientationChange("portrait");

                expect(component.currentEditorLayout()).toEqual({
                    tileLayout: component.portraitLayout(),
                    rows: PORTRAIT_GRID_ROWS,
                    columns: PORTRAIT_GRID_COLUMNS,
                });
            });
        });

        describe("onResetLayout method", (): void => {
            it("should reset landscape layout to initial config", (): void => {
                const changed: IDashboardLayoutConfig = { tiles: [] };
                component.onLayoutChange(changed);
                expect(component.landscapeLayout()).toEqual(changed);

                component.onResetLayout();

                expect(component.landscapeLayout()).toEqual(DEFAULT_LANDSCAPE_LAYOUT);
            });

            it("should reset portrait layout to initial config when in portrait mode", (): void => {
                component.onOrientationLockChange("portrait");

                const changed: IDashboardLayoutConfig = { tiles: [] };
                component.onLayoutChange(changed);
                expect(component.portraitLayout()).toEqual(changed);

                component.onResetLayout();

                expect(component.portraitLayout()).toEqual(DEFAULT_PORTRAIT_LAYOUT);
            });

            it("should return a new reference when resetting (not the original object)", (): void => {
                const originalRef = component.landscapeLayout();

                component.onLayoutChange({ tiles: [] });
                component.onResetLayout();

                expect(component.landscapeLayout()).not.toBe(originalRef);
                expect(component.landscapeLayout()).toEqual(DEFAULT_LANDSCAPE_LAYOUT);
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
            it("should clear the landscape layout to empty tiles", (): void => {
                component.onClearLayout();

                expect(component.landscapeLayout()).toEqual({ tiles: [] });
            });

            it("should clear the portrait layout when in portrait mode", (): void => {
                component.onOrientationLockChange("portrait");

                component.onClearLayout();

                expect(component.portraitLayout()).toEqual({ tiles: [] });
            });

            it("should not affect the other orientation layout when clearing landscape", (): void => {
                component.onClearLayout();

                expect(component.portraitLayout()).toEqual(DEFAULT_PORTRAIT_LAYOUT);
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
});
