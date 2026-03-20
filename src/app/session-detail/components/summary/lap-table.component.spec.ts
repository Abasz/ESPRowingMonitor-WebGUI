import { ComponentFixture, TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ILap } from "../../models/session-analysis.interfaces";

import { LapTableComponent } from "./lap-table.component";

const createMockLaps = (): Array<ILap> => [
    {
        lapNumber: 1,
        startIndex: 0,
        endIndex: 9,
        startTime: 0,
        endTime: 25,
        duration: 25,
        avgPower: 150,
        avgStrokeRate: 24,
        avgSpeed: 2.5,
        avgDistPerStroke: 10,
    },
    {
        lapNumber: 2,
        startIndex: 15,
        endIndex: 24,
        startTime: 40,
        endTime: 65,
        duration: 25,
        avgPower: 180,
        avgStrokeRate: 26,
        avgSpeed: 2.8,
        avgDistPerStroke: 11,
    },
];

describe("LapTableComponent", (): void => {
    let component: LapTableComponent;
    let fixture: ComponentFixture<LapTableComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [LapTableComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(LapTableComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("laps", createMockLaps());
        fixture.detectChanges();
    });

    describe("as part of table rendering", (): void => {
        it("should render header row", (): void => {
            const headerCells = fixture.nativeElement.querySelectorAll("mat-header-cell");

            expect(headerCells.length).toBe(7);
            expect(headerCells[0].textContent).toContain("Lap");
            expect(headerCells[1].textContent).toContain("Start");
            expect(headerCells[2].textContent).toContain("Duration");
        });

        it("should render one row per lap", (): void => {
            const rows = fixture.nativeElement.querySelectorAll("mat-row");

            expect(rows.length).toBe(2);
        });

        it("should display lap numbers", (): void => {
            const firstRowCells = fixture.nativeElement.querySelectorAll("mat-row:first-child mat-cell");

            expect(firstRowCells[0].textContent).toContain("1");
        });

        it("should format pace as time per 500m", (): void => {
            const firstRowCells = fixture.nativeElement.querySelectorAll("mat-row:first-child mat-cell");

            expect(firstRowCells[3].textContent).toMatch(/\d+:\d{2}/);
        });

        it("should format power in watts", (): void => {
            const firstRowCells = fixture.nativeElement.querySelectorAll("mat-row:first-child mat-cell");

            expect(firstRowCells[4].textContent).toContain("150");
            expect(firstRowCells[4].textContent).toContain("W");
        });

        it("should update when laps input changes", (): void => {
            fixture.componentRef.setInput("laps", [createMockLaps()[0]]);
            fixture.detectChanges();

            const rows = fixture.nativeElement.querySelectorAll("mat-row");

            expect(rows.length).toBe(1);
        });

        it("should display dash for pace when avgSpeed is zero", (): void => {
            const zeroSpeedLap: ILap = { ...createMockLaps()[0], avgSpeed: 0 };
            fixture.componentRef.setInput("laps", [zeroSpeedLap]);
            fixture.detectChanges();

            const firstRowCells = fixture.nativeElement.querySelectorAll("mat-row:first-child mat-cell");

            expect(firstRowCells[3].textContent).toContain("--");
        });
    });

    describe("as part of row selection", (): void => {
        it("should emit lapSelected when row is clicked", (): void => {
            const emitSpy = vi.spyOn(component.lapSelected, "emit");
            const firstRow: HTMLElement = fixture.nativeElement.querySelector("mat-row");

            firstRow.click();

            expect(emitSpy).toHaveBeenCalledWith(createMockLaps()[0]);
        });

        it("should highlight selected row", (): void => {
            fixture.componentRef.setInput("selectedLap", createMockLaps()[0]);
            fixture.detectChanges();

            const firstRow = fixture.nativeElement.querySelector("mat-row");

            expect(firstRow.classList.contains("selected")).toBe(true);
        });

        it("should not highlight unselected rows", (): void => {
            fixture.componentRef.setInput("selectedLap", createMockLaps()[0]);
            fixture.detectChanges();

            const rows = fixture.nativeElement.querySelectorAll("mat-row");

            expect(rows[1].classList.contains("selected")).toBe(false);
        });
    });
});
