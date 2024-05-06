import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    Inject,
    OnDestroy,
    ViewChild,
} from "@angular/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { MatSort, SortDirection } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { finalize, from, map, Observable, startWith, switchMap } from "rxjs";

import { ISessionSummary } from "../../common/common.interfaces";
import { DataRecorderService } from "../../common/services/data-recorder.service";
import { SnackBarConfirmComponent } from "../../common/snack-bar-confirm/snack-bar-confirm.component";

@Component({
    selector: "app-logbook-dialog",
    templateUrl: "./logbook-dialog.component.html",
    styleUrls: ["./logbook-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogbookDialogComponent implements AfterViewInit, OnDestroy {
    displayedColumns: Array<string> = [
        "sessionId",
        "time",
        "distance",
        "strokeCount",
        "deviceName",
        "actions",
    ];

    sessionsTableData$: Observable<MatTableDataSource<ISessionSummary>>;
    @ViewChild(MatSort, { static: true }) sort!: MatSort;

    private confirmSnackBarRef: MatSnackBarRef<SnackBarConfirmComponent> | undefined;
    private dataSource: MatTableDataSource<ISessionSummary> = new MatTableDataSource<ISessionSummary>(
        this.sessionSummary,
    );

    constructor(
        private dataRecorder: DataRecorderService,
        private snackBar: MatSnackBar,
        @Inject(MAT_DIALOG_DATA) private sessionSummary: Array<ISessionSummary>,
    ) {
        this.sessionsTableData$ = this.dataRecorder.getSessionSummaries$().pipe(
            map((sessions: Array<ISessionSummary>): MatTableDataSource<ISessionSummary> => {
                this.dataSource.data = sessions;

                return this.dataSource;
            }),
            startWith(this.dataSource),
        );
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
            )
            // eslint-disable-next-line rxjs-angular/prefer-takeuntil
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

    async downloadSession(sessionId: number): Promise<void> {
        try {
            await this.dataRecorder.downloadSession(sessionId);
        } catch (e) {
            if (e instanceof Error) {
                this.snackBar.open(`Error while downloading session: ${e.message}`, "Dismiss");
            }

            console.error(e);
        }
    }

    ngAfterViewInit(): void {
        this.dataSource.sort = this.sort;
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
        return session?.sessionId ?? 0;
    }
}
