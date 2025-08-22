import { HarnessLoader } from "@angular/cdk/testing";
import { TestbedHarnessEnvironment } from "@angular/cdk/testing/testbed";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatCardHarness } from "@angular/material/card/testing";
import { MatIconHarness } from "@angular/material/icon/testing";
import { MatTooltipHarness } from "@angular/material/tooltip/testing";

import { MetricComponent } from "./metric.component";

describe("MetricComponent", (): void => {
    let component: MetricComponent;
    let fixture: ComponentFixture<MetricComponent>;
    let loader: HarnessLoader;

    beforeEach(async (): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [MetricComponent],
            providers: [provideZonelessChangeDetection()],
        }).compileComponents();

        fixture = TestBed.createComponent(MetricComponent);
        component = fixture.componentInstance;
        loader = TestbedHarnessEnvironment.loader(fixture);
    });

    describe("as part of component creation", (): void => {
        it("should create the component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should initialize icon input signal", (): void => {
            expect(component.icon()).toBeUndefined();
        });

        it("should initialize title input signal", (): void => {
            expect(component.title()).toBeUndefined();
        });

        it("should initialize unit input signal", (): void => {
            expect(component.unit()).toBeUndefined();
        });

        it("should render string value correctly", (): void => {
            fixture.componentRef.setInput("value", "test-value");
            fixture.detectChanges();

            const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");
            expect(valueSpan.textContent.trim()).toBe("test-value");

            fixture.componentRef.setInput("value", 42);
            fixture.detectChanges();

            const valueSpanNumber = fixture.nativeElement.querySelector("div.value span:first-child");
            expect(valueSpanNumber.textContent.trim()).toBe("42");
            expect(component.value()).toBe(42);
        });
    });

    describe("as part of template rendering", (): void => {
        describe("mat-card element", (): void => {
            it("should render mat-card element", async (): Promise<void> => {
                fixture.componentRef.setInput("value", "test");
                fixture.detectChanges();

                const cardHarness = await loader.getHarness(MatCardHarness);
                expect(cardHarness).toBeTruthy();
            });

            it("should apply correct CSS class to mat-card", (): void => {
                fixture.componentRef.setInput("value", "test");
                fixture.detectChanges();

                const matCard = fixture.nativeElement.querySelector("mat-card");
                expect(matCard).toBeTruthy();
                expect(matCard.classList).toContain("justify-center");
            });
        });

        describe("when icon is provided", (): void => {
            beforeEach((): void => {
                fixture.componentRef.setInput("icon", "test-icon");
                fixture.componentRef.setInput("value", "123");
                fixture.componentRef.setInput("title", "Test Title");
                fixture.detectChanges();
            });

            it("should render mat-icon element", async (): Promise<void> => {
                const iconHarness = await loader.getHarness(MatIconHarness);
                expect(iconHarness).toBeTruthy();
            });

            it("should display correct icon name", async (): Promise<void> => {
                const iconHarness = await loader.getHarness(MatIconHarness);
                const iconName = await iconHarness.getName();
                expect(iconName).toBe("test-icon");
            });

            it("should not render title span", (): void => {
                const titleSpan = fixture.nativeElement.querySelector("span.title");
                expect(titleSpan).toBeFalsy();
            });

            it("should have a tooltip attached to the icon", async (): Promise<void> => {
                const tooltips = await loader.getAllHarnesses(MatTooltipHarness);

                expect(tooltips).toHaveSize(1);
            });

            it("should show tooltip text equal to title input", async (): Promise<void> => {
                const tooltip = await loader.getHarness(MatTooltipHarness);

                await tooltip.show();

                expect(await tooltip.getTooltipText()).toBe("Test Title");
            });

            it("should set tooltip position to above", async (): Promise<void> => {
                const matIcon = fixture.nativeElement.querySelector("mat-icon");

                expect(matIcon.getAttribute("mattooltipposition")).toBe("above");
            });

            it("should set tooltip show delay to 1000ms", async (): Promise<void> => {
                const matIcon = fixture.nativeElement.querySelector("mat-icon");

                expect(matIcon.getAttribute("mattooltipshowdelay")).toBe("1000");
            });
        });

        describe("when icon is undefined", (): void => {
            beforeEach((): void => {
                fixture.componentRef.setInput("icon", undefined);
                fixture.componentRef.setInput("value", "123");
                fixture.componentRef.setInput("title", "Test Title");
                fixture.detectChanges();
            });

            it("should not render mat-icon element", async (): Promise<void> => {
                try {
                    await loader.getHarness(MatIconHarness);
                    fail("Expected MatIconHarness not to be found");
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });

            it("should render title span element", (): void => {
                const titleSpan = fixture.nativeElement.querySelector("span.title");

                expect(titleSpan).toBeTruthy();
            });

            it("should display title text in span", (): void => {
                const titleSpan = fixture.nativeElement.querySelector("span.title");

                expect(titleSpan.textContent.trim()).toBe("Test Title");
            });

            it("should apply title CSS class to span", (): void => {
                const titleSpan = fixture.nativeElement.querySelector("span.title");

                expect(titleSpan.classList).toContain("title");
            });
        });

        describe("value display", (): void => {
            beforeEach((): void => {
                fixture.componentRef.setInput("value", "123");
                fixture.componentRef.setInput("unit", "kg");
                fixture.detectChanges();
            });

            it("should render value div container", (): void => {
                const valueDiv = fixture.nativeElement.querySelector("div.value");

                expect(valueDiv).toBeTruthy();
            });

            it("should apply value CSS class to div", (): void => {
                const valueDiv = fixture.nativeElement.querySelector("div.value");

                expect(valueDiv.classList).toContain("value");
            });

            it("should render value span element", (): void => {
                const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");

                expect(valueSpan).toBeTruthy();
            });

            it("should display value content", (): void => {
                const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");

                expect(valueSpan.textContent.trim()).toBe("123");
            });

            it("should render unit span element", (): void => {
                const unitSpan = fixture.nativeElement.querySelector("span.unit");

                expect(unitSpan).toBeTruthy();
            });

            it("should apply unit CSS class to span", (): void => {
                const unitSpan = fixture.nativeElement.querySelector("span.unit");

                expect(unitSpan.classList).toContain("unit");
            });
        });

        describe("value input signal", (): void => {
            describe("with string value", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("value", "test-string");
                    fixture.detectChanges();
                });

                it("should display string value correctly", (): void => {
                    const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");

                    expect(valueSpan.textContent.trim()).toBe("test-string");
                });

                it("should return string from value signal", (): void => {
                    expect(component.value()).toBe("test-string");
                });
            });

            describe("with number value", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("value", 42);
                    fixture.detectChanges();
                });

                it("should display number value correctly", (): void => {
                    const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");

                    expect(valueSpan.textContent.trim()).toBe("42");
                });

                it("should return number from value signal", (): void => {
                    expect(component.value()).toBe(42);
                });
            });

            describe("with decimal number value", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("value", 42.5);
                    fixture.detectChanges();
                });

                it("should display decimal number correctly", (): void => {
                    const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");

                    expect(valueSpan.textContent.trim()).toBe("42.5");
                });
            });

            it("with zero value should display correctly", (): void => {
                fixture.componentRef.setInput("value", 0);
                fixture.detectChanges();

                const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");

                expect(valueSpan.textContent.trim()).toBe("0");
            });
        });

        describe("title input signal", (): void => {
            describe("when title is provided", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("title", "Test Title");
                    fixture.componentRef.setInput("value", "123");
                    fixture.detectChanges();
                });

                it("should return title from signal", (): void => {
                    expect(component.title()).toBe("Test Title");
                });

                describe("without icon", (): void => {
                    it("should display title in span element", (): void => {
                        const titleSpan = fixture.nativeElement.querySelector("span.title");

                        expect(titleSpan.textContent.trim()).toBe("Test Title");
                    });
                });
            });

            describe("when title is undefined", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("title", undefined);
                    fixture.componentRef.setInput("value", "123");
                    fixture.detectChanges();
                });

                it("should return undefined from signal", (): void => {
                    expect(component.title()).toBeUndefined();
                });
            });
        });

        describe("unit input signal", (): void => {
            describe("when unit is provided", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("unit", "kg");
                    fixture.componentRef.setInput("value", "123");
                    fixture.detectChanges();
                });

                it("should return unit from signal", (): void => {
                    expect(component.unit()).toBe("kg");
                });

                it("should display unit in template", (): void => {
                    const unitSpan = fixture.nativeElement.querySelector("span.unit");

                    expect(unitSpan.textContent.trim()).toBe("kg");
                });
            });

            describe("when unit is undefined", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("unit", undefined);
                    fixture.componentRef.setInput("value", "123");
                    fixture.detectChanges();
                });

                it("should return undefined from signal", (): void => {
                    expect(component.unit()).toBeUndefined();
                });

                it("should render empty unit span", (): void => {
                    const unitSpan = fixture.nativeElement.querySelector("span.unit");

                    expect(unitSpan).toBeTruthy();
                    expect(unitSpan.textContent.trim()).toBe("");
                });
            });

            it("with empty string unit should display empty unit correctly", (): void => {
                fixture.componentRef.setInput("unit", "");
                fixture.componentRef.setInput("value", "123");
                fixture.detectChanges();

                const unitSpan = fixture.nativeElement.querySelector("span.unit");

                expect(unitSpan.textContent.trim()).toBe("");
            });
        });

        describe("icon input signal", (): void => {
            describe("when icon is provided", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("icon", "speed");
                    fixture.componentRef.setInput("value", "123");
                    fixture.detectChanges();
                });

                it("should return icon name from signal", (): void => {
                    expect(component.icon()).toBe("speed");
                });

                it("should trigger icon rendering path", (): void => {
                    const matIcon = fixture.nativeElement.querySelector("mat-icon");
                    const titleSpan = fixture.nativeElement.querySelector("span.title");

                    expect(matIcon).toBeTruthy();
                    expect(titleSpan).toBeFalsy();
                });
            });

            describe("when icon is undefined", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("icon", undefined);
                    fixture.componentRef.setInput("value", "123");
                    fixture.componentRef.setInput("title", "Test Title");
                    fixture.detectChanges();
                });

                it("should return undefined from signal", (): void => {
                    expect(component.icon()).toBeUndefined();
                });

                it("should trigger title rendering path", (): void => {
                    const matIcon = fixture.nativeElement.querySelector("mat-icon");
                    const titleSpan = fixture.nativeElement.querySelector("span.title");

                    expect(matIcon).toBeFalsy();
                    expect(titleSpan).toBeTruthy();
                });
            });

            describe("with empty string icon", (): void => {
                beforeEach((): void => {
                    fixture.componentRef.setInput("icon", "");
                    fixture.componentRef.setInput("value", "123");
                    fixture.detectChanges();
                });

                it("should treat empty string as truthy", (): void => {
                    expect(component.icon()).toBe("");
                });

                it("should not render mat-icon and show nothing when icon is empty string", async (): Promise<void> => {
                    fixture.componentRef.setInput("icon", "");
                    fixture.componentRef.setInput("title", "Test Title");
                    fixture.componentRef.setInput("value", "Test Value");
                    fixture.detectChanges();

                    const matIcon = fixture.nativeElement.querySelector("mat-icon");
                    expect(matIcon).toBe(null);

                    const titleElement = fixture.nativeElement.querySelector(".title");
                    expect(titleElement).toBe(null);
                });
            });
        });
    });

    describe("as part of input combinations", (): void => {
        describe("with all inputs provided", (): void => {
            it("should render complete metric display", (): void => {
                fixture.componentRef.setInput("icon", "star");
                fixture.componentRef.setInput("title", "Rating");
                fixture.componentRef.setInput("value", "4.5");
                fixture.componentRef.setInput("unit", "stars");
                fixture.detectChanges();

                const valueElement = fixture.nativeElement.querySelector(".value span:first-child");
                const unitElement = fixture.nativeElement.querySelector(".value .unit");

                expect(valueElement?.textContent?.trim()).toBe("4.5");
                expect(unitElement?.textContent?.trim()).toBe("stars");
                expect(component.icon()).toBe("star");
                expect(component.title()).toBe("Rating");
            });

            it("should prioritize icon over title display", async (): Promise<void> => {
                fixture.componentRef.setInput("icon", "home");
                fixture.componentRef.setInput("title", "Home Title");
                fixture.componentRef.setInput("value", "123");
                fixture.detectChanges();

                const matIcon = await loader.getHarness(MatIconHarness);
                expect(await matIcon.getName()).toBe("home");

                const titleElement = fixture.nativeElement.querySelector(".title");
                expect(titleElement).toBe(null);
            });

            it("should combine value and unit correctly", (): void => {
                fixture.componentRef.setInput("value", "42");
                fixture.componentRef.setInput("unit", "kg");
                fixture.detectChanges();

                const valueElement = fixture.nativeElement.querySelector(".value span:first-child");
                const unitElement = fixture.nativeElement.querySelector(".value .unit");

                expect(valueElement?.textContent?.trim()).toBe("42");
                expect(unitElement?.textContent?.trim()).toBe("kg");
            });
        });

        describe("with minimal inputs", (): void => {
            it("should render with only value", (): void => {
                fixture.componentRef.setInput("value", "123");
                fixture.detectChanges();

                const valueElement = fixture.nativeElement.querySelector(".value span:first-child");
                expect(valueElement?.textContent?.trim()).toBe("123");

                const matIcon = fixture.nativeElement.querySelector("mat-icon");
                expect(matIcon).toBe(null);

                const titleElement = fixture.nativeElement.querySelector(".title");
                expect(titleElement).toBeTruthy();
                expect(titleElement.textContent.trim()).toBe("");
            });

            it("should handle undefined optional inputs gracefully", (): void => {
                fixture.componentRef.setInput("value", "123");
                fixture.detectChanges();

                const valueElement = fixture.nativeElement.querySelector(".value span:first-child");
                expect(valueElement?.textContent?.trim()).toBe("123");
                expect(component.icon()).toBeUndefined();
                expect(component.title()).toBeUndefined();
                expect(component.unit()).toBeUndefined();
            });
        });
    });

    describe("as part of edge case handling", (): void => {
        describe("with special characters", (): void => {
            it("should handle special characters in title", (): void => {
                const titleWithSpecialChars = "Test & Title <script>alert('xss')</script> €";
                fixture.componentRef.setInput("title", titleWithSpecialChars);
                fixture.componentRef.setInput("value", "123");
                fixture.detectChanges();

                const titleSpan = fixture.nativeElement.querySelector("span.title");

                expect(titleSpan.textContent.trim()).toBe(titleWithSpecialChars);
                expect(titleSpan.innerHTML).not.toContain("<script>");
            });

            it("should handle special characters in unit", (): void => {
                const unitWithSpecialChars = "m/s² & °C";
                fixture.componentRef.setInput("unit", unitWithSpecialChars);
                fixture.componentRef.setInput("value", "25");
                fixture.detectChanges();

                const unitSpan = fixture.nativeElement.querySelector("span.unit");
                expect(unitSpan.textContent.trim()).toBe(unitWithSpecialChars);
            });

            it("should handle special characters in value", (): void => {
                const valueWithSpecialChars = "< 0.01% & > 99%";
                fixture.componentRef.setInput("value", valueWithSpecialChars);
                fixture.detectChanges();

                const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");

                expect(valueSpan.textContent.trim()).toBe(valueWithSpecialChars);
                expect(valueSpan.innerHTML).toContain("&lt;");
            });
        });

        describe("with very long content", (): void => {
            it("should handle long title content", (): void => {
                const longTitle =
                    "Very Long Title That Might Overflow The Container Width " +
                    "And Should Be Handled Properly Without Breaking The Layout Or Causing Display Issues";
                fixture.componentRef.setInput("title", longTitle);
                fixture.componentRef.setInput("value", "123");
                fixture.detectChanges();

                const titleSpan = fixture.nativeElement.querySelector("span.title");
                expect(titleSpan.textContent.trim()).toBe(longTitle);
                expect(titleSpan).toBeTruthy();
            });

            it("should handle long value content", (): void => {
                const longValue =
                    "Very Long Value String That Should Be Handled Properly " +
                    "Without Breaking The Component Layout Or Causing Overflow Issues In The Display";
                fixture.componentRef.setInput("value", longValue);
                fixture.detectChanges();

                const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");
                expect(valueSpan.textContent.trim()).toBe(longValue);
                expect(valueSpan).toBeTruthy();
            });
        });

        describe("with numeric edge cases", (): void => {
            describe("with negative number", (): void => {
                it("should display negative number correctly", (): void => {
                    fixture.componentRef.setInput("value", -42.5);
                    fixture.detectChanges();

                    const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");
                    expect(valueSpan.textContent.trim()).toBe("-42.5");
                });
            });

            describe("with very large number", (): void => {
                it("should display large number correctly", (): void => {
                    fixture.componentRef.setInput("value", 1234567890.123);
                    fixture.detectChanges();

                    const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");
                    expect(valueSpan.textContent.trim()).toBe("1234567890.123");
                });
            });

            describe("with scientific notation", (): void => {
                it("should display scientific notation correctly", (): void => {
                    fixture.componentRef.setInput("value", 1.23e-10);
                    fixture.detectChanges();

                    const valueSpan = fixture.nativeElement.querySelector("div.value span:first-child");
                    expect(valueSpan.textContent.trim()).toBe("1.23e-10");
                });
            });
        });
    });
});
