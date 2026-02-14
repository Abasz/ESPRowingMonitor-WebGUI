import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatCheckboxHarness } from "@angular/material/checkbox/testing";
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
            getItem: vi.fn().mockReturnValue(true),
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
        it("should initialize from config", (): void => {
            expect(component.settingsForm.controls.showPeakForceInTitle.value).toBe(true);
            expect(mockConfigManager.getItem).toHaveBeenCalledWith("displayShowPeakForceInTitle");
        });

        it("should initialize unchecked when config is false", (): void => {
            vi.mocked(mockConfigManager.getItem).mockReturnValue(false);

            const localFixture = TestBed.createComponent(DisplaySettingsComponent);
            const localComponent = localFixture.componentInstance;

            expect(localComponent.settingsForm.controls.showPeakForceInTitle.value).toBe(false);
        });

        it("should initialize unchecked when config is true", (): void => {
            vi.mocked(mockConfigManager.getItem).mockReturnValue(true);

            const localFixture = TestBed.createComponent(DisplaySettingsComponent);
            const localComponent = localFixture.componentInstance;

            expect(localComponent.settingsForm.controls.showPeakForceInTitle.value).toBe(true);
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render the checkbox", async (): Promise<void> => {
            const checkbox = await loader.getHarness(MatCheckboxHarness);

            expect(checkbox).toBeTruthy();
        });
    });

    describe("form validation and state", (): void => {
        it("should mark the form as dirty when toggled", async (): Promise<void> => {
            const checkbox = await loader.getHarness(MatCheckboxHarness);

            expect(component.settingsForm.dirty).toBe(false);

            await checkbox.toggle();

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
