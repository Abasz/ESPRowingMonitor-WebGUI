import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ISessionSummary } from "../../common/common.interfaces";
import { DataRecorderService } from "../../common/services/data-recorder.service";

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

const mockSessions: Array<ISessionSummary> = [
    {
        sessionId: 1700000000000,
        deviceName: "TestDevice",
        startTime: 1700000000000,
        finishTime: 1700000060000,
        elapsedTime: 60,
        distance: 25000,
        strokeCount: 20,
    },
    {
        sessionId: 1700100000000,
        deviceName: "OtherDevice",
        startTime: 1700100000000,
        finishTime: 1700100120000,
        elapsedTime: 120,
        distance: 50000,
        strokeCount: 40,
    },
];

describe("SessionDetailComponent", (): void => {
    let component: SessionDetailComponent;
    let fixture: ComponentFixture<SessionDetailComponent>;
    let mockSessionAnalysis: Pick<SessionAnalysisService, "loadSession" | "loadFromJson">;
    let mockDataRecorder: Pick<DataRecorderService, "getSessionSummaries$">;
    let mockRouter: Pick<Router, "navigate">;
    let paramMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

    beforeEach(async (): Promise<void> => {
        paramMapSubject = new BehaviorSubject(convertToParamMap({ id: "1700000000000" }));
        mockSessionAnalysis = { loadSession: vi.fn(), loadFromJson: vi.fn() };
        mockDataRecorder = { getSessionSummaries$: vi.fn().mockReturnValue(of(mockSessions)) };
        mockRouter = { navigate: vi.fn().mockResolvedValue(true) };

        await TestBed.configureTestingModule({
            imports: [SessionDetailComponent],
            providers: [
                {
                    provide: ActivatedRoute,
                    useValue: { paramMap: paramMapSubject.asObservable() },
                },
                { provide: Router, useValue: mockRouter },
                { provide: SessionAnalysisService, useValue: mockSessionAnalysis },
                { provide: DataRecorderService, useValue: mockDataRecorder },
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
            paramMapSubject.next(convertToParamMap({ id: "abc" }));
            fixture.detectChanges();

            expect(component.error()).toBe("Invalid session ID");
            expect(component.loading()).toBe(false);
            expect(fixture.nativeElement.querySelector(".error-container")).toBeTruthy();
        });

        it("should show error when ID is missing", (): void => {
            paramMapSubject.next(convertToParamMap({}));
            fixture.detectChanges();

            expect(component.error()).toBe("Invalid session ID");
            expect(component.loading()).toBe(false);
        });

        it("should still show toolbar when error is displayed", (): void => {
            paramMapSubject.next(convertToParamMap({ id: "abc" }));
            fixture.detectChanges();

            expect(fixture.nativeElement.querySelector("mat-toolbar")).toBeTruthy();
            expect(fixture.nativeElement.querySelector("button[aria-label='Open JSON file']")).toBeTruthy();
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
            expect(component.filterControl.value).toBe("");
        });

        it("should show error when load fails", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockRejectedValue(new Error("Database error"));
            await fixture.whenStable();

            expect(component.error()).toBe("Database error");
            expect(component.filterControl.value).toBe("");
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
            paramMapSubject.next(convertToParamMap({ id: "abc" }));
            fixture.detectChanges();

            const backButton = fixture.nativeElement.querySelector(".error-container button");
            backButton.click();

            expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
        });
    });

    describe("as part of session toolbar", (): void => {
        it("should display toolbar with session autocomplete", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            const toolbar = fixture.nativeElement.querySelector("mat-toolbar");

            expect(toolbar).toBeTruthy();

            const input = toolbar.querySelector("input[matInput]");

            expect(input).toBeTruthy();
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

    describe("as part of session switcher", (): void => {
        it("should populate sessions from DataRecorderService", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            expect(component.filteredSessions()).toEqual(mockSessions);
        });

        it("should render autocomplete input with current session date", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            const input: HTMLInputElement = fixture.nativeElement.querySelector(
                "mat-toolbar input[matInput]",
            );

            expect(input).toBeTruthy();
            expect(component.filterControl.value).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        it("should navigate to selected session", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            await component.onSessionSelected(1700100000000);

            expect(mockRouter.navigate).toHaveBeenCalledWith(["/session", 1700100000000]);
        });

        it("should not navigate when selecting the current session", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            component.onSessionSelected(1700000000000);

            expect(mockRouter.navigate).not.toHaveBeenCalled();
        });

        it("should handle non-string filter values from autocomplete selection", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            component.filterControl.setValue(1700100000000 as unknown as string);

            expect((): void => {
                component.filteredSessions();
            }).not.toThrow();
            expect(component.filteredSessions().length).toBe(2);
        });

        it("should filter sessions by search term", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            component.filterControl.setValue("OtherDevice");

            expect(component.filteredSessions().length).toBe(1);
            expect(component.filteredSessions()[0].sessionId).toBe(1700100000000);
        });

        it("should show all sessions when filter is empty", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            component.filterControl.setValue("");

            expect(component.filteredSessions().length).toBe(2);
        });

        it("should not set display text before session loads", (): void => {
            vi.mocked(mockSessionAnalysis.loadSession).mockReturnValue(
                new Promise((): void => {
                    // never resolves
                }),
            );
            fixture.detectChanges();

            expect(component.filterControl.value).toBe("");
        });

        it("should restore current session date when input loses focus with empty filter", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            component.filterControl.setValue("");

            component.onAutocompleteClosed();

            expect(component.filterControl.value).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        it("should not restore session date when filter has text", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            component.filterControl.setValue("some search text");

            component.onAutocompleteClosed();

            expect(component.filterControl.value).toBe("some search text");
        });

        it("should select active option when autocomplete opens", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const input: HTMLInputElement = fixture.nativeElement.querySelector(
                "mat-toolbar input[matInput]",
            );
            input.focus();
            input.dispatchEvent(new Event("focusin"));
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const selectedOptions = document.querySelectorAll("mat-option.mdc-list-item--selected");

            expect(selectedOptions.length).toBe(1);
        });

        it("should not throw when selectActiveOption is called without analysis", (): void => {
            expect((): void => {
                component.selectActiveOption();
            }).not.toThrow();
        });

        it("should reload when route param changes", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(
                createMockAnalysis({ sessionId: 1700100000000 }),
            );
            paramMapSubject.next(convertToParamMap({ id: "1700100000000" }));
            await fixture.whenStable();

            expect(mockSessionAnalysis.loadSession).toHaveBeenCalledTimes(2);
            expect(mockSessionAnalysis.loadSession).toHaveBeenLastCalledWith(1700100000000);
        });
    });

    describe("as part of JSON file import", (): void => {
        const createFileEvent = (content: string, filename: string = "session.json"): Event => {
            const file = new File([content], filename, { type: "application/json" });
            const input = document.createElement("input");
            Object.defineProperty(input, "files", { value: [file] });

            return { target: input } as unknown as Event;
        };

        const validExportJson = JSON.stringify({
            sessionId: 1700200000000,
            records: [{ timeStamp: "2023-11-17T00:00:00Z", elapsedTime: 1, speed: 4, strokeCount: 1 }],
            handleForces: {},
        });

        it("should load session from valid JSON file", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            vi.mocked(mockSessionAnalysis.loadFromJson).mockReturnValue(
                createMockAnalysis({ sessionId: 1700200000000, deviceName: "ImportedDevice" }),
            );

            const event = createFileEvent(validExportJson, "my-session.json");
            await component.onFileSelected(event);

            expect(mockSessionAnalysis.loadFromJson).toHaveBeenCalled();
            expect(component.analysis()?.deviceName).toBe("ImportedDevice");
        });

        it("should set Unknown as fallback device name when not in data", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            vi.mocked(mockSessionAnalysis.loadFromJson).mockReturnValue(createMockAnalysis());

            const event = createFileEvent(validExportJson);
            await component.onFileSelected(event);

            const callArg = vi.mocked(mockSessionAnalysis.loadFromJson).mock.calls[0][0];
            expect(callArg.deviceName).toBe("Unknown");
        });

        it("should show error for empty records", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const event = createFileEvent(JSON.stringify({ sessionId: 1, records: [], handleForces: {} }));
            await component.onFileSelected(event);

            expect(component.error()).toBe("JSON file contains no session data");
        });

        it("should show error for invalid JSON", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const event = createFileEvent("not valid json");
            await component.onFileSelected(event);

            expect(component.error()).toBe("Failed to parse JSON file");
        });

        it("should do nothing when no file is selected", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const input = document.createElement("input");
            const event = { target: input } as unknown as Event;
            await component.onFileSelected(event);

            expect(mockSessionAnalysis.loadFromJson).not.toHaveBeenCalled();
        });

        it("should render upload button in toolbar", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const uploadButton = fixture.nativeElement.querySelector("button[aria-label='Open JSON file']");

            expect(uploadButton).toBeTruthy();
        });

        it("should reset file input after selection", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            vi.mocked(mockSessionAnalysis.loadFromJson).mockReturnValue(createMockAnalysis());

            const file = new File([validExportJson], "session.json", { type: "application/json" });
            const input = document.createElement("input");
            Object.defineProperty(input, "files", { value: [file], writable: true });
            const event = { target: input } as unknown as Event;
            await component.onFileSelected(event);

            expect(input.value).toBe("");
        });

        it("should update route with imported session ID", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            vi.mocked(mockSessionAnalysis.loadFromJson).mockReturnValue(
                createMockAnalysis({ sessionId: 1700200000000 }),
            );

            const event = createFileEvent(validExportJson);
            await component.onFileSelected(event);

            expect(mockRouter.navigate).toHaveBeenCalledWith(["/session", 1700200000000], {
                replaceUrl: true,
            });
        });

        it("should load DB session after importing a JSON file", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            vi.mocked(mockSessionAnalysis.loadFromJson).mockReturnValue(
                createMockAnalysis({ sessionId: 1700200000000, deviceName: "ImportedDevice" }),
            );

            const event = createFileEvent(validExportJson);
            await component.onFileSelected(event);

            expect(component.analysis()?.sessionId).toBe(1700200000000);

            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(
                createMockAnalysis({ sessionId: 1700100000000, deviceName: "OtherDevice" }),
            );
            paramMapSubject.next(convertToParamMap({ id: "1700100000000" }));
            await fixture.whenStable();

            expect(mockSessionAnalysis.loadSession).toHaveBeenLastCalledWith(1700100000000);
            expect(component.analysis()?.sessionId).toBe(1700100000000);
        });

        it("should add imported session to autocomplete list", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            vi.mocked(mockSessionAnalysis.loadFromJson).mockReturnValue(
                createMockAnalysis({ sessionId: 1700200000000, deviceName: "ImportedDevice" }),
            );

            const event = createFileEvent(validExportJson);
            await component.onFileSelected(event);

            component.filterControl.setValue("");

            expect(component.filteredSessions().length).toBe(3);
            expect(
                component
                    .filteredSessions()
                    .some((s: ISessionSummary): boolean => s.sessionId === 1700200000000),
            ).toBe(true);
        });

        it("should not add duplicate entry when same file is imported twice", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            vi.mocked(mockSessionAnalysis.loadFromJson).mockReturnValue(
                createMockAnalysis({ sessionId: 1700200000000, deviceName: "ImportedDevice" }),
            );

            await component.onFileSelected(createFileEvent(validExportJson));
            await component.onFileSelected(createFileEvent(validExportJson));

            component.filterControl.setValue("");

            const importedCount = component
                .filteredSessions()
                .filter((s: ISessionSummary): boolean => s.sessionId === 1700200000000).length;

            expect(importedCount).toBe(1);
            expect(component.filteredSessions().length).toBe(3);
        });

        describe("during initial load should set loading to false", (): void => {
            it("when JSON has empty records", async (): Promise<void> => {
                vi.mocked(mockSessionAnalysis.loadSession).mockReturnValue(
                    new Promise((): void => {
                        // never resolves — initial load still in progress
                    }),
                );
                fixture.detectChanges();

                expect(component.loading()).toBe(true);

                const event = createFileEvent(
                    JSON.stringify({ sessionId: 1, records: [], handleForces: {} }),
                );
                await component.onFileSelected(event);

                expect(component.loading()).toBe(false);
                expect(component.error()).toBe("JSON file contains no session data");

                fixture.detectChanges();

                expect(fixture.nativeElement.querySelector("mat-spinner")).toBeNull();
                expect(fixture.nativeElement.querySelector(".error-container")).toBeTruthy();
            });

            it("when JSON is invalid", async (): Promise<void> => {
                vi.mocked(mockSessionAnalysis.loadSession).mockReturnValue(
                    new Promise((): void => {
                        // never resolves
                    }),
                );
                fixture.detectChanges();

                expect(component.loading()).toBe(true);

                const event = createFileEvent("not valid json");
                await component.onFileSelected(event);

                expect(component.loading()).toBe(false);
                expect(component.error()).toBe("Failed to parse JSON file");

                fixture.detectChanges();

                expect(fixture.nativeElement.querySelector("mat-spinner")).toBeNull();
                expect(fixture.nativeElement.querySelector(".error-container")).toBeTruthy();
            });
        });
    });

    describe("as part of session filtering by date", (): void => {
        it("should filter sessions by date substring", async (): Promise<void> => {
            vi.mocked(mockSessionAnalysis.loadSession).mockResolvedValue(createMockAnalysis());
            await fixture.whenStable();

            const dateStr = component.formatSessionDate(mockSessions[0].sessionId);
            const datePrefix = dateStr.substring(0, 10);

            component.filterControl.setValue(datePrefix);

            const filtered = component.filteredSessions();

            expect(filtered.length).toBeGreaterThanOrEqual(1);
            expect(
                filtered.every((session: ISessionSummary): boolean =>
                    component.formatSessionDate(session.sessionId).includes(datePrefix),
                ),
            ).toBe(true);
        });
    });

    describe("as part of race condition handling", (): void => {
        it("should discard stale load results when a newer load is initiated", async (): Promise<void> => {
            let resolveFirst!: (value: ISessionAnalysis) => void;
            let resolveSecond!: (value: ISessionAnalysis) => void;

            vi.mocked(mockSessionAnalysis.loadSession)
                .mockImplementationOnce(
                    (): Promise<ISessionAnalysis> =>
                        new Promise((resolve: (value: ISessionAnalysis) => void): void => {
                            resolveFirst = resolve;
                        }),
                )
                .mockImplementationOnce(
                    (): Promise<ISessionAnalysis> =>
                        new Promise((resolve: (value: ISessionAnalysis) => void): void => {
                            resolveSecond = resolve;
                        }),
                );

            fixture.detectChanges();

            paramMapSubject.next(convertToParamMap({ id: "1700100000000" }));

            resolveSecond(createMockAnalysis({ sessionId: 1700100000000 }));
            await fixture.whenStable();

            resolveFirst(createMockAnalysis({ sessionId: 1700000000000 }));
            await fixture.whenStable();

            expect(component.analysis()?.sessionId).toBe(1700100000000);
        });
    });
});
