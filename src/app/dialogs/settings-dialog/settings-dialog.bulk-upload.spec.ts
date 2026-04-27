import { MatDialog } from "@angular/material/dialog";
import { MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { EMPTY, of, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BulkUploadProgressDialogComponent } from "../bulk-upload-dialog/bulk-upload-progress-dialog.component";
import {
    BulkUploadPromptDialogComponent,
    BulkUploadPromptResult,
} from "../bulk-upload-dialog/bulk-upload-prompt-dialog.component";

import { SettingsDialogComponent } from "./settings-dialog.component";
import {
    createMockGeneralForm,
    createSettingsDialogTestBed,
    ISettingsDialogTestBedResult,
    setupMockChildComponents,
} from "./settings-dialog.test.helpers";

describe("SettingsDialogComponent bulk upload flow", (): void => {
    let component: SettingsDialogComponent;
    let mockMatDialogRef: ISettingsDialogTestBedResult["mockMatDialogRef"];
    let mockSnackBar: ISettingsDialogTestBedResult["mockSnackBar"];
    let mockDataRecorderService: ISettingsDialogTestBedResult["mockDataRecorderService"];
    let mockDialog: Pick<MatDialog, "open">;
    let afterClosedSubject: Subject<void>;

    const setupGeneralSettingsWithKeyChange = (
        isFirstSetup: boolean = true,
        apiKey: string = "test-api-key",
    ): void => {
        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(
                createMockGeneralForm(true, {
                    intervalsApiKey: { value: apiKey, dirty: true },
                }),
            ),
            hasApiKeyChanged: vi.fn().mockReturnValue(true),
            isFirstTimeSetup: vi.fn().mockReturnValue(isFirstSetup),
        } as unknown as ReturnType<typeof component.generalSettings>);
        component.onGeneralFormValidityChange(true);
    };

    const mockPromptDialogResult = (result: BulkUploadPromptResult | undefined): void => {
        vi.mocked(mockDialog.open).mockReturnValueOnce({
            afterClosed: vi.fn().mockReturnValue(of(result)),
        } as unknown as ReturnType<MatDialog["open"]>);
    };

    beforeEach(async (): Promise<void> => {
        mockDialog = { open: vi.fn() };
        afterClosedSubject = new Subject<void>();

        // eslint-disable-next-line @typescript-eslint/typedef -- There is a bug in ESLint wanting type annotation on this but that results in invalid TS syntax
        ({ component, mockMatDialogRef, mockSnackBar, mockDataRecorderService } =
            await createSettingsDialogTestBed({
                extraProviders: [{ provide: MatDialog, useValue: mockDialog }],
            }));

        vi.mocked(mockMatDialogRef.close).mockImplementation((): void => {
            afterClosedSubject.next();
        });
        vi.mocked(mockMatDialogRef.afterClosed).mockReturnValue(afterClosedSubject.asObservable());

        setupMockChildComponents(component);
        component.currentTabIndex.set(0);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    describe("when general settings are saved and API key has not changed", (): void => {
        it("should not open prompt dialog", async (): Promise<void> => {
            await component.saveSettings();

            expect(mockDialog.open).not.toHaveBeenCalled();
        });
    });

    describe("when API key has changed but there are no sessions in the logbook", (): void => {
        it("should not open prompt dialog", async (): Promise<void> => {
            setupGeneralSettingsWithKeyChange(true);
            vi.mocked(mockDataRecorderService.hasSessions).mockResolvedValue(false);

            await component.saveSettings();

            expect(mockDialog.open).not.toHaveBeenCalled();
        });
    });

    describe("when general settings are saved and API key is empty after change", (): void => {
        it("should not open prompt dialog", async (): Promise<void> => {
            setupGeneralSettingsWithKeyChange(true, "");

            await component.saveSettings();

            expect(mockDialog.open).not.toHaveBeenCalled();
        });
    });

    describe("when not on the General tab", (): void => {
        it("should not open prompt dialog even if API key changed", async (): Promise<void> => {
            setupGeneralSettingsWithKeyChange();
            component.currentTabIndex.set(1);
            component.onGeneralFormValidityChange(false);

            await component.saveSettings();

            expect(mockDialog.open).not.toHaveBeenCalled();
        });
    });

    describe("when API key is set for the first time", (): void => {
        beforeEach((): void => {
            setupGeneralSettingsWithKeyChange(true);
        });

        it("should open prompt dialog with isFirstSetup true", async (): Promise<void> => {
            mockPromptDialogResult("skip");

            await component.saveSettings();

            expect(mockDialog.open).toHaveBeenCalledWith(BulkUploadPromptDialogComponent, {
                data: { isFirstSetup: true },
                disableClose: true,
            });
        });

        it("should not open progress dialog when user selects skip", async (): Promise<void> => {
            mockPromptDialogResult("skip");

            await component.saveSettings();

            expect(mockDialog.open).toHaveBeenCalledTimes(1);
        });

        it("should not open progress dialog when prompt dialog is dismissed", async (): Promise<void> => {
            mockPromptDialogResult(undefined);

            await component.saveSettings();

            expect(mockDialog.open).toHaveBeenCalledTimes(1);
        });

        it("should open progress dialog with resetTracking false when upload-all selected", async (): Promise<void> => {
            mockPromptDialogResult("upload-all");
            vi.mocked(mockDialog.open).mockReturnValue({
                afterClosed: vi.fn().mockReturnValue(EMPTY),
            } as unknown as ReturnType<MatDialog["open"]>);

            await component.saveSettings();

            expect(mockDialog.open).toHaveBeenCalledWith(BulkUploadProgressDialogComponent, {
                data: { resetTracking: false },
                disableClose: true,
            });
        });
    });

    describe("when API key has changed", (): void => {
        beforeEach((): void => {
            setupGeneralSettingsWithKeyChange(false);
        });

        it("should open prompt dialog with isFirstSetup false", async (): Promise<void> => {
            mockPromptDialogResult("keep-existing");

            await component.saveSettings();

            expect(mockDialog.open).toHaveBeenCalledWith(BulkUploadPromptDialogComponent, {
                data: { isFirstSetup: false },
                disableClose: true,
            });
        });

        it("should open progress dialog with resetTracking true when upload-all-reset selected", async (): Promise<void> => {
            mockPromptDialogResult("upload-all-reset");
            vi.mocked(mockDialog.open).mockReturnValue({
                afterClosed: vi.fn().mockReturnValue(EMPTY),
            } as unknown as ReturnType<MatDialog["open"]>);

            await component.saveSettings();

            expect(mockDialog.open).toHaveBeenCalledWith(BulkUploadProgressDialogComponent, {
                data: { resetTracking: true },
                disableClose: true,
            });
        });

        it("should open progress dialog with resetTracking false when keep-existing selected", async (): Promise<void> => {
            mockPromptDialogResult("keep-existing");
            vi.mocked(mockDialog.open).mockReturnValue({
                afterClosed: vi.fn().mockReturnValue(EMPTY),
            } as unknown as ReturnType<MatDialog["open"]>);

            await component.saveSettings();

            expect(mockDialog.open).toHaveBeenCalledWith(BulkUploadProgressDialogComponent, {
                data: { resetTracking: false },
                disableClose: true,
            });
        });
    });

    describe("when cross-tab save includes General tab", (): void => {
        it("should open prompt dialog after saving all tabs when API key changed", async (): Promise<void> => {
            setupGeneralSettingsWithKeyChange(true);
            component.currentTabIndex.set(2);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            const mockSnackBarRef = { onAction: vi.fn().mockReturnValue(of(true)) };
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
                mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
            );

            mockPromptDialogResult("skip");

            await component.saveSettings();

            expect(mockDialog.open).toHaveBeenCalledWith(BulkUploadPromptDialogComponent, {
                data: { isFirstSetup: true },
                disableClose: true,
            });
        });

        it("should not open prompt dialog when user cancels cross-tab save", async (): Promise<void> => {
            setupGeneralSettingsWithKeyChange(true);
            component.currentTabIndex.set(2);

            component.onGeneralFormValidityChange(true);
            component.onRowingFormValidityChange(true);

            const mockSnackBarRef = { onAction: vi.fn().mockReturnValue(EMPTY) };
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(
                mockSnackBarRef as unknown as MatSnackBarRef<TextOnlySnackBar>,
            );

            await component.saveSettings();

            expect(mockDialog.open).not.toHaveBeenCalled();
        });
    });

    describe("dialog close ordering", (): void => {
        it("should call dialogRef.close before opening prompt dialog", async (): Promise<void> => {
            setupGeneralSettingsWithKeyChange(true);
            const callOrder: Array<string> = [];

            vi.mocked(mockMatDialogRef.close).mockImplementation((): void => {
                callOrder.push("close");
                afterClosedSubject.next();
            });
            vi.mocked(mockDialog.open).mockImplementation((): ReturnType<MatDialog["open"]> => {
                callOrder.push("open");

                return {
                    afterClosed: vi.fn().mockReturnValue(of("skip" satisfies BulkUploadPromptResult)),
                } as unknown as ReturnType<MatDialog["open"]>;
            });

            await component.saveSettings();

            expect(callOrder).toEqual(["close", "open"]);
        });
    });

    describe("when saveSettings is called concurrently", (): void => {
        it("should only open prompt dialog once on concurrent save calls", async (): Promise<void> => {
            setupGeneralSettingsWithKeyChange(true);
            mockPromptDialogResult("skip");

            const firstSave = component.saveSettings();
            const secondSave = component.saveSettings();
            await Promise.all([firstSave, secondSave]);

            expect(mockDialog.open).toHaveBeenCalledTimes(1);
        });
    });
});
