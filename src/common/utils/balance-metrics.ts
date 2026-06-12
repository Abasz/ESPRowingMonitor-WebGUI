export interface BalanceMetrics {
    powerBalance: number;
    ratios: ReadonlyArray<number>;
}

/**
 * The minimum number of stroke pairs required before a consistency (standard
 * deviation) value is considered statistically meaningful. With fewer pairs
 * the population std-dev is either 0 (single pair) or unreliable, which
 * would mislead users into thinking balance is consistently measured.
 */
export const MIN_BALANCE_PAIRS_FOR_CONSISTENCY = 3;

/**
 * Converts an array of session strokes to the input format expected by
 * {@link computeBalanceMetrics}, filtering out strokes with no handle-force
 * data and computing the mean force per stroke from the raw force array.
 */
export function strokesToBalanceInput(
    strokes: ReadonlyArray<{ strokeIndex: number; handleForces: ReadonlyArray<number> }>,
): Array<{ strokeCount: number; meanForce: number }> {
    return strokes
        .filter(
            (stroke: { strokeIndex: number; handleForces: ReadonlyArray<number> }): boolean =>
                stroke.handleForces.length > 0,
        )
        .map(
            (stroke: {
                strokeIndex: number;
                handleForces: ReadonlyArray<number>;
            }): { strokeCount: number; meanForce: number } => ({
                strokeCount: stroke.strokeIndex,
                meanForce:
                    stroke.handleForces.reduce((sum: number, force: number): number => sum + force, 0) /
                    stroke.handleForces.length,
            }),
        );
}

/**
 * Computes the power balance between the two sides of a kayak ergometer.
 *
 * Odd strokeCounts are treated as side A, even strokeCounts as side B.
 * Each side-A stroke is paired with the immediately following side-B stroke
 * (strokeCount + 1). The ratio for each pair is `forceA / (forceA + forceB)`.
 *
 * @returns `powerBalance` — mean ratio (0.5 = perfectly balanced; > 0.5 means side A is
 *   stronger); `ratios` — the per-pair ratio array, with length equal to the number of valid
 *   pairs found and useful for computing std dev (consistency).
 */
export function computeBalanceMetrics(
    strokes: ReadonlyArray<{ strokeCount: number; meanForce: number }>,
): BalanceMetrics {
    const byCount = new Map<number, number>(
        strokes.map((stroke: { strokeCount: number; meanForce: number }): [number, number] => [
            stroke.strokeCount,
            stroke.meanForce,
        ]),
    );
    const ratios: Array<number> = [];

    for (const { strokeCount, meanForce } of strokes) {
        if (strokeCount % 2 !== 1) {
            continue;
        }

        const partnerForce = byCount.get(strokeCount + 1);

        if (partnerForce === undefined) {
            continue;
        }

        const total = meanForce + partnerForce;

        if (total === 0) {
            continue;
        }

        ratios.push(meanForce / total);
    }

    if (ratios.length === 0) {
        return { powerBalance: 0.5, ratios: [] };
    }

    const powerBalance = ratios.reduce((sum: number, r: number): number => sum + r, 0) / ratios.length;

    return { powerBalance, ratios };
}
