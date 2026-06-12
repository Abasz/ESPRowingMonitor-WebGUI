import { DecimalPipe } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    InputSignal,
    linkedSignal,
    Signal,
    viewChildren,
    WritableSignal,
} from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MatCard } from "@angular/material/card";
import { ChartData, ChartOptions, Point } from "chart.js";

import { SecondsToTimePipe } from "../../../../common/utils/seconds-to-time.pipe";
import { isKayakErgometer } from "../../../../common/utils/utility.functions";
import {
    ILap,
    ISessionAnalysis,
    ISessionRecord,
    ISessionStatistics,
    ISessionStroke,
} from "../../models/session-analysis.interfaces";
import { SessionChartComponent } from "../shared/session-chart.component";

import { LapTableComponent } from "./lap-table.component";

interface IMetricItem {
    label: string;
    value: number;
    format: string;
    unit?: string;
}

interface IChartConfig {
    title: string;
    color: string;
    unit: string;
    decimals: number;
    data: ChartData;
    options?: ChartOptions;
}

interface IAverageDataset {
    data: Array<Point>;
    borderColor: string;
    borderDash: Array<number>;
    label: string;
}

const CHART_COLORS = {
    speed: "#11a9ed",
    power: "#cf23b8",
    strokeRate: "#ed7e00",
    heartRate: "#ff0035",
    distPerStroke: "#7cb5ec",
    driveLength: "#2dc937",
    peakForcePositionNorm: "#f5a623",
    drive: "#11a9ed",
    recovery: "#ed7e00",
    average: "#888888",
};

// 15% opacity in hex
const FILL_OPACITY = "26";

const buildPoints = <T extends ISessionRecord>(
    strokes: Array<T>,
    valueAccessor: (stroke: T) => number,
): Array<Point> =>
    strokes.map(
        (stroke: T): Point => ({
            x: stroke.elapsedTime,
            y: valueAccessor(stroke),
        }),
    );

const createAverageDataset = (strokes: Array<ISessionRecord>, averageValue: number): IAverageDataset => ({
    data:
        strokes.length > 0
            ? [
                  { x: strokes[0].elapsedTime, y: averageValue },
                  { x: strokes[strokes.length - 1].elapsedTime, y: averageValue },
              ]
            : [],
    borderColor: CHART_COLORS.average,
    borderDash: [6, 3],
    label: "Average",
});

const computeYMin = (...pointArrays: Array<Array<Point>>): number => {
    const yValues = pointArrays.flat().map((point: Point): number => point.y as number);

    if (yValues.length === 0) {
        return 0;
    }

    const yMin = yValues.reduce((min: number, y: number): number => (y < min ? y : min), Infinity);
    const yMax = yValues.reduce((max: number, y: number): number => (y > max ? y : max), -Infinity);
    const range = yMax - yMin || 1;

    return Math.max(0, yMin - range * 0.05);
};

const createYScale = (
    yAxisTitle: string,
    ...pointArrays: Array<Array<Point>>
): { title: { display: boolean; text: string }; min: number } => ({
    title: { display: true, text: yAxisTitle },
    min: computeYMin(...pointArrays),
});

const secondsToTimePipe = new SecondsToTimePipe();

const buildSpeedChartConfig = (strokes: Array<ISessionRecord>, stats: ISessionStatistics): IChartConfig => {
    const speedPoints = buildPoints(strokes, (stroke: ISessionRecord): number => stroke.speed * 3.6);
    const speedAvg = createAverageDataset(strokes, stats.avg.speed * 3.6);

    return {
        title: "Speed",
        color: CHART_COLORS.speed,
        unit: "km/h",
        decimals: 1,
        data: {
            datasets: [
                {
                    data: speedPoints,
                    borderColor: CHART_COLORS.speed,
                    backgroundColor: CHART_COLORS.speed + FILL_OPACITY,
                    fill: true,
                    label: "Speed",
                },
                speedAvg,
            ],
        },
        options: { scales: { y: createYScale("km/h", speedPoints, speedAvg.data) } },
    };
};

