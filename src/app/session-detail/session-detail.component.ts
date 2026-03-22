import { DatePipe, DecimalPipe } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    Signal,
    signal,
    viewChild,
    WritableSignal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { MatAutocomplete, MatAutocompleteTrigger } from "@angular/material/autocomplete";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatFormField } from "@angular/material/form-field";
import { MatIcon } from "@angular/material/icon";
import { MatInput } from "@angular/material/input";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatOption } from "@angular/material/select";
import { MatTab, MatTabGroup } from "@angular/material/tabs";
import { MatToolbar } from "@angular/material/toolbar";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { BehaviorSubject, combineLatest, map, startWith } from "rxjs";

import { ISessionSummary } from "../../common/common.interfaces";
import { IExportSession } from "../../common/database.interfaces";
import { DataRecorderService } from "../../common/services/data-recorder.service";
import { SecondsToTimePipe } from "../../common/utils/seconds-to-time.pipe";

import { SessionStrokesComponent } from "./components/strokes/session-strokes.component";
import { SessionSummaryComponent } from "./components/summary/session-summary.component";
import { ISessionAnalysis } from "./models/session-analysis.interfaces";
import { SessionAnalysisService } from "./services/session-analysis.service";

const datePipe: DatePipe = new DatePipe("en-US");

@Component({
    selector: "app-session-detail",
    templateUrl: "./session-detail.component.html",
    styleUrls: ["./session-detail.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        DecimalPipe,
        SecondsToTimePipe,
        ReactiveFormsModule,
        MatProgressSpinner,
        MatTabGroup,
        MatTab,
        MatButton,
        MatIconButton,
        MatIcon,
        MatToolbar,
        MatAutocomplete,
        MatAutocompleteTrigger,
        MatOption,
        MatFormField,
        MatInput,
        SessionSummaryComponent,
        SessionStrokesComponent,
    ],
})
export class SessionDetailComponent implements OnInit {
    readonly analysis: WritableSignal<ISessionAnalysis | undefined> = signal(undefined);
    readonly error: WritableSignal<string | undefined> = signal(undefined);
    readonly loading: WritableSignal<boolean> = signal(true);

    readonly filterControl: FormControl<string> = new FormControl("", { nonNullable: true });
    readonly filteredSessions: Signal<Array<ISessionSummary>>;

    private readonly importedSessions: BehaviorSubject<Array<ISessionSummary>> = new BehaviorSubject<
        Array<ISessionSummary>
    >([]);

    private readonly autocomplete: Signal<MatAutocomplete | undefined> =
        viewChild<MatAutocomplete>("sessionAuto");

