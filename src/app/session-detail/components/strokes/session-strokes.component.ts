import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    Injector,
    input,
    InputSignal,
    Signal,
    signal,
    viewChild,
    WritableSignal,
} from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatSliderModule } from "@angular/material/slider";
import { MatTooltip } from "@angular/material/tooltip";
import { ChartData, ChartOptions, ChartTypeRegistry, Point, TooltipItem } from "chart.js";
import { Context } from "chartjs-plugin-datalabels";

import { ILap, ISessionStroke } from "../../models/session-analysis.interfaces";
import { SessionChartComponent } from "../shared/session-chart.component";

import { StrokeInspectorComponent } from "./stroke-inspector.component";

const FORCE_CURVE_COLOR = "#11a9ed";
const HIGHLIGHT_COLOR = "#ff6b35";
const PEAK_MARKER_COLOR = "#e53935";

interface IContinuousForceCurveData {
    chartData: ChartData;
    strokeOffsets: Array<number>;
}

const buildSingleStrokeForceCurve = (stroke: ISessionStroke, chartMaxY: number): ChartData => {
    const forcePoints = stroke.handleForces.map(
        (force: number, index: number): Point => ({ x: index, y: force }),
    );

    const peakIndex = Math.round(
        (stroke.peakForcePositionNorm / 100) * Math.max(0, stroke.handleForces.length - 1),
    );

    return {
        datasets: [
            {
                data: forcePoints,
                borderColor: FORCE_CURVE_COLOR,
                fill: false,
                label: "Force",
            },
            {
                data: [
                    { x: peakIndex, y: 0 },
                    { x: peakIndex, y: stroke.peakForce },
                    { x: peakIndex, y: chartMaxY },
                ],
                borderColor: PEAK_MARKER_COLOR,
                borderDash: [4, 4],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                label: "Peak Position",
                datalabels: {
                    display: (ctx: Context): boolean => ctx.dataIndex === 1,
                    anchor: "end",
                    align: -45,
                    offset: 8,
                    formatter: (): string =>
                        `Peak: ${Math.round(stroke.peakForce)}N @ ${Math.round(stroke.peakForcePositionNorm)}%`,
                    color: PEAK_MARKER_COLOR,
                    font: { size: 12, weight: "bold" },
                },
            },
        ],
    };
};

const buildContinuousForceCurveData = (strokes: Array<ISessionStroke>): IContinuousForceCurveData => {
    const points: Array<Point> = [];
    const strokeOffsets: Array<number> = [];
    let xOffset = 0;

    for (const stroke of strokes) {
        strokeOffsets.push(xOffset);
        stroke.handleForces.forEach((force: number, sampleIndex: number): void => {
            points.push({ x: xOffset + sampleIndex, y: force });
        });
        xOffset += stroke.handleForces.length;
    }

    return {
        chartData: {
            datasets: [
                {
                    data: points,
                    borderColor: FORCE_CURVE_COLOR,
                    fill: false,
                    label: "Force",
                    parsing: false,
                },
            ],
        },
        strokeOffsets,
    };
};

const computeMaxForce = (strokes: Array<ISessionStroke>): number =>
    strokes.reduce((max: number, stroke: ISessionStroke): number => Math.max(max, stroke.peakForce), 0);

const VIEWPORT_STROKE_COUNT = 15;

@Component({
    selector: "app-session-strokes",
    templateUrl: "./session-strokes.component.html",
    styleUrls: ["./session-strokes.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatIconButton,
        MatIcon,
        MatSliderModule,
        MatTooltip,
        StrokeInspectorComponent,
        SessionChartComponent,
    ],
})
export class SessionStrokesComponent {
    readonly strokes: InputSignal<Array<ISessionStroke>> = input.required<Array<ISessionStroke>>();
    readonly laps: InputSignal<Array<ILap>> = input<Array<ILap>>([]);

    readonly currentStrokeIndex: WritableSignal<number> = signal(0);

    readonly currentStroke: Signal<ISessionStroke> = computed(
        (): ISessionStroke => this.strokes()[this.currentStrokeIndex()],
    );

    readonly maxIndex: Signal<number> = computed((): number => Math.max(0, this.strokes().length - 1));

    readonly singleStrokeForceCurve: Signal<ChartData> = computed((): ChartData => {
        const maxForce = computeMaxForce(this.strokes());

        return buildSingleStrokeForceCurve(this.currentStroke(), maxForce * 1.05);
    });

