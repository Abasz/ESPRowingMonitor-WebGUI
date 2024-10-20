import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core";
import { MatCard } from "@angular/material/card";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";

@Component({
    selector: "app-metric",
    templateUrl: "./metric.component.html",
    styleUrls: ["./metric.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatCard, MatIcon, MatTooltip],
})
export class MetricComponent {
    readonly icon: InputSignal<string | undefined> = input();
    readonly title: InputSignal<string | undefined> = input();
    readonly unit: InputSignal<string | undefined> = input();
    readonly value: InputSignal<string | number> = input.required<string | number>();
}
