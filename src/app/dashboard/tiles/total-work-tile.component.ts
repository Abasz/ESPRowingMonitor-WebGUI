import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";

import { ICalculatedMetrics } from "../../../common/common.interfaces";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-total-work-tile",
    template: `
        <app-metric
            [title]="label()"
            [icon]="icon()"
            [value]="(totalWorkKj() | number: '0.0-1') ?? '--'"
            unit="kJ"
        ></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent, DecimalPipe],
})
export class TotalWorkTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();

    readonly totalWorkKj: Signal<number> = computed((): number => this.rowingData().totalWork / 1000);
}
