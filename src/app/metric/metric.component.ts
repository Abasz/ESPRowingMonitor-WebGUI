import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

@Component({
    selector: "app-metric",
    templateUrl: "./metric.component.html",
    styleUrls: ["./metric.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricComponent {
    @Input() icon: string | undefined;
    @Input() title: string | undefined;
    @Input() unit: string | undefined;
    @Input() value: string | number = "";
}
