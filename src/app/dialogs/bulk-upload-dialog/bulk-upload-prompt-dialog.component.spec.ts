import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    BulkUploadPromptDialogComponent,
    BulkUploadPromptResult,
} from "./bulk-upload-prompt-dialog.component";

describe("BulkUploadPromptDialogComponent", (): void => {
    let component: BulkUploadPromptDialogComponent;
    let fixture: ComponentFixture<BulkUploadPromptDialogComponent>;
    let mockDialogRef: { close: ReturnType<typeof vi.fn> };

    const setupComponent = async (isFirstSetup: boolean): Promise<void> => {
        mockDialogRef = { close: vi.fn() };

        await TestBed.configureTestingModule({
            imports: [BulkUploadPromptDialogComponent],
            providers: [
                { provide: MatDialogRef, useValue: mockDialogRef },
                { provide: MAT_DIALOG_DATA, useValue: { isFirstSetup } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(BulkUploadPromptDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    };

    describe("as part of component creation", (): void => {
        it("should create the component", async (): Promise<void> => {
            await setupComponent(true);
            expect(component).toBeTruthy();
        });
    });

    describe("as part of template rendering — first setup", (): void => {
        beforeEach(async (): Promise<void> => {
            await setupComponent(true);
        });

        it("should show first-setup body text", (): void => {
            const content = fixture.nativeElement.querySelector("[mat-dialog-content]").textContent;
            expect(content).toContain("existing sessions");
        });

        it("should show Skip button", (): void => {
            const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll("button");
            const labels = Array.from(buttons).map((button: HTMLButtonElement): string =>
                button.textContent!.trim(),
            );
            expect(labels).toContain("Skip");
        });

        it("should show Upload all sessions as primary action label", (): void => {
            const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll("button");
            const labels = Array.from(buttons).map((button: HTMLButtonElement): string =>
                button.textContent!.trim(),
            );
            expect(labels).toContain("Upload all sessions");
        });
    });

    describe("as part of template rendering — key change", (): void => {
        beforeEach(async (): Promise<void> => {
            await setupComponent(false);
        });

        it("should show key-change body text", (): void => {
            const content = fixture.nativeElement.querySelector("[mat-dialog-content]").textContent;
            expect(content).toContain("API key has changed");
        });

        it("should show Skip button", (): void => {
            const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll("button");
            const labels = Array.from(buttons).map((button: HTMLButtonElement): string =>
                button.textContent!.trim(),
            );
            expect(labels).toContain("Skip");
        });

        it("should show Only upload new sessions button", (): void => {
            const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll("button");
            const labels = Array.from(buttons).map((button: HTMLButtonElement): string =>
                button.textContent!.trim(),
            );
            expect(labels).toContain("Only upload new sessions");
        });

        it("should show Upload all sessions (recommended) as primary action label", (): void => {
            const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll("button");
            const labels = Array.from(buttons).map((button: HTMLButtonElement): string =>
                button.textContent!.trim(),
            );
            expect(labels).toContain("Upload all sessions (recommended)");
        });
    });

    describe("onPrimaryAction method", (): void => {
        describe("when isFirstSetup is true", (): void => {
            beforeEach(async (): Promise<void> => {
                await setupComponent(true);
            });

            it("should close with upload-all", (): void => {
                component.onPrimaryAction();
                expect(mockDialogRef.close).toHaveBeenCalledWith(
                    "upload-all" satisfies BulkUploadPromptResult,
                );
            });
        });

        describe("when isFirstSetup is false", (): void => {
            beforeEach(async (): Promise<void> => {
                await setupComponent(false);
            });

            it("should close with upload-all-reset", (): void => {
                component.onPrimaryAction();
                expect(mockDialogRef.close).toHaveBeenCalledWith(
                    "upload-all-reset" satisfies BulkUploadPromptResult,
                );
            });
        });
    });

    describe("onSkipAction method", (): void => {
        it("should close with skip", async (): Promise<void> => {
            await setupComponent(true);
            component.onSkipAction();
            expect(mockDialogRef.close).toHaveBeenCalledWith("skip" satisfies BulkUploadPromptResult);
        });
    });

    describe("onSecondaryAction method", (): void => {
        it("should close with keep-existing", async (): Promise<void> => {
            await setupComponent(false);
            component.onSecondaryAction();
            expect(mockDialogRef.close).toHaveBeenCalledWith(
                "keep-existing" satisfies BulkUploadPromptResult,
            );
        });
    });

    describe("as part of button click interactions", (): void => {
        describe("when isFirstSetup is true", (): void => {
            beforeEach(async (): Promise<void> => {
                await setupComponent(true);
            });

            it("should call onPrimaryAction when primary button is clicked", (): void => {
                const spy = vi.spyOn(component, "onPrimaryAction");
                const buttons: NodeListOf<HTMLButtonElement> =
                    fixture.nativeElement.querySelectorAll("button");
                const primaryButton = Array.from(buttons).find(
                    (button: HTMLButtonElement): boolean =>
                        button.textContent!.trim() === "Upload all sessions",
                )!;
                primaryButton.click();
                expect(spy).toHaveBeenCalled();
            });

            it("should call onSkipAction when Skip button is clicked", (): void => {
                const spy = vi.spyOn(component, "onSkipAction");
                const buttons: NodeListOf<HTMLButtonElement> =
                    fixture.nativeElement.querySelectorAll("button");
                const skipButton = Array.from(buttons).find(
                    (button: HTMLButtonElement): boolean => button.textContent!.trim() === "Skip",
                )!;
                skipButton.click();
                expect(spy).toHaveBeenCalled();
            });
        });

        describe("when isFirstSetup is false", (): void => {
            beforeEach(async (): Promise<void> => {
                await setupComponent(false);
            });

            it("should call onPrimaryAction when primary button is clicked", (): void => {
                const spy = vi.spyOn(component, "onPrimaryAction");
                const buttons: NodeListOf<HTMLButtonElement> =
                    fixture.nativeElement.querySelectorAll("button");
                const primaryButton = Array.from(buttons).find(
                    (button: HTMLButtonElement): boolean =>
                        button.textContent!.trim() === "Upload all sessions (recommended)",
                )!;
                primaryButton.click();
                expect(spy).toHaveBeenCalled();
            });

            it("should call onSecondaryAction when Only upload new sessions button is clicked", (): void => {
                const spy = vi.spyOn(component, "onSecondaryAction");
                const buttons: NodeListOf<HTMLButtonElement> =
                    fixture.nativeElement.querySelectorAll("button");
                const secondaryButton = Array.from(buttons).find(
                    (button: HTMLButtonElement): boolean =>
                        button.textContent!.trim() === "Only upload new sessions",
                )!;
                secondaryButton.click();
                expect(spy).toHaveBeenCalled();
            });

            it("should call onSkipAction when Skip button is clicked", (): void => {
                const spy = vi.spyOn(component, "onSkipAction");
                const buttons: NodeListOf<HTMLButtonElement> =
                    fixture.nativeElement.querySelectorAll("button");
                const skipButton = Array.from(buttons).find(
                    (button: HTMLButtonElement): boolean => button.textContent!.trim() === "Skip",
                )!;
                skipButton.click();
                expect(spy).toHaveBeenCalled();
            });
        });
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });
});
