import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core";

import { ICalculatedMetrics } from "../../../common/common.interfaces";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-total-strokes-tile",
    template: `
        <app-metric
            [title]="label()"
            [icon]="icon()"
            unit="stk"
            [value]="rowingData().strokeCount"
        ></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent],
})
export class TotalStrokesTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();
}
