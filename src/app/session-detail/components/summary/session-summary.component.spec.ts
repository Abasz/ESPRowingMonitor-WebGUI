import { ComponentFixture, TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { ISessionAnalysis } from "../../models/session-analysis.interfaces";

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

            expect(component.avgMetrics().length).toBe(8);
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
});
