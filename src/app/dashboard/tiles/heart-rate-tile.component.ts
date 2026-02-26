import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";
import { MatIcon } from "@angular/material/icon";

import { IHeartRate } from "../../../common/common.interfaces";
import { BatteryLevelPipe } from "../../../common/utils/battery-level.pipe";
import { RoundNumberPipe } from "../../../common/utils/round-number.pipe";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-heart-rate-tile",
    template: `
        <app-metric [title]="label()" [icon]="icon()" [value]="displayHeartRate() | roundNumber" unit="bpm">
            @if (heartRateData()?.batteryLevel; as batteryLevel) {
                <mat-icon>{{ batteryLevel | batteryLevel }}</mat-icon>
            }
        </app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent, MatIcon, RoundNumberPipe, BatteryLevelPipe],
    styles: [
        `
            mat-icon {
                width: 1.1em;
                height: 1.1em;
                font-size: 1.1em;
                position: absolute;
                top: 0.3em;
                right: 0.2em;
            }
        `,
    ],
})
export class HeartRateTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly heartRateData: InputSignal<IHeartRate | undefined> = input.required<IHeartRate | undefined>();

    readonly displayHeartRate: Signal<number> = computed((): number => {
        const data = this.heartRateData();

        return data?.contactDetected === true ? (data?.heartRate ?? 0) : 0;
    });
}
