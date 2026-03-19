import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, signal, WritableSignal } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatTab, MatTabGroup } from "@angular/material/tabs";
import { ActivatedRoute, Router } from "@angular/router";

import { ISessionAnalysis } from "./models/session-analysis.interfaces";
import { SessionAnalysisService } from "./services/session-analysis.service";

@Component({
    selector: "app-session-detail",
    templateUrl: "./session-detail.component.html",
    styleUrls: ["./session-detail.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatProgressSpinner, MatTabGroup, MatTab, MatButton, DatePipe],
})
export class SessionDetailComponent implements OnInit {
    readonly analysis: WritableSignal<ISessionAnalysis | undefined> = signal(undefined);
    readonly error: WritableSignal<string | undefined> = signal(undefined);
    readonly loading: WritableSignal<boolean> = signal(true);

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private sessionAnalysis: SessionAnalysisService,
    ) {}

    ngOnInit(): void {
        const sessionId = Number(this.route.snapshot.paramMap.get("id"));
        if (sessionId === 0 || Number.isNaN(sessionId)) {
            this.error.set("Invalid session ID");
            this.loading.set(false);

            return;
        }

        void this.loadSession(sessionId);
    }

    goBack(): void {
        void this.router.navigate(["/"]);
    }

    private async loadSession(sessionId: number): Promise<void> {
        try {
            const result = await this.sessionAnalysis.loadSession(sessionId);
            if (result.strokes.length === 0) {
                this.error.set("Session not found or contains no data");

                return;
            }
            this.analysis.set(result);
        } catch (e) {
            this.error.set(e instanceof Error ? e.message : "Failed to load session");
            console.error(e);
        } finally {
            this.loading.set(false);
        }
    }
}
