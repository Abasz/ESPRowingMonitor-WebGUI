import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SettingsDialogComponent } from "./settings-dialog.component";

describe("SettingsDialogComponent", (): void => {
    let component: SettingsDialogComponent;
    let fixture: ComponentFixture<SettingsDialogComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            declarations: [SettingsDialogComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });
});
