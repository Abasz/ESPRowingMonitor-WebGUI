import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatCard } from "@angular/material/card";
import {
    CategoryScale,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Title,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { BaseChartDirective, provideCharts } from "ng2-charts";

import { ForceCurveComponent } from "./force-curve.component";

describe("FurceCurveComponent", (): void => {
    let component: ForceCurveComponent;
    let fixture: ComponentFixture<ForceCurveComponent>;

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
                provideZonelessChangeDetection(),
            ],
            imports: [MatCard, BaseChartDirective, ForceCurveComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ForceCurveComponent);
        component = fixture.componentInstance;
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });
});
