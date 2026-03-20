import { ILap, ISessionStroke } from "../models/session-analysis.interfaces";

const STROKE_RATE_THRESHOLD = 2;
const PAUSE_DURATION_THRESHOLD = 5;
const MIN_LAP_STROKES = 3;

const computeLapMetrics = (
    strokes: Array<ISessionStroke>,
    lapNumber: number,
    startIndex: number,
    endIndex: number,
): ILap => {
    const lapStrokes = strokes.slice(startIndex, endIndex + 1);
    const count = lapStrokes.length;

    let sumPower = 0;
    let sumStrokeRate = 0;
    let sumSpeed = 0;
    let sumDistPerStroke = 0;

    for (const stroke of lapStrokes) {
        sumPower += stroke.avgStrokePower;
        sumStrokeRate += stroke.strokeRate;
        sumSpeed += stroke.speed;
        sumDistPerStroke += stroke.distPerStroke;
    }

    return {
        lapNumber,
        startIndex,
        endIndex,
        startTime: lapStrokes[0].elapsedTime,
        endTime: lapStrokes[count - 1].elapsedTime,
        duration: lapStrokes[count - 1].elapsedTime - lapStrokes[0].elapsedTime,
        avgPower: sumPower / count,
        avgStrokeRate: sumStrokeRate / count,
        avgSpeed: sumSpeed / count,
        avgDistPerStroke: sumDistPerStroke / count,
    };
};

export const detectLaps = (strokes: Array<ISessionStroke>): Array<ILap> => {
    if (strokes.length === 0) {
        return [];
    }

    const activeIndices = strokes
        .map((stroke: ISessionStroke, index: number): { stroke: ISessionStroke; index: number } => ({
            stroke,
            index,
        }))
        .filter(
            ({ stroke }: { stroke: ISessionStroke; index: number }): boolean =>
                stroke.strokeRate > STROKE_RATE_THRESHOLD,
        );

    if (activeIndices.length === 0) {
        return [];
    }

    const lapRanges: Array<{ startIndex: number; endIndex: number }> = [];

    let segmentStart = activeIndices[0].index;
    let previous = activeIndices[0];

    for (let index = 1; index < activeIndices.length; index++) {
        const current = activeIndices[index];

        const gap = current.stroke.elapsedTime - previous.stroke.elapsedTime;

        if (gap >= PAUSE_DURATION_THRESHOLD) {
            lapRanges.push({
                startIndex: segmentStart,
                endIndex: previous.index,
            });

            segmentStart = current.index;
        }

        previous = current;
    }

    // close last segment
    lapRanges.push({
        startIndex: segmentStart,
        endIndex: previous.index,
    });

    return lapRanges
        .filter(
            (range: { startIndex: number; endIndex: number }): boolean =>
                range.endIndex - range.startIndex + 1 >= MIN_LAP_STROKES,
        )
        .map(
            (range: { startIndex: number; endIndex: number }, lapIndex: number): ILap =>
                computeLapMetrics(strokes, lapIndex + 1, range.startIndex, range.endIndex),
        );
};
