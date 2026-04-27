import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BulkUploadResult, IntervalsIcuService } from "../../../common/services/intervals-icu.service";

import { BulkUploadProgressDialogComponent } from "./bulk-upload-progress-dialog.component";

describe("BulkUploadProgressDialogComponent", (): void => {
    let component: BulkUploadProgressDialogComponent;
    let fixture: ComponentFixture<BulkUploadProgressDialogComponent>;

    let mockIntervalsService: Pick<IntervalsIcuService, "runBulkUpload" | "cancelBulkUpload">;
    let mockDialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
    let resolveUpload: (result: BulkUploadResult) => void;
    let capturedOnProgress: ((uploaded: number, failed: number, total: number) => void) | undefined;

    beforeEach(async (): Promise<void> => {
        mockDialogRef = { close: vi.fn(), disableClose: false };
        capturedOnProgress = undefined;

        mockIntervalsService = {
            runBulkUpload: vi
                .fn()
                .mockImplementation(
                    (
                        _resetTracking: boolean,
                        onProgress?: (uploaded: number, failed: number, total: number) => void,
                    ): Promise<BulkUploadResult> => {
                        capturedOnProgress = onProgress;

                        return new Promise<BulkUploadResult>(
                            (resolve: (value: BulkUploadResult) => void): void => {
                                resolveUpload = resolve;
                            },
                        );
                    },
                ),
            cancelBulkUpload: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [BulkUploadProgressDialogComponent],
            providers: [
                { provide: MatDialogRef, useValue: mockDialogRef },
                { provide: IntervalsIcuService, useValue: mockIntervalsService },
                { provide: MAT_DIALOG_DATA, useValue: { resetTracking: false } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(BulkUploadProgressDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should disable dialog close on init", (): void => {
            expect(mockDialogRef.disableClose).toBe(true);
        });

        it("should start runBulkUpload with the provided resetTracking flag", (): void => {
            expect(mockIntervalsService.runBulkUpload).toHaveBeenCalledWith(false, expect.any(Function));
        });

        it("should pass resetTracking from data to runBulkUpload", (): void => {
            expect(mockIntervalsService.runBulkUpload).toHaveBeenCalledWith(
                component.data.resetTracking,
                expect.any(Function),
            );
        });
    });

    describe("as part of template rendering while uploading", (): void => {
        it("should show preparing message before first progress update", (): void => {
            const content = fixture.nativeElement.textContent as string;
            expect(content).toContain("Preparing upload");
        });

        it("should show indeterminate progress bar before first progress update", (): void => {
            expect(component.progressMode()).toBe("indeterminate");
        });

        it("should show Cancel button while upload is running", (): void => {
            const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll("button");
            const labels = Array.from(buttons).map((button: HTMLButtonElement): string =>
                button.textContent!.trim(),
            );
            expect(labels).toContain("Cancel");
        });

        it("should not show Close button while upload is running", (): void => {
            const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll("button");
            const labels = Array.from(buttons).map((button: HTMLButtonElement): string =>
                button.textContent!.trim(),
            );
            expect(labels).not.toContain("Close");
        });

        it("should show determinate progress bar after first progress update", (): void => {
            capturedOnProgress!(1, 0, 5);
            fixture.detectChanges();

            expect(component.progressMode()).toBe("determinate");
        });

        it("should show correct progress percentage after progress update", (): void => {
            capturedOnProgress!(2, 1, 6);
            fixture.detectChanges();

            expect(component.progressPercent()).toBeCloseTo(50, 1);
        });

        it("should display upload counters after progress update", (): void => {
            capturedOnProgress!(3, 1, 10);
            fixture.detectChanges();

            const content = fixture.nativeElement.textContent as string;
            expect(content).toContain("Uploaded: 3");
            expect(content).toContain("Failed: 1");
        });

        it("should display current item number in running counter", (): void => {
            capturedOnProgress!(2, 0, 5);
            fixture.detectChanges();

            const content = fixture.nativeElement.textContent as string;
            expect(content).toContain("Uploading 2 of 5");
        });
    });

    describe("as part of template rendering after upload completes", (): void => {
        it("should show completion message and Close button on successful upload", async (): Promise<void> => {
            resolveUpload({ uploaded: 5, failed: 0, cancelled: false });
            await fixture.whenStable();
            fixture.detectChanges();

            const content = fixture.nativeElement.textContent as string;
            expect(content).toContain("Upload complete");

            const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll("button");
            const labels = Array.from(buttons).map((button: HTMLButtonElement): string =>
                button.textContent!.trim(),
            );
            expect(labels).toContain("Close");
            expect(labels).not.toContain("Cancel");
        });

        it("should show cancellation message on cancelled upload", async (): Promise<void> => {
            resolveUpload({ uploaded: 2, failed: 0, cancelled: true });
            await fixture.whenStable();
            fixture.detectChanges();

            const content = fixture.nativeElement.textContent as string;
            expect(content).toContain("Upload cancelled");
        });

        it("should re-enable dialog close after upload completes", async (): Promise<void> => {
            resolveUpload({ uploaded: 3, failed: 1, cancelled: false });
            await fixture.whenStable();
            fixture.detectChanges();

            expect(mockDialogRef.disableClose).toBe(false);
        });

        it("should update uploaded and failed counts from final result", async (): Promise<void> => {
            capturedOnProgress!(1, 0, 3);
            resolveUpload({ uploaded: 3, failed: 0, cancelled: false });
            await fixture.whenStable();
            fixture.detectChanges();

            expect(component.uploaded()).toBe(3);
            expect(component.failed()).toBe(0);
        });

        it("should render final uploaded and failed counts in the template", async (): Promise<void> => {
            resolveUpload({ uploaded: 4, failed: 2, cancelled: false });
            await fixture.whenStable();
            fixture.detectChanges();

            const content = fixture.nativeElement.textContent as string;
            expect(content).toContain("Uploaded: 4");
            expect(content).toContain("Failed: 2");
        });
    });

    describe("onCancel method", (): void => {
        it("should call cancelBulkUpload on the service", (): void => {
            component.onCancel();
            expect(mockIntervalsService.cancelBulkUpload).toHaveBeenCalled();
        });

        it("should call cancelBulkUpload when Cancel button is clicked", (): void => {
            const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll("button");
            const cancelButton = Array.from(buttons).find(
                (button: HTMLButtonElement): boolean => button.textContent!.trim() === "Cancel",
            )!;
            cancelButton.click();
            expect(mockIntervalsService.cancelBulkUpload).toHaveBeenCalled();
        });
    });

    describe("onClose method", (): void => {
        it("should close the dialog", async (): Promise<void> => {
            resolveUpload({ uploaded: 1, failed: 0, cancelled: false });
            await fixture.whenStable();
            fixture.detectChanges();

            component.onClose();

            expect(mockDialogRef.close).toHaveBeenCalled();
        });
    });

    describe("as part of edge cases & robustness handling", (): void => {
        let rejectingFixture: ComponentFixture<BulkUploadProgressDialogComponent>;
        let rejectingDialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean };

        beforeEach(async (): Promise<void> => {
            rejectingDialogRef = { close: vi.fn(), disableClose: false };

            TestBed.resetTestingModule();
            await TestBed.configureTestingModule({
                imports: [BulkUploadProgressDialogComponent],
                providers: [
                    { provide: MatDialogRef, useValue: rejectingDialogRef },
                    {
                        provide: IntervalsIcuService,
                        useValue: {
                            runBulkUpload: vi.fn().mockRejectedValue(new Error("network failure")),
                            cancelBulkUpload: vi.fn(),
                        },
                    },
                    { provide: MAT_DIALOG_DATA, useValue: { resetTracking: false } },
                ],
            }).compileComponents();

            rejectingFixture = TestBed.createComponent(BulkUploadProgressDialogComponent);
            rejectingFixture.detectChanges();
        });

        afterEach((): void => {
            vi.restoreAllMocks();
        });

        it("should show completion state and re-enable close when upload rejects", async (): Promise<void> => {
            await rejectingFixture.whenStable();

            expect(rejectingFixture.componentInstance.result()).toEqual({
                uploaded: 0,
                failed: 0,
                cancelled: false,
            });
            expect(rejectingDialogRef.disableClose).toBe(false);
        });

        it("should switch progress bar to determinate when upload rejects before any progress", async (): Promise<void> => {
            await rejectingFixture.whenStable();
            rejectingFixture.detectChanges();

            expect(rejectingFixture.componentInstance.progressMode()).toBe("determinate");
        });
    });
});
