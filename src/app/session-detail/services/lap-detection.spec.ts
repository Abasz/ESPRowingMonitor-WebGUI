import { describe, expect, it } from "vitest";

import { ILapEntity } from "../../../common/database.interfaces";
import { ISessionStroke } from "../models/session-analysis.interfaces";

import { buildLapsFromMarkers, detectLaps } from "./lap-detection";

const createStroke = (
    strokeIndex: number,
    elapsedTime: number,
    strokeRate: number,
    overrides?: Partial<ISessionStroke>,
): ISessionStroke => ({
    strokeIndex,
    timeStamp: 1700000000000 + elapsedTime * 1000,
    elapsedTime,
    speed: 2.5,
    avgStrokePower: 150,
    strokeRate,
    distPerStroke: 10,
    distance: 1000,
    driveDuration: 0.8,
    recoveryDuration: 1.7,
    dragFactor: 110,
    heartRate: undefined,
    peakForce: 200,
    peakForcePositionNorm: 50,
    driveLength: 0.8,
    handleForces: [20, 60, 100, 80, 40],
    ...overrides,
});

const createActiveStrokes = (
    count: number,
    startTime: number = 0,
    interval: number = 2.5,
): Array<ISessionStroke> =>
    Array.from(
        { length: count },
        (_value: unknown, index: number): ISessionStroke =>
            createStroke(index, startTime + index * interval, 24),
    );

