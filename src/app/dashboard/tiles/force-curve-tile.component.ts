import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    input,
    InputSignal,
    Signal,
    viewChild,
} from "@angular/core";
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

import { ICalculatedMetrics, IDisplayConfig } from "../../../common/common.interfaces";

@Component({
    selector: "app-force-curve-tile",
    template: `
        <mat-card>
            <canvas
                baseChart
                height="100"
                [data]="handleForcesChart()"
                [options]="forceChartOptions()"
                type="line"
            ></canvas>
        </mat-card>
    `,
    styles: [
        `
            :host {
                display: block;
                height: 100%;
            }

            mat-card {
                height: 100%;
            }

            canvas {
                padding: 24px;
            }
        `,
    ],
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
export class ForceCurveTileComponent {
    readonly label: InputSignal<string> = input.required<string>();
    readonly icon: InputSignal<string | undefined> = input<string | undefined>();
    readonly rowingData: InputSignal<ICalculatedMetrics> = input.required<ICalculatedMetrics>();
    readonly displayConfig: InputSignal<IDisplayConfig> = input.required<IDisplayConfig>();

    readonly handleForces: Signal<Array<number>> = computed(
        (): Array<number> => this.rowingData().handleForces,
    );
    readonly showPeakInTitle: Signal<boolean> = computed(
        (): boolean => this.displayConfig().forceCurve.showPeakForceInTitle,
    );
    readonly showGridLines: Signal<boolean> = computed(
        (): boolean => this.displayConfig().forceCurve.showGridLines,
    );
    readonly showAxisLabels: Signal<boolean> = computed(
        (): boolean => this.displayConfig().forceCurve.showAxisLabels,
    );

    readonly forceChartOptions: Signal<ChartOptions<"line">> = computed((): ChartOptions<"line"> => {
        const shouldShowPeakInTitle = this.showPeakInTitle();
        const handleForcesData = this.handleForces();
        const shouldShowGridLines = this.showGridLines();
        const shouldShowAxisLabels = this.showAxisLabels();
        const tileLabel = this.label();

        if (
            this._forceChartOptions.plugins?.legend?.title === undefined ||
            this._forceChartOptions.plugins?.datalabels === undefined ||
            this._forceChartOptions.scales?.y === undefined
        ) {
            return { ...this._forceChartOptions };
        }

        this._forceChartOptions.scales.y.grid = {
            display: shouldShowGridLines,
        };
        this._forceChartOptions.scales.y.border = {
            display: shouldShowAxisLabels || shouldShowGridLines,
        };
        this._forceChartOptions.scales.y.ticks = {
            display: shouldShowAxisLabels,
            color: "rgba(0,0,0)",
        };

        if (handleForcesData.length === 0) {
            this._forceChartOptions.plugins.legend.title.display = true;
            this._forceChartOptions.plugins.legend.title.text = tileLabel;
            this._forceChartOptions.plugins.datalabels.display = false;

            return { ...this._forceChartOptions };
        }

        this._forceChartOptions.plugins.legend.title.display = shouldShowPeakInTitle;
        this._forceChartOptions.plugins.legend.title.text = `Peak: ${Math.round(Math.max(...handleForcesData))}N`;
        this._forceChartOptions.plugins.datalabels.display = shouldShowPeakInTitle
            ? false
            : (ctx: Context): boolean =>
                  Math.max(
                      ...(ctx.dataset.data as Array<Point>).map((point: Point): number => point.y ?? 0),
                  ) === (ctx.dataset.data[ctx.dataIndex] as Point).y;

        return { ...this._forceChartOptions };
    });

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

    private _forceChartOptions: ChartOptions<"line"> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            datalabels: {
                anchor: "center",
                align: "top",
                offset: -2,
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

    private readonly chartDirective: Signal<BaseChartDirective | undefined> = viewChild(BaseChartDirective);

    constructor() {
        effect((): void => {
            this.displayConfig();
            this.chartDirective()?.chart?.resize();
        });
    }
}
