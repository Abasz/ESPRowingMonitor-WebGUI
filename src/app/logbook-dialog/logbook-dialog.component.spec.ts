import { ComponentFixture, TestBed } from "@angular/core/testing";

import { LogbookDialogComponent } from "./logbook-dialog.component";

describe("SettingsDialogComponent", (): void => {
    let component: LogbookDialogComponent;
    let fixture: ComponentFixture<LogbookDialogComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            declarations: [LogbookDialogComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(LogbookDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });
});
