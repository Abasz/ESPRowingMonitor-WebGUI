import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatCard } from "@angular/material/card";
import { MatCardHarness } from "@angular/material/card/testing";
import {
    CategoryScale,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    Point,
    PointElement,
    Title,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { BaseChartDirective, provideCharts } from "ng2-charts";
import { beforeEach, describe, expect, it } from "vitest";

import { ForceCurveComponent } from "./force-curve.component";

describe("ForceCurveComponent", (): void => {
    let component: ForceCurveComponent;
    let fixture: ComponentFixture<ForceCurveComponent>;
    let loader: HarnessLoader;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
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
            imports: [MatCard, BaseChartDirective, ForceCurveComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ForceCurveComponent);
        component = fixture.componentInstance;
        loader = TestbedHarnessEnvironment.loader(fixture);

        fixture.componentRef.setInput("handleForces", []);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize handleForces input signal", (): void => {
            expect(component.handleForces).toBeDefined();
            expect(typeof component.handleForces).toBe("function");
        });

        it("should initialize showPeakInTitle input signal with default value true", (): void => {
            expect(component.showPeakInTitle).toBeDefined();
            expect(typeof component.showPeakInTitle).toBe("function");
            expect(component.showPeakInTitle()).toBe(true);
        });

        it("should initialize showGridLines input signal with default value true", (): void => {
            expect(component.showGridLines).toBeDefined();
            expect(typeof component.showGridLines).toBe("function");
            expect(component.showGridLines()).toBe(true);
        });

        it("should initialize showAxisLabels input signal with default value true", (): void => {
            expect(component.showAxisLabels).toBeDefined();
            expect(typeof component.showAxisLabels).toBe("function");
            expect(component.showAxisLabels()).toBe(true);
        });

        it("should configure chart as responsive with animations", (): void => {
            expect(component.forceChartOptions().responsive).toBe(true);
            expect(component.forceChartOptions().maintainAspectRatio).toBe(false);

            const tensionAnim = component.forceChartOptions().animations?.tension as {
                duration: number;
                easing: string;
            };
            expect(tensionAnim?.duration).toBe(200);
            expect(tensionAnim?.easing).toBe("linear");
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render canvas with chart data bound", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15, 25, 5]);
            await fixture.whenStable();

            const canvas = fixture.nativeElement.querySelector("canvas[baseChart]");
            expect(canvas).toBeTruthy();

            const cardHarness = await loader.getHarness(MatCardHarness);
            expect(cardHarness).toBeTruthy();
        });
    });

    describe("handleForces input signal", (): void => {
        it("should accept and store force data array", async (): Promise<void> => {
            const testForces = [10, 20, 30];
            fixture.componentRef.setInput("handleForces", testForces);
            await fixture.whenStable();

            expect(component.handleForces()).toEqual(testForces);
        });

        it("should handle empty array", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", []);
            await fixture.whenStable();

            expect(component.handleForces()).toEqual([]);
        });
    });

    describe("showPeakInTitle input signal behavior", (): void => {
        it("should show Force Curve title when no data", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", []);
            fixture.componentRef.setInput("showPeakInTitle", true);
            await fixture.whenStable();

            expect(component.forceChartOptions().plugins?.legend?.title?.display).toBe(true);
            expect(component.forceChartOptions().plugins?.legend?.title?.text).toBe("Force Curve");
            expect(component.forceChartOptions().plugins?.datalabels?.display).toBe(false);
        });

        it("should show peak value in title when showPeakInTitle is true with data", async (): Promise<void> => {
            fixture.componentRef.setInput("showPeakInTitle", true);
            fixture.componentRef.setInput("handleForces", [10, 20, 15, 25, 5]);
            await fixture.whenStable();

            expect(component.forceChartOptions().plugins?.legend?.title?.display).toBe(true);
            expect(component.forceChartOptions().plugins?.legend?.title?.text).toBe("Peak: 25N");
            expect(component.forceChartOptions().plugins?.datalabels?.display).toBe(false);
        });

        it("should hide legend title and show datalabel when showPeakInTitle is false with data", async (): Promise<void> => {
            fixture.componentRef.setInput("showPeakInTitle", false);
            fixture.componentRef.setInput("handleForces", [10, 20, 15, 25, 5]);
            await fixture.whenStable();

            expect(component.forceChartOptions().plugins?.legend?.title?.display).toBe(false);

            const display = component.forceChartOptions().plugins?.datalabels?.display;
            expect(typeof display).toBe("function");
        });

        it("should always show Force Curve title when no data regardless of showPeakInTitle", async (): Promise<void> => {
            fixture.componentRef.setInput("showPeakInTitle", false);
            fixture.componentRef.setInput("handleForces", []);
            await fixture.whenStable();

            expect(component.forceChartOptions().plugins?.legend?.title?.display).toBe(true);
            expect(component.forceChartOptions().plugins?.legend?.title?.text).toBe("Force Curve");
            expect(component.forceChartOptions().plugins?.datalabels?.display).toBe(false);
        });

        it("should update chart options when showPeakInTitle changes", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15, 25, 5]);

            fixture.componentRef.setInput("showPeakInTitle", true);
            await fixture.whenStable();
            expect(component.forceChartOptions().plugins?.legend?.title?.display).toBe(true);
            expect(component.forceChartOptions().plugins?.datalabels?.display).toBe(false);

            fixture.componentRef.setInput("showPeakInTitle", false);
            await fixture.whenStable();
            expect(component.forceChartOptions().plugins?.legend?.title?.display).toBe(false);
            expect(typeof component.forceChartOptions().plugins?.datalabels?.display).toBe("function");
        });
    });

    describe("showGridLines input signal behavior", (): void => {
        it("should show grid lines by default", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            await fixture.whenStable();

            const scales = component.forceChartOptions().scales as {
                y: { grid: { display: boolean } };
            };
            expect(scales.y.grid.display).toBe(true);
        });

        it("should hide grid lines when showGridLines is false", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            fixture.componentRef.setInput("showGridLines", false);
            await fixture.whenStable();

            const scales = component.forceChartOptions().scales as {
                y: { grid: { display: boolean } };
            };
            expect(scales.y.grid.display).toBe(false);
        });

        it("should update grid lines when showGridLines changes", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            fixture.componentRef.setInput("showGridLines", true);
            await fixture.whenStable();

            let scales = component.forceChartOptions().scales as {
                y: { grid: { display: boolean } };
            };
            expect(scales.y.grid.display).toBe(true);

            fixture.componentRef.setInput("showGridLines", false);
            await fixture.whenStable();

            scales = component.forceChartOptions().scales as {
                y: { grid: { display: boolean } };
            };
            expect(scales.y.grid.display).toBe(false);
        });
    });

    describe("showAxisLabels input signal behavior", (): void => {
        it("should show axis labels by default", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            await fixture.whenStable();

            const scales = component.forceChartOptions().scales as {
                y: { ticks: { display: boolean } };
            };
            expect(scales.y.ticks.display).toBe(true);
        });

        it("should hide axis labels when showAxisLabels is false", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            fixture.componentRef.setInput("showAxisLabels", false);
            await fixture.whenStable();

            const scales = component.forceChartOptions().scales as {
                y: { ticks: { display: boolean } };
            };
            expect(scales.y.ticks.display).toBe(false);
        });

        it("should update axis labels when showAxisLabels changes", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            fixture.componentRef.setInput("showAxisLabels", true);
            await fixture.whenStable();

            let scales = component.forceChartOptions().scales as {
                y: { ticks: { display: boolean } };
            };
            expect(scales.y.ticks.display).toBe(true);

            fixture.componentRef.setInput("showAxisLabels", false);
            await fixture.whenStable();

            scales = component.forceChartOptions().scales as {
                y: { ticks: { display: boolean } };
            };
            expect(scales.y.ticks.display).toBe(false);
        });
    });

    describe("y-axis border behavior", (): void => {
        it("should show border by default when both grid and labels are true", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            await fixture.whenStable();

            const scales = component.forceChartOptions().scales as {
                y: { border: { display: boolean } };
            };
            expect(scales.y.border.display).toBe(true);
        });

        it("should show border when showAxisLabels is true and showGridLines is false", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            fixture.componentRef.setInput("showAxisLabels", true);
            fixture.componentRef.setInput("showGridLines", false);
            await fixture.whenStable();

            const scales = component.forceChartOptions().scales as {
                y: { border: { display: boolean } };
            };
            expect(scales.y.border.display).toBe(true);
        });

        it("should show border when showGridLines is true and showAxisLabels is false", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            fixture.componentRef.setInput("showAxisLabels", false);
            fixture.componentRef.setInput("showGridLines", true);
            await fixture.whenStable();

            const scales = component.forceChartOptions().scales as {
                y: { border: { display: boolean } };
            };
            expect(scales.y.border.display).toBe(true);
        });

        it("should hide border when both showAxisLabels and showGridLines are false", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            fixture.componentRef.setInput("showAxisLabels", false);
            fixture.componentRef.setInput("showGridLines", false);
            await fixture.whenStable();

            const scales = component.forceChartOptions().scales as {
                y: { border: { display: boolean } };
            };
            expect(scales.y.border.display).toBe(false);
        });
    });

    describe("handleForcesChart computed signal", (): void => {
        it("should map force array to Point format with sequential x coordinates", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15, 25, 5]);
            await fixture.whenStable();

            const chartData = component.handleForcesChart();
            const dataPoints = chartData.datasets[0].data as Array<Point>;

            expect(dataPoints).toHaveLength(5);
            expect(dataPoints[0]).toEqual({ x: 0, y: 10 });
            expect(dataPoints[1]).toEqual({ x: 1, y: 20 });
            expect(dataPoints[2]).toEqual({ x: 2, y: 15 });
            expect(dataPoints[3]).toEqual({ x: 3, y: 25 });
            expect(dataPoints[4]).toEqual({ x: 4, y: 5 });
        });

        it("should handle empty array", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", []);
            await fixture.whenStable();

            const chartData = component.handleForcesChart();
            const dataPoints = chartData.datasets[0].data as Array<Point>;

            expect(dataPoints).toHaveLength(0);
        });

        it("should update chart data when handleForces changes", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20]);
            await fixture.whenStable();

            let chartData = component.handleForcesChart();
            let dataPoints = chartData.datasets[0].data as Array<Point>;
            expect(dataPoints).toHaveLength(2);

            fixture.componentRef.setInput("handleForces", [100, 200, 300]);
            await fixture.whenStable();

            chartData = component.handleForcesChart();
            dataPoints = chartData.datasets[0].data as Array<Point>;

            expect(dataPoints).toHaveLength(3);
            expect(dataPoints[0]).toEqual({ x: 0, y: 100 });
            expect(dataPoints[1]).toEqual({ x: 1, y: 200 });
            expect(dataPoints[2]).toEqual({ x: 2, y: 300 });
        });

        it("should maintain dataset configuration", async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15]);
            await fixture.whenStable();

            const chartData = component.handleForcesChart();
            const dataset = chartData.datasets[0];

            expect(dataset.fill).toBe(true);
            expect(dataset.label).toBe("");
            expect(dataset.borderColor).toBe("rgb(31,119,180)");
            expect(dataset.backgroundColor).toBe("rgb(31,119,180,0.5)");
            expect(dataset.pointRadius).toBe(0);
        });
    });

    describe("as part of edge case handling", (): void => {
        it("should handle large datasets without errors", (): void => {
            const largeDataset = Array.from({ length: 1000 }, (_: unknown, i: number): number => i * 0.5);
            fixture.componentRef.setInput("handleForces", largeDataset);

            const chartData = component.handleForcesChart();
            const dataPoints = chartData.datasets[0].data as Array<Point>;

            expect(dataPoints).toHaveLength(1000);
            expect(dataPoints[0]).toEqual({ x: 0, y: 0 });
            expect(dataPoints[999]).toEqual({ x: 999, y: 499.5 });
        });
    });
});