const buildPowerChartConfig = (strokes: Array<ISessionRecord>, stats: ISessionStatistics): IChartConfig => {
    const powerPoints = buildPoints(strokes, (stroke: ISessionRecord): number => stroke.avgStrokePower);
    const powerAvg = createAverageDataset(strokes, stats.avg.strokePower);

    return {
        title: "Stroke Power",
        color: CHART_COLORS.power,
        unit: "W",
        decimals: 0,
        data: {
            datasets: [
                {
                    data: powerPoints,
                    borderColor: CHART_COLORS.power,
                    backgroundColor: CHART_COLORS.power + FILL_OPACITY,
                    fill: true,
                    label: "Power",
                },
                powerAvg,
            ],
        },
        options: { scales: { y: createYScale("W", powerPoints, powerAvg.data) } },
    };
};

const buildStrokeRateChartConfig = (
    strokes: Array<ISessionRecord>,
    stats: ISessionStatistics,
): IChartConfig => {
    const strokeRatePoints = buildPoints(strokes, (stroke: ISessionRecord): number => stroke.strokeRate);
    const strokeRateAvg = createAverageDataset(strokes, stats.avg.strokeRate);

    return {
        title: "Stroke Rate",
        color: CHART_COLORS.strokeRate,
        unit: "spm",
        decimals: 0,
        data: {
            datasets: [
                {
                    data: strokeRatePoints,
                    borderColor: CHART_COLORS.strokeRate,
                    label: "Stroke Rate",
                },
                strokeRateAvg,
            ],
        },
        options: { scales: { y: createYScale("spm", strokeRatePoints, strokeRateAvg.data) } },
    };
};

const buildHeartRateChartConfig = (
    strokes: Array<ISessionRecord>,
    averageHeartRate: number,
): IChartConfig => {
    const hrPoints = strokes.map((stroke: ISessionRecord): { x: number; y: number } => ({
        x: stroke.elapsedTime,
        // as per docs NaN values create visual gaps instead of false zero-spikes at sensor dropouts
        y: stroke.heartRate?.heartRate ?? NaN,
    }));
    const hrNonNaNPoints: Array<Point> = hrPoints.filter(
        (point: { x: number; y: number }): boolean => !Number.isNaN(point.y),
    ) as Array<Point>;
    const hrAvg = createAverageDataset(strokes, averageHeartRate);

    return {
        title: "Heart Rate",
        color: CHART_COLORS.heartRate,
        unit: "bpm",
        decimals: 0,
        data: {
            datasets: [
                {
                    data: hrPoints,
                    borderColor: CHART_COLORS.heartRate,
                    label: "Heart Rate",
                },
                hrAvg,
            ],
        },
        options: { scales: { y: createYScale("bpm", hrNonNaNPoints, hrAvg.data) } },
    };
};

const buildDistPerStrokeChartConfig = (strokes: Array<ISessionRecord>): IChartConfig => {
    const distPerStrokePoints = buildPoints(
        strokes,
        (stroke: ISessionRecord): number => stroke.distPerStroke,
    ).filter((point: Point): boolean => point.y !== 0);

    return {
        title: "Dist/Stroke",
        color: CHART_COLORS.distPerStroke,
        unit: "m",
        decimals: 1,
        data: {
            datasets: [
                {
                    data: distPerStrokePoints,
                    borderColor: CHART_COLORS.distPerStroke,
                    showLine: false,
                    label: "Dist/Stroke",
                },
            ],
        },
        options: {
            elements: { point: { radius: 1, borderWidth: 2 } },
            scales: { y: createYScale("m", distPerStrokePoints) },
        },
    };
};

const buildDriveLengthChartConfig = (
    records: Array<ISessionRecord>,
    strokes: Array<ISessionStroke>,
): IChartConfig => {
    const driveLengthMap = new Map<number, number>(
        strokes.map((stroke: ISessionStroke): [number, number] => [stroke.strokeIndex, stroke.driveLength]),
    );

    const driveLengthPoints = records.map((record: ISessionRecord): { x: number; y: number } => ({
        x: record.elapsedTime,
        y: driveLengthMap.get(record.strokeIndex) ?? NaN,
    }));

    return {
        title: "Drive Length",
        color: CHART_COLORS.driveLength,
        unit: "m",
        decimals: 2,
        data: {
            datasets: [
                {
                    data: driveLengthPoints,
                    borderColor: CHART_COLORS.driveLength,
                    label: "Drive Length",
                },
            ],
        },
        options: {
            scales: {
                y: {
                    title: { display: true, text: "m" },
                    min: 0.5,
                    max: 2.1,
                },
            },
        },
    };
};

