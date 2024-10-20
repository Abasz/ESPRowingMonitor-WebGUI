import { TestBed } from "@angular/core/testing";

import { AppComponent } from "./app.component";

describe("AppComponent", (): void => {
    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [AppComponent],
        }).compileComponents();
    });

    it("should create the app", (): void => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    it("should render title", (): void => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector(".content span")?.textContent).toContain(
            "esp-rowing-monitor-client app is running!",
        );
    });
});
