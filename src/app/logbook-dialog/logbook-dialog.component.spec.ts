import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { provideZonelessChangeDetection } from "@angular/core";
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
import { Observable, of, Subject } from "rxjs";

import { ISessionSummary } from "../../common/common.interfaces";
import { DataRecorderService } from "../../common/services/data-recorder.service";
import { SnackBarConfirmComponent } from "../../common/snack-bar-confirm/snack-bar-confirm.component";
import { SecondsToTimePipe } from "../../common/utils/seconds-to-time.pipe";

import { LogbookDialogComponent } from "./logbook-dialog.component";

describe("LogbookDialogComponent", (): void => {
    let fixture: ComponentFixture<LogbookDialogComponent>;
    let component: LogbookDialogComponent;

    let summaries$: Subject<Array<ISessionSummary>>;

    let dataRecorderSpy: jasmine.SpyObj<DataRecorderService>;
    let snackBarSpy: jasmine.SpyObj<MatSnackBar>;

    const SESSIONS: Array<ISessionSummary> = [
        {
            sessionId: new Date("2024-01-02T10:00:00Z").getTime(),
            startTime: 1000,
            finishTime: 7000,
            distance: 25000,
            strokeCount: 30,
            deviceName: "Device A",
        },
        {
            sessionId: new Date("2024-01-01T10:00:00Z").getTime(),
            startTime: 0,
            finishTime: 4000,
            distance: 50000,
            strokeCount: 60,
            deviceName: undefined as unknown as string,
        },
    ];

    beforeEach(async (): Promise<void> => {
        summaries$ = new Subject<Array<ISessionSummary>>();
        dataRecorderSpy = jasmine.createSpyObj("DataRecorderService", [
            "getSessionSummaries$",
            "deleteSession",
            "export",
            "exportSessionToJson",
            "exportSessionToTcx",
            "exportSessionToCsv",
            "import",
        ]);
        dataRecorderSpy.getSessionSummaries$.and.returnValue(summaries$.asObservable());
        dataRecorderSpy.deleteSession.and.resolveTo([1, 1, 1, 1]);

        snackBarSpy = jasmine.createSpyObj(["open", "openFromComponent"]);

        snackBarSpy.open.and.returnValue({
            afterDismissed: (): Observable<MatSnackBarDismiss> => of({ dismissedByAction: false }),
            onAction: (): Observable<void> => of(),
        } as unknown as MatSnackBarRef<TextOnlySnackBar>);
        snackBarSpy.openFromComponent.and.returnValue({
            onAction: (): Observable<boolean> => of(true),
            dismiss: jasmine.createSpy("dismiss"),
        } as unknown as MatSnackBarRef<SnackBarConfirmComponent>);

        await TestBed.configureTestingModule({
            imports: [LogbookDialogComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: MAT_DIALOG_DATA, useValue: SESSIONS },
                { provide: DataRecorderService, useValue: dataRecorderSpy },
                { provide: MatSnackBar, useValue: snackBarSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(LogbookDialogComponent);
        component = fixture.componentInstance;
    });

    it("should create the component", (): void => {
        expect(component).toBeTruthy();
    });

    it("should dismiss confirm snackbar on ngOnDestroy when present", (): void => {
        component.deleteSession(SESSIONS[0].sessionId);
        const dismissSpy = jasmine.createSpy("dismiss");
        (component as unknown as { confirmSnackBarRef: { dismiss: jasmine.Spy } }).confirmSnackBarRef = {
            dismiss: dismissSpy,
        };

        component.ngOnDestroy();

        expect(dismissSpy).toHaveBeenCalled();
    });

    describe("template", (): void => {
        it("should render one table row per session", (): void => {
            summaries$.next(SESSIONS);

            fixture.detectChanges();

            const rows = fixture.nativeElement.querySelectorAll("mat-row");
            expect(rows).toHaveSize(SESSIONS.length);
        });

        it("should show date and time from sessionId", (): void => {
            summaries$.next(SESSIONS);

            fixture.detectChanges();

            const firstRowDateCell = fixture.nativeElement.querySelector("mat-row .date");
            const expectedDate = new Date(SESSIONS[0].sessionId);
            expect(firstRowDateCell.textContent).toContain(expectedDate.getFullYear().toString());
            expect(firstRowDateCell.textContent).toContain(expectedDate.toTimeString().substring(0, 8));
        });

        it("should show calculated duration in the Time column", (): void => {
            summaries$.next(SESSIONS);

            fixture.detectChanges();
            const firstRowTimeCell = fixture.nativeElement.querySelector("mat-row .time");

            expect(firstRowTimeCell.textContent.trim().length).toBeGreaterThan(0);
        });

        it("should update table rows when getSessionSummaries$ emits", (): void => {
            summaries$.next([]);
            fixture.detectChanges();
            expect(fixture.nativeElement.querySelectorAll("mat-row")).toHaveSize(0);

            summaries$.next(SESSIONS);
            fixture.detectChanges();

            const rows = fixture.nativeElement.querySelectorAll("mat-row");
            expect(rows).toHaveSize(SESSIONS.length);
        });

        it("distance column should show meters as distance/100", (): void => {
            summaries$.next(SESSIONS);

            fixture.detectChanges();

            const firstRowDistanceCell = fixture.nativeElement.querySelector("mat-row .distance");
            const expectedDistance = SESSIONS[0].distance / 100;
            expect(firstRowDistanceCell.textContent.trim()).toBe(expectedDistance.toString());
        });

        describe("device name", (): void => {
            it("should show provided device name", (): void => {
                summaries$.next(SESSIONS);

                fixture.detectChanges();

                const firstRowDeviceCell = fixture.nativeElement.querySelector("mat-row .device-name");
                expect(firstRowDeviceCell.textContent.trim()).toBe(SESSIONS[0].deviceName);
            });

            it("should fall back to 'Unknown' when deviceName is missing", (): void => {
                summaries$.next(SESSIONS);

                fixture.detectChanges();

                const rows = fixture.nativeElement.querySelectorAll("mat-row");
                const secondRowDeviceCell = rows[1]?.querySelector(".device-name");
                expect(secondRowDeviceCell.textContent.trim()).toBe("Unknown");
            });
        });

        describe("sorting", (): void => {
            it("should default to sorting by sessionId descending (newest first)", (): void => {
                summaries$.next(SESSIONS);

                fixture.detectChanges();

                const firstRowDateCell = fixture.nativeElement.querySelector("mat-row .date");
                const newestSessionDate = new Date(SESSIONS[0].sessionId);
                expect(firstRowDateCell.textContent).toContain(newestSessionDate.getFullYear().toString());
            });

            describe("by Time column", (): void => {
                it("should place shorter duration first when sorting Time ascending", (): void => {
                    summaries$.next(SESSIONS);
                    fixture.detectChanges();

                    const timeHeader = fixture.nativeElement.querySelector(".time[mat-sort-header]");
                    expect(timeHeader).not.toBeNull();
                    timeHeader.click();
                    fixture.detectChanges();

                    const firstRowTimeCell = fixture.nativeElement.querySelector("mat-row .time");
                    expect(firstRowTimeCell).not.toBeNull();
                    expect(firstRowTimeCell.textContent.trim()).toContain(
                        new SecondsToTimePipe().transform(
                            (SESSIONS[1].finishTime - SESSIONS[1].startTime) / 1000,
                            "pace",
                        ),
                    );
                });

                it("should place longer duration first when sorting Time descending", (): void => {
                    summaries$.next(SESSIONS);
                    fixture.detectChanges();

                    const timeHeader = fixture.nativeElement.querySelector(".time[mat-sort-header]");
                    expect(timeHeader).not.toBeNull();
                    timeHeader.click(); // first click for ascending
                    timeHeader.click(); // second click for descending
                    fixture.detectChanges();

                    const firstRowTimeCell = fixture.nativeElement.querySelector("mat-row .time");
                    expect(firstRowTimeCell).not.toBeNull();
                    expect(firstRowTimeCell.textContent.trim()).toContain(
                        new SecondsToTimePipe().transform(
                            (SESSIONS[0].finishTime - SESSIONS[0].startTime) / 1000,
                            "pace",
                        ),
                    );
                });
            });

            describe("by Distance column", (): void => {
                it("should place smaller distance first when sorting Distance ascending", (): void => {
                    summaries$.next(SESSIONS);
                    fixture.detectChanges();

                    const distanceHeader = fixture.nativeElement.querySelector(".distance[mat-sort-header]");
                    expect(distanceHeader).not.toBeNull();
                    distanceHeader.click();
                    fixture.detectChanges();

                    const firstRowDistanceCell = fixture.nativeElement.querySelector("mat-row .distance");
                    expect(firstRowDistanceCell).not.toBeNull();
                    expect(firstRowDistanceCell.textContent.trim()).toBe(
                        (SESSIONS[1].distance / 100).toString(),
                    );
                });

                it("should place larger distance first when sorting Distance descending", (): void => {
                    summaries$.next(SESSIONS);
                    fixture.detectChanges();

                    const distanceHeader = fixture.nativeElement.querySelector(".distance[mat-sort-header]");
                    expect(distanceHeader).not.toBeNull();
                    distanceHeader.click(); // first click for ascending
                    distanceHeader.click(); // second click for descending
                    fixture.detectChanges();

                    const firstRowDistanceCell = fixture.nativeElement.querySelector("mat-row .distance");
                    expect(firstRowDistanceCell).not.toBeNull();
                    expect(firstRowDistanceCell.textContent.trim()).toBe(
                        (SESSIONS[0].distance / 100).toString(),
                    );
                });
            });

            describe("by Strokes column", (): void => {
                it("should place fewer strokes first when sorting Strokes ascending", (): void => {
                    summaries$.next(SESSIONS);
                    fixture.detectChanges();

                    const strokesHeader = fixture.nativeElement.querySelector(
                        ".stroke-count[mat-sort-header]",
                    );
                    expect(strokesHeader).not.toBeNull();
                    strokesHeader.click();
                    fixture.detectChanges();

                    const firstRowStrokesCell = fixture.nativeElement.querySelector("mat-row .stroke-count");
                    expect(firstRowStrokesCell).not.toBeNull();
                    expect(firstRowStrokesCell.textContent.trim()).toBe(SESSIONS[1].strokeCount.toString());
                });

                it("should place more strokes first when sorting Strokes descending", (): void => {
                    summaries$.next(SESSIONS);
                    fixture.detectChanges();

                    const strokesHeader = fixture.nativeElement.querySelector(
                        ".stroke-count[mat-sort-header]",
                    );
                    expect(strokesHeader).not.toBeNull();
                    strokesHeader.click(); // first click for ascending
                    strokesHeader.click(); // second click for descending
                    fixture.detectChanges();

                    const firstRowStrokesCell = fixture.nativeElement.querySelector("mat-row .stroke-count");
                    expect(firstRowStrokesCell).not.toBeNull();
                    expect(firstRowStrokesCell.textContent.trim()).toBe(SESSIONS[0].strokeCount.toString());
                });
            });

            describe("by Device column", (): void => {
                it("should sort by device name lexicographically when sorting Device ascending", (): void => {
                    summaries$.next(SESSIONS);
                    fixture.detectChanges();

                    const deviceHeader = fixture.nativeElement.querySelector(".device-name[mat-sort-header]");
                    expect(deviceHeader).not.toBeNull();
                    deviceHeader.click();
                    fixture.detectChanges();

                    const firstRowDeviceCell = fixture.nativeElement.querySelector("mat-row .device-name");
                    expect(firstRowDeviceCell).not.toBeNull();
                    // "Device A" should come before "Unknown" alphabetically
                    expect(firstRowDeviceCell.textContent.trim()).toBe(SESSIONS[0].deviceName);
                });

                it("should place 'Unknown' first when sorting Device descending", (): void => {
                    summaries$.next(SESSIONS);
                    fixture.detectChanges();

                    const deviceHeader = fixture.nativeElement.querySelector(".device-name[mat-sort-header]");
                    expect(deviceHeader).not.toBeNull();
                    deviceHeader.click(); // first click for ascending
                    deviceHeader.click(); // second click for descending
                    fixture.detectChanges();

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
            expect(await menu.getItems()).toHaveSize(3);
        });

        it("should call exportSessionToJson with sessionId when JSON option clicked", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            fixture.detectChanges();

            await component.exportToJson(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToJson).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("should call exportSessionToTcx with sessionId when TCX option clicked", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            fixture.detectChanges();

            await component.exportToTcx(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToTcx).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("should call exportSessionToCsv with sessionId when CSV option clicked", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            fixture.detectChanges();

            await component.exportToCsv(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToCsv).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });
    });

    describe("exportToJson method", (): void => {
        it("should call respective service method with the given sessionId", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            dataRecorderSpy.exportSessionToJson.and.resolveTo();
            fixture.detectChanges();

            await component.exportToJson(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToJson).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("shows snackbar on exportToJson error", async (): Promise<void> => {
            // arrange
            summaries$.next(SESSIONS);
            dataRecorderSpy.exportSessionToJson.and.returnValue(
                Promise.reject(new Error("export json error")),
            );
            fixture.detectChanges();

            await component.exportToJson(SESSIONS[0].sessionId);

            // assert
            expect(snackBarSpy.open).toHaveBeenCalledWith(
                jasmine.stringMatching(/Error while downloading session: export json error/),
                "Dismiss",
            );
        });
    });

    describe("exportToTcx method", (): void => {
        it("should call respective service method with the given sessionId", async (): Promise<void> => {
            // arrange
            summaries$.next(SESSIONS);
            dataRecorderSpy.exportSessionToTcx.and.resolveTo();
            fixture.detectChanges();

            await component.exportToTcx(SESSIONS[0].sessionId);

            // assert
            expect(dataRecorderSpy.exportSessionToTcx).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("shows snackbar on exportToTcx error", async (): Promise<void> => {
            // arrange
            summaries$.next(SESSIONS);
            dataRecorderSpy.exportSessionToTcx.and.rejectWith(new Error("export tcx error"));
            fixture.detectChanges();

            await component.exportToTcx(SESSIONS[0].sessionId);

            // assert
            expect(snackBarSpy.open).toHaveBeenCalledWith(
                jasmine.stringMatching(/Error while downloading session: export tcx error/),
                "Dismiss",
            );
        });
    });

    describe("exportToCsv method", (): void => {
        it("should call respective service method with the given sessionId", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            dataRecorderSpy.exportSessionToCsv.and.resolveTo();
            fixture.detectChanges();

            await component.exportToCsv(SESSIONS[0].sessionId);

            expect(dataRecorderSpy.exportSessionToCsv).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("shows snackbar on exportToCsv error", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            dataRecorderSpy.exportSessionToCsv.and.rejectWith(new Error("export csv error"));
            fixture.detectChanges();

            await component.exportToCsv(SESSIONS[0].sessionId);

            expect(snackBarSpy.open).toHaveBeenCalledWith(
                jasmine.stringMatching(/Error while downloading session: export csv error/),
                "Dismiss",
            );
        });
    });

    describe("deleteSession method", (): void => {
        it("should open confirm snackbar when delete button clicked", (): void => {
            summaries$.next(SESSIONS);
            fixture.detectChanges();

            const deleteButton = fixture.nativeElement.querySelector("mat-row .delete-button");
            deleteButton.click();

            expect(snackBarSpy.openFromComponent).toHaveBeenCalledWith(
                SnackBarConfirmComponent,
                jasmine.objectContaining({
                    data: { text: "Are sure you want to delete?", confirm: "Yes" },
                }),
            );
        });

        it("should call dataRecorder.deleteSession after user confirms", (): void => {
            summaries$.next(SESSIONS);
            fixture.detectChanges();
            dataRecorderSpy.deleteSession.and.returnValue(
                Promise.resolve([1, 1, 1, 1] as [number, number, number, number]),
            );

            const deleteButton = fixture.nativeElement.querySelector("mat-row .delete-button");
            deleteButton.click();
            const mockConfirmRef = snackBarSpy.openFromComponent.calls.mostRecent().returnValue;
            mockConfirmRef.onAction().subscribe(); // trigger the confirmation

            expect(dataRecorderSpy.deleteSession).toHaveBeenCalledWith(SESSIONS[0].sessionId);
        });

        it("should show success snackbar after successful deletion", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            fixture.detectChanges();
            dataRecorderSpy.deleteSession.and.returnValue(
                Promise.resolve([1, 1, 1, 1] as [number, number, number, number]),
            );

            const deleteButton = fixture.nativeElement.querySelector("mat-row .delete-button");
            deleteButton.click();
            const mockConfirmRef = snackBarSpy.openFromComponent.calls.mostRecent().returnValue;

            // trigger the confirmation and wait for completion
            await new Promise<void>((resolve: () => void): void => {
                mockConfirmRef.onAction().subscribe({
                    next: (): void => resolve(),
                    error: (): void => resolve(),
                });
            });

            await fixture.whenStable();

            expect(snackBarSpy.open).toHaveBeenCalledWith(
                jasmine.stringMatching(/Session ".*" was deleted/),
                "Dismiss",
            );
        });

        it("should show error snackbar if deletion fails", async (): Promise<void> => {
            summaries$.next(SESSIONS);
            fixture.detectChanges();
            dataRecorderSpy.deleteSession.and.rejectWith(new Error("Delete failed"));

            const deleteButton = fixture.nativeElement.querySelector("mat-row .delete-button");
            deleteButton.click();
            const mockConfirmRef = snackBarSpy.openFromComponent.calls.mostRecent().returnValue;

            // trigger the confirmation and wait for completion
            await new Promise<void>((resolve: () => void): void => {
                mockConfirmRef.onAction().subscribe({
                    next: (): void => resolve(),
                    error: (): void => resolve(),
                });
            });

            await fixture.whenStable();

            expect(snackBarSpy.open).toHaveBeenCalledWith(
                jasmine.stringMatching(/An error occurred while deleting session ".*"/),
                "Dismiss",
            );
        });
    });

    describe("export method", (): void => {
        it("should call DataRecorderService.export with progress callback", async (): Promise<void> => {
            fixture.detectChanges();

            const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
            expect(exportButton).not.toBeNull();
            expect(exportButton.textContent.trim()).toBe("Export");
            exportButton.click();

            expect(dataRecorderSpy.export).toHaveBeenCalledWith(jasmine.any(Function));
        });

        it("should show progress bar while exporting and disable buttons", (): void => {
            const exportPromise = new Promise<void>((resolve: () => void): void => {
                // keep resolve available but unused for this test
                void resolve;
            });
            dataRecorderSpy.export.and.returnValue(exportPromise);
            fixture.detectChanges();

            const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
            expect(exportButton.textContent.trim()).toBe("Export");
            exportButton.click();
            fixture.detectChanges();

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
                fixture.detectChanges();

                const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
                exportButton.click();
                await fixture.whenStable();

                expect(snackBarSpy.open).toHaveBeenCalledWith("Export successful", "Dismiss");
            });

            it("should hide progress bar", async (): Promise<void> => {
                fixture.detectChanges();

                const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
                exportButton.click();
                await fixture.whenStable();

                // simulate snackbar afterDismissed
                const mockSnackBarRef = snackBarSpy.open.calls.mostRecent().returnValue;
                mockSnackBarRef.afterDismissed().subscribe();

                expect(component.importExportProgress()).toBeUndefined();
            });
        });

        describe("on export error", (): void => {
            it("should show failure snackbar", async (): Promise<void> => {
                dataRecorderSpy.export.and.rejectWith(new Error("Export failed"));
                fixture.detectChanges();

                const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
                exportButton.click();
                await fixture.whenStable();

                expect(snackBarSpy.open).toHaveBeenCalledWith("Export failed: Export failed", "Dismiss", {
                    duration: 10000,
                });
            });

            it("should hide progress bar", async (): Promise<void> => {
                dataRecorderSpy.export.and.rejectWith(new Error("Export failed"));
                fixture.detectChanges();

                const exportButton = fixture.nativeElement.querySelector("[mat-dialog-actions] button");
                exportButton.click();
                await fixture.whenStable();

                // simulate snackbar afterDismissed
                const mockSnackBarRef = snackBarSpy.open.calls.mostRecent().returnValue;
                mockSnackBarRef.afterDismissed().subscribe();

                expect(component.importExportProgress()).toBeUndefined();
            });
        });
    });

    describe("import method", (): void => {
        it("should open file picker when Import clicked", (): void => {
            fixture.detectChanges();
            const fileInput = fixture.nativeElement.querySelector("input[type='file']");
            spyOn(fileInput, "click");

            const importButton = fixture.nativeElement.querySelector(
                "[mat-dialog-actions] button:nth-child(2)",
            );
            expect(importButton.textContent.trim()).toBe("Import");
            importButton.click();

            expect(fileInput.click).toHaveBeenCalled();
        });

        it("should call DataRecorderService.import with selected file and progress callback", async (): Promise<void> => {
            const mockFile = new File(["test content"], "test.csv", { type: "text/csv" });
            fixture.detectChanges();

            const fileInput = fixture.nativeElement.querySelector("input[type='file']");
            Object.defineProperty(fileInput, "files", {
                value: [mockFile],
                writable: false,
            });

            fileInput.dispatchEvent(new Event("change"));
            await fixture.whenStable();

            expect(dataRecorderSpy.import).toHaveBeenCalledWith(mockFile, jasmine.any(Function));
        });

        describe("on import success", (): void => {
            it("should show success snackbar", async (): Promise<void> => {
                const mockFile = new File(["test content"], "test.csv", { type: "text/csv" });
                fixture.detectChanges();

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
                fixture.detectChanges();

                const fileInput = fixture.nativeElement.querySelector("input[type='file']");
                Object.defineProperty(fileInput, "files", {
                    value: [mockFile],
                    writable: false,
                });

                fileInput.dispatchEvent(new Event("change"));
                await fixture.whenStable();

                // simulate snackbar afterDismissed
                const mockSnackBarRef = snackBarSpy.open.calls.mostRecent().returnValue;
                mockSnackBarRef.afterDismissed().subscribe();

                expect(component.importExportProgress()).toBeUndefined();
            });
        });

        describe("on import error", (): void => {
            it("should show failure snackbar", async (): Promise<void> => {
                const mockFile = new File(["test content"], "test.csv", { type: "text/csv" });
                dataRecorderSpy.import.and.rejectWith(new Error("Import failed"));
                fixture.detectChanges();

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
                dataRecorderSpy.import.and.rejectWith(new Error("Import failed"));
                fixture.detectChanges();

                const fileInput = fixture.nativeElement.querySelector("input[type='file']");
                Object.defineProperty(fileInput, "files", {
                    value: [mockFile],
                    writable: false,
                });

                fileInput.dispatchEvent(new Event("change"));
                await fixture.whenStable();

                // simulate snackbar afterDismissed
                const mockSnackBarRef = snackBarSpy.open.calls.mostRecent().returnValue;
                mockSnackBarRef.afterDismissed().subscribe();

                expect(component.importExportProgress()).toBeUndefined();
            });
        });

        it("should do nothing when no file is selected", (): void => {
            fixture.detectChanges();
            const fileInput = fixture.nativeElement.querySelector("input[type='file']");
            Object.defineProperty(fileInput, "files", {
                value: [],
                writable: false,
            });

            fileInput.dispatchEvent(new Event("change"));

            expect(dataRecorderSpy.import).not.toHaveBeenCalled();
        });
    });
});
