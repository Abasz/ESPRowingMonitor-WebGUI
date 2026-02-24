import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core";

import { SecondsToTimePipe } from "../../../common/utils/seconds-to-time.pipe";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-timer-tile",
    template: `
        <app-metric
            [title]="label()"
            [icon]="icon()"
            [value]="elapseTime() | secondsToTime: 'pace'"
        ></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent, SecondsToTimePipe],
})
export class TimerTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly elapseTime: InputSignal<number> = input.required<number>();
}
