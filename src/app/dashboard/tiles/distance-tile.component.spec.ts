import { ComponentFixture, TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { Config, ICalculatedMetrics, IDisplayConfig } from "../../../common/common.interfaces";

import { createMockMetrics } from "./dashboard-tile.test.helpers";
import { DistanceTileComponent } from "./distance-tile.component";

describe("DistanceTileComponent", (): void => {
    let component: DistanceTileComponent;
    let fixture: ComponentFixture<DistanceTileComponent>;

    const mockInitialMetrics: ICalculatedMetrics = createMockMetrics();
    const mockInitialDisplayConfig: IDisplayConfig = new Config().display;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [DistanceTileComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(DistanceTileComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("label", "Distance");
        fixture.componentRef.setInput("icon", "distance");
        fixture.componentRef.setInput("rowingData", mockInitialMetrics);
        fixture.componentRef.setInput("displayConfig", mockInitialDisplayConfig);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("isImperial computed signal", (): void => {
        it("should return false when unitSystem is metric", (): void => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });

            expect(component.isImperial()).toBe(false);
        });

        it("should return true when unitSystem is imperial", (): void => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });

            expect(component.isImperial()).toBe(true);
        });
    });

    describe("distance computed signal", (): void => {
        it("should divide raw distance by 100 in metric mode", (): void => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 50000 });
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });

            expect(component.distance()).toBe(500);
        });

        it("should convert distance to miles in imperial mode", (): void => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 80000 });
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });

            const expectedMiles = 800 * 0.000621371;
            expect(component.distance()).toBeCloseTo(expectedMiles, 5);
        });

        it("should update when rowingData input changes", (): void => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });

            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 100000 });
            expect(component.distance()).toBe(1000);

            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 20000 });
            expect(component.distance()).toBe(200);
        });

        it("should update when unitSystem changes", (): void => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 50000 });

            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            expect(component.distance()).toBe(500);

            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });
            const expectedMiles = 500 * 0.000621371;
            expect(component.distance()).toBeCloseTo(expectedMiles, 5);
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render unit m in metric mode", async (): Promise<void> => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 50000 });
            fixture.detectChanges();
            await fixture.whenStable();

            const unitEl = fixture.nativeElement.querySelector(".unit");
            expect(unitEl?.textContent?.trim()).toBe("m");
        });

        it("should render unit mi in imperial mode", async (): Promise<void> => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 80000 });
            fixture.detectChanges();
            await fixture.whenStable();

            const unitEl = fixture.nativeElement.querySelector(".unit");
            expect(unitEl?.textContent?.trim()).toBe("mi");
        });

        it("should render distance formatted via number pipe with correct decimal places", async (): Promise<void> => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 50000 });
            fixture.detectChanges();
            await fixture.whenStable();

            const valueEl = fixture.nativeElement.querySelector(".value");
            expect(valueEl?.textContent?.trim()).toMatch(/^500/);
        });

        it("should render imperial distance with appropriate decimal places", async (): Promise<void> => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 80000 });
            fixture.detectChanges();
            await fixture.whenStable();

            const valueEl = fixture.nativeElement.querySelector(".value");
            expect(valueEl?.textContent?.trim()).toMatch(/\d+\.\d+/);
        });

        it("should update unit when unitSystem changes", async (): Promise<void> => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distance: 50000 });
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelector(".unit")?.textContent?.trim()).toBe("m");

            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelector(".unit")?.textContent?.trim()).toBe("mi");
        });
    });
});