const buildDriveRecoveryChartConfig = (strokes: Array<ISessionRecord>): IChartConfig => {
    const drivePoints = buildPoints(strokes, (stroke: ISessionRecord): number => stroke.driveDuration);
    const recoveryPoints = buildPoints(strokes, (stroke: ISessionRecord): number => stroke.recoveryDuration);

    return {
        title: "Drive / Recovery",
        color: CHART_COLORS.drive,
        unit: "s",
        decimals: 2,
        data: {
            datasets: [
                { data: drivePoints, borderColor: CHART_COLORS.drive, label: "Drive" },
                { data: recoveryPoints, borderColor: CHART_COLORS.recovery, label: "Recovery" },
            ],
        },
        options: {
            scales: {
                y: {
                    title: { display: true, text: "s" },
                    min: 0.1,
                    max: 0.6,
                },
            },
            plugins: { legend: { display: true } },
        },
    };
};

const buildPeakForcePositionChartConfig = (
    strokes: Array<ISessionStroke>,
    stats: ISessionStatistics,
): IChartConfig => {
    const positionPoints = buildPoints(
        strokes,
        (stroke: ISessionStroke): number => stroke.peakForcePositionNorm,
    );
    const positionAvg = createAverageDataset(strokes, stats.avg.peakForcePositionNorm);

    return {
        title: "Peak Force Position",
        color: CHART_COLORS.peakForcePositionNorm,
        unit: "%",
        decimals: 0,
        data: {
            datasets: [
                {
                    data: positionPoints,
                    borderColor: CHART_COLORS.peakForcePositionNorm,
                    showLine: false,
                    label: "Peak Position",
                },
                positionAvg,
            ],
        },
        options: {
            elements: { point: { radius: 1, borderWidth: 2 } },
            scales: {
                y: {
                    title: { display: true, text: "%" },
                    min: 0,
                    max: 100,
                },
            },
        },
    };
};