    private loadSequence: number = 0;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private destroyRef: DestroyRef,
        private sessionAnalysis: SessionAnalysisService,
        private dataRecorder: DataRecorderService,
    ) {
        this.filteredSessions = toSignal(
            combineLatest([
                this.filterControl.valueChanges.pipe(startWith("")),
                this.dataRecorder.getSessionSummaries$(),
                this.importedSessions,
            ]).pipe(
                map(
                    ([filter, sessions, imported]: [
                        string | number,
                        Array<ISessionSummary>,
                        Array<ISessionSummary>,
                    ]): Array<ISessionSummary> => {
                        const allSessions = [...sessions, ...imported];
                        const lowerFilter = typeof filter === "string" ? filter.toLowerCase() : "";
                        if (lowerFilter.length === 0) {
                            return allSessions;
                        }

                        return allSessions.filter((session: ISessionSummary): boolean => {
                            const dateStr = this.formatSessionDate(session.sessionId).toLowerCase();
                            const device = (session.deviceName ?? "").toLowerCase();

                            return dateStr.includes(lowerFilter) || device.includes(lowerFilter);
                        });
                    },
                ),
                takeUntilDestroyed(),
            ),
            { initialValue: [] },
        );
    }

    ngOnInit(): void {
        this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params: ParamMap): void => {
            const sessionId = Number(params.get("id"));
            if (sessionId === 0 || Number.isNaN(sessionId)) {
                this.error.set("Invalid session ID");
                this.loading.set(false);

                return;
            }

            if (sessionId === this.analysis()?.sessionId) {
                return;
            }

            this.loading.set(true);
            this.error.set(undefined);
            this.analysis.set(undefined);
            void this.loadSession(sessionId);
        });
    }

    goBack(): void {
        void this.router.navigate(["/"]);
    }

    async onSessionSelected(sessionId: number): Promise<void> {
        if (sessionId === this.analysis()?.sessionId) {
            return;
        }
        // defer navigation to a microtask to avoid triggering it during the autocomplete option-selection change-detection cycle.
        await Promise.resolve();
        await this.router.navigate(["/session", sessionId]);
    }

    onAutocompleteClosed(): void {
        const currentSessionId = this.analysis()?.sessionId;
        if (currentSessionId === undefined || this.filterControl.value.length > 0) {
            return;
        }

        this.filterControl.setValue(this.formatSessionDate(currentSessionId), { emitEvent: false });
    }

    selectActiveOption(): void {
        const currentId = this.analysis()?.sessionId;
        if (currentId === undefined) {
            return;
        }

        const activeOption = this.autocomplete()?.options.find(
            (option: MatOption): boolean => option.value === currentId,
        );
        activeOption?.select();
    }

    formatSessionDate(sessionId: number): string {
        return datePipe.transform(sessionId, "yyyy-MM-dd HH:mm") ?? "";
    }

    async onFileSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file === undefined) {
            return;
        }

        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as IExportSession;

            if (!Array.isArray(parsed.records) || parsed.records.length === 0) {
                this.error.set("JSON file contains no session data");
                this.loading.set(false);

                return;
            }

            const exportSession: IExportSession = {
                ...parsed,
                deviceName: parsed.deviceName ?? "Unknown",
            };
            const result = this.sessionAnalysis.loadFromJson(exportSession);

            this.analysis.set(result);
            this.loading.set(false);

            const lastStroke = result.strokes[result.strokes.length - 1];
            const isAlreadyImported = this.importedSessions.value.some(
                (session: ISessionSummary): boolean => session.sessionId === result.sessionId,
            );
            if (!isAlreadyImported) {
                this.importedSessions.next([
                    ...this.importedSessions.value,
                    {
                        sessionId: result.sessionId,
                        deviceName: result.deviceName,
                        startTime: result.strokes[0].timeStamp,
                        finishTime: lastStroke.timeStamp,
                        elapsedTime: lastStroke.elapsedTime,
                        distance: lastStroke.distance,
                        strokeCount: result.strokes.length,
                    },
                ]);
            }
            this.filterControl.setValue(this.formatSessionDate(result.sessionId), { emitEvent: false });
            await this.router.navigate(["/session", result.sessionId], { replaceUrl: true });
        } catch {
            this.error.set("Failed to parse JSON file");
            this.loading.set(false);
        } finally {
            input.value = "";
        }
    }

    private async loadSession(sessionId: number): Promise<void> {
        const currentSequence = ++this.loadSequence;
        try {
            const result = await this.sessionAnalysis.loadSession(sessionId);
            if (currentSequence !== this.loadSequence) {
                return;
            }
            if (result.strokes.length === 0) {
                this.error.set("Session not found or contains no data");

                return;
            }
            this.analysis.set(result);
            this.filterControl.setValue(this.formatSessionDate(sessionId), { emitEvent: false });
        } catch (e) {
            if (currentSequence !== this.loadSequence) {
                return;
            }
            this.error.set(e instanceof Error ? e.message : "Failed to load session");
            console.error(e);
        } finally {
            if (currentSequence === this.loadSequence) {
                this.loading.set(false);
            }
        }
    }
}
