import { ComponentFixture, TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { ICalculatedMetrics, IDisplayConfig } from "../../../common/common.interfaces";

import { createMockDisplayConfig, createMockMetrics } from "./dashboard-tile.test.helpers";
import { SpeedTileComponent } from "./speed-tile.component";

const msToKmh = 3.6;
const msToMph = 2.23694;

describe("SpeedTileComponent", (): void => {
    let component: SpeedTileComponent;
    let fixture: ComponentFixture<SpeedTileComponent>;

    const mockInitialMetrics: ICalculatedMetrics = createMockMetrics();
    const mockInitialDisplayConfig: IDisplayConfig = createMockDisplayConfig();

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [SpeedTileComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SpeedTileComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("label", "Speed");
        fixture.componentRef.setInput("icon", "speed");
        fixture.componentRef.setInput("rowingData", mockInitialMetrics);
        fixture.componentRef.setInput("displayConfig", mockInitialDisplayConfig);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("speed computed signal", (): void => {
        it("should convert m/s to km/h in metric mode", (): void => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, speed: 1 });
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });

            expect(component.speed()).toBeCloseTo(msToKmh, 5);
        });

        it("should convert m/s to mph in imperial mode", (): void => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, speed: 1 });
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });

            expect(component.speed()).toBeCloseTo(msToMph, 5);
        });

        it("should update when rowingData input changes", (): void => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });

            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, speed: 2 });
            expect(component.speed()).toBeCloseTo(2 * msToKmh, 5);

            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, speed: 5 });
            expect(component.speed()).toBeCloseTo(5 * msToKmh, 5);
        });

        it("should update when unitSystem changes", (): void => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, speed: 1 });

            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            expect(component.speed()).toBeCloseTo(msToKmh, 5);

            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });
            expect(component.speed()).toBeCloseTo(msToMph, 5);
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render the unit as km/h in metric mode", async (): Promise<void> => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            fixture.detectChanges();
            await fixture.whenStable();

            const unitEl = fixture.nativeElement.querySelector(".unit");
            expect(unitEl?.textContent?.trim()).toBe("km/h");
        });

        it("should render the unit as mph in imperial mode", async (): Promise<void> => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });
            fixture.detectChanges();
            await fixture.whenStable();

            const unitEl = fixture.nativeElement.querySelector(".unit");
            expect(unitEl?.textContent?.trim()).toBe("mph");
        });

        it("should update the unit when unitSystem changes", async (): Promise<void> => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, speed: 1 });
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelector(".unit")?.textContent?.trim()).toBe("km/h");

            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelector(".unit")?.textContent?.trim()).toBe("mph");
        });

        it("should render the speed value to 2 decimal places", async (): Promise<void> => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, speed: 1 });
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            fixture.detectChanges();
            await fixture.whenStable();

            const valueEl = fixture.nativeElement.querySelector(".value");
            expect(valueEl?.textContent?.trim()).toMatch(/\d+\.\d{2}/);
        });
    });
});
