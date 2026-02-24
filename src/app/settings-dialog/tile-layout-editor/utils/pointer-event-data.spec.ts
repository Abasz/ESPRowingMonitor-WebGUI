import { describe, expect, it, vi } from "vitest";

import { pointerEventFromMouse, pointerEventFromTouch } from "./pointer-event-data";

describe("PointerEventData", (): void => {
    describe("pointerEventFromMouse function", (): void => {
        it("should extract clientX and clientY from MouseEvent", (): void => {
            const mouseEvent = new MouseEvent("mousedown", { clientX: 150, clientY: 200 });

            const result = pointerEventFromMouse(mouseEvent);

            expect(result.clientX).toBe(150);
            expect(result.clientY).toBe(200);
        });

        it("should set sourceElement to currentTarget", (): void => {
            const mouseEvent = new MouseEvent("mousedown");
            const element = document.createElement("div");
            Object.defineProperty(mouseEvent, "currentTarget", { value: element });

            const result = pointerEventFromMouse(mouseEvent);

            expect(result.sourceElement).toBe(element);
        });

        it("should delegate preventDefault to the original event", (): void => {
            const mouseEvent = new MouseEvent("mousedown", { cancelable: true });
            const preventDefaultSpy = vi.spyOn(mouseEvent, "preventDefault");

            const result = pointerEventFromMouse(mouseEvent);
            result.preventDefault();

            expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
        });

        it("should delegate stopPropagation to the original event", (): void => {
            const mouseEvent = new MouseEvent("mousedown");
            const stopPropagationSpy = vi.spyOn(mouseEvent, "stopPropagation");

            const result = pointerEventFromMouse(mouseEvent);
            result.stopPropagation();

            expect(stopPropagationSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("pointerEventFromTouch function", (): void => {
        it("should extract clientX and clientY from Touch object", (): void => {
            const touch = { clientX: 75, clientY: 120 } as Touch;
            const touchEvent = new TouchEvent("touchstart");

            const result = pointerEventFromTouch(touchEvent, touch);

            expect(result.clientX).toBe(75);
            expect(result.clientY).toBe(120);
        });

        it("should set sourceElement to currentTarget of TouchEvent", (): void => {
            const touch = { clientX: 0, clientY: 0 } as Touch;
            const touchEvent = new TouchEvent("touchstart");
            const element = document.createElement("div");
            Object.defineProperty(touchEvent, "currentTarget", { value: element });

            const result = pointerEventFromTouch(touchEvent, touch);

            expect(result.sourceElement).toBe(element);
        });

        it("should delegate preventDefault to the original TouchEvent", (): void => {
            const touch = { clientX: 0, clientY: 0 } as Touch;
            const touchEvent = new TouchEvent("touchstart", { cancelable: true });
            const preventDefaultSpy = vi.spyOn(touchEvent, "preventDefault");

            const result = pointerEventFromTouch(touchEvent, touch);
            result.preventDefault();

            expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
        });

        it("should delegate stopPropagation to the original TouchEvent", (): void => {
            const touch = { clientX: 0, clientY: 0 } as Touch;
            const touchEvent = new TouchEvent("touchstart");
            const stopPropagationSpy = vi.spyOn(touchEvent, "stopPropagation");

            const result = pointerEventFromTouch(touchEvent, touch);
            result.stopPropagation();

            expect(stopPropagationSpy).toHaveBeenCalledTimes(1);
        });
    });
});
