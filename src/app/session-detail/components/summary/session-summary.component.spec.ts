import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ISessionAnalysis } from "../../models/session-analysis.interfaces";
import { SessionChartComponent } from "../shared/session-chart.component";

import { SessionSummaryComponent } from "./session-summary.component";

const createMockAnalysis = (): ISessionAnalysis => ({
    sessionId: 1700000000000,
    deviceName: "TestDevice",
    records: [
        {
            strokeIndex: 0,
            distance: 1000,
            speed: 2.5,
            strokeRate: 24,
            avgStrokePower: 150,
            elapsedTime: 2.5,
            timeStamp: 1700000002500,
            heartRate: { heartRate: 145, contactDetected: true },
            distPerStroke: 10,
            driveDuration: 0.8,
            recoveryDuration: 1.7,
            dragFactor: 110,
        },
    ],
    strokes: [
        {
            strokeIndex: 0,
            distance: 1000,
            speed: 2.5,
            strokeRate: 24,
            avgStrokePower: 150,
            elapsedTime: 2.5,
            timeStamp: 1700000002500,
            heartRate: { heartRate: 145, contactDetected: true },
            peakForce: 200,
            peakForcePositionNorm: 50,
            driveLength: 0.8,
            distPerStroke: 10,
            driveDuration: 0.8,
            recoveryDuration: 1.7,
            dragFactor: 110,
            handleForces: [20, 60, 100, 80, 40],
        },
    ],
    statistics: {
        totalDistance: 10,
        totalTime: 120,
        totalStrokeCount: 50,
        max: {
            speed: 3.0,
            strokePower: 200,
            strokeRate: 30,
            peakForce: 250,
            distPerStroke: 12,
            driveLength: 0.9,
            driveDuration: 0.85,
            recoveryDuration: 1.8,
        },
        avg: {
            speed: 2.5,
            strokePower: 150,
            strokeRate: 24,
            distPerStroke: 10,
            driveLength: 0.8,
            driveDuration: 0.75,
            recoveryDuration: 1.6,
            heartRate: 145,
            dragFactor: 110,
            peakForcePositionNorm: 50,
        },
    },
    laps: [],
});

