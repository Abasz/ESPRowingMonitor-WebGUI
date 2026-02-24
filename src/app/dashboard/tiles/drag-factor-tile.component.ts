import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core";

import { ICalculatedMetrics } from "../../../common/common.interfaces";
import { RoundNumberPipe } from "../../../common/utils/round-number.pipe";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-drag-factor-tile",
    template: `
        <app-metric
            [title]="label()"
            [icon]="icon()"
            [value]="rowingData().dragFactor | roundNumber"
        ></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent, RoundNumberPipe],
})
export class DragFactorTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();
}
