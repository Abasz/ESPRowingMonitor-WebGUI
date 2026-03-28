import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    computed,
    Inject,
    OnDestroy,
    Signal,
} from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import { MatProgressBar } from "@angular/material/progress-bar";

import { IMigrationProgress } from "../../../common/common.interfaces";
import { UtilsService } from "../../../common/services/utils.service";
import { SecondsToTimePipe } from "../../../common/utils/seconds-to-time.pipe";

@Component({
    selector: "app-migration-dialog",
    templateUrl: "./migration-dialog.component.html",
    styleUrls: ["./migration-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatProgressBar, MatDialogTitle, MatDialogContent, SecondsToTimePipe],
})
export class MigrationOverlayComponent implements AfterViewInit, OnDestroy {
    readonly progressPercent: Signal<number> = computed((): number => {
        const { processed, total }: IMigrationProgress = this.progress();

        if (total === 0) {
            return 0;
        }

        return Math.min(100, (processed / total) * 100);
    });

    readonly etaSec: Signal<number> = computed((): number => {
        const { processed, total, startedAt }: IMigrationProgress = this.progress();

        if (processed === 0 || startedAt === 0) {
            return 0;
        }

        const elapsedMs = Date.now() - startedAt;
        const ratePerMs = processed / elapsedMs;
        const remainingRecords = total - processed;

        return Math.ceil(remainingRecords / ratePerMs / 1000);
    });

    constructor(
        @Inject(MAT_DIALOG_DATA) readonly progress: Signal<IMigrationProgress>,
        private readonly utils: UtilsService,
    ) {}

    async ngAfterViewInit(): Promise<void> {
        this.utils.enableWakeLock();
    }

    ngOnDestroy(): void {
        this.utils.disableWakeLock();
    }
}
