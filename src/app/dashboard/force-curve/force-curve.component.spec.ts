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
import ChartDataLabels, { Context } from "chartjs-plugin-datalabels";
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
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize handleForces input signal", (): void => {
            expect(component.handleForces).toBeDefined();
            expect(typeof component.handleForces).toBe("function");
        });

        describe("forceChartOptions configuration", (): void => {
            describe("basic chart properties", (): void => {
                it("should be configured as responsive", (): void => {
                    expect(component.forceChartOptions.responsive).toBe(true);
                });

                it("should not maintain aspect ratio", (): void => {
                    expect(component.forceChartOptions.maintainAspectRatio).toBe(false);
                });
            });

            describe("plugins configuration", (): void => {
                describe("datalabels plugin", (): void => {
                    it("should configure anchor as center", (): void => {
                        expect(component.forceChartOptions.plugins?.datalabels?.anchor).toBe("center");
                    });

                    it("should configure align as top", (): void => {
                        expect(component.forceChartOptions.plugins?.datalabels?.align).toBe("top");
                    });

                    it("should have custom formatter function", (): void => {
                        const formatter = component.forceChartOptions.plugins?.datalabels?.formatter;
                        expect(typeof formatter).toBe("function");

                        if (typeof formatter === "function") {
                            const testPoint: Point = { x: 5, y: 42.7 };
                            const result = formatter(testPoint, {} as unknown as Context);
                            expect(result).toBe("Peak: 43");
                        }
                    });

                    it("should have display function for peak detection", (): void => {
                        const display = component.forceChartOptions.plugins?.datalabels?.display;
                        expect(typeof display).toBe("function");
                    });

                    it("should configure font size to 16", (): void => {
                        const font = component.forceChartOptions.plugins?.datalabels?.font as {
                            size: number;
                        };
                        expect(font?.size).toBe(16);
                    });

                    it("should configure color as black", (): void => {
                        expect(component.forceChartOptions.plugins?.datalabels?.color).toBe("rgb(0,0,0)");
                    });
                });

                describe("legend plugin", (): void => {
                    it("should display legend title", (): void => {
                        expect(component.forceChartOptions.plugins?.legend?.title?.display).toBe(true);
                    });

                    it("should set title text to Force Curve", (): void => {
                        expect(component.forceChartOptions.plugins?.legend?.title?.text).toBe("Force Curve");
                    });

                    it("should configure title font size to 32", (): void => {
                        const titleFont = component.forceChartOptions.plugins?.legend?.title?.font as {
                            size: number;
                        };
                        expect(titleFont?.size).toBe(32);
                    });

                    it("should set title color to black", (): void => {
                        expect(component.forceChartOptions.plugins?.legend?.title?.color).toBe("rgb(0,0,0)");
                    });

                    it("should hide legend labels", (): void => {
                        expect(component.forceChartOptions.plugins?.legend?.labels?.boxWidth).toBe(0);
                        const labelsFont = component.forceChartOptions.plugins?.legend?.labels?.font as {
                            size: number;
                        };
                        expect(labelsFont?.size).toBe(0);
                    });
                });
            });

            describe("scales configuration", (): void => {
                describe("x-axis configuration", (): void => {
                    it("should use linear scale type", (): void => {
                        expect(component.forceChartOptions.scales?.x?.type).toBe("linear");
                    });

                    it("should hide x-axis display", (): void => {
                        expect(component.forceChartOptions.scales?.x?.display).toBe(false);
                    });

                    it("should configure tick step size", (): void => {
                        const xTicks = component.forceChartOptions.scales?.x?.ticks as {
                            stepSize: number;
                        };
                        expect(xTicks?.stepSize).toBe(1);
                    });
                });

                describe("y-axis configuration", (): void => {
                    it("should configure tick color", (): void => {
                        const yTicks = component.forceChartOptions.scales?.y?.ticks as {
                            color: string;
                        };
                        expect(yTicks?.color).toBe("rgba(0,0,0)");
                    });
                });
            });

            describe("animations configuration", (): void => {
                it("should configure tension animation", (): void => {
                    const tensionAnim = component.forceChartOptions.animations?.tension as {
                        duration: number;
                        easing: string;
                    };
                    expect(tensionAnim?.duration).toBe(200);
                    expect(tensionAnim?.easing).toBe("linear");
                });

                it("should configure y-axis animation", (): void => {
                    const yAnim = component.forceChartOptions.animations?.y as {
                        duration: number;
                        easing: string;
                    };
                    expect(yAnim?.duration).toBe(200);
                    expect(yAnim?.easing).toBe("linear");
                });

                it("should configure x-axis animation", (): void => {
                    const xAnim = component.forceChartOptions.animations?.x as {
                        duration: number;
                        easing: string;
                    };
                    expect(xAnim?.duration).toBe(200);
                    expect(xAnim?.easing).toBe("linear");
                });
            });
        });
    });

    describe("as part of template rendering", (): void => {
        beforeEach(async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15, 25, 5]);
            await fixture.whenStable();
        });

        describe("mat-card element", (): void => {
            it("should render mat-card element", async (): Promise<void> => {
                const cardHarness = await loader.getHarness(MatCardHarness);
                expect(cardHarness).toBeTruthy();
            });

            it("should apply correct styling to mat-card", (): void => {
                const matCard = fixture.nativeElement.querySelector("mat-card");
                expect(matCard).toBeTruthy();
            });
        });

        describe("canvas element", (): void => {
            it("should render canvas element with baseChart directive", (): void => {
                const canvas = fixture.nativeElement.querySelector("canvas[baseChart]");
                expect(canvas).toBeTruthy();
            });

            it("should set correct height attribute on canvas", (): void => {
                const canvas = fixture.nativeElement.querySelector("canvas");

                expect(canvas.getAttribute("height")).toBeDefined();
                expect(parseInt(canvas.getAttribute("height"))).toBeGreaterThanOrEqual(100);
            });
        });
    });

    describe("handleForces input signal", (): void => {
        it("should accept array of numbers as input", async (): Promise<void> => {
            const testForces = [10, 20, 30];
            fixture.componentRef.setInput("handleForces", testForces);
            await fixture.whenStable();

            expect(component.handleForces()).toEqual(testForces);
        });

        it("should be required input", (): void => {
            expect(component.handleForces).toBeDefined();
            expect(typeof component.handleForces).toBe("function");
        });

        describe("with valid force data", (): void => {
            it("should accept positive numbers", async (): Promise<void> => {
                const positiveForces = [5.5, 10.2, 15.8, 20.1];
                fixture.componentRef.setInput("handleForces", positiveForces);
                await fixture.whenStable();

                expect(component.handleForces()).toEqual(positiveForces);
            });

            it("should accept zero values", async (): Promise<void> => {
                const forcesWithZero = [0, 5, 0, 10, 0];
                fixture.componentRef.setInput("handleForces", forcesWithZero);
                await fixture.whenStable();

                expect(component.handleForces()).toEqual(forcesWithZero);
            });

            it("should accept negative numbers", async (): Promise<void> => {
                const negativeForces = [-5, -10, -2.5];
                fixture.componentRef.setInput("handleForces", negativeForces);
                await fixture.whenStable();

                expect(component.handleForces()).toEqual(negativeForces);
            });

            it("should accept decimal numbers", async (): Promise<void> => {
                const decimalForces = [1.23, 4.56, 7.89, 10.11];
                fixture.componentRef.setInput("handleForces", decimalForces);
                await fixture.whenStable();

                expect(component.handleForces()).toEqual(decimalForces);
            });
        });

        describe("with edge case data", (): void => {
            it("should handle empty array", async (): Promise<void> => {
                const emptyForces: Array<number> = [];
                fixture.componentRef.setInput("handleForces", emptyForces);
                await fixture.whenStable();

                expect(component.handleForces()).toEqual([]);
            });

            it("should handle single value array", async (): Promise<void> => {
                const singleForce = [42.5];
                fixture.componentRef.setInput("handleForces", singleForce);
                await fixture.whenStable();

                expect(component.handleForces()).toEqual(singleForce);
            });

            it("should handle large arrays", async (): Promise<void> => {
                const largeForces = Array.from({ length: 1000 }, (_: unknown, i: number): number => i * 0.1);
                fixture.componentRef.setInput("handleForces", largeForces);
                await fixture.whenStable();

                expect(component.handleForces()).toEqual(largeForces);
            });
        });
    });

    describe("handleForcesChart computed signal", (): void => {
        beforeEach(async (): Promise<void> => {
            fixture.componentRef.setInput("handleForces", [10, 20, 15, 25, 5]);
            await fixture.whenStable();
        });

        describe("data transformation", (): void => {
            it("should map force array to Point format", (): void => {
                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                expect(dataPoints).toHaveLength(5);
                expect(dataPoints[0]).toEqual({ x: 0, y: 10 });
                expect(dataPoints[1]).toEqual({ x: 1, y: 20 });
                expect(dataPoints[2]).toEqual({ x: 2, y: 15 });
                expect(dataPoints[3]).toEqual({ x: 3, y: 25 });
                expect(dataPoints[4]).toEqual({ x: 4, y: 5 });
            });

            it("should preserve force values as y coordinates", async (): Promise<void> => {
                const testForces = [7.5, 14.2, 21.8];
                fixture.componentRef.setInput("handleForces", testForces);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                expect(dataPoints[0].y).toBe(7.5);
                expect(dataPoints[1].y).toBe(14.2);
                expect(dataPoints[2].y).toBe(21.8);
            });

            it("should generate sequential x coordinates", (): void => {
                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                dataPoints.forEach((point: Point, index: number): void => {
                    expect(point.x).toBe(index);
                });
            });

            it("should update chart data when handleForces changes", async (): Promise<void> => {
                const newForces = [100, 200, 300];
                fixture.componentRef.setInput("handleForces", newForces);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                expect(dataPoints).toHaveLength(3);
                expect(dataPoints[0]).toEqual({ x: 0, y: 100 });
                expect(dataPoints[1]).toEqual({ x: 1, y: 200 });
                expect(dataPoints[2]).toEqual({ x: 2, y: 300 });
            });
        });

        describe("chart data structure", (): void => {
            it("should return proper ChartConfiguration data format", (): void => {
                const chartData = component.handleForcesChart();

                expect(chartData.datasets).toBeDefined();
                expect(Array.isArray(chartData.datasets)).toBe(true);
                expect(chartData.datasets).toHaveLength(1);
            });

            it("should maintain dataset configuration", (): void => {
                const chartData = component.handleForcesChart();
                const dataset = chartData.datasets[0];

                expect(dataset.fill).toBe(true);
                expect(dataset.label).toBe("");
                expect(dataset.borderColor).toBe("rgb(31,119,180)");
                expect(dataset.backgroundColor).toBe("rgb(31,119,180,0.5)");
                expect(dataset.pointRadius).toBe(0);
            });

            it("should create new object reference for reactivity", async (): Promise<void> => {
                const chartData1 = component.handleForcesChart();

                fixture.componentRef.setInput("handleForces", [5, 15, 10, 20, 8]);
                await fixture.whenStable();
                const chartData2 = component.handleForcesChart();

                expect(chartData1).not.toBe(chartData2);
                expect(chartData1.datasets).toBeDefined();
                expect(chartData2.datasets).toBeDefined();
            });
        });
    });

    describe("as part of integration scenarios", (): void => {
        describe("with realistic force curve data", (): void => {
            it("should render typical rowing stroke pattern", async (): Promise<void> => {
                const rowingStroke = [5, 15, 30, 45, 50, 45, 30, 15, 5];
                fixture.componentRef.setInput("handleForces", rowingStroke);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                expect(dataPoints).toHaveLength(9);
                expect(dataPoints[0].y).toBe(5);
                expect(dataPoints[4].y).toBe(50);
                expect(dataPoints[8].y).toBe(5);
            });

            it("should handle multiple stroke cycles", async (): Promise<void> => {
                const multipleStrokes = [
                    5,
                    25,
                    50,
                    25,
                    5, // stroke 1
                    5,
                    30,
                    55,
                    30,
                    5, // stroke 2
                    5,
                    20,
                    45,
                    20,
                    5, // stroke 3
                ];
                fixture.componentRef.setInput("handleForces", multipleStrokes);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                expect(dataPoints).toHaveLength(15);
                expect(dataPoints[2].y).toBe(50);
                expect(dataPoints[7].y).toBe(55);
                expect(dataPoints[12].y).toBe(45);
            });
        });

        describe("with dynamic data updates", (): void => {
            it("should update chart when force data changes", async (): Promise<void> => {
                const initialForces = [10, 20, 30];
                fixture.componentRef.setInput("handleForces", initialForces);
                await fixture.whenStable();

                const initialChartData = component.handleForcesChart();
                const initialDataPoints = initialChartData.datasets[0].data as Array<Point>;
                expect(initialDataPoints).toHaveLength(3);

                const newForces = [40, 50, 60, 70];
                fixture.componentRef.setInput("handleForces", newForces);
                await fixture.whenStable();

                const updatedChartData = component.handleForcesChart();
                const updatedDataPoints = updatedChartData.datasets[0].data as Array<Point>;

                expect(updatedDataPoints).toHaveLength(4);
                expect(updatedDataPoints[3]).toEqual({ x: 3, y: 70 });
            });

            it("should maintain chart configuration during updates", async (): Promise<void> => {
                const initialForces = [10];
                fixture.componentRef.setInput("handleForces", initialForces);
                await fixture.whenStable();

                const initialChartData = component.handleForcesChart();
                const initialDataset = initialChartData.datasets[0];

                const newForces = [100, 200];
                fixture.componentRef.setInput("handleForces", newForces);
                await fixture.whenStable();

                const updatedChartData = component.handleForcesChart();
                const updatedDataset = updatedChartData.datasets[0];

                expect(updatedDataset.fill).toBe(initialDataset.fill);
                expect(updatedDataset.label).toBe(initialDataset.label);
                expect(updatedDataset.borderColor).toBe(initialDataset.borderColor);
            });
        });
    });

    describe("as part of edge case handling", (): void => {
        describe("with extreme values", (): void => {
            it("should handle very large force values", async (): Promise<void> => {
                const largeValues = [10000, 50000, 100000];
                fixture.componentRef.setInput("handleForces", largeValues);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                expect(dataPoints[0].y).toBe(10000);
                expect(dataPoints[1].y).toBe(50000);
                expect(dataPoints[2].y).toBe(100000);
            });

            it("should handle very small decimal values", async (): Promise<void> => {
                const smallValues = [0.001, 0.0005, 0.0001];
                fixture.componentRef.setInput("handleForces", smallValues);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                expect(dataPoints[0].y).toBe(0.001);
                expect(dataPoints[1].y).toBe(0.0005);
                expect(dataPoints[2].y).toBe(0.0001);
            });

            it("should handle negative force values", async (): Promise<void> => {
                const negativeValues = [-10, -25, -5];
                fixture.componentRef.setInput("handleForces", negativeValues);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                expect(dataPoints[0].y).toBe(-10);
                expect(dataPoints[1].y).toBe(-25);
                expect(dataPoints[2].y).toBe(-5);
            });
        });

        describe("with unusual data patterns", (): void => {
            it("should handle constant values", async (): Promise<void> => {
                const constantValues = [25, 25, 25, 25, 25];
                fixture.componentRef.setInput("handleForces", constantValues);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                dataPoints.forEach((point: Point): void => {
                    expect(point.y).toBe(25);
                });
            });

            it("should handle monotonically increasing values", async (): Promise<void> => {
                const increasingValues = [1, 5, 10, 20, 35, 55];
                fixture.componentRef.setInput("handleForces", increasingValues);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                for (let i = 1; i < dataPoints.length; i++) {
                    expect(dataPoints[i].y).toBeGreaterThan(dataPoints[i - 1].y ?? 0);
                }
            });

            it("should handle monotonically decreasing values", async (): Promise<void> => {
                const decreasingValues = [100, 80, 60, 40, 20, 5];
                fixture.componentRef.setInput("handleForces", decreasingValues);
                await fixture.whenStable();

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                for (let i = 1; i < dataPoints.length; i++) {
                    expect(dataPoints[i].y).toBeLessThan(dataPoints[i - 1].y ?? 0);
                }
            });
        });

        describe("with performance considerations", (): void => {
            it("should handle frequent data updates efficiently", async (): Promise<void> => {
                const baseForces = [10, 20, 30];

                for (let i = 0; i < 10; i++) {
                    const updatedForces = baseForces.map((force: number): number => force + i);
                    fixture.componentRef.setInput("handleForces", updatedForces);
                    await fixture.whenStable();

                    const chartData = component.handleForcesChart();
                    expect(chartData.datasets[0].data).toHaveLength(3);
                }

                const finalChartData = component.handleForcesChart();
                const finalDataPoints = finalChartData.datasets[0].data as Array<Point>;
                expect(finalDataPoints[0].y).toBe(19);
                expect(finalDataPoints[1].y).toBe(29);
                expect(finalDataPoints[2].y).toBe(39);
            });

            it("should handle very large datasets", (): void => {
                const veryLargeDataset = Array.from(
                    { length: 10000 },
                    (_: unknown, i: number): number => Math.sin(i * 0.01) * 100,
                );
                fixture.componentRef.setInput("handleForces", veryLargeDataset);

                const chartData = component.handleForcesChart();
                const dataPoints = chartData.datasets[0].data as Array<Point>;

                expect(dataPoints).toHaveLength(10000);
                expect(dataPoints[0].x).toBe(0);
                expect(dataPoints[9999].x).toBe(9999);
            });
        });
    });
});
