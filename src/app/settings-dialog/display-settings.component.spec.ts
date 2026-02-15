import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatCheckboxHarness } from "@angular/material/checkbox/testing";
import { MatRadioGroupHarness } from "@angular/material/radio/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigManagerService } from "../../common/services/config-manager.service";

import { DisplaySettingsComponent } from "./display-settings.component";

describe("DisplaySettingsComponent", (): void => {
    let component: DisplaySettingsComponent;
    let fixture: ComponentFixture<DisplaySettingsComponent>;
    let loader: HarnessLoader;
    let mockConfigManager: Pick<ConfigManagerService, "getItem">;

    beforeEach(async (): Promise<void> => {
        mockConfigManager = {
            getItem: vi.fn().mockImplementation((_group: string, key: string): boolean | string => {
                if (key === "unitSystem") {
                    return "metric";
                }

                return true;
            }),
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
            expect(mockConfigManager.getItem).toHaveBeenCalledWith("display", "showPeakForceInTitle");
        });

        it("should initialize unitSystem from config", (): void => {
            expect(component.settingsForm.controls.unitSystem.value).toBe("metric");
            expect(mockConfigManager.getItem).toHaveBeenCalledWith("display", "unitSystem");
        });

        it("should initialize showPeakForceInTitle unchecked when config is false", (): void => {
            vi.mocked(mockConfigManager.getItem).mockImplementation(
                (_group: string, key: string): boolean | string => {
                    if (key === "unitSystem") {
                        return "metric";
                    }

                    return false;
                },
            );

            const localFixture = TestBed.createComponent(DisplaySettingsComponent);
            const localComponent = localFixture.componentInstance;

            expect(localComponent.settingsForm.controls.showPeakForceInTitle.value).toBe(false);
        });

        it("should initialize unitSystem to imperial when config is imperial", (): void => {
            vi.mocked(mockConfigManager.getItem).mockImplementation(
                (_group: string, key: string): boolean | string => {
                    if (key === "unitSystem") {
                        return "imperial";
                    }

                    return true;
                },
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
});
