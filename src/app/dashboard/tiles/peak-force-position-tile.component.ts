import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core";

import { ICalculatedMetrics } from "../../../common/common.interfaces";
import { RoundNumberPipe } from "../../../common/utils/round-number.pipe";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-peak-force-position-tile",
    template: `
        <app-metric
            [title]="label()"
            [icon]="icon()"
            [value]="rowingData().peakForcePositionNorm | roundNumber"
            unit="%"
        ></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent, RoundNumberPipe],
})
export class PeakForcePositionTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();
}
