import { ComponentFixture, TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { ISessionStroke } from "../../models/session-analysis.interfaces";

import { StrokeInspectorComponent } from "./stroke-inspector.component";

const createMockStroke = (overrides: Partial<ISessionStroke> = {}): ISessionStroke => ({
    strokeIndex: 42,
    timeStamp: Date.now(),
    elapsedTime: 120,
    speed: 2.5,
    avgStrokePower: 185,
    strokeRate: 26,
    distPerStroke: 9.8,
    distance: 25000,
    driveDuration: 0.72,
    recoveryDuration: 1.58,
    dragFactor: 110,
    heartRate: undefined,
    peakForce: 450,
    peakForcePositionNorm: 50,
    driveLength: 1.35,
    handleForces: [100, 200, 450, 300, 100],
    ...overrides,
});

const findMetricByLabel = (nativeElement: HTMLElement, labelText: string): HTMLElement | undefined => {
    const labels: NodeListOf<HTMLElement> = nativeElement.querySelectorAll(".metric-grid .label");

    const label = Array.from(labels).find(
        (element: HTMLElement): boolean => element.textContent?.trim() === `${labelText}:`,
    );

    return (label?.nextElementSibling as HTMLElement | null) ?? undefined;
};

describe("StrokeInspectorComponent", (): void => {
    let component: StrokeInspectorComponent;
    let fixture: ComponentFixture<StrokeInspectorComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [StrokeInspectorComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(StrokeInspectorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("stroke", createMockStroke());
        fixture.detectChanges();
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });

    describe("as part of stroke header", (): void => {
        it("should display stroke number", (): void => {
            const header = fixture.nativeElement.querySelector(".stroke-header .label");

            expect(header.textContent).toContain("42");
        });

        it("should display elapsed time", (): void => {
            const time = fixture.nativeElement.querySelector(".stroke-time");

            expect(time.textContent).toMatch(/2:00/);
        });
    });

    describe("as part of metric display", (): void => {
        it("should display pace", (): void => {
            const paceMetric = findMetricByLabel(fixture.nativeElement, "Pace");

            expect(paceMetric).toBeTruthy();
            expect(paceMetric?.textContent).toMatch(/\d+:\d{2}/);
            expect(paceMetric?.querySelector(".unit")?.textContent).toContain("/500m");
        });

        it("should display power in watts", (): void => {
            const powerMetric = findMetricByLabel(fixture.nativeElement, "Power");

            expect(powerMetric?.textContent).toContain("185");
            expect(powerMetric?.querySelector(".unit")?.textContent).toContain("W");
        });

        it("should display stroke rate", (): void => {
            const rateMetric = findMetricByLabel(fixture.nativeElement, "Stroke Rate");

            expect(rateMetric?.textContent).toContain("26");
        });

        it("should display drive and recovery durations", (): void => {
            const driveMetric = findMetricByLabel(fixture.nativeElement, "Drive");
            const recoveryMetric = findMetricByLabel(fixture.nativeElement, "Recovery");

            expect(driveMetric?.textContent).toContain("0.72");
            expect(recoveryMetric?.textContent).toContain("1.58");
        });

        it("should not display heart rate when undefined", (): void => {
            const hrMetric = findMetricByLabel(fixture.nativeElement, "Heart Rate");

            expect(hrMetric).toBeUndefined();
        });

        it("should display heart rate when available", (): void => {
            fixture.componentRef.setInput(
                "stroke",
                createMockStroke({
                    heartRate: { heartRate: 155, contactDetected: true },
                }),
            );
            fixture.detectChanges();

            const hrMetric = findMetricByLabel(fixture.nativeElement, "Heart Rate");

            expect(hrMetric?.textContent).toContain("155");
            expect(hrMetric?.querySelector(".unit")?.textContent).toContain("bpm");
        });

        it("should display speed in km/h", (): void => {
            const speedMetric = findMetricByLabel(fixture.nativeElement, "Speed");

            expect(speedMetric?.textContent).toContain("9.0");
            expect(speedMetric?.querySelector(".unit")?.textContent).toContain("km/h");
        });

        it("should display dist/stroke", (): void => {
            const distMetric = findMetricByLabel(fixture.nativeElement, "Dist/Stroke");

            expect(distMetric?.textContent).toContain("9.8");
            expect(distMetric?.querySelector(".unit")?.textContent).toContain("m");
        });

        it("should display drive length", (): void => {
            const driveLengthMetric = findMetricByLabel(fixture.nativeElement, "Drive Length");

            expect(driveLengthMetric?.textContent).toContain("1.35");
            expect(driveLengthMetric?.querySelector(".unit")?.textContent).toContain("m");
        });

        it("should display drag factor without unit", (): void => {
            const dragFactorMetric = findMetricByLabel(fixture.nativeElement, "Drag Factor");

            expect(dragFactorMetric?.textContent).toContain("110");
            expect(dragFactorMetric?.querySelector(".unit")).toBeNull();
        });
    });

    describe("as part of input reactivity", (): void => {
        it("should update metrics when stroke input changes", (): void => {
            fixture.componentRef.setInput(
                "stroke",
                createMockStroke({ strokeIndex: 99, avgStrokePower: 220 }),
            );
            fixture.detectChanges();

            const header = fixture.nativeElement.querySelector(".stroke-header .label");

            expect(header.textContent).toContain("99");

            const powerMetric = findMetricByLabel(fixture.nativeElement, "Power");

            expect(powerMetric?.textContent).toContain("220");
        });

        it("should show dash for pace when speed is zero", (): void => {
            fixture.componentRef.setInput("stroke", createMockStroke({ speed: 0 }));
            fixture.detectChanges();

            const paceMetric = findMetricByLabel(fixture.nativeElement, "Pace");

            expect(paceMetric?.textContent).toContain("--");
        });
    });
});
