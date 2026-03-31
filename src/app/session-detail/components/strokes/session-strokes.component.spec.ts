import { ComponentFixture, TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { ILap, ISessionStroke } from "../../models/session-analysis.interfaces";

import { SessionStrokesComponent } from "./session-strokes.component";

const createMockStrokes = (count: number): Array<ISessionStroke> =>
    Array.from(
        { length: count },
        (_value: unknown, index: number): ISessionStroke => ({
            strokeIndex: index + 1,
            timeStamp: Date.now() + index * 2500,
            elapsedTime: index * 2.5,
            speed: 2.5,
            avgStrokePower: 150 + index,
            strokeRate: 24,
            distPerStroke: 10,
            distance: index * 1000,
            driveDuration: 0.7,
            recoveryDuration: 1.5,
            dragFactor: 110,
            heartRate: undefined,
            peakForce: 350,
            peakForcePositionNorm: 50,
            driveLength: 1.3,
            handleForces: [100, 200, 350, 200, 100],
        }),
    );

describe("SessionStrokesComponent", (): void => {
    let component: SessionStrokesComponent;
    let fixture: ComponentFixture<SessionStrokesComponent>;
    let mockStrokes: Array<ISessionStroke>;

    beforeEach(async (): Promise<void> => {
        mockStrokes = createMockStrokes(10);

        await TestBed.configureTestingModule({
            imports: [SessionStrokesComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SessionStrokesComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("strokes", mockStrokes);
        fixture.detectChanges();
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });

    describe("as part of stroke navigation", (): void => {
        it("should start at index 0", (): void => {
            expect(component.currentStrokeIndex()).toBe(0);
        });

        it("should navigate to next stroke", (): void => {
            component.onNext();

            expect(component.currentStrokeIndex()).toBe(1);
        });

        it("should navigate to previous stroke", (): void => {
            component.currentStrokeIndex.set(5);
            component.onPrevious();

            expect(component.currentStrokeIndex()).toBe(4);
        });

        it("should not go below 0", (): void => {
            component.onPrevious();

            expect(component.currentStrokeIndex()).toBe(0);
        });

        it("should not exceed max index", (): void => {
            component.currentStrokeIndex.set(9);
            component.onNext();

            expect(component.currentStrokeIndex()).toBe(9);
        });

        it("should update via slider", (): void => {
            component.onSliderChange("7");

            expect(component.currentStrokeIndex()).toBe(7);
        });
    });

    describe("as part of current stroke tracking", (): void => {
        it("should provide current stroke based on index", (): void => {
            expect(component.currentStroke().strokeIndex).toBe(1);

            component.currentStrokeIndex.set(3);

            expect(component.currentStroke().strokeIndex).toBe(4);
        });

        it("should compute max index from strokes length", (): void => {
            expect(component.maxIndex()).toBe(9);
        });
    });

    describe("as part of force curve data building", (): void => {
        it("should build single stroke force curve from current stroke", (): void => {
            const chartData = component.singleStrokeForceCurve();

            expect(chartData.datasets).toHaveLength(2);
            expect(chartData.datasets[0].data).toHaveLength(5);
            expect(chartData.datasets[1].label).toBe("Peak Position");
        });

        it("should update single stroke force curve when index changes", (): void => {
            component.currentStrokeIndex.set(3);
            const chartData = component.singleStrokeForceCurve();

            expect(chartData.datasets[0].data).toHaveLength(5);
        });

        it("should build continuous force curve from all strokes", (): void => {
            const continuousData = component.continuousForceCurve();

            expect(continuousData.chartData.datasets).toHaveLength(1);
            expect(continuousData.strokeOffsets).toHaveLength(10);
        });

        it("should include highlight dataset in continuous chart data", (): void => {
            const chartData = component.continuousChartData();

            expect(chartData.datasets).toHaveLength(2);
            expect(chartData.datasets[1].label).toBe("Current");
        });

        it("should place peak marker vertical line at max force index", (): void => {
            const chartData = component.singleStrokeForceCurve();
            const peakDataset = chartData.datasets[1];
            const points = peakDataset.data as Array<{ x: number; y: number }>;

            expect(points).toHaveLength(3);
            expect(points[0].x).toBe(2);
            expect(points[0].y).toBe(0);
            expect(points[1].x).toBe(2);
            expect(points[1].y).toBe(350);
        });

        it("should update highlight dataset when stroke index changes", (): void => {
            component.currentStrokeIndex.set(3);
            const chartData = component.continuousChartData();

            expect(chartData.datasets[1].data).toHaveLength(5);
        });

        it("should enable decimation on continuous chart", (): void => {
            const options = component.continuousChartOptions();
            const decimation = options.plugins?.decimation as { enabled: boolean; algorithm: string };

            expect(decimation.enabled).toBe(true);
            expect(decimation.algorithm).toBe("lttb");
        });

        it("should set fixed Y scale based on max peak force", (): void => {
            const options = component.singleStrokeChartOptions();
            const yScale = options.scales?.y as { min: number; max: number };

            expect(yScale.min).toBe(0);
            expect(yScale.max).toBeCloseTo(367.5);
        });

        it("should disable zoom on single stroke chart", (): void => {
            const options = component.singleStrokeChartOptions();
            const zoomConfig = options.plugins?.zoom as {
                pan: { enabled: boolean };
                zoom: { wheel: { enabled: boolean } };
            };

            expect(zoomConfig.pan.enabled).toBe(false);
            expect(zoomConfig.zoom.wheel.enabled).toBe(false);
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render navigation buttons", (): void => {
            const buttons = fixture.nativeElement.querySelectorAll("button[mat-icon-button]");

            // 2 nav buttons + 2 reset zoom buttons from session charts
            expect(buttons.length).toBeGreaterThanOrEqual(2);
        });

        it("should disable previous button at first stroke", (): void => {
            const prevButton: HTMLButtonElement = fixture.nativeElement.querySelector(
                "button[aria-label='Previous stroke']",
            );

            expect(prevButton.disabled).toBe(true);
        });

        it("should disable next button at last stroke", (): void => {
            component.currentStrokeIndex.set(9);
            fixture.detectChanges();

            const nextButton: HTMLButtonElement = fixture.nativeElement.querySelector(
                "button[aria-label='Next stroke']",
            );

            expect(nextButton.disabled).toBe(true);
        });

        it("should render stroke inspector", (): void => {
            const inspector = fixture.nativeElement.querySelector("app-stroke-inspector");

            expect(inspector).toBeTruthy();
        });

        it("should render two session charts", (): void => {
            const charts = fixture.nativeElement.querySelectorAll("app-session-chart");

            expect(charts.length).toBe(2);
        });

        it("should render slider", (): void => {
            const slider = fixture.nativeElement.querySelector("mat-slider");

            expect(slider).toBeTruthy();
        });
    });

    describe("as part of viewport sync", (): void => {
        it("should compute stroke offsets for viewport calculation", (): void => {
            const continuousData = component.continuousForceCurve();

            expect(continuousData.strokeOffsets[0]).toBe(0);
            expect(continuousData.strokeOffsets[1]).toBe(5);
            expect(continuousData.strokeOffsets[2]).toBe(10);
        });

        it("should resolve full window bounds when dataset fits within viewport", (): void => {
            // 10 strokes × 5 forces = 50 total samples; VIEWPORT_STROKE_COUNT=15 covers all
            const continuousData = component.continuousForceCurve();
            const strokeIndex = 6;
            const halfWindow = Math.floor(15 / 2); // 7
            const startStroke = Math.max(0, strokeIndex - halfWindow); // max(0, -1) = 0
            const endStroke = Math.min(9, strokeIndex + halfWindow); // min(9, 13) = 9

            const minX = continuousData.strokeOffsets[startStroke];
            const maxX = continuousData.strokeOffsets[endStroke] + mockStrokes[endStroke].handleForces.length;

            expect(minX).toBe(0);
            expect(maxX).toBe(50);
        });

        it("should clamp window start when navigating near the beginning", (): void => {
            const continuousData = component.continuousForceCurve();
            const strokeIndex = 1;
            const halfWindow = Math.floor(15 / 2); // 7
            const startStroke = Math.max(0, strokeIndex - halfWindow); // max(0, -6) = 0
            const endStroke = Math.min(9, strokeIndex + halfWindow); // min(9, 8) = 8

            const minX = continuousData.strokeOffsets[startStroke];
            const maxX = continuousData.strokeOffsets[endStroke] + mockStrokes[endStroke].handleForces.length;

            expect(minX).toBe(0);
            expect(maxX).toBe(45); // offset[8]=40, handleForces.length=5
        });
    });

    describe("as part of lap navigation", (): void => {
        const mockLaps: Array<ILap> = [
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
                startIndex: 5,
                endIndex: 9,
                startTime: 12.5,
                endTime: 22.5,
                duration: 10,
                avgPower: 155,
                avgStrokeRate: 24,
                avgSpeed: 2.5,
                avgDistPerStroke: 10,
            },
        ];

        it("should navigate to lap start index on lap selection", (): void => {
            fixture.componentRef.setInput("laps", mockLaps);
            fixture.detectChanges();

            component.onLapSelected(2);

            expect(component.currentStrokeIndex()).toBe(5);
        });

        it("should not change index for non-existent lap", (): void => {
            fixture.componentRef.setInput("laps", mockLaps);
            fixture.detectChanges();

            component.currentStrokeIndex.set(3);
            component.onLapSelected(99);

            expect(component.currentStrokeIndex()).toBe(3);
        });

        it("should render lap markers when multiple laps exist", (): void => {
            fixture.componentRef.setInput("laps", mockLaps);
            fixture.detectChanges();

            const lapMarkers = fixture.nativeElement.querySelectorAll(".lap-markers button");

            expect(lapMarkers.length).toBe(2);
        });

        it("should not render lap markers when single lap", (): void => {
            fixture.componentRef.setInput("laps", [mockLaps[0]]);
            fixture.detectChanges();

            const lapMarkers = fixture.nativeElement.querySelectorAll(".lap-markers button");

            expect(lapMarkers.length).toBe(0);
        });
    });
});
