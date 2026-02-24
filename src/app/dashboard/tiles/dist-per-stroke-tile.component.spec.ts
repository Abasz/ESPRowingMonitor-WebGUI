import { ComponentFixture, TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { ICalculatedMetrics, IDisplayConfig } from "../../../common/common.interfaces";

import { createMockDisplayConfig, createMockMetrics } from "./dashboard-tile.test.helpers";
import { DistPerStrokeTileComponent } from "./dist-per-stroke-tile.component";

describe("DistPerStrokeTileComponent", (): void => {
    let component: DistPerStrokeTileComponent;
    let fixture: ComponentFixture<DistPerStrokeTileComponent>;

    const mockInitialMetrics: ICalculatedMetrics = createMockMetrics();
    const mockInitialDisplayConfig: IDisplayConfig = createMockDisplayConfig();

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [DistPerStrokeTileComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(DistPerStrokeTileComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("label", "Dist / Stroke");
        fixture.componentRef.setInput("icon", "route");
        fixture.componentRef.setInput("rowingData", mockInitialMetrics);
        fixture.componentRef.setInput("displayConfig", mockInitialDisplayConfig);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("distPerStroke computed signal", (): void => {
        it("should reflect distPerStroke from input", (): void => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distPerStroke: 8.5 });

            expect(component.distPerStroke()).toBe(8.5);
        });

        it("should update when rowingData input changes", (): void => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distPerStroke: 7.2 });
            expect(component.distPerStroke()).toBe(7.2);

            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distPerStroke: 9.1 });
            expect(component.distPerStroke()).toBe(9.1);
        });
    });

    describe("as part of template rendering", (): void => {
        it("should render unit as m/stk in metric mode", async (): Promise<void> => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distPerStroke: 8.5 });
            fixture.detectChanges();
            await fixture.whenStable();

            const unitEl = fixture.nativeElement.querySelector(".unit");
            expect(unitEl?.textContent?.trim()).toBe("m/stk");
        });

        it("should render unit as ft/stk in imperial mode", async (): Promise<void> => {
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distPerStroke: 8.5 });
            fixture.detectChanges();
            await fixture.whenStable();

            const unitEl = fixture.nativeElement.querySelector(".unit");
            expect(unitEl?.textContent?.trim()).toBe("ft/stk");
        });

        it("should update the unit when unitSystem changes", async (): Promise<void> => {
            fixture.componentRef.setInput("rowingData", { ...mockInitialMetrics, distPerStroke: 8.5 });
            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "metric" },
            });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelector(".unit")?.textContent?.trim()).toBe("m/stk");

            fixture.componentRef.setInput("displayConfig", {
                ...mockInitialDisplayConfig,
                general: { unitSystem: "imperial" },
            });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelector(".unit")?.textContent?.trim()).toBe("ft/stk");
        });
    });
});
