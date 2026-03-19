import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    InputSignal,
    Signal,
    viewChild,
} from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import {
    Chart,
    ChartData,
    ChartOptions,
    ChartType,
    Decimation,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    ScatterController,
    Title,
    Tooltip,
    TooltipItem,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { BaseChartDirective, provideCharts } from "ng2-charts";

import { SecondsToTimePipe } from "../../../../common/utils/seconds-to-time.pipe";
import { deepMerge } from "../../../../common/utils/utility.functions";

const secondsToTimePipe = new SecondsToTimePipe();

const DEFAULT_CHART_OPTIONS: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    elements: {
        line: { borderWidth: 1 },
        point: { radius: 0 },
    },
    scales: {
        x: {
            type: "linear",
            bounds: "data",
            grid: { display: false },
            ticks: {
                callback: (tickValue: string | number): string => {
                    return secondsToTimePipe.transform(Number(tickValue), "pace");
                },
            },
        },
        y: {
            grace: "5%",
            grid: { display: false },
        },
    },
    plugins: {
        legend: { display: false },
        tooltip: { mode: "index", intersect: false },
        zoom: {
            pan: {
                enabled: true,
                mode: "x",
            },
            zoom: {
                wheel: {
                    enabled: true,
                    modifierKey: "ctrl",
                },
                drag: {
                    enabled: true,
                    modifierKey: "ctrl",
                },
                pinch: { enabled: true },
                mode: "x",
                onZoomRejected: ({ chart, event }: { chart: Chart; event: Event }): void => {
                    if (event instanceof WheelEvent) {
                        event.preventDefault();
                        const panDelta = event.deltaX !== 0 ? -event.deltaX : -event.deltaY;
                        chart.pan({ x: panDelta });
                    }
                },
            },
            limits: {
                x: { min: "original", max: "original" },
                y: { min: "original", max: "original" },
            },
        },
    },
};

@Component({
    selector: "app-session-chart",
    template: `
        <div>
            <canvas baseChart [data]="chartData()" [options]="mergedOptions()" [type]="chartType()"></canvas>
            <button mat-icon-button class="reset-zoom-button" (click)="resetZoom()" aria-label="Reset zoom">
                <mat-icon>zoom_out_map</mat-icon>
            </button>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                position: relative;
                height: 100%;
                min-height: 200px;
            }

            div {
                height: 100%;
            }

            canvas {
                touch-action: pan-y !important;
            }

            .reset-zoom-button {
                position: absolute;
                top: 4px;
                right: 4px;
                opacity: 0.6;

                &:hover {
                    opacity: 1;
                }
            }
        `,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BaseChartDirective, MatIconButton, MatIcon],
    providers: [
        provideCharts({
            registerables: [
                LineController,
                ScatterController,
                LineElement,
                PointElement,
                LinearScale,
                Decimation,
                Filler,
                Title,
                Legend,
                Tooltip,
                zoomPlugin,
            ],
        }),
    ],
})
export class SessionChartComponent {
    readonly chartData: InputSignal<ChartData> = input.required<ChartData>();
    readonly chartOptions: InputSignal<ChartOptions | undefined> = input<ChartOptions | undefined>(undefined);
    readonly chartType: InputSignal<ChartType> = input<ChartType>("line");
    readonly tooltipUnit: InputSignal<string> = input<string>("");
    readonly tooltipDecimals: InputSignal<number> = input<number>(1);
    readonly tooltipTitleFormatter: InputSignal<((x: number) => string) | undefined> = input<
        ((x: number) => string) | undefined
    >((x: number): string => secondsToTimePipe.transform(x, "pace"));

    readonly mergedOptions: Signal<ChartOptions> = computed((): ChartOptions => {
        const unit = this.tooltipUnit();
        const decimals = this.tooltipDecimals();
        const titleFormatter = this.tooltipTitleFormatter();

        const titleCallback = titleFormatter
            ? {
                  title: (tooltipItems: Array<TooltipItem<"line">>): string => {
                      if (tooltipItems.length === 0) return "";

                      return titleFormatter(tooltipItems[0].parsed.x as number);
                  },
              }
            : {};

        const tooltipDefaults: Record<string, unknown> = {
            plugins: {
                tooltip: {
                    callbacks: {
                        ...titleCallback,
                        label: (tooltipItem: TooltipItem<"line">): string => {
                            const datasetLabel = tooltipItem.dataset.label ?? "";
                            const formattedValue = (tooltipItem.parsed.y as number).toFixed(decimals);

                            return unit
                                ? `${datasetLabel}: ${formattedValue} ${unit}`
                                : `${datasetLabel}: ${formattedValue}`;
                        },
                    },
                },
            },
        };

        const baseWithTooltip = deepMerge(DEFAULT_CHART_OPTIONS, tooltipDefaults);

        const userOptions = this.chartOptions();
        if (!userOptions) {
            return baseWithTooltip;
        }

        return deepMerge(baseWithTooltip, userOptions);
    });

    private readonly chartDirective: Signal<BaseChartDirective | undefined> = viewChild(BaseChartDirective);

    resetZoom(): void {
        this.chartDirective()?.chart?.resetZoom();
    }

    zoomToRange(min: number, max: number): void {
        const chart = this.chartDirective()?.chart;
        if (chart) {
            chart.zoomScale("x", { min, max }, "default");
        }
    }
}
