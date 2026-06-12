import { describe, expect, it } from "vitest";

import { isKayakErgometer } from "./utility.functions";

describe("isKayakErgometer", (): void => {
    describe("when device name contains a kayak pattern", (): void => {
        it("should return true for a name containing 'kayak'", (): void => {
            expect(isKayakErgometer("MyKayakErgo")).toBe(true);
        });

        it("should return true for a case-insensitive match", (): void => {
            expect(isKayakErgometer("KAYAK 2000")).toBe(true);
        });

        it("should return true for a name containing 'olddanube'", (): void => {
            expect(isKayakErgometer("OldDanube Ergo")).toBe(true);
        });
    });

    describe("when device name does not match any pattern", (): void => {
        it("should return false for a regular rowing device", (): void => {
            expect(isKayakErgometer("ESP Rowing Monitor")).toBe(false);
        });

        it("should return false for undefined", (): void => {
            expect(isKayakErgometer(undefined)).toBe(false);
        });

        it("should return false for an empty string", (): void => {
            expect(isKayakErgometer("")).toBe(false);
        });
    });
});
