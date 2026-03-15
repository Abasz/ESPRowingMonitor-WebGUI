import { signal } from "@angular/core";
import { ComponentFixture } from "@angular/core/testing";
import { MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { of, take } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_LANDSCAPE_LAYOUT, DEFAULT_PORTRAIT_LAYOUT } from "../dashboard/dashboard-tile-definitions";

import { SettingsDialogComponent } from "./settings-dialog.component";
import {
    createMockDisplayForm,
    createMockGeneralForm,
    createMockRowingForm,
    createSettingsDialogTestBed,
    ISettingsDialogTestBedResult,
    setupMockChildComponents,
} from "./settings-dialog.test.helpers";

describe("SettingsDialogComponent", (): void => {
    let component: SettingsDialogComponent;
    let fixture: ComponentFixture<SettingsDialogComponent>;
    let mockMatDialogRef: ISettingsDialogTestBedResult["mockMatDialogRef"];
    let mockErgSettingsService: ISettingsDialogTestBedResult["mockErgSettingsService"];
    let mockSnackBar: ISettingsDialogTestBedResult["mockSnackBar"];
    let mockUtilsService: ISettingsDialogTestBedResult["mockUtilsService"];
    let breakpointSubject: ISettingsDialogTestBedResult["breakpointSubject"];

    beforeEach(async (): Promise<void> => {
        // eslint-disable-next-line @typescript-eslint/typedef -- There is a bug in ESLint wanting type annotation on this but that results in invalid TS syntax
        ({
            fixture,
            component,
            mockMatDialogRef,
            mockErgSettingsService,
            mockSnackBar,
            mockUtilsService,
            breakpointSubject,
        } = await createSettingsDialogTestBed());
    });

    describe("as part of the initialization and layout management", (): void => {
        it("should be created", (): void => {
            expect(component).toBeTruthy();
        });

        it("should set disableClose to true on initialization", (): void => {
            expect(mockMatDialogRef.disableClose).toBe(true);
        });

        it("should have the correct dialog title", async (): Promise<void> => {
            const titleElement = fixture.debugElement.nativeElement.querySelector("[mat-dialog-title]");
            expect(titleElement.textContent.trim()).toBe("Settings");
        });

        it("should call MatDialogRef.updateSize when breakpoint changes", (): void => {
            expect(mockMatDialogRef.updateSize).toHaveBeenCalled();
        });

        it("should call UtilsService.breakpointHelper on initialization", (): void => {
            expect(mockUtilsService.breakpointHelper).toHaveBeenCalledWith([[599, "max"]]);
        });

        it("should have breakPoints$ observable", (): void => {
            expect(component.breakPoints$).toBeDefined();
        });

        describe("handle responsive layout", (): void => {
            it("when big screen", (): void => {
                breakpointSubject.next({ maxW599: false });

                component.breakPoints$.pipe(take(1)).subscribe((isSmallScreen: boolean): void => {
                    expect(isSmallScreen).toBe(false);
                    expect(mockMatDialogRef.updateSize).toHaveBeenCalledWith("560px");
                });
            });

            it("when small screen", (): void => {
                breakpointSubject.next({ maxW599: true });

                component.breakPoints$.pipe(take(1)).subscribe((isSmallScreen: boolean): void => {
                    expect(isSmallScreen).toBe(true);
                    expect(mockMatDialogRef.updateSize).toHaveBeenCalledWith("90%");
                });
            });
        });

        it("should receive correct data from MAT_DIALOG_DATA injection", (): void => {
            expect(component.data).toBeDefined();
            expect(component.data.rowerSettings).toBeDefined();
            expect(component.data.rowerSettings.generalSettings).toBeDefined();
            expect(component.data.rowerSettings.rowingSettings).toBeDefined();
            expect(component.data.ergConnectionStatus).toBeDefined();
            expect(component.data.deviceInfo).toBeDefined();

            expect(component.data.ergConnectionStatus.deviceName).toBe("Test Device");
            expect(component.data.deviceInfo.modelNumber).toBe("Test Model");
        });
    });

    describe("dialog actions", (): void => {
        it("should have proper buttons with correct state", async (): Promise<void> => {
            const dialogActions = fixture.debugElement.nativeElement.querySelector("[mat-dialog-actions]");
            const buttons = dialogActions.querySelectorAll("button");
            expect(buttons).toHaveLength(2);

            const saveButton = dialogActions.querySelector("button[ng-reflect-disabled]") || buttons[0];
            const cancelButton = buttons[1];

            expect(saveButton.textContent.trim()).toBe("Save");
            expect(cancelButton.textContent.trim()).toBe("Cancel");

            setupMockChildComponents(component, false, false, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);
            await fixture.whenStable();

            expect(saveButton.disabled).toBe(true);

            setupMockChildComponents(component, true, true, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);
            await fixture.whenStable();

            expect(saveButton.disabled).toBe(false);
        });

        it("should call MatDialogRef.close() when closeDialog method is called with no dirty forms", (): void => {
            setupMockChildComponents(component, false, false);

            component.handleDialogClose();

            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });

        it("should display MatSnackBar confirmation when forms are dirty on close", async (): Promise<void> => {
            setupMockChildComponents(component, true, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
        });

        it("should handle snackbar dismissal without action in close dialog", async (): Promise<void> => {
            const mockSnackBarRef = {
                onAction: vi.fn().mockReturnValue(of()),
            };
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
                mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
            );

            setupMockChildComponents(component, true, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockSnackBarRef.onAction).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });

        it("should respond to ESC keydown events properly", (): void => {
            expect(mockMatDialogRef.keydownEvents).toHaveBeenCalled();
        });

        it("should handle ESC key with clean forms", (): void => {
            setupMockChildComponents(component, false, false);

            component.handleDialogClose();

            expect(mockMatDialogRef.close).toHaveBeenCalled();
            expect(mockSnackBar.openFromComponent).not.toHaveBeenCalled();
        });

        it("should handle ESC key with dirty forms showing confirmation", (): void => {
            setupMockChildComponents(component, true, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });

        it("should respond to backdrop click events properly", (): void => {
            expect(mockMatDialogRef.backdropClick).toHaveBeenCalled();
        });

        it("should handle backdrop click with clean forms", (): void => {
            setupMockChildComponents(component, false, false);

            component.handleDialogClose();

            expect(mockMatDialogRef.close).toHaveBeenCalled();
            expect(mockSnackBar.openFromComponent).not.toHaveBeenCalled();
        });

        it("should handle backdrop click with dirty forms showing confirmation", (): void => {
            setupMockChildComponents(component, true, false);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });

        it("should handle display form dirty state in close confirmation", (): void => {
            setupMockChildComponents(component, false, false, false, true);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });

        it("should show confirmation when layout is dirty but all forms are clean", (): void => {
            const mockGeneralForm = createMockGeneralForm(false);
            const mockRowingForm = createMockRowingForm(false);
            const mockDisplayForm = createMockDisplayForm(false);

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(true),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
                getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.handleDialogClose();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();
            expect(mockMatDialogRef.close).not.toHaveBeenCalled();
        });
    });

    describe("form validation state", (): void => {
        it("should be invalid when both forms are invalid", (): void => {
            component.onGeneralFormValidityChange(false);
            component.onRowingFormValidityChange(false);

            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should be invalid when only general form is valid", (): void => {
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(false);

            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should be invalid when only rowing form is valid", (): void => {
            component.onGeneralFormValidityChange(false);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should be valid when both forms are valid", (): void => {
            setupMockChildComponents(component, true, true, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(true);

            component.currentTabIndex.set(2);
            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        describe("when toggling validity", (): void => {
            it("should reflect changes in general form validity", (): void => {
                setupMockChildComponents(component, true, true, false);
                component.currentTabIndex.set(0);

                component.onGeneralFormValidityChange(false);
                component.onRowingFormValidityChange(true);
                expect(component.isSaveButtonEnabled()).toBe(false);
                component.onGeneralFormValidityChange(true);
                expect(component.isSaveButtonEnabled()).toBe(true);
                component.onGeneralFormValidityChange(false);
                expect(component.isSaveButtonEnabled()).toBe(false);
            });

            it("should reflect changes in rowing form validity", (): void => {
                setupMockChildComponents(component, true, true, false);
                component.currentTabIndex.set(2);

                component.onGeneralFormValidityChange(true);
                component.onRowingFormValidityChange(false);
                expect(component.isSaveButtonEnabled()).toBe(false);
                component.onRowingFormValidityChange(true);
                expect(component.isSaveButtonEnabled()).toBe(true);
                component.onRowingFormValidityChange(false);
                expect(component.isSaveButtonEnabled()).toBe(false);
            });
        });

        it("should enable save button when switching tabs based on tab-specific conditions", (): void => {
            setupMockChildComponents(component, true, true, false);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            // start on general tab - should be enabled
            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(true);

            // switch to rowing tab - should still be enabled
            component.currentTabIndex.set(2);
            expect(component.isSaveButtonEnabled()).toBe(true);

            // now with profile loaded but clean forms
            setupMockChildComponents(component, false, false, true);
            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            // general tab with clean forms - should be disabled
            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(false);

            // rowing tab with clean forms but profile loaded - should be enabled
            component.currentTabIndex.set(2);
            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should disable save button when general form is invalid even when dirty", (): void => {
            const mockGeneralForm = {
                ...createMockGeneralForm(true, {
                    logLevel: 2,
                }),
                valid: false,
            };
            const mockRowingForm = createMockRowingForm(false);
            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onGeneralFormValidityChange(false);
            component.onRowingFormValidityChange(true);
            component.currentTabIndex.set(0);
            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should disable save button when rowing form is invalid even when dirty", (): void => {
            const mockGeneralForm = createMockGeneralForm(true);
            const mockRowingForm = {
                ...createMockRowingForm(true, {
                    machineSettings: { flywheelInertia: 0.06 },
                }),
                valid: false,
            };
            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
                getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);
            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(true);
            component.onRowingFormValidityChange(false);
            component.currentTabIndex.set(2);
            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should handle forms becoming pristine after being dirty", (): void => {
            setupMockChildComponents(component, true, true);
            component.handleDialogClose();
            expect(mockSnackBar.openFromComponent).toHaveBeenCalled();

            vi.mocked(mockSnackBar.openFromComponent).mockClear();

            setupMockChildComponents(component, false, false);
            component.handleDialogClose();
            expect(mockSnackBar.openFromComponent).not.toHaveBeenCalled();
            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });
    });

    describe("when rowing profile is loaded", (): void => {
        it("should enable save button on rowing tab even if form is pristine", (): void => {
            setupMockChildComponents(component, false, false, true);
            component.currentTabIndex.set(2);
            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should enable save even with invalid forms on rowing tab", (): void => {
            setupMockChildComponents(component, false, false, true);
            component.currentTabIndex.set(2);
            component.onGeneralFormValidityChange(false);
            component.onDisplayFormValidityChange(false);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should not enable save button on general tab", (): void => {
            setupMockChildComponents(component, false, false, true);
            component.currentTabIndex.set(0);
            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            expect(component.isSaveButtonEnabled()).toBe(false);
        });

        it("should enable save button on display tab when layout is dirty but form is clean", (): void => {
            const mockGeneralForm = createMockGeneralForm(false);
            const mockRowingForm = createMockRowingForm(false);
            const mockDisplayForm = createMockDisplayForm(false);

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockDisplayForm),
                isLayoutDirty: signal(true),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
                getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(true);
            component.onDisplayFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            component.currentTabIndex.set(1);

            expect(component.isSaveButtonEnabled()).toBe(true);
        });

        it("should save rowing settings even if not dirty", async (): Promise<void> => {
            const mockGeneralForm = createMockGeneralForm(false);
            const mockRowingForm = createMockRowingForm(false, {
                machineSettings: { flywheelInertia: 0.06 },
            });

            vi.spyOn(component, "generalSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockGeneralForm),
            } as unknown as ReturnType<typeof component.generalSettings>);
            vi.spyOn(component, "displaySettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
                isLayoutDirty: signal(false),
                getLayoutConfig: vi.fn().mockReturnValue({
                    landscape: DEFAULT_LANDSCAPE_LAYOUT,
                    portrait: DEFAULT_PORTRAIT_LAYOUT,
                    orientationLock: "auto",
                }),
                getAveragingConfig: vi.fn().mockReturnValue({ mode: "off", windowSize: 3 }),
            } as unknown as ReturnType<typeof component.displaySettings>);
            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: true,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            component.onGeneralFormValidityChange(false);
            component.onDisplayFormValidityChange(false);
            component.onRowingFormValidityChange(true);

            component.currentTabIndex.set(2);

            await component.saveSettings();

            expect(mockErgSettingsService.changeMachineSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    flywheelInertia: 0.06,
                }),
            );
            expect(mockMatDialogRef.close).toHaveBeenCalled();
        });
    });
});
