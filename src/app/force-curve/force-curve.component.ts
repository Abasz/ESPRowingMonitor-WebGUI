import { ChangeDetectionStrategy, Component, effect, input, InputSignal } from "@angular/core";
import { ChartConfiguration, ChartOptions, Point } from "chart.js";
import { Context } from "chartjs-plugin-datalabels";

@Component({
    selector: "app-force-curve",
    templateUrl: "./force-curve.component.html",
    styleUrls: ["./force-curve.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForceCurveComponent {
    readonly handleForces: InputSignal<Array<number>> = input.required<Array<number>>();

    get forceChartOptions(): ChartOptions<"line"> {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: {
                    anchor: "center",
                    align: "top",
                    formatter: (value: Point): string => `Peak: ${Math.round(value.y)}`,
                    display: (ctx: Context): boolean =>
                        Math.max(
                            ...(ctx.dataset.data as Array<Point>).map((point: Point): number => point.y),
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
    }

    get handleForcesChart(): ChartConfiguration<"line">["data"] | undefined {
        return this._handleForcesChart;
    }

    private _handleForcesChart: ChartConfiguration<"line">["data"] = {
        datasets: [
            {
                fill: true,
                label: "Force Curve",
                data: [],
                borderColor: "rgb(31,119,180)",
                backgroundColor: "rgb(31,119,180,0.5)",
                pointRadius: 0,
            },
        ],
    };

    constructor() {
        effect((): void => {
            this._handleForcesChart.datasets[0].data = this.handleForces().map(
                (currentForce: number, index: number): Point => ({
                    y: currentForce,
                    x: index,
                }),
            );
        });
    }
}
