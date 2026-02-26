import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core";

import { ICalculatedMetrics } from "../../../common/common.interfaces";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-peak-force-tile",
    template: `
        <app-metric [title]="label()" [icon]="icon()" [value]="rowingData().peakForce" unit="N"></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent],
})
export class PeakForceTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();
}
