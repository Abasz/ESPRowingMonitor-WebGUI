import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core";

import { ICalculatedMetrics } from "../../../common/common.interfaces";
import { RoundNumberPipe } from "../../../common/utils/round-number.pipe";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-drive-length-tile",
    template: `
        <app-metric
            [title]="label()"
            [icon]="icon()"
            [value]="rowingData().driveLength | roundNumber: 2"
            unit="m"
        ></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent, RoundNumberPipe],
})
export class DriveLengthTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();
}
