import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ForceCurveComponent } from "./force-curve.component";

describe("FurceCurveComponent", (): void => {
    let component: ForceCurveComponent;
    let fixture: ComponentFixture<ForceCurveComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            declarations: [ForceCurveComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ForceCurveComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });
});
