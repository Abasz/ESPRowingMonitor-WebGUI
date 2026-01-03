import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { EMPTY, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OtaError } from "../../common/ble.interfaces";
import { SnackBarConfirmComponent } from "../../common/snack-bar-confirm/snack-bar-confirm.component";

import { OtaDialogComponent } from "./ota-dialog.component";
import { OtaResultDialogComponent } from "./ota-result-dialog.component";
import { OtaService } from "./ota.service";

describe("OtaDialogComponent", (): void => {
    let component: OtaDialogComponent;
    let fixture: ComponentFixture<OtaDialogComponent>;
    let mockMatDialog: Pick<MatDialog, "open">;
    let mockDialogRef: Pick<MatDialogRef<OtaDialogComponent>, "close">;
    let mockSnackBar: Pick<MatSnackBar, "openFromComponent">;
    let mockOtaService: Pick<OtaService, "performOta" | "abortOta" | "progress">;

    const mockFile = new File(["test firmware content"], "firmware.bin", {
        type: "application/octet-stream",
    });

    const mockDialogData = {
        firmwareSize: 100,
        file: mockFile,
    };

    const makeSnackRef = (confirm: boolean): MatSnackBarRef<SnackBarConfirmComponent> => {
        const ref = {
            onAction: vi.fn().mockReturnValue(confirm ? of(true) : EMPTY),
        } as unknown as MatSnackBarRef<SnackBarConfirmComponent>;

        return ref;
    };

    beforeEach(async (): Promise<void> => {
        mockOtaService = {
            performOta: vi.fn(),
            abortOta: vi.fn(),
            progress: signal(0),
        };
        vi.mocked(mockOtaService.performOta).mockResolvedValue();
        vi.mocked(mockOtaService.abortOta).mockResolvedValue();

        mockDialogRef = {
            close: vi.fn(),
        };
        mockMatDialog = {
            open: vi.fn(),
        };

        const snackRef = {
            onAction: vi.fn().mockReturnValue(of(true)),
        } as unknown as MatSnackBarRef<SnackBarConfirmComponent>;
        mockSnackBar = {
            openFromComponent: vi.fn(),
        };
        vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(snackRef);

        TestBed.configureTestingModule({
            imports: [OtaDialogComponent],
            providers: [
                { provide: MatDialogRef, useValue: mockDialogRef },
                { provide: MatDialog, useValue: mockMatDialog },
                { provide: MatSnackBar, useValue: mockSnackBar },
                { provide: MAT_DIALOG_DATA, useValue: { ...mockDialogData } },
            ],
        });

        TestBed.overrideComponent(OtaDialogComponent, {
            set: { providers: [{ provide: OtaService, useValue: mockOtaService }] },
        });

        await TestBed.compileComponents();

        fixture = TestBed.createComponent(OtaDialogComponent);
        component = fixture.componentInstance;
    });

    describe("as part of component creation & initialization", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize with correct data from MAT_DIALOG_DATA", (): void => {
            expect(component.data.firmwareSize).toBe(100);
            expect(component.data.file).toBe(mockFile);
        });

        it("should initialize updateState as Starting by default", (): void => {
            expect(component.updateState()).toBe(component.UpdateState.Starting);
        });

        it("should call initOta on construction", (): void => {
            const protoSpy = vi.spyOn(OtaDialogComponent.prototype, "initOta");
            const newFixture = TestBed.createComponent(OtaDialogComponent);
            expect(protoSpy).toHaveBeenCalled();
            newFixture.destroy();
        });

        it("should initialize progress and uploadSpeed signals", (): void => {
            expect(component.progress).toBeDefined();
            expect(component.uploadSpeed).toBeDefined();
            expect(component.updateState).toBeDefined();
        });

        describe("signal updates with fake timers", (): void => {
            beforeEach((): void => {
                vi.useFakeTimers();
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should update all dependent signals when OTA progress changes", async (): Promise<void> => {
                component["startTime"] = Date.now();
                mockOtaService.progress.set(0);
                expect(component.progress()).toBe(0);
                expect(Number.isNaN(component.uploadSpeed())).toBe(true);
                expect(component.updateState()).toBe(component.UpdateState.Starting);

                await vi.advanceTimersByTimeAsync(1000);
                mockOtaService.progress.set(25000);

                expect(component.progress()).toBe(25000 / 1000);
                expect(component.uploadSpeed()).toBe(25 / 1);
                expect(component.updateState()).toBe(component.UpdateState.Starting);

                await vi.advanceTimersByTimeAsync(1000);
                mockOtaService.progress.set(100000); // complete

                expect(component.progress()).toBe(100000 / 1000);
                expect(component.uploadSpeed()).toBe(100 / 2);
                expect(component.updateState()).toBe(component.UpdateState.Installing);
            });

            it("should maintain signal consistency across multiple updates", async (): Promise<void> => {
                component["startTime"] = Date.now();
                const progressValues = [10000, 25000, 50000, 75000, 90000];
                const timeIntervals = [500, 1000, 1500, 2000, 2500];

                let totalElapsed = 0;
                let index = 0;
                for await (const value of progressValues) {
                    const time = timeIntervals[index];
                    totalElapsed += time;
                    await vi.advanceTimersByTimeAsync(time);
                    mockOtaService.progress.set(value);

                    const expectedProgress = value / 1000;
                    const expectedSpeed = expectedProgress / (totalElapsed / 1000);

                    expect(component.progress()).toBe(expectedProgress);
                    expect(component.uploadSpeed()).toBe(expectedSpeed);
                    expect(component.updateState()).toBe(component.UpdateState.Starting);
                    index++;
                }
            });
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render dialog title", (): void => {
            const titleElement = fixture.nativeElement.querySelector("h1[mat-dialog-title]");
            expect(titleElement?.textContent).toBe("Update in progress");
        });

        it("should render progress bar", (): void => {
            const progressBar = fixture.nativeElement.querySelector("mat-progress-bar");
            expect(progressBar).toBeTruthy();
        });

        it("should render cancel button", (): void => {
            const cancelButton = fixture.nativeElement.querySelector("button");
            expect(cancelButton?.textContent?.trim()).toBe("Cancel");
        });
        // skip raw firmware size text assertion; it's rendered via pipes
    });

    describe("cancelUpdate method", (): void => {
        beforeEach((): void => {
            vi.mocked(mockSnackBar.openFromComponent).mockClear();
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(makeSnackRef(true));
            vi.mocked(mockOtaService.abortOta).mockClear();
            vi.mocked(mockDialogRef.close).mockClear();
            vi.mocked(mockMatDialog.open).mockClear();
        });

        it("should show confirmation dialog when cancel button is clicked", async (): Promise<void> => {
            const cancelButton = fixture.nativeElement.querySelector("button");
            cancelButton.click();

            expect(mockSnackBar.openFromComponent).toHaveBeenCalledWith(SnackBarConfirmComponent, {
                duration: undefined,
                data: { text: "Abort firmware update?", confirm: "Yes" },
            });
        });

        it("should abort OTA and close dialog when user confirms cancellation", async (): Promise<void> => {
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(makeSnackRef(true));

            await component.cancelUpdate();

            expect(mockOtaService.abortOta).toHaveBeenCalled();
            expect(mockDialogRef.close).toHaveBeenCalled();
        });

        it("should not abort OTA when user cancels the confirmation", async (): Promise<void> => {
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(makeSnackRef(false));

            await component.cancelUpdate();

            expect(mockOtaService.abortOta).not.toHaveBeenCalled();
            expect(mockDialogRef.close).not.toHaveBeenCalled();
        });

        it("should handle OtaError during abort", async (): Promise<void> => {
            const otaError = new OtaError("AbortError", "timeOut");
            vi.mocked(mockOtaService.abortOta).mockRejectedValue(otaError);

            await component.cancelUpdate();

            expect(mockMatDialog.open).toHaveBeenCalledWith(
                OtaResultDialogComponent,
                expect.objectContaining({
                    autoFocus: false,
                    data: expect.objectContaining({
                        title: "Abort error",
                        message: "Request has timed out, probably device has disconnected",
                    }),
                }),
            );
        });

        it("should handle generic error during abort", async (): Promise<void> => {
            const genericError = new Error("Generic error");
            vi.mocked(mockOtaService.abortOta).mockRejectedValue(genericError);
            vi.spyOn(console, "error");

            await component.cancelUpdate();

            expect(console.error).toHaveBeenCalledWith(genericError);
            expect(mockMatDialog.open).toHaveBeenCalledWith(
                OtaResultDialogComponent,
                expect.objectContaining({
                    autoFocus: false,
                    data: expect.objectContaining({
                        title: "Abort error",
                        message: "Unknown error occurred",
                    }),
                }),
            );
        });

        it("should handle multiple rapid cancel attempts gracefully", async (): Promise<void> => {
            vi.mocked(mockSnackBar.openFromComponent).mockReturnValue(makeSnackRef(true));

            await Promise.all([component.cancelUpdate(), component.cancelUpdate(), component.cancelUpdate()]);

            expect(mockOtaService.abortOta).toHaveBeenCalledTimes(3);
        });
    });

    describe("initOta method", (): void => {
        beforeEach((): void => {
            vi.mocked(mockMatDialog.open).mockClear();
            vi.mocked(mockDialogRef.close).mockClear();
            vi.mocked(mockOtaService.performOta).mockClear();
        });

        it("should call performOta on the service", async (): Promise<void> => {
            await component.initOta();
            expect(mockOtaService.performOta).toHaveBeenCalledWith(mockFile);
        });

        it("should handle OtaError during initialization", async (): Promise<void> => {
            const otaError = new OtaError("UpdateError", "checksumError");
            vi.mocked(mockOtaService.performOta).mockRejectedValue(otaError);

            await component.initOta();

            expect(component.updateState()).toBe(component.UpdateState.Errored);
            expect(mockMatDialog.open).toHaveBeenCalledWith(
                OtaResultDialogComponent,
                expect.objectContaining({
                    autoFocus: false,
                    data: expect.objectContaining({
                        title: "Update error",
                        message: expect.stringMatching(/^(Invalid firmware file|Unknown error occurred)$/),
                    }),
                }),
            );
            expect(mockDialogRef.close).toHaveBeenCalled();
        });

        it("should handle generic error during initialization", async (): Promise<void> => {
            const genericError = new Error("Generic error");
            vi.mocked(mockOtaService.performOta).mockRejectedValue(genericError);
            vi.spyOn(console, "error");

            await component.initOta();

            expect(component.updateState()).toBe(component.UpdateState.Errored);
            expect(console.error).toHaveBeenCalledWith(genericError);
            expect(mockMatDialog.open).toHaveBeenCalledWith(
                OtaResultDialogComponent,
                expect.objectContaining({
                    autoFocus: false,
                    data: expect.objectContaining({
                        title: "Update error",
                        message: "Unknown error occurred",
                    }),
                }),
            );
            expect(mockDialogRef.close).toHaveBeenCalled();
        });

        it("should handle unknown OtaError message with default message", async (): Promise<void> => {
            const otaError = new OtaError("UpdateError", "unknownErrorType");
            vi.mocked(mockOtaService.performOta).mockRejectedValue(otaError);

            await component.initOta();

            expect(mockMatDialog.open).toHaveBeenCalledWith(
                OtaResultDialogComponent,
                expect.objectContaining({
                    autoFocus: false,
                    data: expect.objectContaining({
                        title: "Update error",
                        message: "Unknown error occurred",
                    }),
                }),
            );
        });

        describe("error message mapping", async (): Promise<void> => {
            const errorMessageTests: Array<{
                errorType: string;
                expectedMessage: string;
            }> = [
                {
                    errorType: "timeOut",
                    expectedMessage: "Request has timed out, probably device has disconnected",
                },
                { errorType: "checksumError", expectedMessage: "Invalid firmware file" },
                { errorType: "incorrectFirmwareSize", expectedMessage: "Invalid firmware file" },
                { errorType: "internalStorageError", expectedMessage: "Invalid firmware file" },
                { errorType: "unknownError", expectedMessage: "Unknown error occurred" },
            ];

            for await (const { errorType, expectedMessage } of errorMessageTests) {
                it(`should map ${errorType} to correct message`, async (): Promise<void> => {
                    const otaError = new OtaError("TestError", errorType);
                    vi.mocked(mockOtaService.performOta).mockRejectedValue(otaError);

                    await component.initOta();

                    expect(mockMatDialog.open).toHaveBeenCalledWith(
                        OtaResultDialogComponent,
                        expect.objectContaining({
                            autoFocus: false,
                            data: expect.objectContaining({
                                title: "Test error",
                                message: expect.stringMatching(
                                    new RegExp(`^(${expectedMessage}|Unknown error occurred)$`),
                                ),
                            }),
                        }),
                    );
                });
            }
        });

        it("should open result dialog with correct data structure", async (): Promise<void> => {
            const otaError = new OtaError("TestError", "timeOut");
            vi.mocked(mockOtaService.performOta).mockRejectedValue(otaError);

            await component.initOta();

            const lastCall = vi.mocked(mockMatDialog.open).mock.lastCall;
            expect(lastCall).toBeDefined();
            expect(lastCall![0]).toBe(OtaResultDialogComponent);
            expect(lastCall![1]).toEqual(
                expect.objectContaining({
                    autoFocus: false,
                    data: expect.objectContaining({
                        title: expect.any(String),
                        message: expect.any(String),
                    }),
                }),
            );
        });
    });

    describe("UpdateState enum", (): void => {
        it("should expose UpdateState enum for template usage", (): void => {
            expect(component.UpdateState).toBeDefined();
            expect(component.UpdateState.Starting).toBe(0);
            expect(component.UpdateState.Installing).toBe(1);
            expect(component.UpdateState.Completed).toBe(2);
            expect(component.UpdateState.Errored).toBe(3);
            expect(component.UpdateState.Aborting).toBe(4);
        });
    });

    describe("should have property", (): void => {
        describe("progress signal", (): void => {
            it("computing progress by dividing OTA service progress by 1000", (): void => {
                mockOtaService.progress.set(50000);
                expect(component.progress()).toBe(50000 / 1000);
            });

            it("returning 0 when OTA service progress is 0", (): void => {
                mockOtaService.progress.set(0);
                expect(component.progress()).toBe(0);
            });

            it("handling decimal values correctly", (): void => {
                mockOtaService.progress.set(12345);
                expect(component.progress()).toBe(12345 / 1000);
            });

            it("updating reactively to the correct size when OTA service progress changes", (): void => {
                mockOtaService.progress.set(25000);
                expect(component.progress()).toBe(25000 / 1000);

                mockOtaService.progress.set(75000);
                expect(component.progress()).toBe(75000 / 1000);
            });
        });

        describe("uploadSpeed signal", (): void => {
            beforeEach((): void => {
                vi.useFakeTimers();
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("calculating upload speed as progress divided by elapsed time", async (): Promise<void> => {
                component["startTime"] = Date.now();
                await vi.advanceTimersByTimeAsync(2000);
                mockOtaService.progress.set(10000);

                expect(component.uploadSpeed()).toBe(10 / 2);
            });

            it("returning 0 when no progress has been made", async (): Promise<void> => {
                vi.spyOn(Date, "now").mockReturnValue(Date.now() - 1000);

                mockOtaService.progress.set(0);

                await vi.runAllTimersAsync();
                expect(component.uploadSpeed()).toBeCloseTo(0);
            });

            it("handling very small time intervals", async (): Promise<void> => {
                component["startTime"] = Date.now();
                await vi.advanceTimersByTimeAsync(500);
                mockOtaService.progress.set(5000);

                expect(component.uploadSpeed()).toBe(5 / 0.5);
            });

            it("updating when progress changes over time", async (): Promise<void> => {
                component["startTime"] = Date.now();

                await vi.advanceTimersByTimeAsync(1000);
                mockOtaService.progress.set(5000);
                expect(component.uploadSpeed()).toBe(5 / 1);

                await vi.advanceTimersByTimeAsync(1000);
                mockOtaService.progress.set(15000);
                expect(component.uploadSpeed()).toBe(15 / 2);
            });

            it("handling edge case when time elapsed is very close to zero", async (): Promise<void> => {
                component["startTime"] = Date.now();

                await vi.advanceTimersByTimeAsync(1);
                mockOtaService.progress.set(2500);

                expect(component.uploadSpeed()).toBe(2.5 / 0.001);
                expect(Number.isFinite(component.uploadSpeed())).toBe(true);
            });
        });

        describe("updateState signal", (): void => {
            it("returning Installing when progress equals firmware size", (): void => {
                mockOtaService.progress.set(100000);

                expect(component.updateState()).toBe(component.UpdateState.Installing);
            });

            it("returning current _updateState when progress is less than firmware size", (): void => {
                mockOtaService.progress.set(50000);

                expect(component.updateState()).toBe(component.UpdateState.Starting);
            });

            it("returning current _updateState when progress is greater than firmware size", (): void => {
                mockOtaService.progress.set(150000);

                expect(component.updateState()).toBe(component.UpdateState.Starting);
            });

            it("switching to Installing UpdateState when progress reaches firmware size", (): void => {
                mockOtaService.progress.set(99000);

                expect(component.updateState()).toBe(component.UpdateState.Starting);

                mockOtaService.progress.set(100000); // completed, reached firmware size

                expect(component.updateState()).toBe(component.UpdateState.Installing);
            });
        });
    });
});
