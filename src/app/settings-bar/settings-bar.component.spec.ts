import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SettingsBarComponent } from "./settings-bar.component";

describe("SettingsBarComponent", (): void => {
    let component: SettingsBarComponent;
    let fixture: ComponentFixture<SettingsBarComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [SettingsBarComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsBarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });
});