@Component({
    selector: "app-session-summary",
    templateUrl: "./session-summary.component.html",
    styleUrls: ["./session-summary.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatCard, MatButton, SecondsToTimePipe, DecimalPipe, SessionChartComponent, LapTableComponent],
})
export class SessionSummaryComponent {
    readonly analysis: InputSignal<ISessionAnalysis> = input.required<ISessionAnalysis>();

    readonly stats: Signal<ISessionStatistics> = computed(
        (): ISessionStatistics => this.analysis().statistics,
    );

    readonly isKayakSession: Signal<boolean> = computed((): boolean =>
        isKayakErgometer(this.analysis().deviceName),
    );

    readonly balanceDisplay: Signal<{ sideA: number; sideB: number; consistency: string } | undefined> =
        computed((): { sideA: number; sideB: number; consistency: string } | undefined => {
            if (!this.isKayakSession()) {
                return undefined;
            }

            const {
                powerBalance,
                powerBalanceConsistency,
            }: { powerBalance?: number; powerBalanceConsistency?: number } = this.analysis();

            if (powerBalance === undefined) {
                return undefined;
            }

            const sideA = Math.round(powerBalance * 100);

            return {
                sideA,
                sideB: 100 - sideA,
                consistency:
                    powerBalanceConsistency !== undefined
                        ? `±${(powerBalanceConsistency * 100).toFixed(1)}%`
                        : "",
            };
        });

    readonly selectedLap: WritableSignal<ILap | undefined> = linkedSignal<ISessionAnalysis, ILap | undefined>(
        {
            source: this.analysis,
            computation: (): ILap | undefined => undefined,
        },
    );

    readonly maxMetrics: Signal<Array<IMetricItem>> = computed((): Array<IMetricItem> => {
        const { max }: ISessionStatistics = this.stats();

        return [
            { label: "Speed", value: max.speed * 3.6, format: "1.1-1", unit: "km/h" },
            { label: "Power", value: max.strokePower, format: "1.0-0", unit: "W" },
            { label: "Stroke Rate", value: max.strokeRate, format: "1.0-0", unit: "spm" },
            { label: "Peak Force", value: max.peakForce, format: "1.0-0", unit: "N" },
            { label: "Dist/Stroke", value: max.distPerStroke, format: "1.1-1", unit: "m" },
            { label: "Drive Length", value: max.driveLength, format: "1.2-2", unit: "m" },
            { label: "Drive", value: max.driveDuration, format: "1.2-2", unit: "s" },
            { label: "Recovery", value: max.recoveryDuration, format: "1.2-2", unit: "s" },
        ];
    });

    readonly avgMetrics: Signal<Array<IMetricItem>> = computed((): Array<IMetricItem> => {
        const { avg }: ISessionStatistics = this.stats();
        const metrics: Array<IMetricItem> = [
            { label: "Speed", value: avg.speed * 3.6, format: "1.1-1", unit: "km/h" },
            { label: "Power", value: avg.strokePower, format: "1.0-0", unit: "W" },
            { label: "Stroke Rate", value: avg.strokeRate, format: "1.0-0", unit: "spm" },
            { label: "Peak Position", value: avg.peakForcePositionNorm, format: "1.0-0", unit: "%" },
            { label: "Dist/Stroke", value: avg.distPerStroke, format: "1.1-1", unit: "m" },
            { label: "Drive Length", value: avg.driveLength, format: "1.2-2", unit: "m" },
            { label: "Drive", value: avg.driveDuration, format: "1.2-2", unit: "s" },
            { label: "Recovery", value: avg.recoveryDuration, format: "1.2-2", unit: "s" },
            { label: "Drag Factor", value: avg.dragFactor, format: "1.0-0" },
        ];

        if (avg.heartRate !== undefined) {
            metrics.push({ label: "Heart Rate", value: avg.heartRate, format: "1.0-0", unit: "bpm" });
        }

        return metrics;
    });

    readonly maxPace: Signal<string> = computed((): string => {
        const { max }: ISessionStatistics = this.stats();

        return max.speed > 0 ? secondsToTimePipe.transform(500 / max.speed, "pace") : "--";
    });

    readonly avgPace: Signal<string> = computed((): string => {
        const { avg }: ISessionStatistics = this.stats();

        return avg.speed > 0 ? secondsToTimePipe.transform(500 / avg.speed, "pace") : "--";
    });

    readonly charts: Signal<Array<IChartConfig>> = computed((): Array<IChartConfig> => {
        const records = this.analysis().records;
        const strokes = this.analysis().strokes;
        const stats = this.stats();
        const configs: Array<IChartConfig> = [
            buildSpeedChartConfig(records, stats),
            buildPowerChartConfig(records, stats),
            buildStrokeRateChartConfig(records, stats),
        ];

        if (this.hasHeartRate()) {
            configs.push(buildHeartRateChartConfig(records, stats.avg.heartRate as number));
        }

        configs.push(
            buildDistPerStrokeChartConfig(records),
            buildDriveLengthChartConfig(records, strokes),
            buildPeakForcePositionChartConfig(strokes, stats),
            buildDriveRecoveryChartConfig(records),
        );

        return configs;
    });

    private readonly hasHeartRate: Signal<boolean> = computed(
        (): boolean => this.stats().avg.heartRate !== undefined,
    );

    private readonly chartComponents: Signal<ReadonlyArray<SessionChartComponent>> =
        viewChildren(SessionChartComponent);

    onLapSelected(lap: ILap): void {
        this.selectedLap.set(lap);
        for (const chart of this.chartComponents()) {
            chart.zoomToRange(lap.startTime, lap.endTime);
        }
    }

    onShowFullSession(): void {
        this.selectedLap.set(undefined);
        for (const chart of this.chartComponents()) {
            chart.resetZoom();
        }
    }
}
