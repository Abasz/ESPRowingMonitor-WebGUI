import { ChangeDetectionStrategy, Component, computed, input, InputSignal, Signal } from "@angular/core";
import { MatCard } from "@angular/material/card";
import {
    CategoryScale,
    ChartConfiguration,
    ChartOptions,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    Point,
    PointElement,
    Title,
} from "chart.js";
import ChartDataLabels, { Context } from "chartjs-plugin-datalabels";
import { BaseChartDirective, provideCharts } from "ng2-charts";

@Component({
    selector: "app-force-curve",
    templateUrl: "./force-curve.component.html",
    styleUrls: ["./force-curve.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatCard, BaseChartDirective],
    providers: [
        provideCharts({
            registerables: [
                LineController,
                LineElement,
                PointElement,
                LinearScale,
                CategoryScale,
                Filler,
                Title,
                Legend,
                ChartDataLabels,
            ],
        }),
    ],
})
export class ForceCurveComponent {
    readonly forceChartOptions: ChartOptions<"line"> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            datalabels: {
                anchor: "center",
                align: "top",
                formatter: (value: Point): string => `Peak: ${Math.round(value.y ?? 0)}`,
                display: (ctx: Context): boolean =>
                    Math.max(
                        ...(ctx.dataset.data as Array<Point>).map((point: Point): number => point.y ?? 0),
                    ) === (ctx.dataset.data[ctx.dataIndex] as Point).y,

                font: {
                    size: 16,
                },
                color: "rgb(0,0,0)",
            },
            legend: {
                title: {
                    display: true,
                    text: "Force Curve",
                    color: "rgb(0,0,0)",
                    font: {
                        size: 32,
                    },
                    padding: {},
                },
                labels: {
                    boxWidth: 0,
                    font: {
                        size: 0,
                    },
                },
            },
        },
        scales: {
            x: {
                type: "linear",
                display: false,
                ticks: { stepSize: 1 },
            },
            y: {
                ticks: { color: "rgba(0,0,0)" },
            },
        },
        animations: {
            tension: {
                duration: 200,
                easing: "linear",
            },
            y: {
                duration: 200,
                easing: "linear",
            },
            x: {
                duration: 200,
                easing: "linear",
            },
        },
    };

    readonly handleForces: InputSignal<Array<number>> = input.required<Array<number>>();
    readonly handleForcesChart: Signal<ChartConfiguration<"line">["data"]> = computed(
        (): ChartConfiguration<"line">["data"] => {
            this._handleForcesChart.datasets[0].data = this.handleForces().map(
                (currentForce: number, index: number): Point => ({
                    y: currentForce,
                    x: index,
                }),
            );

            return { ...this._handleForcesChart };
        },
    );

    private _handleForcesChart: ChartConfiguration<"line">["data"] = {
        datasets: [
            {
                fill: true,
                label: "",
                data: [],
                borderColor: "rgb(31,119,180)",
                backgroundColor: "rgb(31,119,180,0.5)",
                pointRadius: 0,
            },
        ],
    };
}