describe("detectLaps", (): void => {
    describe("as part of edge case handling", (): void => {
        it("should return empty array for empty strokes", (): void => {
            expect(detectLaps([])).toEqual([]);
        });

        it("should return empty array when all strokes are inactive", (): void => {
            const strokes = Array.from(
                { length: 5 },
                (_value: unknown, index: number): ISessionStroke => createStroke(index, index * 2.5, 0),
            );

            expect(detectLaps(strokes)).toEqual([]);
        });

        it("should return empty array when active strokes are fewer than minimum", (): void => {
            const strokes = [createStroke(0, 0, 24), createStroke(1, 2.5, 24)];

            expect(detectLaps(strokes)).toEqual([]);
        });
    });

    describe("as part of continuous session detection", (): void => {
        it("should return single lap for continuous session", (): void => {
            const strokes = createActiveStrokes(10);

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(1);
            expect(laps[0].lapNumber).toBe(1);
            expect(laps[0].startIndex).toBe(0);
            expect(laps[0].endIndex).toBe(9);
        });

        it("should not split when pause is shorter than threshold", (): void => {
            const strokes = [
                ...createActiveStrokes(5),
                createStroke(5, 12, 0),
                ...createActiveStrokes(5, 14, 2.5).map(
                    (stroke: ISessionStroke, index: number): ISessionStroke => ({
                        ...stroke,
                        strokeIndex: 6 + index,
                    }),
                ),
            ];

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(1);
        });
    });

    describe("as part of pause detection", (): void => {
        it("should detect two laps with a pause in the middle", (): void => {
            const strokes = [
                ...createActiveStrokes(5),
                createStroke(5, 12.5, 0),
                createStroke(6, 15, 0),
                createStroke(7, 17.5, 0),
                ...createActiveStrokes(5, 20, 2.5).map(
                    (stroke: ISessionStroke, index: number): ISessionStroke => ({
                        ...stroke,
                        strokeIndex: 8 + index,
                    }),
                ),
            ];

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(2);
            expect(laps[0].lapNumber).toBe(1);
            expect(laps[0].startIndex).toBe(0);
            expect(laps[0].endIndex).toBe(4);
            expect(laps[1].lapNumber).toBe(2);
            expect(laps[1].startIndex).toBe(8);
            expect(laps[1].endIndex).toBe(12);
        });

        it("should detect pause from time gap without rest strokes", (): void => {
            const strokes = [
                ...createActiveStrokes(5),
                createStroke(5, 17.5, 1),
                ...createActiveStrokes(5, 20, 2.5).map(
                    (stroke: ISessionStroke, index: number): ISessionStroke => ({
                        ...stroke,
                        strokeIndex: 6 + index,
                    }),
                ),
            ];

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(2);
            expect(laps[0].endIndex).toBe(4);
            expect(laps[1].startIndex).toBe(6);
        });

        it("should detect multiple laps with multiple pauses", (): void => {
            const lap1 = createActiveStrokes(5, 0);
            const lap2 = createActiveStrokes(4, 20, 2.5).map(
                (stroke: ISessionStroke, index: number): ISessionStroke => ({
                    ...stroke,
                    strokeIndex: 5 + index,
                }),
            );
            const lap3 = createActiveStrokes(3, 40, 2.5).map(
                (stroke: ISessionStroke, index: number): ISessionStroke => ({
                    ...stroke,
                    strokeIndex: 9 + index,
                }),
            );

            const strokes = [...lap1, ...lap2, ...lap3];

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(3);
            expect(laps[0].lapNumber).toBe(1);
            expect(laps[1].lapNumber).toBe(2);
            expect(laps[2].lapNumber).toBe(3);
        });
    });

    describe("as part of leading and trailing pause handling", (): void => {
        it("should skip leading inactive strokes", (): void => {
            const strokes = [
                createStroke(0, 0, 0),
                createStroke(1, 2.5, 0),
                ...createActiveStrokes(5, 10, 2.5).map(
                    (stroke: ISessionStroke, index: number): ISessionStroke => ({
                        ...stroke,
                        strokeIndex: 2 + index,
                    }),
                ),
            ];

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(1);
            expect(laps[0].startIndex).toBe(2);
        });

        it("should skip trailing inactive strokes", (): void => {
            const strokes = [...createActiveStrokes(5), createStroke(5, 12.5, 0), createStroke(6, 15, 0)];

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(1);
            expect(laps[0].endIndex).toBe(4);
        });
    });

    describe("as part of minimum lap strokes filtering", (): void => {
        it("should filter out laps with fewer than 3 strokes", (): void => {
            const strokes = [
                ...createActiveStrokes(2),
                createStroke(2, 5, 0),
                createStroke(3, 7.5, 0),
                createStroke(4, 10, 0),
                ...createActiveStrokes(5, 15, 2.5).map(
                    (stroke: ISessionStroke, index: number): ISessionStroke => ({
                        ...stroke,
                        strokeIndex: 5 + index,
                    }),
                ),
            ];

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(1);
            expect(laps[0].lapNumber).toBe(1);
            expect(laps[0].startIndex).toBe(5);
        });

        it("should renumber laps after filtering", (): void => {
            const strokes = [
                ...createActiveStrokes(5, 0),
                createStroke(5, 12.5, 0),
                createStroke(6, 15, 0),
                createStroke(7, 17.5, 0),
                createStroke(8, 20, 24),
                createStroke(9, 22.5, 24),
                createStroke(10, 25, 0),
                createStroke(11, 27.5, 0),
                createStroke(12, 30, 0),
                ...createActiveStrokes(4, 35, 2.5).map(
                    (stroke: ISessionStroke, index: number): ISessionStroke => ({
                        ...stroke,
                        strokeIndex: 13 + index,
                    }),
                ),
            ];

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(2);
            expect(laps[0].lapNumber).toBe(1);
            expect(laps[1].lapNumber).toBe(2);
        });
    });

    describe("as part of lap metrics computation", (): void => {
        it("should compute correct time range", (): void => {
            const strokes = createActiveStrokes(5);

            const laps = detectLaps(strokes);

            expect(laps[0].startTime).toBe(0);
            expect(laps[0].endTime).toBe(10);
            expect(laps[0].duration).toBe(10);
        });

        it("should compute correct averages", (): void => {
            const strokes = [
                createStroke(0, 0, 20, { avgStrokePower: 100, speed: 2.0, distPerStroke: 8 }),
                createStroke(1, 2.5, 24, { avgStrokePower: 150, speed: 2.5, distPerStroke: 10 }),
                createStroke(2, 5, 28, { avgStrokePower: 200, speed: 3.0, distPerStroke: 12 }),
            ];

            const laps = detectLaps(strokes);

            expect(laps[0].avgPower).toBe(150);
            expect(laps[0].avgStrokeRate).toBe(24);
            expect(laps[0].avgSpeed).toBe(2.5);
            expect(laps[0].avgDistPerStroke).toBe(10);
        });

        it("should compute averages per lap independently", (): void => {
            const strokes = [
                createStroke(0, 0, 20, { avgStrokePower: 100 }),
                createStroke(1, 2.5, 20, { avgStrokePower: 100 }),
                createStroke(2, 5, 20, { avgStrokePower: 100 }),
                createStroke(3, 15, 30, { avgStrokePower: 200 }),
                createStroke(4, 17.5, 30, { avgStrokePower: 200 }),
                createStroke(5, 20, 30, { avgStrokePower: 200 }),
            ];

            const laps = detectLaps(strokes);

            expect(laps).toHaveLength(2);
            expect(laps[0].avgPower).toBe(100);
            expect(laps[0].avgStrokeRate).toBe(20);
            expect(laps[1].avgPower).toBe(200);
            expect(laps[1].avgStrokeRate).toBe(30);
        });

        it("should set powerBalance to undefined when strokes have no handle forces", (): void => {
            const strokes = [
                createStroke(0, 0, 24, { handleForces: [] }),
                createStroke(1, 2.5, 24, { handleForces: [] }),
                createStroke(2, 5, 24, { handleForces: [] }),
            ];

            const laps = detectLaps(strokes);

            expect(laps[0].powerBalance).toBeUndefined();
        });

        it("should compute powerBalance from paired handle force data", (): void => {
            const strokes = [
                // strokeIndex 1 (odd = side A) paired with strokeIndex 2 (even = side B)
                createStroke(1, 0, 24, { handleForces: [100, 200, 100] }),
                createStroke(2, 2.5, 24, { handleForces: [100, 200, 100] }),
                createStroke(3, 5, 24, { handleForces: [] }),
            ];

            const laps = detectLaps(strokes);

            expect(laps[0].powerBalance).toBeCloseTo(0.5);
        });
    });
});

