import { CdkScrollable } from "@angular/cdk/scrolling";
import { DatePipe } from "@angular/common";
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    Inject,
    OnDestroy,
    Signal,
    signal,
    viewChild,
    WritableSignal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatButton, MatIconButton } from "@angular/material/button";
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
} from "@angular/material/dialog";
import { MatIcon } from "@angular/material/icon";
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatProgressBar } from "@angular/material/progress-bar";
import { MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { MatSort, MatSortHeader, SortDirection } from "@angular/material/sort";
import {
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatTable,
    MatTableDataSource,
} from "@angular/material/table";
import { ExportProgress } from "dexie-export-import";
import { ImportProgress } from "dexie-export-import/dist/import";
import { finalize, from, Observable, switchMap } from "rxjs";

import { ISessionSummary } from "../../common/common.interfaces";
import { DialogCloseButtonComponent } from "../../common/dialog-close-button/dialog-close-button.component";
import { DataRecorderService } from "../../common/services/data-recorder.service";
import { SnackBarConfirmComponent } from "../../common/snack-bar-confirm/snack-bar-confirm.component";
import { SecondsToTimePipe } from "../../common/utils/seconds-to-time.pipe";

@Component({
    selector: "app-logbook-dialog",
    templateUrl: "./logbook-dialog.component.html",
    styleUrls: ["./logbook-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatDialogTitle,
        DialogCloseButtonComponent,
        MatDialogClose,
        CdkScrollable,
        MatDialogContent,
        MatTable,
        MatSort,
        MatColumnDef,
        MatHeaderCellDef,
        MatHeaderCell,
        MatSortHeader,
        MatCellDef,
        MatCell,
        MatIconButton,
        MatMenuTrigger,
        MatIcon,
        MatHeaderRowDef,
        MatHeaderRow,
        MatRowDef,
        MatRow,
        MatDialogActions,
        MatButton,
        MatProgressBar,
        MatMenu,
        MatMenuContent,
        MatMenuItem,
        DatePipe,
        SecondsToTimePipe,
    ]
})
export class LogbookDialogComponent implements AfterViewInit, OnDestroy {
    dataSource: MatTableDataSource<ISessionSummary> = new MatTableDataSource<ISessionSummary>(
        this.sessionSummary,
    );

    displayedColumns: Array<string> = [
        "sessionId",
        "time",
        "distance",
        "strokeCount",
        "deviceName",
        "actions",
    ];

    importExportProgress: WritableSignal<number | undefined> = signal(undefined);

    sort: Signal<MatSort> = viewChild.required(MatSort);

    private confirmSnackBarRef: MatSnackBarRef<SnackBarConfirmComponent> | undefined;

    constructor(
        private dataRecorder: DataRecorderService,
        private snackBar: MatSnackBar,
        @Inject(MAT_DIALOG_DATA) private sessionSummary: Array<ISessionSummary>,
        private destroyRef: DestroyRef,
    ) {
        this.dataRecorder
            .getSessionSummaries$()
            .pipe(takeUntilDestroyed())
            .subscribe((sessions: Array<ISessionSummary>): void => {
                this.dataSource.data = sessions;
            });
    }

    deleteSession(sessionId: number): void {
        const sessionDate = new Date(sessionId);
        const dateString =
            sessionDate.getFullYear() +
            "-" +
            (sessionDate.getMonth() + 1) +
            "-" +
            sessionDate.getDate() +
            " " +
            sessionDate.getHours() +
            ":" +
            sessionDate.getMinutes();

        this.confirmSnackBarRef = this.snackBar.openFromComponent(SnackBarConfirmComponent, {
            duration: 10000,
            data: { text: "Are sure you want to delete?", confirm: "Yes" },
        });

        this.confirmSnackBarRef
            .onAction()
            .pipe(
                switchMap(
                    (): Observable<[number, number, number, number]> =>
                        from(this.dataRecorder.deleteSession(sessionId)),
                ),
                finalize((): undefined => (this.confirmSnackBarRef = undefined)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: (): void => {
                    this.snackBar.open(`Session "${dateString}" was deleted`, "Dismiss");
                },
                error: (error: unknown): void => {
                    this.snackBar.open(`An error occurred while deleting session "${dateString}"`, "Dismiss");

                    console.error(error);
                },
            });
    }

    async export(): Promise<void> {
        this.importExportProgress.set(0);
        try {
            await this.dataRecorder.export((progress: ExportProgress): boolean => {
                const status = Math.floor((progress.completedRows / (progress.totalRows ?? 0)) * 100);
                this.importExportProgress.set(status);

                return true;
            });
            this.snackBar
                .open("Export successful", "Dismiss")
                .afterDismissed()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe((): void => {
                    this.importExportProgress.set(undefined);
                });
        } catch (e) {
            if (e instanceof Error) {
                this.snackBar
                    .open(`Export failed: ${e.message}`, "Dismiss", { duration: 10000 })
                    .afterDismissed()
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe((): void => {
                        this.importExportProgress.set(undefined);
                    });
            }
            console.error(e);
        }
    }

    async exportToJson(sessionId: number): Promise<void> {
        try {
            await this.dataRecorder.exportSessionToJson(sessionId);
        } catch (e) {
            if (e instanceof Error) {
                this.snackBar.open(`Error while downloading session: ${e.message}`, "Dismiss");
            }

            console.error(e);
        }
    }

    async exportToTcx(sessionId: number): Promise<void> {
        try {
            await this.dataRecorder.exportSessionToTcx(sessionId);
        } catch (e) {
            if (e instanceof Error) {
                this.snackBar.open(`Error while downloading session: ${e.message}`, "Dismiss");
            }

            console.error(e);
        }
    }

    async import(event: Event): Promise<void> {
        this.importExportProgress.set(0);
        const file = (event.target as HTMLInputElement)?.files?.[0];

        if (!file) {
            return;
        }

        try {
            await this.dataRecorder.import(file, (progress: ImportProgress): boolean => {
                const status = Math.floor((progress.completedRows / (progress.totalRows ?? 0)) * 100);
                this.importExportProgress.set(status);

                return true;
            });
            this.snackBar
                .open("Import successful", "Dismiss")
                .afterDismissed()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe((): void => {
                    this.importExportProgress.set(undefined);
                });
        } catch (e) {
            if (e instanceof Error) {
                this.snackBar
                    .open(`Import failed: ${e.message}`, "Dismiss", {
                        duration: 10000,
                    })
                    .afterDismissed()
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe((): void => {
                        this.importExportProgress.set(undefined);
                    });

                console.error(e);
            }
        }
        (event.target as HTMLInputElement).value = "";
    }

    ngAfterViewInit(): void {
        this.dataSource.sort = this.sort();
        this.dataSource.sortData = (data: Array<ISessionSummary>, sort: MatSort): Array<ISessionSummary> => {
            const active: string = sort.active;
            const direction: SortDirection = sort.direction;
            if (!active || direction === "") {
                return data;
            }

            return data.sort((a: ISessionSummary, b: ISessionSummary): number => {
                const directionAdjustment: number = direction === "asc" ? 1 : -1;
                if (active === "time") {
                    if (a.startTime - a.finishTime > b.startTime - b.finishTime) {
                        return directionAdjustment * 1;
                    }

                    return directionAdjustment * -1;
                }

                const valueA: string | number = this.dataSource.sortingDataAccessor(a, active);
                const valueB: string | number = this.dataSource.sortingDataAccessor(b, active);
                if (valueA > valueB) {
                    return directionAdjustment * 1;
                }

                return directionAdjustment * -1;
            });
        };
    }

    ngOnDestroy(): void {
        this.confirmSnackBarRef?.dismiss();
    }

    trackBySessionId(_: number, session: ISessionSummary | undefined): number {
        return (session?.finishTime ?? 0) - (session?.startTime ?? 0);
    }
}
