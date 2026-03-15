import { signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IMigrationProgress } from "../../common/common.interfaces";
import { UtilsService } from "../../common/services/utils.service";

import { MigrationOverlayComponent } from "./migration-dialog.component";

function createMockProgress(overrides: Partial<IMigrationProgress> = {}): IMigrationProgress {
    return { processed: 0, total: 0, startedAt: 0, ...overrides };
}

describe("MigrationOverlayComponent", (): void => {
    let component: MigrationOverlayComponent;
    let fixture: ComponentFixture<MigrationOverlayComponent>;
    let progressSignal: WritableSignal<IMigrationProgress>;
    let mockUtilsService: Pick<UtilsService, "enableWakeLock" | "disableWakeLock">;

    beforeEach(async (): Promise<void> => {
        progressSignal = signal<IMigrationProgress>(createMockProgress());

        mockUtilsService = {
            enableWakeLock: vi.fn(),
            disableWakeLock: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [MigrationOverlayComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: progressSignal },
                { provide: UtilsService, useValue: mockUtilsService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(MigrationOverlayComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("as part of template rendering", (): void => {
        describe("when total is 0 (counting phase)", (): void => {
            it("should render indeterminate progress bar", (): void => {
                const bar: HTMLElement | null = fixture.nativeElement.querySelector("mat-progress-bar");
                expect(bar).toBeTruthy();
                expect(bar?.getAttribute("mode")).toBe("indeterminate");
            });

            it("should not display record count", (): void => {
                const recordCountSpan: NodeListOf<HTMLSpanElement> =
                    fixture.nativeElement.querySelectorAll(".progress span");
                // record count span is only rendered when progress().processed > 0
                expect(recordCountSpan).toHaveLength(1);
            });

            it("should display Calculating status", (): void => {
                const etaSpan: HTMLElement | null = fixture.nativeElement.querySelector(
                    ".progress span:first-child",
                );
                expect(etaSpan?.textContent?.trim()).toContain("Calculating…");
            });
        });

        describe("when migration is in progress", (): void => {
            beforeEach((): void => {
                progressSignal.set(
                    createMockProgress({ processed: 500, total: 1000, startedAt: Date.now() - 5000 }),
                );
                fixture.detectChanges();
            });

            it("should render determinate progress bar", (): void => {
                const bar: HTMLElement | null = fixture.nativeElement.querySelector("mat-progress-bar");
                expect(bar?.getAttribute("mode")).toBe("determinate");
            });

            it("should display correct progress percentage", (): void => {
                expect(component.progressPercent()).toBe(50);
            });

            it("should display processed and total count", (): void => {
                const recordCountSpan: HTMLElement | null =
                    fixture.nativeElement.querySelector(".progress span:last-child");
                expect(recordCountSpan?.textContent?.trim()).toBe("500 / 1000 records");
            });

            it("should display a calculated ETA", (): void => {
                const etaSpans: NodeListOf<HTMLSpanElement> = fixture.nativeElement.querySelectorAll(
                    ".progress span:first-child",
                );
                const etaEl = etaSpans[0];
                expect(etaEl?.textContent?.trim()).toMatch(/^ETA:/);
            });
        });

        describe("when migration is complete", (): void => {
            beforeEach((): void => {
                progressSignal.set(
                    createMockProgress({ processed: 1000, total: 1000, startedAt: Date.now() - 10000 }),
                );
                fixture.detectChanges();
            });

            it("should display 100% progress", (): void => {
                expect(component.progressPercent()).toBe(100);
            });

            it("should display 1000 / 1000 records", (): void => {
                const recordCountSpan: HTMLElement | null =
                    fixture.nativeElement.querySelector(".progress span:last-child");
                expect(recordCountSpan?.textContent?.trim()).toBe("1000 / 1000 records");
            });

            it("should display Completed status", (): void => {
                const etaSpan: HTMLElement | null = fixture.nativeElement.querySelector(
                    ".progress span:first-child",
                );
                expect(etaSpan?.textContent?.trim()).toContain("Completed");
            });
        });
    });

    describe("progressPercent computed signal", (): void => {
        it("should return 0 when total is 0", (): void => {
            progressSignal.set(createMockProgress({ processed: 0, total: 0 }));
            expect(component.progressPercent()).toBe(0);
        });

        it("should not exceed 100", (): void => {
            progressSignal.set(createMockProgress({ processed: 1100, total: 1000, startedAt: 1 }));
            expect(component.progressPercent()).toBe(100);
        });
    });

    describe("etaSec computed signal", (): void => {
        it("should return 0 when ETA cannot be calculated", (): void => {
            progressSignal.set(createMockProgress({ processed: 0, total: 0, startedAt: 0 }));
            expect(component.etaSec()).toBe(0);
        });

        describe("when migration is in progress with long ETA", (): void => {
            beforeEach((): void => {
                vi.useFakeTimers();
                vi.setSystemTime(65_000);
                // 50 of 1000 processed in ~65 seconds → ETA > 60 seconds
                progressSignal.set(createMockProgress({ processed: 50, total: 1000, startedAt: 1 }));
                fixture.detectChanges();
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should return a value greater than 60", (): void => {
                expect(component.etaSec()).toBeGreaterThan(60);
            });

            it("should render ETA via secondsToTime pipe in the template", (): void => {
                const etaSpans: NodeListOf<HTMLSpanElement> = fixture.nativeElement.querySelectorAll(
                    ".progress span:first-child",
                );
                const etaEl = etaSpans[0];
                expect(etaEl?.textContent).toContain("ETA:");
                expect(etaEl?.textContent).toMatch(/~.*(?:minute|second|hour)/);
            });
        });

        describe("when migration is nearly complete with short ETA", (): void => {
            beforeEach((): void => {
                vi.useFakeTimers();
                vi.setSystemTime(10_000);
                // 900 of 1000 processed in 10 seconds → short ETA
                progressSignal.set(createMockProgress({ processed: 900, total: 1000, startedAt: 1 }));
                fixture.detectChanges();
            });

            afterEach((): void => {
                vi.useRealTimers();
            });

            it("should return a value between 1 and 60", (): void => {
                expect(component.etaSec()).toBeGreaterThan(0);
                expect(component.etaSec()).toBeLessThanOrEqual(60);
            });
        });
    });

    describe("ngAfterViewInit method", (): void => {
        it("should enable wake lock", async (): Promise<void> => {
            await component.ngAfterViewInit();

            expect(vi.mocked(mockUtilsService.enableWakeLock)).toHaveBeenCalled();
        });
    });

    describe("ngOnDestroy method", (): void => {
        it("should disable wake lock", (): void => {
            component.ngOnDestroy();

            expect(vi.mocked(mockUtilsService.disableWakeLock)).toHaveBeenCalled();
        });
    });
});
