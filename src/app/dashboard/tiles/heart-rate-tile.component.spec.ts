import { ComponentFixture, TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { IHeartRate } from "../../../common/common.interfaces";

import { HeartRateTileComponent } from "./heart-rate-tile.component";

describe("HeartRateTileComponent", (): void => {
    let component: HeartRateTileComponent;
    let fixture: ComponentFixture<HeartRateTileComponent>;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [HeartRateTileComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(HeartRateTileComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput("label", "Heart Rate");
        fixture.componentRef.setInput("icon", "ecg_heart");
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });
    });

    describe("displayHeartRate computed signal", (): void => {
        it("should return heart rate value when contact is detected", (): void => {
            fixture.componentRef.setInput("heartRateData", { heartRate: 75, contactDetected: true });

            expect(component.displayHeartRate()).toBe(75);
        });

        it("should return 0 when contact is not detected", (): void => {
            fixture.componentRef.setInput("heartRateData", { heartRate: 75, contactDetected: false });

            expect(component.displayHeartRate()).toBe(0);
        });

        it("should return 0 when heartRateData is undefined", (): void => {
            fixture.componentRef.setInput("heartRateData", undefined);

            expect(component.displayHeartRate()).toBe(0);
        });

        it("should return 0 when contactDetected is undefined", (): void => {
            fixture.componentRef.setInput("heartRateData", { heartRate: 80 } as IHeartRate);

            expect(component.displayHeartRate()).toBe(0);
        });

        it("should update when heartRateData changes", (): void => {
            fixture.componentRef.setInput("heartRateData", { heartRate: 80, contactDetected: true });
            expect(component.displayHeartRate()).toBe(80);

            fixture.componentRef.setInput("heartRateData", { heartRate: 100, contactDetected: true });
            expect(component.displayHeartRate()).toBe(100);

            fixture.componentRef.setInput("heartRateData", { heartRate: 100, contactDetected: false });
            expect(component.displayHeartRate()).toBe(0);
        });
    });

    describe("heart rate value display", (): void => {
        it("should display heart rate value when contact is detected", async (): Promise<void> => {
            fixture.componentRef.setInput("heartRateData", { heartRate: 75, contactDetected: true });
            fixture.detectChanges();
            await fixture.whenStable();

            const valueEl = fixture.nativeElement.querySelector(".value > span:first-child");
            expect(valueEl?.textContent?.trim()).toBe("75");
        });

        it("should display dash when contact is not detected", async (): Promise<void> => {
            fixture.componentRef.setInput("heartRateData", { heartRate: 75, contactDetected: false });
            fixture.detectChanges();
            await fixture.whenStable();

            const valueEl = fixture.nativeElement.querySelector(".value > span:first-child");
            expect(valueEl?.textContent?.trim()).toBe("--");
        });

        it("should display dash when heartRateData is undefined", async (): Promise<void> => {
            fixture.componentRef.setInput("heartRateData", undefined);
            fixture.detectChanges();
            await fixture.whenStable();

            const valueEl = fixture.nativeElement.querySelector(".value > span:first-child");
            expect(valueEl?.textContent?.trim()).toBe("--");
        });

        it("should update displayed value when contact state changes", async (): Promise<void> => {
            fixture.componentRef.setInput("heartRateData", { heartRate: 80, contactDetected: false });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(
                fixture.nativeElement.querySelector(".value > span:first-child")?.textContent?.trim(),
            ).toBe("--");

            fixture.componentRef.setInput("heartRateData", { heartRate: 80, contactDetected: true });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(
                fixture.nativeElement.querySelector(".value > span:first-child")?.textContent?.trim(),
            ).toBe("80");
        });
    });

    describe("battery level icon", (): void => {
        it("should render battery icon when batteryLevel is present", async (): Promise<void> => {
            fixture.componentRef.setInput("heartRateData", {
                heartRate: 75,
                contactDetected: true,
                batteryLevel: 90,
            });
            fixture.detectChanges();
            await fixture.whenStable();

            const matIcons = fixture.nativeElement.querySelectorAll("mat-icon");
            expect(matIcons.length).toBe(2);
        });

        it("should not render battery icon when batteryLevel is absent", async (): Promise<void> => {
            fixture.componentRef.setInput("heartRateData", { heartRate: 75, contactDetected: true });
            fixture.detectChanges();
            await fixture.whenStable();

            const matIcons = fixture.nativeElement.querySelectorAll("mat-icon");
            expect(matIcons.length).toBe(1);
        });

        it("should remove battery icon when batteryLevel is removed", async (): Promise<void> => {
            fixture.componentRef.setInput("heartRateData", {
                heartRate: 75,
                contactDetected: true,
                batteryLevel: 75,
            });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelectorAll("mat-icon").length).toBe(2);

            fixture.componentRef.setInput("heartRateData", { heartRate: 75, contactDetected: true });
            fixture.detectChanges();
            await fixture.whenStable();

            expect(fixture.nativeElement.querySelectorAll("mat-icon").length).toBe(1);
        });
    });
});
