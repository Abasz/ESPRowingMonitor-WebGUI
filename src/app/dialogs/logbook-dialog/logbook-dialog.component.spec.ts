import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { Location } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatButtonHarness } from "@angular/material/button/testing";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatMenuHarness } from "@angular/material/menu/testing";
import {
    MatSnackBar,
    MatSnackBarDismiss,
    MatSnackBarRef,
    TextOnlySnackBar,
} from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { firstValueFrom, Observable, of, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { ILogbookDialogData, ISessionSummary } from "../../../common/common.interfaces";
import { ConfigManagerService } from "../../../common/services/config-manager.service";
import { DataRecorderService } from "../../../common/services/data-recorder.service";
import { IntervalsIcuService } from "../../../common/services/intervals-icu.service";
import { SnackBarConfirmComponent } from "../../../common/snack-bar-confirm/snack-bar-confirm.component";
import { SecondsToTimePipe } from "../../../common/utils/seconds-to-time.pipe";

import { LogbookDialogComponent } from "./logbook-dialog.component";

describe("LogbookDialogComponent", (): void => {
    let fixture: ComponentFixture<LogbookDialogComponent>;
    let component: LogbookDialogComponent;

    let summaries$: Subject<Array<ISessionSummary>>;
    let uploadedIds$: Subject<Array<number>>;

    let dataRecorderSpy: Pick<
        DataRecorderService,
        | "getSessionSummaries$"
        | "deleteSession"
        | "export"
        | "exportSessionToJson"
        | "exportSessionToFit"
        | "exportSessionToCsv"
        | "import"
    >;
    let snackBarSpy: Pick<MatSnackBar, "open" | "openFromComponent">;
    let routerSpy: Pick<Router, "serializeUrl" | "createUrlTree">;
    let locationSpy: Pick<Location, "prepareExternalUrl">;
    let intervalsIcuServiceSpy: Pick<IntervalsIcuService, "uploadSession" | "getUploadedSessionIds$">;
    let configManagerSpy: Pick<ConfigManagerService, "getGroup">;

    const SESSIONS: Array<ISessionSummary> = [
        {
            sessionId: new Date("2024-01-02T10:00:00Z").getTime(),
            startTime: 1000,
            finishTime: 7000,
            elapsedTime: 6000,
            distance: 25000,
            strokeCount: 30,
            deviceName: "Device A",
        },
        {
            sessionId: new Date("2024-01-01T10:00:00Z").getTime(),
            startTime: 0,
            finishTime: 4000,
            elapsedTime: 4000,
            distance: 50000,
            strokeCount: 60,
            deviceName: undefined as unknown as string,
        },
    ];

    const DEFAULT_DIALOG_DATA: ILogbookDialogData = {
        summaries: SESSIONS,
        uploadedSessionIds: [SESSIONS[0].sessionId],
    };

    const createComponent = (): void => {
        fixture?.destroy();
        fixture = TestBed.createComponent(LogbookDialogComponent);
        component = fixture.componentInstance;
    };

    beforeEach(async (): Promise<void> => {
        summaries$ = new Subject<Array<ISessionSummary>>();
        uploadedIds$ = new Subject<Array<number>>();

        intervalsIcuServiceSpy = {
            uploadSession: vi.fn(),
            getUploadedSessionIds$: vi.fn(),
        };
        vi.mocked(intervalsIcuServiceSpy.uploadSession).mockResolvedValue(true);
        vi.mocked(intervalsIcuServiceSpy.getUploadedSessionIds$).mockReturnValue(uploadedIds$.asObservable());

        configManagerSpy = {
            getGroup: vi.fn(),
        };
        vi.mocked(configManagerSpy.getGroup).mockReturnValue({
            intervalsIcu: { apiKey: "", athleteId: "", autoUploadEnabled: false },
        } as ReturnType<ConfigManagerService["getGroup"]>);

        dataRecorderSpy = {
            getSessionSummaries$: vi.fn(),
            deleteSession: vi.fn(),
            export: vi.fn(),
            exportSessionToJson: vi.fn(),
            exportSessionToFit: vi.fn(),
            exportSessionToCsv: vi.fn(),
            import: vi.fn(),
        };
        vi.mocked(dataRecorderSpy.getSessionSummaries$).mockReturnValue(summaries$.asObservable());
        vi.mocked(dataRecorderSpy.deleteSession).mockResolvedValue(undefined);

        snackBarSpy = {
            open: vi.fn(),
            openFromComponent: vi.fn(),
        };

        vi.mocked(snackBarSpy.open).mockReturnValue({
            afterDismissed: (): Observable<MatSnackBarDismiss> => of({ dismissedByAction: false }),
            onAction: (): Observable<void> => of(),
        } as unknown as MatSnackBarRef<TextOnlySnackBar>);
        vi.mocked(snackBarSpy.openFromComponent).mockReturnValue({
            onAction: (): Observable<boolean> => of(true),
            dismiss: vi.fn(),
        } as unknown as MatSnackBarRef<SnackBarConfirmComponent>);

        routerSpy = {
            createUrlTree: vi.fn().mockReturnValue({}),
            serializeUrl: vi.fn().mockReturnValue("/session/123"),
        };
        locationSpy = {
            prepareExternalUrl: vi.fn().mockReturnValue("/base/session/123"),
        };

        await TestBed.configureTestingModule({
            imports: [LogbookDialogComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: DEFAULT_DIALOG_DATA },
                { provide: DataRecorderService, useValue: dataRecorderSpy },
                { provide: MatSnackBar, useValue: snackBarSpy },
                { provide: Router, useValue: routerSpy },
                { provide: Location, useValue: locationSpy },
                { provide: IntervalsIcuService, useValue: intervalsIcuServiceSpy },
                { provide: ConfigManagerService, useValue: configManagerSpy },
            ],
        }).compileComponents();

        createComponent();
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("ngOnDestroy method", (): void => {
        it("should dismiss confirm snackbar on ngOnDestroy when present", (): void => {
            component.deleteSession(SESSIONS[0].sessionId);
            const dismissSpy = vi.fn();
            (
                component as unknown as {
                    confirmSnackBarRef: {
                        dismiss: Mock;
                    };
                }
            ).confirmSnackBarRef = {
                dismiss: dismissSpy,
            };

            component.ngOnDestroy();

            expect(dismissSpy).toHaveBeenCalled();
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render one table row per session", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            await fixture.whenStable();

            const rows = fixture.nativeElement.querySelectorAll("mat-row");
            expect(rows).toHaveLength(SESSIONS.length);
        });

        it("should show date and time from sessionId", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            await fixture.whenStable();

            const firstRowDateCell = fixture.nativeElement.querySelector("mat-row .date");
            const expectedDate = new Date(SESSIONS[0].sessionId);
            expect(firstRowDateCell.textContent).toContain(expectedDate.getFullYear().toString());
            expect(firstRowDateCell.textContent).toContain(expectedDate.toTimeString().substring(0, 8));
        });

        it("should show calculated duration in the Time column", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            await fixture.whenStable();
            const firstRowTimeCell = fixture.nativeElement.querySelector("mat-row .time");

            expect(firstRowTimeCell.textContent.trim().length).toBeGreaterThan(0);
        });

        it("should update table rows when getSessionSummaries$ emits", async (): Promise<void> => {
            summaries$.next([]);
            expect(fixture.nativeElement.querySelectorAll("mat-row")).toHaveLength(0);

            summaries$.next(SESSIONS);
            await fixture.whenStable();

            const rows = fixture.nativeElement.querySelectorAll("mat-row");
            expect(rows).toHaveLength(SESSIONS.length);
        });

        it("distance column should show meters as distance/100", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            await fixture.whenStable();

            const firstRowDistanceCell = fixture.nativeElement.querySelector("mat-row .distance");
            const expectedDistance = SESSIONS[0].distance / 100;
            expect(firstRowDistanceCell.textContent.trim()).toBe(expectedDistance.toString());
        });

        describe("device name", (): void => {
            it("should show provided device name", async (): Promise<void> => {
                summaries$.next(SESSIONS);
                await fixture.whenStable();

                const firstRowDeviceCell = fixture.nativeElement.querySelector("mat-row .device-name");
                expect(firstRowDeviceCell.textContent.trim()).toBe(SESSIONS[0].deviceName);
            });

            it("should fall back to 'Unknown' when deviceName is missing", async (): Promise<void> => {
                summaries$.next(SESSIONS);
                await fixture.whenStable();

                const rows = fixture.nativeElement.querySelectorAll("mat-row");
                const secondRowDeviceCell = rows[1]?.querySelector(".device-name");
                expect(secondRowDeviceCell.textContent.trim()).toBe("Unknown");
            });
        });

        describe("sorting", (): void => {
            it("should default to sorting by sessionId descending (newest first)", async (): Promise<void> => {
                summaries$.next(SESSIONS);
                await fixture.whenStable();

                const firstRowDateCell = fixture.nativeElement.querySelector("mat-row .date");
                const newestSessionDate = new Date(SESSIONS[0].sessionId);
                expect(firstRowDateCell.textContent).toContain(newestSessionDate.getFullYear().toString());
            });

            describe("by Time column", (): void => {
                it("should place shorter duration first when sorting Time ascending", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    await fixture.whenStable();

                    const timeHeader = fixture.nativeElement.querySelector(".time[mat-sort-header]");
                    expect(timeHeader).not.toBeNull();
                    timeHeader.click();

                    const firstRowTimeCell = fixture.nativeElement.querySelector("mat-row .time");
                    expect(firstRowTimeCell).not.toBeNull();
                    expect(firstRowTimeCell.textContent.trim()).toContain(
                        new SecondsToTimePipe().transform(SESSIONS[1].elapsedTime, "pace"),
                    );
                });

                it("should place longer duration first when sorting Time descending", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    await fixture.whenStable();

                    const timeHeader = fixture.nativeElement.querySelector(".time[mat-sort-header]");
                    expect(timeHeader).not.toBeNull();
                    timeHeader.click(); // first click for ascending
                    timeHeader.click(); // second click for descending

                    const firstRowTimeCell = fixture.nativeElement.querySelector("mat-row .time");
                    expect(firstRowTimeCell).not.toBeNull();
                    expect(firstRowTimeCell.textContent.trim()).toContain(
                        new SecondsToTimePipe().transform(SESSIONS[0].elapsedTime, "pace"),
                    );
                });
            });

            describe("by Distance column", (): void => {
                it("should place smaller distance first when sorting Distance ascending", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    await fixture.whenStable();

                    const distanceHeader = fixture.nativeElement.querySelector(".distance[mat-sort-header]");
                    expect(distanceHeader).not.toBeNull();
                    distanceHeader.click();

                    const firstRowDistanceCell = fixture.nativeElement.querySelector("mat-row .distance");
                    expect(firstRowDistanceCell).not.toBeNull();
                    expect(firstRowDistanceCell.textContent.trim()).toBe(
                        (SESSIONS[1].distance / 100).toString(),
                    );
                });

                it("should place larger distance first when sorting Distance descending", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    await fixture.whenStable();

                    const distanceHeader = fixture.nativeElement.querySelector(".distance[mat-sort-header]");
                    expect(distanceHeader).not.toBeNull();
                    distanceHeader.click(); // first click for ascending
                    distanceHeader.click(); // second click for descending

                    const firstRowDistanceCell = fixture.nativeElement.querySelector("mat-row .distance");
                    expect(firstRowDistanceCell).not.toBeNull();
                    expect(firstRowDistanceCell.textContent.trim()).toBe(
                        (SESSIONS[0].distance / 100).toString(),
                    );
                });
            });

            describe("by Strokes column", (): void => {
                it("should place fewer strokes first when sorting Strokes ascending", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    await fixture.whenStable();

                    const strokesHeader = fixture.nativeElement.querySelector(
                        ".stroke-count[mat-sort-header]",
                    );
                    expect(strokesHeader).not.toBeNull();
                    strokesHeader.click();

                    const firstRowStrokesCell = fixture.nativeElement.querySelector("mat-row .stroke-count");
                    expect(firstRowStrokesCell).not.toBeNull();
                    expect(firstRowStrokesCell.textContent.trim()).toBe(SESSIONS[1].strokeCount.toString());
                });

                it("should place more strokes first when sorting Strokes descending", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    await fixture.whenStable();

                    const strokesHeader = fixture.nativeElement.querySelector(
                        ".stroke-count[mat-sort-header]",
                    );
                    expect(strokesHeader).not.toBeNull();
                    strokesHeader.click(); // first click for ascending
                    strokesHeader.click(); // second click for descending

                    const firstRowStrokesCell = fixture.nativeElement.querySelector("mat-row .stroke-count");
                    expect(firstRowStrokesCell).not.toBeNull();
                    expect(firstRowStrokesCell.textContent.trim()).toBe(SESSIONS[0].strokeCount.toString());
                });
            });

            describe("by Device column", (): void => {
                it("should sort by device name lexicographically when sorting Device ascending", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    await fixture.whenStable();

                    const deviceHeader = fixture.nativeElement.querySelector(".device-name[mat-sort-header]");
                    expect(deviceHeader).not.toBeNull();
                    deviceHeader.click();

                    const firstRowDeviceCell = fixture.nativeElement.querySelector("mat-row .device-name");
                    expect(firstRowDeviceCell).not.toBeNull();
                    // "Device A" should come before "Unknown" alphabetically
                    expect(firstRowDeviceCell.textContent.trim()).toBe(SESSIONS[0].deviceName);
                });

                it("should place 'Unknown' first when sorting Device descending", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    await fixture.whenStable();

                    const deviceHeader = fixture.nativeElement.querySelector(".device-name[mat-sort-header]");
                    expect(deviceHeader).not.toBeNull();
                    deviceHeader.click(); // first click for ascending
                    deviceHeader.click(); // second click for descending

                    const firstRowDeviceCell = fixture.nativeElement.querySelector("mat-row .device-name");
                    expect(firstRowDeviceCell).not.toBeNull();
                    expect(firstRowDeviceCell.textContent.trim()).toBe("Unknown");
                });
            });
        });

        it("should open actions menu for a row", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            const loader = TestbedHarnessEnvironment.loader(fixture);
            const button = await loader.getHarness<MatButtonHarness>(
                MatButtonHarness.with({
                    selector: "button.mat-mdc-menu-trigger",
                }),
            );
            const menu = await loader.getHarness<MatMenuHarness>(MatMenuHarness);

            expect(await menu.isOpen()).toBeFalsy();
            await button.click();
            expect(await menu.isOpen()).toBeTruthy();
            expect(await menu.getItems()).toHaveLength(3);
        });

        it("should call exportSessionToJson with sessionId when JSON option clicked", async (): Promise<void> => {
            summaries$.next(SESSIONS);

            await component.exportToJson(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToJson).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("should call exportSessionToFit with sessionId when FIT option clicked", async (): Promise<void> => {
            summaries$.next(SESSIONS);

            await component.exportToFit(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToFit).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("should call exportSessionToCsv with sessionId when CSV option clicked", async (): Promise<void> => {
            summaries$.next(SESSIONS);

            await component.exportToCsv(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToCsv).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        describe("upload button", (): void => {
            describe("when no API key is configured", (): void => {
                beforeEach((): void => {
                    vi.mocked(configManagerSpy.getGroup).mockReturnValue({
                        intervalsIcu: { apiKey: "", athleteId: "", autoUploadEnabled: false },
                    } as ReturnType<ConfigManagerService["getGroup"]>);
                    createComponent();
                });

                it("should not show upload button", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    await fixture.whenStable();

                    const uploadButtons = fixture.nativeElement.querySelectorAll(
                        "[aria-label='Upload to Intervals.icu']",
                    );
                    expect(uploadButtons).toHaveLength(0);
                });
            });

            describe("when API key is present", (): void => {
                beforeEach((): void => {
                    vi.mocked(configManagerSpy.getGroup).mockReturnValue({
                        intervalsIcu: { apiKey: "my-key", athleteId: "", autoUploadEnabled: false },
                    } as ReturnType<ConfigManagerService["getGroup"]>);
                    createComponent();
                });

                it("should not show upload button for already-uploaded session", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    uploadedIds$.next([SESSIONS[0].sessionId, SESSIONS[1].sessionId]);
                    await fixture.whenStable();

                    const uploadButtons = fixture.nativeElement.querySelectorAll(
                        "[aria-label='Upload to Intervals.icu']",
                    );
                    expect(uploadButtons).toHaveLength(0);
                });

                it("should show upload button for non-uploaded sessions when API key is present", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    uploadedIds$.next([]);
                    await fixture.whenStable();

                    const uploadButtons = fixture.nativeElement.querySelectorAll(
                        "[aria-label='Upload to Intervals.icu']",
                    );
                    expect(uploadButtons).toHaveLength(SESSIONS.length);
                });

                it("should disable upload button while uploading that session", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    uploadedIds$.next([]);
                    await fixture.whenStable();

                    component.uploadingSessionId.set(SESSIONS[0].sessionId);
                    fixture.detectChanges();

                    const uploadButton = fixture.nativeElement.querySelector(
                        "[aria-label='Upload to Intervals.icu']",
                    );
                    expect(uploadButton.disabled).toBe(true);
                });

                it("should not disable upload button for a different session while uploading", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    uploadedIds$.next([]);
                    await fixture.whenStable();

                    component.uploadingSessionId.set(SESSIONS[0].sessionId);
                    fixture.detectChanges();

                    const uploadButtons = fixture.nativeElement.querySelectorAll(
                        "[aria-label='Upload to Intervals.icu']",
                    );
                    expect(uploadButtons[1].disabled).toBe(false);
                });

                it("should call uploadToIntervals when upload button is clicked", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    uploadedIds$.next([]);
                    await fixture.whenStable();
                    fixture.detectChanges();

                    vi.spyOn(component, "uploadToIntervals");
                    const uploadButton = fixture.nativeElement.querySelector(
                        "[aria-label='Upload to Intervals.icu']",
                    );
                    uploadButton.click();

                    expect(component.uploadToIntervals).toHaveBeenCalledWith(SESSIONS[0].sessionId);
                });

                it("should hide upload button for session after it appears in uploaded IDs observable", async (): Promise<void> => {
                    summaries$.next(SESSIONS);
                    uploadedIds$.next([]);
                    await fixture.whenStable();
                    fixture.detectChanges();

                    expect(
                        fixture.nativeElement.querySelectorAll("[aria-label='Upload to Intervals.icu']"),
                    ).toHaveLength(2);

                    uploadedIds$.next([SESSIONS[0].sessionId]);
                    await fixture.whenStable();
                    fixture.detectChanges();

                    expect(
                        fixture.nativeElement.querySelectorAll("[aria-label='Upload to Intervals.icu']"),
                    ).toHaveLength(1);
                });
            });
        });
    });

    describe("exportToJson method", (): void => {
        it("should call respective service method with the given sessionId", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            vi.mocked(dataRecorderSpy.exportSessionToJson).mockResolvedValue();

            await component.exportToJson(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToJson).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("shows snackbar on exportToJson error", async (): Promise<void> => {
            // arrange
            summaries$.next(SESSIONS);
            vi.mocked(dataRecorderSpy.exportSessionToJson).mockReturnValue(
                Promise.reject(new Error("export json error")),
            );

            await component.exportToJson(SESSIONS[0].sessionId);

            // assert
            expect(snackBarSpy.open).toHaveBeenCalledWith(
                expect.stringMatching(/Error while downloading session: export json error/),
                "Dismiss",
            );
        });
    });

    describe("exportToFit method", (): void => {
        it("should call respective service method with the given sessionId", async (): Promise<void> => {
            // arrange
            summaries$.next(SESSIONS);
            vi.mocked(dataRecorderSpy.exportSessionToFit).mockResolvedValue();

            await component.exportToFit(SESSIONS[0].sessionId);

            // assert
            expect(dataRecorderSpy.exportSessionToFit).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("shows snackbar on exportToFit error", async (): Promise<void> => {
            // arrange
            summaries$.next(SESSIONS);
            vi.mocked(dataRecorderSpy.exportSessionToFit).mockRejectedValue(new Error("export fit error"));

            await component.exportToFit(SESSIONS[0].sessionId);

            // assert
            expect(snackBarSpy.open).toHaveBeenCalledWith(
                expect.stringMatching(/Error while downloading session: export fit error/),
                "Dismiss",
            );
        });
    });

    describe("exportToCsv method", (): void => {
        it("should call respective service method with the given sessionId", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            vi.mocked(dataRecorderSpy.exportSessionToCsv).mockResolvedValue();

            await component.exportToCsv(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToCsv).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("shows snackbar on exportToCsv error", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            vi.mocked(dataRecorderSpy.exportSessionToCsv).mockRejectedValue(new Error("export csv error"));

            await component.exportToCsv(SESSIONS[0].sessionId);

            expect(snackBarSpy.open).toHaveBeenCalledWith(
                expect.stringMatching(/Error while downloading session: export csv error/),
                "Dismiss",
            );
        });
    });

    describe("deleteSession method", (): void => {
        it("should open confirm snackbar when delete button clicked", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            await fixture.whenStable();

            const deleteButton = fixture.nativeElement.querySelector("mat-row .delete-button");
            deleteButton.click();

            expect(snackBarSpy.openFromComponent).toHaveBeenCalledWith(
                SnackBarConfirmComponent,
                expect.objectContaining({
                    data: { text: "Are sure you want to delete?", confirm: "Yes" },
                }),
            );
        });

        it("should call dataRecorder.deleteSession after user confirms", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            await fixture.whenStable();
            vi.mocked(dataRecorderSpy.deleteSession).mockResolvedValue(undefined);

            const deleteButton = fixture.nativeElement.querySelector("mat-row .delete-button");
            deleteButton.click();
            const lastCallResult = vi.mocked(snackBarSpy.openFromComponent).mock.results[
                vi.mocked(snackBarSpy.openFromComponent).mock.results.length - 1
            ];
            const mockConfirmRef = lastCallResult?.value as MatSnackBarRef<SnackBarConfirmComponent>;
            if (mockConfirmRef) {
                mockConfirmRef.onAction().subscribe(); // trigger the confirmation
            }

            expect(dataRecorderSpy.deleteSession).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("should show success snackbar after successful deletion", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            await fixture.whenStable();
            vi.mocked(dataRecorderSpy.deleteSession).mockResolvedValue(undefined);

            const deleteButton = fixture.nativeElement.querySelector("mat-row .delete-button");
            deleteButton.click();
            const lastCallResult = vi.mocked(snackBarSpy.openFromComponent).mock.results[
                vi.mocked(snackBarSpy.openFromComponent).mock.results.length - 1
            ];
            const mockConfirmRef = lastCallResult?.value as MatSnackBarRef<SnackBarConfirmComponent>;

            await firstValueFrom(mockConfirmRef.onAction());
            await fixture.whenStable();

            expect(snackBarSpy.open).toHaveBeenCalledWith(
                expect.stringMatching(/Session ".*" was deleted/),
                "Dismiss",
            );
        });

        it("should show error snackbar if deletion fails", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            await fixture.whenStable();
            vi.mocked(dataRecorderSpy.deleteSession).mockRejectedValue(new Error("Delete failed"));

            const deleteButton = fixture.nativeElement.querySelector("mat-row .delete-button");
            deleteButton.click();
            const lastCallResult = vi.mocked(snackBarSpy.openFromComponent).mock.results[
                vi.mocked(snackBarSpy.openFromComponent).mock.results.length - 1
            ];
            const mockConfirmRef = lastCallResult?.value as MatSnackBarRef<SnackBarConfirmComponent>;

            await firstValueFrom(mockConfirmRef.onAction());
            await fixture.whenStable();

            expect(snackBarSpy.open).toHaveBeenCalledWith(
                expect.stringMatching(/An error occurred while deleting session ".*"/),
                "Dismiss",
            );
        });
    });

    describe("export method", (): void => {
        it("should call DataRecorderService.export with progress callback", async (): Promise<void> => {
            const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
            expect(exportButton).not.toBeNull();
            expect(exportButton.textContent.trim()).toBe("Export");
            exportButton.click();

            expect(dataRecorderSpy.export).toHaveBeenCalledWith(expect.any(Function));
        });

        it("should show progress bar while exporting and disable buttons", async (): Promise<void> => {
            const exportPromise = new Promise<void>((resolve: () => void): void => {
                // keep resolve available but unused for this test
                void resolve;
            });
            vi.mocked(dataRecorderSpy.export).mockReturnValue(exportPromise);

            const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
            expect(exportButton.textContent.trim()).toBe("Export");
            exportButton.click();
            await fixture.whenStable();

            const progressBar = fixture.nativeElement.querySelector("mat-progress-bar");
            expect(progressBar).not.toBeNull();
            expect(exportButton.disabled).toBe(true);

            const importButton = fixture.nativeElement.querySelector(
                "[mat-dialog-actions] button:nth-child(2)",
            );
            expect(importButton.disabled).toBe(true);
        });

        describe("on export success", (): void => {
            it("should show success snackbar", async (): Promise<void> => {
                const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
                exportButton.click();
                await fixture.whenStable();

                expect(snackBarSpy.open).toHaveBeenCalledWith("Export successful", "Dismiss");
            });

            it("should hide progress bar", async (): Promise<void> => {
                const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
                exportButton.click();
                await fixture.whenStable();

                // simulate snackbar afterDismissed
                const lastCallResult = vi.mocked(snackBarSpy.open).mock.results[
                    vi.mocked(snackBarSpy.open).mock.results.length - 1
                ];
                const mockSnackBarRef = lastCallResult?.value as MatSnackBarRef<TextOnlySnackBar>;
                mockSnackBarRef.afterDismissed().subscribe();

                expect(component.importExportProgress()).toBeUndefined();
            });
        });

        describe("on export error", (): void => {
            it("should show failure snackbar", async (): Promise<void> => {
                vi.mocked(dataRecorderSpy.export).mockRejectedValue(new Error("Export failed"));

                const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
                exportButton.click();
                await fixture.whenStable();

                expect(snackBarSpy.open).toHaveBeenCalledWith("Export failed: Export failed", "Dismiss", {
                    duration: 10000,
                });
            });

            it("should hide progress bar", async (): Promise<void> => {
                vi.mocked(dataRecorderSpy.export).mockRejectedValue(new Error("Export failed"));

                const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
                exportButton.click();
                await fixture.whenStable();

                // simulate snackbar afterDismissed
                const lastCallResult = vi.mocked(snackBarSpy.open).mock.results[
                    vi.mocked(snackBarSpy.open).mock.results.length - 1
                ];
                const mockSnackBarRef = lastCallResult?.value as MatSnackBarRef<TextOnlySnackBar>;
                mockSnackBarRef.afterDismissed().subscribe();

                expect(component.importExportProgress()).toBeUndefined();
            });
        });
    });

    describe("import method", (): void => {
        it("should open file picker when Import clicked", (): void => {
            const fileInput = fixture.nativeElement.querySelector("input[type='file']");
            vi.spyOn(fileInput, "click").mockImplementation((): void => {
                // no-op
            });

            const importButton = fixture.nativeElement.querySelector(
                "[mat-dialog-actions] button:nth-child(2)",
            );
            expect(importButton.textContent.trim()).toBe("Import");
            importButton.click();

            expect(fileInput.click).toHaveBeenCalled();
        });

        it("should call DataRecorderService.import with selected file and progress callback", async (): Promise<void> => {
            const mockFile = new File(["test content"], "test.csv", { type: "text/csv" });

            const fileInput = fixture.nativeElement.querySelector("input[type='file']");
            Object.defineProperty(fileInput, "files", {
                value: [mockFile],
                writable: false,
            });

            fileInput.dispatchEvent(new Event("change"));
            await fixture.whenStable();

            expect(dataRecorderSpy.import).toHaveBeenCalledWith(mockFile, expect.any(Function));
        });

        describe("on import success", (): void => {
            it("should show success snackbar", async (): Promise<void> => {
                const mockFile = new File(["test content"], "test.csv", { type: "text/csv" });

                const fileInput = fixture.nativeElement.querySelector("input[type='file']");
                Object.defineProperty(fileInput, "files", {
                    value: [mockFile],
                    writable: false,
                });

                fileInput.dispatchEvent(new Event("change"));
                await fixture.whenStable();

                expect(snackBarSpy.open).toHaveBeenCalledWith("Import successful", "Dismiss");
            });

            it("should clear progress after success", async (): Promise<void> => {
                const mockFile = new File(["test content"], "test.csv", { type: "text/csv" });

                const fileInput = fixture.nativeElement.querySelector("input[type='file']");
                Object.defineProperty(fileInput, "files", {
                    value: [mockFile],
                    writable: false,
                });

                fileInput.dispatchEvent(new Event("change"));
                await fixture.whenStable();

                // simulate snackbar afterDismissed
                const lastCallResult = vi.mocked(snackBarSpy.open).mock.results[
                    vi.mocked(snackBarSpy.open).mock.results.length - 1
                ];
                const mockSnackBarRef = lastCallResult?.value as MatSnackBarRef<TextOnlySnackBar>;
                mockSnackBarRef.afterDismissed().subscribe();

                expect(component.importExportProgress()).toBeUndefined();
            });
        });

        describe("on import error", (): void => {
            it("should show failure snackbar", async (): Promise<void> => {
                const mockFile = new File(["test content"], "test.csv", { type: "text/csv" });
                vi.mocked(dataRecorderSpy.import).mockRejectedValue(new Error("Import failed"));

                const fileInput = fixture.nativeElement.querySelector("input[type='file']");
                Object.defineProperty(fileInput, "files", {
                    value: [mockFile],
                    writable: false,
                });

                fileInput.dispatchEvent(new Event("change"));
                await fixture.whenStable();

                expect(snackBarSpy.open).toHaveBeenCalledWith("Import failed: Import failed", "Dismiss", {
                    duration: 10000,
                });
            });

            it("should clear progress", async (): Promise<void> => {
                const mockFile = new File(["test content"], "test.csv", { type: "text/csv" });
                vi.mocked(dataRecorderSpy.import).mockRejectedValue(new Error("Import failed"));

                const fileInput = fixture.nativeElement.querySelector("input[type='file']");
                Object.defineProperty(fileInput, "files", {
                    value: [mockFile],
                    writable: false,
                });

                fileInput.dispatchEvent(new Event("change"));
                await fixture.whenStable();

                // simulate snackbar afterDismissed
                const lastCallResult = vi.mocked(snackBarSpy.open).mock.results[
                    vi.mocked(snackBarSpy.open).mock.results.length - 1
                ];
                const mockSnackBarRef = lastCallResult?.value as MatSnackBarRef<TextOnlySnackBar>;
                mockSnackBarRef.afterDismissed().subscribe();

                expect(component.importExportProgress()).toBeUndefined();
            });
        });

        it("should do nothing when no file is selected", (): void => {
            const fileInput = fixture.nativeElement.querySelector("input[type='file']");
            Object.defineProperty(fileInput, "files", {
                value: [],
                writable: false,
            });

            fileInput.dispatchEvent(new Event("change"));

            expect(dataRecorderSpy.import).not.toHaveBeenCalled();
        });
    });

    describe("hasApiKey property", (): void => {
        it("should be false when no API key is configured", (): void => {
            vi.mocked(configManagerSpy.getGroup).mockReturnValue({
                intervalsIcu: { apiKey: "", athleteId: "", autoUploadEnabled: false },
            } as ReturnType<ConfigManagerService["getGroup"]>);
            createComponent();

            expect(component.hasApiKey).toBe(false);
        });

        it("should be true when an API key is configured", (): void => {
            vi.mocked(configManagerSpy.getGroup).mockReturnValue({
                intervalsIcu: { apiKey: "my-key", athleteId: "", autoUploadEnabled: false },
            } as ReturnType<ConfigManagerService["getGroup"]>);
            createComponent();

            expect(component.hasApiKey).toBe(true);
        });
    });

    describe("uploadedSessionIds signal", (): void => {
        it("should start with initial IDs from dialog data before observable emits", (): void => {
            expect(component.uploadedSessionIds().has(SESSIONS[0].sessionId)).toBe(true);
            expect(component.uploadedSessionIds().has(SESSIONS[1].sessionId)).toBe(false);
        });

        it("should update when the observable emits new IDs", (): void => {
            createComponent();
            uploadedIds$.next([SESSIONS[0].sessionId]);

            expect(component.uploadedSessionIds().has(SESSIONS[0].sessionId)).toBe(true);
            expect(component.uploadedSessionIds().has(SESSIONS[1].sessionId)).toBe(false);
        });
    });

    describe("uploadToIntervals method", (): void => {
        it("should call intervalsIcuService.uploadSession with the given sessionId", async (): Promise<void> => {
            await component.uploadToIntervals(SESSIONS[0].sessionId);

            expect(intervalsIcuServiceSpy.uploadSession).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("should set uploadingSessionId during upload and clear it after", async (): Promise<void> => {
            let capturedDuringUpload: number | undefined;
            vi.mocked(intervalsIcuServiceSpy.uploadSession).mockImplementation(async (): Promise<boolean> => {
                capturedDuringUpload = component.uploadingSessionId();

                return true;
            });

            await component.uploadToIntervals(SESSIONS[0].sessionId);

            expect(capturedDuringUpload).toBe(SESSIONS[0].sessionId);
            expect(component.uploadingSessionId()).toBeUndefined();
        });

        it("should show success snackbar when upload succeeds", async (): Promise<void> => {
            vi.mocked(intervalsIcuServiceSpy.uploadSession).mockResolvedValue(true);

            await component.uploadToIntervals(SESSIONS[0].sessionId);

            expect(snackBarSpy.open).toHaveBeenCalledWith("Session uploaded to Intervals.icu", "Dismiss");
        });

        it("should not show success snackbar when upload returns false", async (): Promise<void> => {
            vi.mocked(intervalsIcuServiceSpy.uploadSession).mockResolvedValue(false);

            await component.uploadToIntervals(SESSIONS[0].sessionId);

            expect(snackBarSpy.open).not.toHaveBeenCalledWith("Session uploaded to Intervals.icu", "Dismiss");
        });

        it("should clear uploadingSessionId even when upload throws", async (): Promise<void> => {
            vi.mocked(intervalsIcuServiceSpy.uploadSession).mockRejectedValue(new Error("network error"));

            await component.uploadToIntervals(SESSIONS[0].sessionId).catch((): void => undefined);

            expect(component.uploadingSessionId()).toBeUndefined();
        });
    });

    describe("openSession method", (): void => {
        beforeEach((): void => {
            vi.spyOn(window, "open").mockReturnValue(null);
        });

        afterEach((): void => {
            vi.restoreAllMocks();
        });

        it("should open a new tab with the router-built session URL", (): void => {
            component.openSession(SESSIONS[0].sessionId);

            expect(routerSpy.createUrlTree).toHaveBeenCalledWith(["session", SESSIONS[0].sessionId]);
            expect(locationSpy.prepareExternalUrl).toHaveBeenCalledWith("/session/123");
            expect(window.open).toHaveBeenCalledWith("/base/session/123", "_blank");
        });

        it("should open correct URL when bar_chart button is clicked", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            await fixture.whenStable();

            const barChartButton = fixture.nativeElement.querySelector("mat-row .actions button");
            barChartButton.click();

            expect(window.open).toHaveBeenCalledWith("/base/session/123", "_blank");
        });
    });
});
