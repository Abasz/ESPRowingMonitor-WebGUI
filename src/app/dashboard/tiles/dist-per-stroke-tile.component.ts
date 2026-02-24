import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";

import { ICalculatedMetrics, IDisplayConfig, UnitSystem } from "../../../common/common.interfaces";
import { MetersToFeetPipe } from "../../../common/utils/meters-to-feet.pipe";
import { MetricComponent } from "../metric/metric.component";

@Component({
    selector: "app-dist-per-stroke-tile",
    template: `
        <app-metric
            [title]="label()"
            [icon]="icon()"
            [value]="
                unitSystem() === 'imperial'
                    ? ((distPerStroke() | metersToFeet | number: '0.0-1') ?? '--')
                    : ((distPerStroke() | number: '0.0-1') ?? '--')
            "
            [unit]="unitSystem() === 'imperial' ? 'ft/stk' : 'm/stk'"
        ></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent, DecimalPipe, MetersToFeetPipe],
})
export class DistPerStrokeTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();
    readonly displayConfig: InputSignal<IDisplayConfig> = input.required<IDisplayConfig>();

    readonly distPerStroke: Signal<number> = computed((): number => this.rowingData().distPerStroke);
    readonly unitSystem: Signal<UnitSystem> = computed(
        (): UnitSystem => this.displayConfig().general.unitSystem,
    );
}
