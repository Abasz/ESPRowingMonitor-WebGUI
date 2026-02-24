import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core";

import { ICalculatedMetrics } from "../../../common/common.interfaces";
import { SecondsToTimePipe } from "../../../common/utils/seconds-to-time.pipe";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-pace-tile",
    template: `
        <app-metric
            [title]="label()"
            [icon]="icon()"
            [value]="500 / rowingData().speed | secondsToTime: 'pace'"
            unit="/500m"
        ></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent, SecondsToTimePipe],
})
export class PaceTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();
}
