import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialogRef } from "@angular/material/dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExportProfileDialogComponent } from "./export-profile-dialog.component";

describe("ExportProfileDialogComponent", (): void => {
    let component: ExportProfileDialogComponent;
    let fixture: ComponentFixture<ExportProfileDialogComponent>;
    let mockDialogRef: Pick<MatDialogRef<ExportProfileDialogComponent>, "close">;

    beforeEach(async (): Promise<void> => {
        mockDialogRef = {
            close: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [ExportProfileDialogComponent],
            providers: [{ provide: MatDialogRef, useValue: mockDialogRef }],
        }).compileComponents();

        fixture = TestBed.createComponent(ExportProfileDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize form with default values", (): void => {
            expect(component.exportForm.controls.deviceName.value).toBe("Custom Rower");
            expect(component.exportForm.controls.modelNumber.value).toBe("Generic");
        });

        it("should have a valid form with default values", (): void => {
            expect(component.exportForm.valid).toBe(true);
        });
    });

    describe("as part of template rendering", (): void => {
        it("should display the dialog title", (): void => {
            const titleElement = fixture.nativeElement.querySelector("[mat-dialog-title]");

            expect(titleElement.textContent.trim()).toBe("Export Rower Profile");
        });

        it("should render device name and model number fields", (): void => {
            const inputs = fixture.nativeElement.querySelectorAll("input");

            expect(inputs.length).toBe(2);
        });

        it("should enable the Export button when form is valid", (): void => {
            const exportButton: HTMLButtonElement =
                fixture.nativeElement.querySelector("button[color='primary']");

            expect(exportButton.disabled).toBe(false);
        });

        it("should disable the Export button when form is invalid", (): void => {
            component.exportForm.controls.deviceName.setValue("");
            fixture.detectChanges();

            const exportButton: HTMLButtonElement =
                fixture.nativeElement.querySelector("button[color='primary']");

            expect(exportButton.disabled).toBe(true);
        });
    });

    describe("as part of form validation", (): void => {
        it("should require device name", (): void => {
            component.exportForm.controls.deviceName.setValue("");

            expect(component.exportForm.controls.deviceName.valid).toBe(false);
            expect(component.exportForm.controls.deviceName.errors?.required).toBeTruthy();
        });

        it("should require model number", (): void => {
            component.exportForm.controls.modelNumber.setValue("");

            expect(component.exportForm.controls.modelNumber.valid).toBe(false);
            expect(component.exportForm.controls.modelNumber.errors?.required).toBeTruthy();
        });

        it("should accept device name with spaces within max length", (): void => {
            component.exportForm.controls.deviceName.setValue("My Rower");

            expect(component.exportForm.controls.deviceName.valid).toBe(true);
        });

        it("should accept device name with dashes", (): void => {
            component.exportForm.controls.deviceName.setValue("My-Rower");

            expect(component.exportForm.controls.deviceName.valid).toBe(true);
        });

        it("should reject device name with special characters", (): void => {
            component.exportForm.controls.deviceName.setValue("Rower@Home");

            expect(component.exportForm.controls.deviceName.valid).toBe(false);
            expect(component.exportForm.controls.deviceName.errors?.pattern).toBeTruthy();
        });

        it("should show pattern error message when device name contains special characters", (): void => {
            component.exportForm.controls.deviceName.setValue("Rower@Home");
            component.exportForm.controls.deviceName.markAsTouched();
            fixture.detectChanges();

            const errorElement = fixture.nativeElement.querySelector("mat-error");

            expect(errorElement?.textContent?.trim()).toContain("Invalid character");
        });

        it("should accept device name of exactly 18 characters", (): void => {
            component.exportForm.controls.deviceName.setValue("A".repeat(18));

            expect(component.exportForm.controls.deviceName.valid).toBe(true);
        });

        it("should reject device name longer than 18 characters", (): void => {
            component.exportForm.controls.deviceName.setValue("A".repeat(19));

            expect(component.exportForm.controls.deviceName.valid).toBe(false);
            expect(component.exportForm.controls.deviceName.errors?.maxlength).toBeTruthy();
        });

        it("should show maxlength error message when device name is too long", (): void => {
            component.exportForm.controls.deviceName.setValue("A".repeat(19));
            component.exportForm.controls.deviceName.markAsTouched();
            fixture.detectChanges();

            const errorElement = fixture.nativeElement.querySelector("mat-error");

            expect(errorElement?.textContent?.trim()).toContain("18 characters");
        });
    });

    describe("onExport method", (): void => {
        it("should close dialog with form values when form is valid", (): void => {
            component.exportForm.controls.deviceName.setValue("TestDevice");
            component.exportForm.controls.modelNumber.setValue("V2");

            component.onExport();

            expect(mockDialogRef.close).toHaveBeenCalledWith({
                deviceName: "TestDevice",
                modelNumber: "V2",
            });
        });

        it("should not close dialog when form is invalid", (): void => {
            component.exportForm.controls.deviceName.setValue("");

            component.onExport();

            expect(mockDialogRef.close).not.toHaveBeenCalled();
        });
    });

    describe("onCancel method", (): void => {
        it("should close dialog without result", (): void => {
            component.onCancel();

            expect(mockDialogRef.close).toHaveBeenCalledWith();
        });
    });
});
