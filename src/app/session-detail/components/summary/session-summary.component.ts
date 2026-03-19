import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";
import { MatCard } from "@angular/material/card";

import { SecondsToTimePipe } from "../../../../common/utils/seconds-to-time.pipe";
import { ISessionAnalysis, ISessionStatistics } from "../../models/session-analysis.interfaces";

interface IMetricItem {
    label: string;
    value: number;
    format: string;
    unit?: string;
}

const secondsToTimePipe = new SecondsToTimePipe();

@Component({
    selector: "app-session-summary",
    templateUrl: "./session-summary.component.html",
    styleUrls: ["./session-summary.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatCard, SecondsToTimePipe, DecimalPipe],
})
export class SessionSummaryComponent {
    readonly analysis: InputSignal<ISessionAnalysis> = input.required<ISessionAnalysis>();

    readonly stats: Signal<ISessionStatistics> = computed(
        (): ISessionStatistics => this.analysis().statistics,
    );

    readonly maxMetrics: Signal<Array<IMetricItem>> = computed((): Array<IMetricItem> => {
        const { max }: ISessionStatistics = this.stats();

        return [
            { label: "Speed", value: max.speed * 3.6, format: "1.1-1", unit: "km/h" },
            { label: "Power", value: max.strokePower, format: "1.0-0", unit: "W" },
            { label: "Stroke Rate", value: max.strokeRate, format: "1.0-0", unit: "spm" },
            { label: "Peak Force", value: max.peakForce, format: "1.0-0", unit: "N" },
            { label: "Dist/Stroke", value: max.distPerStroke, format: "1.1-1", unit: "m" },
            { label: "Drive Length", value: max.driveLength, format: "1.2-2", unit: "m" },
            { label: "Drive", value: max.driveDuration, format: "1.2-2", unit: "s" },
            { label: "Recovery", value: max.recoveryDuration, format: "1.2-2", unit: "s" },
        ];
    });

    readonly avgMetrics: Signal<Array<IMetricItem>> = computed((): Array<IMetricItem> => {
        const { avg }: ISessionStatistics = this.stats();
        const metrics: Array<IMetricItem> = [
            { label: "Speed", value: avg.speed * 3.6, format: "1.1-1", unit: "km/h" },
            { label: "Power", value: avg.strokePower, format: "1.0-0", unit: "W" },
            { label: "Stroke Rate", value: avg.strokeRate, format: "1.0-0", unit: "spm" },
            { label: "Dist/Stroke", value: avg.distPerStroke, format: "1.1-1", unit: "m" },
            { label: "Drive Length", value: avg.driveLength, format: "1.2-2", unit: "m" },
            { label: "Drive", value: avg.driveDuration, format: "1.2-2", unit: "s" },
            { label: "Recovery", value: avg.recoveryDuration, format: "1.2-2", unit: "s" },
            { label: "Drag Factor", value: avg.dragFactor, format: "1.0-0" },
        ];

        if (avg.heartRate !== undefined) {
            metrics.push({ label: "Heart Rate", value: avg.heartRate, format: "1.0-0", unit: "bpm" });
        }

        return metrics;
    });

    readonly maxPace: Signal<string> = computed((): string => {
        const { max }: ISessionStatistics = this.stats();

        return max.speed > 0 ? secondsToTimePipe.transform(500 / max.speed, "pace") : "--";
    });

    readonly avgPace: Signal<string> = computed((): string => {
        const { avg }: ISessionStatistics = this.stats();

        return avg.speed > 0 ? secondsToTimePipe.transform(500 / avg.speed, "pace") : "--";
    });
}
