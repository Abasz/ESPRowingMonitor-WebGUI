import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ISessionAnalysis } from "./models/session-analysis.interfaces";
import { SessionAnalysisService } from "./services/session-analysis.service";
import { SessionDetailComponent } from "./session-detail.component";

const createMockAnalysis = (overrides?: Partial<ISessionAnalysis>): ISessionAnalysis => ({
    sessionId: 1700000000000,
    records: [
        {
            strokeIndex: 0,
            distance: 10,
            speed: 2.5,
            strokeRate: 24,
            avgStrokePower: 150,
            elapsedTime: 2.5,
            timeStamp: 1700000002500,
            heartRate: undefined,
            distPerStroke: 10,
            driveDuration: 0.8,
            recoveryDuration: 1.7,
            dragFactor: 110,
        },
    ],
    strokes: [
        {
            strokeIndex: 0,
            distance: 10,
            speed: 2.5,
            strokeRate: 24,
            avgStrokePower: 150,
            elapsedTime: 2.5,
            timeStamp: 1700000002500,
            heartRate: undefined,
            peakForce: 100,
            driveLength: 0.8,
            distPerStroke: 10,
            driveDuration: 0.8,
            recoveryDuration: 1.7,
            dragFactor: 110,
            handleForces: [20, 60, 100, 80, 40],
        },
    ],
    statistics: {
        totalDistance: 10,
        totalTime: 2.5,
        totalStrokeCount: 1,
        max: {
            strokePower: 150,
            strokeRate: 24,
            speed: 2.5,
            peakForce: 100,
            driveLength: 0.8,
            distPerStroke: 10,
            driveDuration: 0.8,
            recoveryDuration: 1.7,
        },
        avg: {
            strokePower: 150,
            strokeRate: 24,
            speed: 2.5,
            heartRate: undefined,
            driveLength: 0.8,
            distPerStroke: 10,
            driveDuration: 0.8,
            recoveryDuration: 1.7,
            dragFactor: 110,
        },
    },
    laps: [],
    deviceName: "TestDevice",
    ...overrides,
});

describe("SessionDetailComponent", (): void => {
    let component: SessionDetailComponent;
    let fixture: ComponentFixture<SessionDetailComponent>;
    let mockSessionAnalysis: Pick<SessionAnalysisService, "loadSession">;
    let mockRouter: Pick<Router, "navigate">;
    let routeParamId: string | null;

    beforeEach(async (): Promise<void> => {
        routeParamId = "1700000000000";
        mockSessionAnalysis = { loadSession: vi.fn() };
        mockRouter = { navigate: vi.fn().mockResolvedValue(true) };

        await TestBed.configureTestingModule({
            imports: [SessionDetailComponent],
            providers: [
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: { get: (): string | null => routeParamId } } },
                },
                { provide: Router, useValue: mockRouter },
                { provide: SessionAnalysisService, useValue: mockSessionAnalysis },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SessionDetailComponent);
        component = fixture.componentInstance;
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("when session ID is invalid", (): void => {
        it("should show error for non-numeric ID", (): void => {
            routeParamId = "abc";
            fixture.detectChanges();

            expect(component.error()).toBe("Invalid session ID");
            expect(component.loading()).toBe(false);
            expect(fixture.nativeElement.querySelector(".error-container")).toBeTruthy();
        });

        it("should show error when ID is null", (): void => {
            routeParamId = null;
            fixture.detectChanges();

            expect(component.error()).toBe("Invalid session ID");
            expect(component.loading()).toBe(false);
        });

        it("should still show toolbar when error is displayed", (): void => {
            routeParamId = "abc";
            fixture.detectChanges();

            expect(fixture.nativeElement.querySelector("mat-toolbar")).toBeTruthy();
        });
    });

    describe("when loading session data", (): void => {
        it("should show loading spinner initially", (): void => {
            vi.mocked(mockSessionAnalysis.loadSession).mockReturnValue(
                new Promise((): void => {
                    // never resolves to keep loading state
                }),
            );
            fixture.detectChanges();

            expect(component.loading()).toBe(true);
            expect(fixture.nativeElement.querySelector("mat-spinner")).toBeTruthy();
        });

        it("should display session data after successful load", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            expect(component.loading()).toBe(false);
            expect(component.analysis()).toBeTruthy();
            expect(fixture.nativeElement.querySelector("mat-tab-group")).toBeTruthy();
        });

        it("should show error when session has no strokes", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis({ strokes: [] }));
            await fixture.whenStable();

            expect(component.error()).toBe("Session not found or contains no data");
            expect(fixture.nativeElement.querySelector(".error-container")).toBeTruthy();
        });

        it("should show error when load fails", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockRejectedValue(new Error("Database error"));
            await fixture.whenStable();

            expect(component.error()).toBe("Database error");
            expect(fixture.nativeElement.querySelector(".error-container")).toBeTruthy();
        });

        it("should show generic error when load fails with non-Error value", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockRejectedValue("unexpected string error");
            await fixture.whenStable();

            expect(component.error()).toBe("Failed to load session");
            expect(fixture.nativeElement.querySelector(".error-container")).toBeTruthy();
        });
    });

    describe("goBack method", (): void => {
        it("should navigate to the root route", (): void => {
            component.goBack();

            expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
        });

        it("should navigate to root when Back to Dashboard button is clicked in error state", (): void => {
            routeParamId = "abc";
            fixture.detectChanges();

            const backButton = fixture.nativeElement.querySelector(".error-container button");
            backButton.click();

            expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
        });
    });

    describe("as part of session toolbar", (): void => {
        it("should display toolbar with session date", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            const toolbar = fixture.nativeElement.querySelector("mat-toolbar");

            expect(toolbar).toBeTruthy();

            const dateSpan = toolbar.querySelector(".session-date");

            expect(dateSpan.textContent).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        it("should display device name when available", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(
                createMockAnalysis({ deviceName: "FTMS Rower" }),
            );
            await fixture.whenStable();

            const deviceName = fixture.nativeElement.querySelector(".device-name");

            expect(deviceName.textContent).toContain("FTMS Rower");
        });

        it("should not display device name when undefined", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(
                createMockAnalysis({ deviceName: undefined }),
            );
            await fixture.whenStable();

            const deviceName = fixture.nativeElement.querySelector(".device-name");

            expect(deviceName).toBeNull();
        });

        it("should hide device name in error state", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(
                createMockAnalysis({ deviceName: "FTMS Rower" }),
            );
            await fixture.whenStable();

            component.error.set("Some error");
            fixture.detectChanges();

            const deviceName = fixture.nativeElement.querySelector(".device-name");

            expect(deviceName).toBeNull();
        });

        it("should navigate back when toolbar back button is clicked", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            const backButton = fixture.nativeElement.querySelector(
                "mat-toolbar button[aria-label='Back to dashboard']",
            );
            backButton.click();

            expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
        });
    });
});
