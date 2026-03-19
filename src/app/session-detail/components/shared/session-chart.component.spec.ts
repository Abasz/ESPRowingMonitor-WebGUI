import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ChartData, ChartOptions } from "chart.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionChartComponent } from "./session-chart.component";

const createMockChartData = (): ChartData => ({
    datasets: [
        {
            label: "Speed",
            data: [
                { x: 0, y: 2.5 },
                { x: 1, y: 2.8 },
                { x: 2, y: 3.0 },
            ],
        },
    ],
});

describe("SessionChartComponent", (): void => {
    let component: SessionChartComponent;
    let fixture: ComponentFixture<SessionChartComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [SessionChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SessionChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("chartData", createMockChartData());
        fixture.detectChanges();
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render a canvas element", (): void => {
            const canvas = fixture.nativeElement.querySelector("canvas");

            expect(canvas).toBeTruthy();
        });

        it("should render a reset zoom button", (): void => {
            const button = fixture.nativeElement.querySelector(".reset-zoom-button");

            expect(button).toBeTruthy();
        });

        it("should default chart type to line", (): void => {
            expect(component.chartType()).toBe("line");
        });

        it("should accept custom chart type", (): void => {
            fixture.componentRef.setInput("chartType", "scatter");
            fixture.detectChanges();

            expect(component.chartType()).toBe("scatter");
        });
    });

    describe("mergedOptions", (): void => {
        it("should provide default options when no chartOptions given", (): void => {
            const options = component.mergedOptions();

            expect(options.responsive).toBe(true);
            expect(options.animation).toBe(false);
            expect(options.elements?.line?.borderWidth).toBe(1);
            expect(options.elements?.point?.radius).toBe(0);
        });

        it("should merge user options with defaults", (): void => {
            const userOptions: ChartOptions = {
                scales: { y: { title: { display: true, text: "km/h" } } },
            };
            fixture.componentRef.setInput("chartOptions", userOptions);
            fixture.detectChanges();

            const options = component.mergedOptions();

            expect(options.responsive).toBe(true);
            expect(options.animation).toBe(false);
            expect((options.scales?.y as Record<string, unknown>)?.title).toEqual({
                display: true,
                text: "km/h",
            });
        });

        it("should disable gridlines by default", (): void => {
            const options = component.mergedOptions();

            expect(options.scales?.x?.grid).toEqual({
                display: false,
            });
            expect(options.scales?.y?.grid).toEqual({
                display: false,
            });
        });

        it("should use data bounds on the X-axis to prevent whitespace beyond data range", (): void => {
            const options = component.mergedOptions();

            expect((options.scales?.x as Record<string, unknown>)?.bounds).toBe("data");
        });

        it("should apply 5% grace on the Y-axis for automatic padding", (): void => {
            const options = component.mergedOptions();

            expect((options.scales?.y as Record<string, unknown>)?.grace).toBe("5%");
        });

        it("should include tooltip callback with unit and decimals", (): void => {
            fixture.componentRef.setInput("tooltipUnit", "km/h");
            fixture.componentRef.setInput("tooltipDecimals", 1);
            fixture.detectChanges();

            const options = component.mergedOptions();
            const callback = options.plugins?.tooltip as {
                callbacks?: {
                    label?: (item: { dataset: { label: string }; parsed: { y: number } }) => string;
                };
            };
            const result = callback?.callbacks?.label?.({
                dataset: { label: "Speed" },
                parsed: { y: 8.567 },
            });

            expect(result).toBe("Speed: 8.6 km/h");
        });

        it("should format tooltip title as pace time by default", (): void => {
            const options = component.mergedOptions();
            const callback = options.plugins?.tooltip as {
                callbacks?: { title?: (items: Array<{ parsed: { x: number } }>) => string };
            };

            // 90 seconds → "1:30"
            expect(callback?.callbacks?.title?.([{ parsed: { x: 90 } }])).toBe("1:30");
        });

        it("should use a custom tooltipTitleFormatter formatter when provided", (): void => {
            fixture.componentRef.setInput("tooltipTitleFormatter", (x: number): string => `t=${x}s`);
            fixture.detectChanges();

            const options = component.mergedOptions();
            const callback = options.plugins?.tooltip as {
                callbacks?: { title?: (items: Array<{ parsed: { x: number } }>) => string };
            };

            expect(callback?.callbacks?.title?.([{ parsed: { x: 42 } }])).toBe("t=42s");
        });

        it("should omit tooltip title callback when tooltipTitleFormatter is set to undefined", (): void => {
            fixture.componentRef.setInput("tooltipTitleFormatter", undefined);
            fixture.detectChanges();

            const options = component.mergedOptions();
            const callback = options.plugins?.tooltip as {
                callbacks?: { title?: unknown };
            };

            expect(callback?.callbacks?.title).toBeUndefined();
        });
    });

    describe("resetZoom method", (): void => {
        it("should call resetZoom on the underlying chart instance", (): void => {
            const mockResetZoom = vi.fn();
            Object.defineProperty(component, "chartDirective", {
                value: (): { chart: { resetZoom: ReturnType<typeof vi.fn> } } => ({
                    chart: { resetZoom: mockResetZoom },
                }),
                writable: true,
                configurable: true,
            });

            component.resetZoom();

            expect(mockResetZoom).toHaveBeenCalled();
        });

        it("should not throw when the chart is not yet initialized", (): void => {
            Object.defineProperty(component, "chartDirective", {
                value: (): undefined => undefined,
                writable: true,
                configurable: true,
            });

            expect((): void => component.resetZoom()).not.toThrow();
        });
    });

    describe("zoomToRange method", (): void => {
        it("should call zoomScale with the correct arguments on the underlying chart instance", (): void => {
            const mockZoomScale = vi.fn();
            Object.defineProperty(component, "chartDirective", {
                value: (): { chart: { zoomScale: ReturnType<typeof vi.fn> } } => ({
                    chart: { zoomScale: mockZoomScale },
                }),
                writable: true,
                configurable: true,
            });

            component.zoomToRange(10, 50);

            expect(mockZoomScale).toHaveBeenCalledWith("x", { min: 10, max: 50 }, "default");
        });

        it("should not throw when the chart is not yet initialized", (): void => {
            Object.defineProperty(component, "chartDirective", {
                value: (): undefined => undefined,
                writable: true,
                configurable: true,
            });

            expect((): void => component.zoomToRange(10, 50)).not.toThrow();
        });
    });
});
