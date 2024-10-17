import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core";

@Component({
    selector: "app-metric",
    templateUrl: "./metric.component.html",
    styleUrls: ["./metric.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricComponent {
    readonly icon: InputSignal<string | undefined> = input();
    readonly title: InputSignal<string | undefined> = input();
    readonly unit: InputSignal<string | undefined> = input();
    readonly value: InputSignal<string | number> = input.required<string | number>();
}
