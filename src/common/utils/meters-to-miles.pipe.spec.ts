import { describe, expect, it } from "vitest";

import { MetersToMilesPipe } from "./meters-to-miles.pipe";

describe("MetersToMilesPipe", (): void => {
    const pipe = new MetersToMilesPipe();

    it("should convert 0 meters to 0 miles", (): void => {
        expect(pipe.transform(0)).toBe(0);
    });

    it("should convert 1609.344 meters to approximately 1 mile", (): void => {
        expect(pipe.transform(1609.344)).toBeCloseTo(1, 4);
    });

    it("should convert 500 meters to approximately 0.3107 miles", (): void => {
        expect(pipe.transform(500)).toBeCloseTo(0.3107, 3);
    });

    it("should convert 2000 meters to approximately 1.2427 miles", (): void => {
        expect(pipe.transform(2000)).toBeCloseTo(1.2427, 3);
    });
});
