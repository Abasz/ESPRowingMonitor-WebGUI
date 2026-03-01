import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";

import { ICalculatedMetrics, IDisplayConfig, UnitSystem } from "../../../common/common.interfaces";
import { MetricComponent } from "../metric/metric.component";

const msToKmh = 3.6;
const msToMph = 2.23694;

@Component({
    selector: "app-speed-tile",
    template: `
        <app-metric
            [title]="label()"
            [icon]="icon()"
            [value]="(speed() | number: '0.2-2') ?? '--'"
            [unit]="unitSystem() === 'imperial' ? 'mph' : 'km/h'"
        ></app-metric>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MetricComponent, DecimalPipe],
})
export class SpeedTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();
    readonly displayConfig: InputSignal<IDisplayConfig> = input.required<IDisplayConfig>();

    readonly unitSystem: Signal<UnitSystem> = computed(
        (): UnitSystem => this.displayConfig().general.unitSystem,
    );

    readonly speed: Signal<number> = computed((): number => {
        const speedMs = this.rowingData().speed;
        const unitSystem = this.unitSystem();

        return unitSystem === "imperial" ? speedMs * msToMph : speedMs * msToKmh;
    });
}