describe("SessionSummaryComponent", (): void => {
    let component: SessionSummaryComponent;
    let fixture: ComponentFixture<SessionSummaryComponent>;

    const getCardByTitle = (title: string): Element | null => {
        for (const card of Array.from(
            fixture.nativeElement.querySelectorAll("mat-card") as NodeListOf<Element>,
        )) {
            if (card.querySelector("h3")?.textContent?.includes(title)) {
                return card;
            }
        }

        return null;
    };

    const getMetricByLabel = (container: Element, label: string): Element | null => {
        for (const metric of Array.from(
            container.querySelectorAll(".metrics > div") as NodeListOf<Element>,
        )) {
            if (metric.querySelector(".label")?.textContent?.includes(label)) {
                return metric;
            }
        }

        return null;
    };

    type ChartConfig = ReturnType<typeof component.charts>[number];

    const getChartConfig = (title: string): ChartConfig | null => {
        for (const chart of component.charts()) {
            if (chart.title === title) {
                return chart;
            }
        }

        return null;
    };

    const getChartWrapperByTitle = (title: string): Element | null => {
        const wrappers = fixture.nativeElement.querySelectorAll(".chart-wrapper") as NodeListOf<Element>;
        for (const wrapper of Array.from(wrappers)) {
            if (wrapper.querySelector(".chart-header span:nth-child(2)")?.textContent?.includes(title)) {
                return wrapper;
            }
        }

        return null;
    };

    const createAnalysisWithLaps = (): ISessionAnalysis => {
        const analysis = createMockAnalysis();
        analysis.laps = [
            {
                lapNumber: 1,
                startIndex: 0,
                endIndex: 4,
                startTime: 0,
                endTime: 10,
                duration: 10,
                avgPower: 150,
                avgStrokeRate: 24,
                avgSpeed: 2.5,
                avgDistPerStroke: 10,
            },
            {
                lapNumber: 2,
                startIndex: 8,
                endIndex: 12,
                startTime: 20,
                endTime: 30,
                duration: 10,
                avgPower: 180,
                avgStrokeRate: 26,
                avgSpeed: 2.8,
                avgDistPerStroke: 11,
            },
        ];

        return analysis;
    };

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [SessionSummaryComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SessionSummaryComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("analysis", createMockAnalysis());
        fixture.detectChanges();
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render three section cards", (): void => {
            const cards = fixture.nativeElement.querySelectorAll("mat-card");

            expect(cards.length).toBe(3);
        });

        it("should render totals section with distance, time and stroke count", (): void => {
            const totalsCard = getCardByTitle("Totals");

            expect(totalsCard).toBeTruthy();
            expect(getMetricByLabel(totalsCard!, "Distance")).toBeTruthy();
            expect(getMetricByLabel(totalsCard!, "Time")).toBeTruthy();
            expect(getMetricByLabel(totalsCard!, "Strokes")).toBeTruthy();
        });

        it("should render totals metrics with larger font", (): void => {
            const totalsCard = getCardByTitle("Totals");

            expect(totalsCard?.querySelector(".totals")).toBeTruthy();
        });

        it("should render maximums section with pace and computed metrics", (): void => {
            const maxCard = getCardByTitle("Maximums");

            expect(maxCard).toBeTruthy();
            expect(getMetricByLabel(maxCard!, "Pace")).toBeTruthy();
            expect(getMetricByLabel(maxCard!, "Speed")).toBeTruthy();
            expect(getMetricByLabel(maxCard!, "Power")).toBeTruthy();
        });

        it("should render averages section with pace and computed metrics", (): void => {
            const avgCard = getCardByTitle("Averages");

            expect(avgCard).toBeTruthy();
            expect(getMetricByLabel(avgCard!, "Pace")).toBeTruthy();
            expect(getMetricByLabel(avgCard!, "Speed")).toBeTruthy();
            expect(getMetricByLabel(avgCard!, "Power")).toBeTruthy();
        });

        it("should show heart rate metric in averages when HR data is available", (): void => {
            const avgCard = getCardByTitle("Averages");

            expect(getMetricByLabel(avgCard!, "Heart Rate")).toBeTruthy();
        });

        it("should hide heart rate metric in averages when HR data is undefined", (): void => {
            const analysis = createMockAnalysis();
            analysis.statistics.avg.heartRate = undefined;
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            const avgCard = getCardByTitle("Averages");

            expect(getMetricByLabel(avgCard!, "Heart Rate")).toBeNull();
        });
    });

    describe("as part of value computations", (): void => {
        it("should convert max speed from m/s to km/h", (): void => {
            expect(component.maxMetrics()[0].value).toBeCloseTo(3.0 * 3.6, 5);
        });

        it("should convert avg speed from m/s to km/h", (): void => {
            expect(component.avgMetrics()[0].value).toBeCloseTo(2.5 * 3.6, 5);
        });

        it("should include heart rate as last metric in avgMetrics when HR data is present", (): void => {
            const avgMetrics = component.avgMetrics();
            const lastMetric = avgMetrics[avgMetrics.length - 1];

            expect(lastMetric.label).toBe("Heart Rate");
            expect(lastMetric.value).toBe(145);
        });

        it("should exclude heart rate from avgMetrics when HR data is undefined", (): void => {
            const analysis = createMockAnalysis();
            analysis.statistics.avg.heartRate = undefined;
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            expect(component.avgMetrics().length).toBe(9);
        });

        it("should render max speed as km/h in the maximums card", (): void => {
            const maxCard = getCardByTitle("Maximums");
            const speedMetric = getMetricByLabel(maxCard!, "Speed");

            expect(speedMetric?.querySelector(".value")?.textContent).toContain("10.8");
        });

        it("should render total distance in the totals card", (): void => {
            const totalsCard = getCardByTitle("Totals");
            const distMetric = getMetricByLabel(totalsCard!, "Distance");

            expect(distMetric?.querySelector(".value")?.textContent).toContain("10");
        });
    });

    describe("as part of chart rendering", (): void => {
        it("should render 8 chart wrappers when HR data is present", (): void => {
            const chartWrappers = fixture.nativeElement.querySelectorAll(".chart-wrapper");

            expect(chartWrappers.length).toBe(8);
        });

        it("should render 6 chart wrappers when HR data is absent", (): void => {
            const analysis = createMockAnalysis();
            analysis.statistics.avg.heartRate = undefined;
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            const chartWrappers = fixture.nativeElement.querySelectorAll(".chart-wrapper");

            expect(chartWrappers.length).toBe(7);
        });

        it("should render chart headers with color circles", (): void => {
            const colorCircles = fixture.nativeElement.querySelectorAll(".chart-header span:nth-child(1)");

            expect(colorCircles.length).toBe(8);
            expect(colorCircles[0].style.backgroundColor).toBeTruthy();
        });

        it("should render chart wrappers for all configured charts", (): void => {
            expect(getChartWrapperByTitle("Speed")).toBeTruthy();
            expect(getChartWrapperByTitle("Stroke Power")).toBeTruthy();
            expect(getChartWrapperByTitle("Stroke Rate")).toBeTruthy();
            expect(getChartWrapperByTitle("Drive / Recovery")).toBeTruthy();
        });

        it("should assign units and decimal places per chart", (): void => {
            expect(getChartConfig("Speed")?.unit).toBe("km/h");
            expect(getChartConfig("Speed")?.decimals).toBe(1);
            expect(getChartConfig("Stroke Power")?.unit).toBe("W");
            expect(getChartConfig("Stroke Power")?.decimals).toBe(0);
        });

        it("should set Y-axis title on charts that use auto scaling", (): void => {
            const chartTitleToYUnit: Record<string, string> = {
                Speed: "km/h",
                "Stroke Power": "W",
                "Stroke Rate": "spm",
                "Dist/Stroke": "m",
            };

            for (const [title, expectedUnit] of Object.entries(chartTitleToYUnit)) {
                const yScale = (getChartConfig(title)?.options?.scales?.y ?? {}) as {
                    title?: { display: boolean; text: string };
                };

                expect(yScale.title?.text, `${title} Y-axis title`).toBe(expectedUnit);
            }
        });

        it("should set explicit Y-axis min and delegate max to grace on auto-scaled charts", (): void => {
            const yScale = (getChartConfig("Speed")?.options?.scales?.y ?? {}) as {
                min?: number;
                max?: number;
            };

            expect(yScale.min).toBeDefined();
            expect(yScale.max).toBeUndefined();
        });

        it("should not set negative Y-axis min on any chart that uses auto bounds", (): void => {
            const analysis = createMockAnalysis();
            analysis.records[0].speed = 0.01;
            analysis.records[0].avgStrokePower = 0.01;
            analysis.records[0].strokeRate = 0.01;
            analysis.records[0].driveDuration = 0.01;
            analysis.records[0].recoveryDuration = 0.01;
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            const autoScaleCharts = ["Speed", "Stroke Power", "Stroke Rate"];
            for (const title of autoScaleCharts) {
                const yScale = (getChartConfig(title)?.options?.scales?.y ?? {}) as {
                    min?: number;
                };

                expect(yScale.min, `${title} should not have negative min`).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe("as part of chart data content", (): void => {
        it("should convert speed to km/h in speed chart data points", (): void => {
            const speedChart = getChartConfig("Speed")!;
            const points = speedChart.data.datasets[0].data as Array<{ x: number; y: number }>;

            expect(points[0].y).toBeCloseTo(2.5 * 3.6, 5);
        });

        it("should filter out zero distPerStroke values", (): void => {
            const analysis = createMockAnalysis();
            analysis.strokes.push({
                strokeIndex: 1,
                distance: 1000,
                speed: 2.5,
                strokeRate: 24,
                avgStrokePower: 150,
                elapsedTime: 5.0,
                timeStamp: 1700000005000,
                heartRate: undefined,
                peakForce: 200,
                peakForcePositionNorm: 0,
                driveLength: 0.8,
                distPerStroke: 0,
                driveDuration: 0.8,
                recoveryDuration: 1.7,
                dragFactor: 110,
                handleForces: [],
            });
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            const distChart = getChartConfig("Dist/Stroke")!;
            const points = distChart.data.datasets[0].data as Array<{ x: number; y: number }>;

            expect(points.every((p: { x: number; y: number }): boolean => p.y !== 0)).toBe(true);
        });

        it("should include an average line as the second dataset in the speed chart", (): void => {
            const speedChart = getChartConfig("Speed")!;

            expect(speedChart.data.datasets.length).toBe(2);
            expect(speedChart.data.datasets[1].label).toBe("Average");
        });
    });

    describe("as part of lap table rendering", (): void => {
        it("should show lap table when multiple laps exist", (): void => {
            fixture.componentRef.setInput("analysis", createAnalysisWithLaps());
            fixture.detectChanges();

            const lapTable = fixture.nativeElement.querySelector("app-lap-table");

            expect(lapTable).toBeTruthy();
        });

        it("should hide lap table when no laps exist", (): void => {
            const lapTable = fixture.nativeElement.querySelector("app-lap-table");

            expect(lapTable).toBeNull();
        });

        it("should hide lap table when only one laps exist", (): void => {
            fixture.componentRef.setInput("analysis", {
                ...createMockAnalysis(),
                laps: [
                    {
                        lapNumber: 1,
                        startIndex: 0,
                        endIndex: 4,
                        startTime: 0,
                        endTime: 10,
                        duration: 10,
                        avgPower: 150,
                        avgStrokeRate: 24,
                        avgSpeed: 2.5,
                        avgDistPerStroke: 10,
                    },
                ],
            });

            fixture.detectChanges();

            const lapTable = fixture.nativeElement.querySelector("app-lap-table");

            expect(lapTable).toBeNull();
        });

        it("should show Laps heading in section card", (): void => {
            fixture.componentRef.setInput("analysis", createAnalysisWithLaps());
            fixture.detectChanges();

            const lapsCard = getCardByTitle("Laps");

            expect(lapsCard).toBeTruthy();
        });

        it("should select lap on onLapSelected call", (): void => {
            const analysis = createAnalysisWithLaps();
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            component.onLapSelected(analysis.laps[0]);

            expect(component.selectedLap()).toEqual(analysis.laps[0]);
        });

        it("should clear selection on onShowFullSession call", (): void => {
            const analysis = createAnalysisWithLaps();
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            component.onLapSelected(analysis.laps[0]);
            component.onShowFullSession();

            expect(component.selectedLap()).toBeUndefined();
        });

        it("should show Show Full Session button when a lap is selected", (): void => {
            const analysis = createAnalysisWithLaps();
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            component.onLapSelected(analysis.laps[0]);
            fixture.detectChanges();

            const button = fixture.nativeElement.querySelector("button[mat-button]");

            expect(button?.textContent).toContain("Show Full Session");
        });

        it("should hide Show Full Session button when no lap is selected", (): void => {
            fixture.componentRef.setInput("analysis", createAnalysisWithLaps());
            fixture.detectChanges();

            const button = fixture.nativeElement.querySelector("button[mat-button]");

            expect(button).toBeNull();
        });
    });

    describe("as part of chart zoom on lap selection", (): void => {
        it("should call zoomToRange on all charts when a lap is selected", (): void => {
            const analysis = createAnalysisWithLaps();
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            const chartEls = fixture.debugElement.queryAll(By.directive(SessionChartComponent));
            const zoomSpies = chartEls.map(
                (chartEl: DebugElement): ReturnType<typeof vi.spyOn> =>
                    vi.spyOn(chartEl.componentInstance as SessionChartComponent, "zoomToRange"),
            );

            component.onLapSelected(analysis.laps[0]);

            for (const spy of zoomSpies) {
                expect(spy).toHaveBeenCalledWith(analysis.laps[0].startTime, analysis.laps[0].endTime);
            }
        });

        it("should call resetZoom on all charts when showing full session", (): void => {
            const analysis = createAnalysisWithLaps();
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            component.onLapSelected(analysis.laps[0]);

            const chartEls = fixture.debugElement.queryAll(By.directive(SessionChartComponent));
            const resetSpies = chartEls.map(
                (chartEl: DebugElement): ReturnType<typeof vi.spyOn> =>
                    vi.spyOn(chartEl.componentInstance as SessionChartComponent, "resetZoom"),
            );

            component.onShowFullSession();

            for (const spy of resetSpies) {
                expect(spy).toHaveBeenCalled();
            }
        });
    });

    describe("when the analysis input changes", (): void => {
        it("should reset selectedLap to undefined", (): void => {
            const analysis = createAnalysisWithLaps();
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            component.onLapSelected(analysis.laps[0]);
            expect(component.selectedLap()).toBe(analysis.laps[0]);

            fixture.componentRef.setInput("analysis", { ...analysis });
            fixture.detectChanges();

            expect(component.selectedLap()).toBeUndefined();
        });

        it("should hide the Show Full Session button after analysis changes", (): void => {
            const analysis = createAnalysisWithLaps();
            fixture.componentRef.setInput("analysis", analysis);
            fixture.detectChanges();

            component.onLapSelected(analysis.laps[0]);
            fixture.detectChanges();

            const buttonBefore = fixture.nativeElement.querySelector("button[mat-button]");
            expect(buttonBefore).not.toBeNull();

            fixture.componentRef.setInput("analysis", { ...analysis });
            fixture.detectChanges();

            const buttonAfter = fixture.nativeElement.querySelector("button[mat-button]");
            expect(buttonAfter).toBeNull();
        });
    });
});
