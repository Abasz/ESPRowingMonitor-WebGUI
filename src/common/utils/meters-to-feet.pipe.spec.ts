import { describe, expect, it } from "vitest";

import { MetersToFeetPipe } from "./meters-to-feet.pipe";

describe("MetersToFeetPipe", (): void => {
    const pipe = new MetersToFeetPipe();

    it("should convert 0 meters to 0 feet", (): void => {
        expect(pipe.transform(0)).toBe(0);
    });

    it("should convert 1 meter to approximately 3.28084 feet", (): void => {
        expect(pipe.transform(1)).toBeCloseTo(3.28084, 4);
    });

    it("should convert 10 meters to approximately 32.8084 feet", (): void => {
        expect(pipe.transform(10)).toBeCloseTo(32.8084, 3);
    });

    it("should convert typical distance per stroke value", (): void => {
        expect(pipe.transform(8.5)).toBeCloseTo(27.887, 2);
    });
});
