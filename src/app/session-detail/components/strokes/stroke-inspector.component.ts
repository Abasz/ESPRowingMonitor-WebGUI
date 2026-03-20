import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";
import { MatCard } from "@angular/material/card";

import { SecondsToTimePipe } from "../../../../common/utils/seconds-to-time.pipe";
import { ISessionStroke } from "../../models/session-analysis.interfaces";

interface IMetricItem {
    label: string;
    value: number;
    format: string;
    unit?: string;
}

const secondsToTimePipe = new SecondsToTimePipe();

@Component({
    selector: "app-stroke-inspector",
    templateUrl: "./stroke-inspector.component.html",
    styleUrls: ["./stroke-inspector.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatCard, SecondsToTimePipe, DecimalPipe],
})
export class StrokeInspectorComponent {
    readonly stroke: InputSignal<ISessionStroke> = input.required<ISessionStroke>();

    readonly pace: Signal<string> = computed((): string => {
        const currentStroke = this.stroke();

        return currentStroke.speed > 0
            ? secondsToTimePipe.transform(500 / currentStroke.speed, "pace")
            : "--";
    });

    readonly metrics: Signal<Array<IMetricItem>> = computed((): Array<IMetricItem> => {
        const currentStroke = this.stroke();

        const metrics: Array<IMetricItem> = [
            { label: "Speed", value: currentStroke.speed * 3.6, format: "1.1-1", unit: "km/h" },
            { label: "Power", value: currentStroke.avgStrokePower, format: "1.0-0", unit: "W" },
            { label: "Stroke Rate", value: currentStroke.strokeRate, format: "1.0-0", unit: "spm" },
            { label: "Dist/Stroke", value: currentStroke.distPerStroke, format: "1.1-1", unit: "m" },
            { label: "Drive Length", value: currentStroke.driveLength, format: "1.2-2", unit: "m" },
            { label: "Drive", value: currentStroke.driveDuration, format: "1.2-2", unit: "s" },
            { label: "Recovery", value: currentStroke.recoveryDuration, format: "1.2-2", unit: "s" },
            { label: "Drag Factor", value: currentStroke.dragFactor, format: "1.0-0" },
        ];

        if (currentStroke.heartRate !== undefined) {
            metrics.push({
                label: "Heart Rate",
                value: currentStroke.heartRate.heartRate,
                format: "1.0-0",
                unit: "bpm",
            });
        }

        return metrics;
    });
}