const createMarker = (
    strokeIndex: number,
    type: "manual" | "distance" | "time" = "manual",
    isPause: boolean = false,
): ILapEntity => ({
    sessionId: 1,
    timeStamp: 1700000000000 + strokeIndex * 2500,
    strokeIndex,
    type,
    isPause,
});

describe("buildLapsFromMarkers", (): void => {
    describe("as part of edge case handling", (): void => {
        it("should return empty array for empty strokes", (): void => {
            expect(buildLapsFromMarkers([], [createMarker(5)])).toEqual([]);
        });

        it("should return empty array for empty markers", (): void => {
            expect(buildLapsFromMarkers(createActiveStrokes(10), [])).toEqual([]);
        });
    });

    describe("as part of single marker splitting", (): void => {
        it("should split strokes into two laps at marker position", (): void => {
            const strokes = createActiveStrokes(10);
            const markers = [createMarker(5, "distance")];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps).toHaveLength(2);
            expect(laps[0].lapNumber).toBe(1);
            expect(laps[0].startIndex).toBe(0);
            expect(laps[0].endIndex).toBe(5);
            expect(laps[1].lapNumber).toBe(2);
            expect(laps[1].startIndex).toBe(6);
            expect(laps[1].endIndex).toBe(9);
        });

        it("should compute correct averages for each split lap", (): void => {
            const strokes = [
                createStroke(0, 0, 20, { avgStrokePower: 100 }),
                createStroke(1, 2.5, 20, { avgStrokePower: 100 }),
                createStroke(2, 5, 20, { avgStrokePower: 100 }),
                createStroke(3, 7.5, 30, { avgStrokePower: 200 }),
                createStroke(4, 10, 30, { avgStrokePower: 200 }),
                createStroke(5, 12.5, 30, { avgStrokePower: 200 }),
            ];
            const markers = [createMarker(2)];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps).toHaveLength(2);
            expect(laps[0].avgPower).toBe(100);
            expect(laps[0].avgStrokeRate).toBe(20);
            expect(laps[1].avgPower).toBe(200);
            expect(laps[1].avgStrokeRate).toBe(30);
        });
    });

    describe("as part of multiple marker splitting", (): void => {
        it("should split strokes into multiple laps", (): void => {
            const strokes = createActiveStrokes(12);
            const markers = [createMarker(3), createMarker(7)];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps).toHaveLength(3);
            expect(laps[0].startIndex).toBe(0);
            expect(laps[0].endIndex).toBe(3);
            expect(laps[1].startIndex).toBe(4);
            expect(laps[1].endIndex).toBe(7);
            expect(laps[2].startIndex).toBe(8);
            expect(laps[2].endIndex).toBe(11);
        });

        it("should number laps sequentially", (): void => {
            const strokes = createActiveStrokes(12);
            const markers = [createMarker(3), createMarker(7)];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps[0].lapNumber).toBe(1);
            expect(laps[1].lapNumber).toBe(2);
            expect(laps[2].lapNumber).toBe(3);
        });
    });

    describe("as part of marker at session boundary handling", (): void => {
        it("should handle marker at last stroke", (): void => {
            const strokes = createActiveStrokes(5);
            const markers = [createMarker(4)];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps).toHaveLength(1);
            expect(laps[0].startIndex).toBe(0);
            expect(laps[0].endIndex).toBe(4);
        });

        it("should handle marker at first stroke", (): void => {
            const strokes = createActiveStrokes(5);
            const markers = [createMarker(0)];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps).toHaveLength(2);
            expect(laps[0].startIndex).toBe(0);
            expect(laps[0].endIndex).toBe(0);
            expect(laps[1].startIndex).toBe(1);
            expect(laps[1].endIndex).toBe(4);
        });

        it("should skip marker beyond last stroke", (): void => {
            const strokes = createActiveStrokes(5);
            const markers = [createMarker(2), createMarker(99)];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps).toHaveLength(2);
            expect(laps[0].endIndex).toBe(2);
            expect(laps[1].startIndex).toBe(3);
            expect(laps[1].endIndex).toBe(4);
        });

        it("should ignore duplicate markers at the same strokeIndex", (): void => {
            const strokes = createActiveStrokes(10);
            const markers = [createMarker(4), createMarker(4)];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps).toHaveLength(2);
            expect(laps[0].startIndex).toBe(0);
            expect(laps[0].endIndex).toBe(4);
            expect(laps[1].startIndex).toBe(5);
            expect(laps[1].endIndex).toBe(9);
        });

        it("should not produce overlapping segments for out-of-order markers", (): void => {
            const strokes = createActiveStrokes(10);
            const markers = [createMarker(7), createMarker(3)];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps).toHaveLength(2);
            expect(laps[0].startIndex).toBe(0);
            expect(laps[0].endIndex).toBe(7);
            expect(laps[1].startIndex).toBe(8);
            expect(laps[1].endIndex).toBe(9);
        });
    });

    describe("as part of pause marker handling", (): void => {
        it("should treat pause markers the same as regular markers for splitting", (): void => {
            const strokes = createActiveStrokes(10);
            const markers = [createMarker(4, "manual", true)];

            const laps = buildLapsFromMarkers(strokes, markers);

            expect(laps).toHaveLength(2);
            expect(laps[0].endIndex).toBe(4);
            expect(laps[1].startIndex).toBe(5);
        });
    });
});
