import { describe, expect, it } from "vitest";

import { computeBalanceMetrics, strokesToBalanceInput } from "./balance-metrics";

describe("strokesToBalanceInput", (): void => {
    describe("when filtering strokes", (): void => {
        it("should exclude strokes with empty handle forces", (): void => {
            const result = strokesToBalanceInput([
                { strokeIndex: 1, handleForces: [] },
                { strokeIndex: 2, handleForces: [100, 200] },
            ]);

            expect(result).toHaveLength(1);
            expect(result[0].strokeCount).toBe(2);
        });
    });

    describe("when mapping strokes", (): void => {
        it("should map strokeIndex to strokeCount", (): void => {
            const result = strokesToBalanceInput([{ strokeIndex: 5, handleForces: [100] }]);

            expect(result[0].strokeCount).toBe(5);
        });

        it("should compute mean force from the handle forces array", (): void => {
            const result = strokesToBalanceInput([{ strokeIndex: 1, handleForces: [100, 200, 300] }]);

            expect(result[0].meanForce).toBeCloseTo(200);
        });
    });
});

describe("computeBalanceMetrics", (): void => {
    describe("when there are no strokes", (): void => {
        it("should return balanced defaults with zero pairs", (): void => {
            const result = computeBalanceMetrics([]);

            expect(result.powerBalance).toBe(0.5);
            expect(result.ratios).toHaveLength(0);
        });
    });

    describe("when there is only a single stroke", (): void => {
        it("should return balanced defaults because no pair can be formed", (): void => {
            const result = computeBalanceMetrics([{ strokeCount: 1, meanForce: 100 }]);

            expect(result.powerBalance).toBe(0.5);
            expect(result.ratios).toHaveLength(0);
        });
    });

    describe("when strokes form a perfectly balanced pair", (): void => {
        it("should return 0.5 balance", (): void => {
            const result = computeBalanceMetrics([
                { strokeCount: 1, meanForce: 100 },
                { strokeCount: 2, meanForce: 100 },
            ]);

            expect(result.powerBalance).toBe(0.5);
            expect(result.ratios).toEqual([0.5]);
        });
    });

    describe("when side A is stronger than side B", (): void => {
        it("should return a balance > 0.5", (): void => {
            const result = computeBalanceMetrics([
                { strokeCount: 1, meanForce: 120 },
                { strokeCount: 2, meanForce: 80 },
            ]);

            expect(result.powerBalance).toBeCloseTo(0.6);
            expect(result.ratios).toHaveLength(1);
        });
    });

    describe("when there are multiple valid pairs", (): void => {
        it("should compute the mean ratio across all pairs", (): void => {
            const result = computeBalanceMetrics([
                { strokeCount: 1, meanForce: 120 },
                { strokeCount: 2, meanForce: 80 },
                { strokeCount: 3, meanForce: 80 },
                { strokeCount: 4, meanForce: 120 },
            ]);

            // pair 1: 120/(120+80) = 0.6; pair 2: 80/(80+120) = 0.4; mean = 0.5
            expect(result.powerBalance).toBeCloseTo(0.5);
            expect(result.ratios).toHaveLength(2);
        });
    });

    describe("when a pair has zero combined force", (): void => {
        it("should skip the zero-force pair", (): void => {
            const result = computeBalanceMetrics([
                { strokeCount: 1, meanForce: 0 },
                { strokeCount: 2, meanForce: 0 },
                { strokeCount: 3, meanForce: 100 },
                { strokeCount: 4, meanForce: 100 },
            ]);

            expect(result.ratios).toHaveLength(1);
        });
    });

    describe("when a side-A stroke has no matching side-B partner", (): void => {
        it("should not count the unpaired stroke", (): void => {
            const result = computeBalanceMetrics([
                { strokeCount: 1, meanForce: 100 },
                { strokeCount: 3, meanForce: 100 },
            ]);

            expect(result.ratios).toHaveLength(0);
        });
    });

    describe("when strokes are provided out of order", (): void => {
        it("should still correctly pair odd and even strokes", (): void => {
            const result = computeBalanceMetrics([
                { strokeCount: 2, meanForce: 80 },
                { strokeCount: 1, meanForce: 120 },
            ]);

            expect(result.powerBalance).toBeCloseTo(0.6);
            expect(result.ratios).toHaveLength(1);
        });
    });
});
