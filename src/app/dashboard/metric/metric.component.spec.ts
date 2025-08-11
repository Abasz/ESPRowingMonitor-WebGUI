import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { MetricComponent } from "./metric.component";

describe("MetricComponent", (): void => {
    let component: MetricComponent;
    let fixture: ComponentFixture<MetricComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            providers: [provideZonelessChangeDetection()],
            imports: [MetricComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(MetricComponent);
        component = fixture.componentInstance;
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });
});