    readonly singleStrokeChartOptions: Signal<ChartOptions> = computed((): ChartOptions => {
        const maxForce = computeMaxForce(this.strokes());

        return {
            elements: {
                line: { borderWidth: 4 },
            },
            scales: {
                x: {
                    type: "linear",
                    display: false,
                    ticks: { display: false },
                },
                y: {
                    min: 0,
                    max: maxForce * 1.05,
                },
            },
            plugins: {
                tooltip: {
                    filter: (tooltipItem: TooltipItem<keyof ChartTypeRegistry>): boolean =>
                        tooltipItem.dataset.label !== "Peak Position",
                    callbacks: {
                        title: (): string => "",
                    },
                },
                zoom: {
                    pan: { enabled: false },
                    zoom: { wheel: { enabled: false }, drag: { enabled: false } },
                },
            },
        };
    });

    readonly continuousForceCurve: Signal<IContinuousForceCurveData> = computed(
        (): IContinuousForceCurveData => buildContinuousForceCurveData(this.strokes()),
    );

    readonly continuousChartData: Signal<ChartData> = computed((): ChartData => {
        const forceCurveData = this.continuousForceCurve();
        const strokeIndex = this.currentStrokeIndex();
        const stroke = this.strokes()[strokeIndex];

        if (!stroke) {
            return forceCurveData.chartData;
        }

        const offset = forceCurveData.strokeOffsets[strokeIndex];

        const highlightPoints = stroke.handleForces.map(
            (force: number, index: number): Point => ({
                x: offset + index,
                y: force,
            }),
        );

        return {
            datasets: [
                ...forceCurveData.chartData.datasets,
                {
                    data: highlightPoints,
                    borderColor: HIGHLIGHT_COLOR,
                    borderWidth: 4,
                    fill: false,
                    label: "Current",
                    parsing: false,
                },
            ],
        };
    });

    readonly continuousChartOptions: Signal<ChartOptions> = computed((): ChartOptions => {
        const maxForce = computeMaxForce(this.strokes());

        return {
            elements: {
                line: { borderWidth: 2 },
            },
            scales: {
                x: {
                    type: "linear",
                    display: false,
                    ticks: { display: false },
                },
                y: {
                    min: 0,
                    max: maxForce * 1.1,
                },
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (): string => "",
                    },
                },
                decimation: {
                    enabled: true,
                    algorithm: "lttb",
                    samples: 800,
                    threshold: 3000,
                },
            },
        };
    });

    private readonly continuousChart: Signal<SessionChartComponent | undefined> =
        viewChild<SessionChartComponent>("continuousChart");

    constructor(private injector: Injector) {}

    onPrevious(): void {
        const index = this.currentStrokeIndex();
        if (index <= 0) {
            return;
        }
        this.currentStrokeIndex.set(index - 1);
        this.syncContinuousChartViewport();
    }

    onNext(): void {
        const index = this.currentStrokeIndex();
        if (index >= this.maxIndex()) {
            return;
        }
        this.currentStrokeIndex.set(index + 1);
        this.syncContinuousChartViewport();
    }

    onSliderChange(value: string): void {
        this.currentStrokeIndex.set(Number(value));
        this.syncContinuousChartViewport();
    }

    onLapSelected(lapNumber: number): void {
        const lap = this.laps().find((candidate: ILap): boolean => candidate.lapNumber === lapNumber);
        if (!lap) {
            return;
        }
        this.currentStrokeIndex.set(lap.startIndex);
        this.syncContinuousChartViewport();
    }

    private syncContinuousChartViewport(): void {
        const forceCurveData = this.continuousForceCurve();

        if (forceCurveData.strokeOffsets.length === 0) {
            return;
        }

        const strokeIndex = this.currentStrokeIndex();
        const halfWindow = Math.floor(VIEWPORT_STROKE_COUNT / 2);
        const startStroke = Math.max(0, strokeIndex - halfWindow);
        const endStroke = Math.min(this.strokes().length - 1, strokeIndex + halfWindow);

        const minX = forceCurveData.strokeOffsets[startStroke];
        const endOffset = forceCurveData.strokeOffsets[endStroke];
        const maxX = endOffset + this.strokes()[endStroke].handleForces.length;

        afterNextRender(
            (): void => {
                this.continuousChart()?.zoomToRange(minX, maxX);
            },
            { injector: this.injector },
        );
    }
}
