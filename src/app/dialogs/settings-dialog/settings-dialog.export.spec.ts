import { ComponentFixture } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StrokeDetectionType } from "../../../common/common.interfaces";
import { ExportProfileDialogComponent } from "../export-profile-dialog/export-profile-dialog.component";

import { SettingsDialogComponent } from "./settings-dialog.component";
import { createMockRowingForm, createSettingsDialogTestBed } from "./settings-dialog.test.helpers";
import { SettingsExportService } from "./settings-export.service";

describe("SettingsDialogComponent export", (): void => {
    let component: SettingsDialogComponent;
    let fixture: ComponentFixture<SettingsDialogComponent>;
    let mockDialog: Pick<MatDialog, "open">;
    let mockSettingsExportService: Pick<SettingsExportService, "exportRowerProfile">;

    beforeEach(async (): Promise<void> => {
        mockDialog = { open: vi.fn() };
        mockSettingsExportService = { exportRowerProfile: vi.fn() };
        vi.mocked(mockSettingsExportService.exportRowerProfile).mockResolvedValue();
        // eslint-disable-next-line @typescript-eslint/typedef -- There is a bug in ESLint wanting type annotation on this but that results in invalid TS syntax
        ({ fixture, component } = await createSettingsDialogTestBed({
            extraProviders: [{ provide: MatDialog, useValue: mockDialog }],
            componentProviders: [{ provide: SettingsExportService, useValue: mockSettingsExportService }],
        }));
    });

    describe("exportProfile method", (): void => {
        const mockFormRawValue = {
            machineSettings: {
                flywheelInertia: 0.0899,
                magicConstant: 2.57,
                sprocketRadius: 3.2,
                impulsePerRevolution: 6,
            },
            sensorSignalSettings: {
                rotationDebounceTime: 4,
                rowingStoppedThreshold: 10,
            },
            dragFactorSettings: {
                goodnessOfFitThreshold: 0.67,
                maxDragFactorRecoveryPeriod: 4,
                dragFactorLowerThreshold: 10,
                dragFactorUpperThreshold: 200,
                dragCoefficientsArrayLength: 5,
            },
            strokeDetectionSettings: {
                strokeDetectionType: StrokeDetectionType.Torque,
                impulseDataArrayLength: 9,
                minimumPoweredTorque: 0,
                minimumDragTorque: 0.08,
                minimumRecoverySlope: 0,
                minimumRecoverySlopeMargin: 0.02,
                minimumRecoveryTime: 145,
                minimumDriveTime: 160,
                driveHandleForcesMaxCapacity: 59,
            },
        };

        beforeEach((): void => {
            const mockRowingForm = {
                ...createMockRowingForm(true),
                getRawValue: vi.fn().mockReturnValue(mockFormRawValue),
            };

            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(mockRowingForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);
        });

        it("should open the export profile dialog with correct component and options", async (): Promise<void> => {
            vi.mocked(mockDialog.open).mockReturnValue({
                afterClosed: vi.fn().mockReturnValue(of(undefined)),
            } as unknown as ReturnType<MatDialog["open"]>);

            await component.exportProfile();

            expect(mockDialog.open).toHaveBeenCalledWith(ExportProfileDialogComponent, {
                width: "360px",
                maxWidth: "95vw",
            });
        });

        it("should not call exportRowerProfile when dialog is cancelled", async (): Promise<void> => {
            vi.mocked(mockDialog.open).mockReturnValue({
                afterClosed: vi.fn().mockReturnValue(of(undefined)),
            } as unknown as ReturnType<MatDialog["open"]>);

            await component.exportProfile();

            expect(mockSettingsExportService.exportRowerProfile).not.toHaveBeenCalled();
        });

        it("should call exportRowerProfile with form settings when dialog confirms", async (): Promise<void> => {
            vi.mocked(mockDialog.open).mockReturnValue({
                afterClosed: vi
                    .fn()
                    .mockReturnValue(of({ deviceName: "TestDevice", modelNumber: "Generic" })),
            } as unknown as ReturnType<MatDialog["open"]>);

            await component.exportProfile();

            expect(mockSettingsExportService.exportRowerProfile).toHaveBeenCalledWith(
                {
                    machineSettings: mockFormRawValue.machineSettings,
                    sensorSignalSettings: mockFormRawValue.sensorSignalSettings,
                    dragFactorSettings: mockFormRawValue.dragFactorSettings,
                    strokeDetectionSettings: mockFormRawValue.strokeDetectionSettings,
                },
                "TestDevice",
                "Generic",
            );
        });

        it("should not open dialog or call exportRowerProfile when rowing form is invalid", async (): Promise<void> => {
            const invalidForm = {
                ...createMockRowingForm(true),
                invalid: true,
                getRawValue: vi.fn(),
            };

            vi.spyOn(component, "rowingSettings").mockReturnValue({
                getForm: vi.fn().mockReturnValue(invalidForm),
                saveAsCustomProfile: vi.fn(),
                isProfileLoaded: false,
            } as unknown as ReturnType<typeof component.rowingSettings>);

            await component.exportProfile();

            expect(mockDialog.open).not.toHaveBeenCalled();
            expect(mockSettingsExportService.exportRowerProfile).not.toHaveBeenCalled();
        });
    });

    describe("as part of template rendering for export button", (): void => {
        beforeEach((): void => {
            component.data.rowerSettings.generalSettings.isRuntimeSettingsEnabled = true;
        });

        it("should show Export Profile button when on rowing tab and runtime settings enabled", async (): Promise<void> => {
            component.currentTabIndex.set(2);
            fixture.detectChanges();

            const exportButton = fixture.nativeElement.querySelector(".export-profile-button");

            expect(exportButton).not.toBeNull();
            expect(exportButton?.textContent?.trim()).toBe("Export Profile");
        });

        it("should not show Export Profile button when on rowing tab but runtime settings disabled", (): void => {
            component.data.rowerSettings.generalSettings.isRuntimeSettingsEnabled = false;
            component.currentTabIndex.set(2);
            fixture.detectChanges();

            const exportButton = fixture.nativeElement.querySelector(".export-profile-button");

            expect(exportButton).toBeNull();
        });

        it("should not show Export Profile button when on general tab", async (): Promise<void> => {
            component.currentTabIndex.set(0);
            fixture.detectChanges();

            const exportButton = fixture.nativeElement.querySelector(".export-profile-button");

            expect(exportButton).toBeNull();
        });

        it("should not show Export Profile button when on display tab", async (): Promise<void> => {
            component.currentTabIndex.set(1);
            fixture.detectChanges();

            const exportButton = fixture.nativeElement.querySelector(".export-profile-button");

            expect(exportButton).toBeNull();
        });

        it("should call exportProfile when Export Profile button is clicked", (): void => {
            component.currentTabIndex.set(2);
            fixture.detectChanges();

            const exportSpy = vi.spyOn(component, "exportProfile").mockResolvedValue();
            const exportButton: HTMLButtonElement =
                fixture.nativeElement.querySelector(".export-profile-button");
            exportButton.click();

            expect(exportSpy).toHaveBeenCalledTimes(1);
        });
    });
});
