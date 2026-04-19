import { describe, expect, it } from "vitest";

import { createSessionFitFile } from "./fit-file";
import { createSplitSession, decodeValidMessages, rawFields } from "./fit-file.spec.helpers";

describe("createSessionFitFile split export", (): void => {
    const baseTime = new Date("2026-01-15T10:00:01Z");

    describe("split messages", (): void => {
        it("should produce one active split when laps array is empty", (): void => {
            const session = createSplitSession({ laps: [] });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitMesgs"]).toHaveLength(1);
            expect(messages["splitMesgs"][0]["splitType"]).toBe("intervalActive");
        });

        it("should produce two active splits for a distance marker", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitMesgs"]).toHaveLength(2);
            expect(messages["splitMesgs"][0]["splitType"]).toBe("intervalActive");
            expect(messages["splitMesgs"][1]["splitType"]).toBe("intervalActive");
        });

        it("should produce active and rest splits for pause and resume markers", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 1000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: true,
                    },
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitMesgs"]).toHaveLength(3);
            expect(messages["splitMesgs"][0]["splitType"]).toBe("intervalActive");
            expect(messages["splitMesgs"][1]["splitType"]).toBe("intervalRest");
            expect(messages["splitMesgs"][2]["splitType"]).toBe("intervalActive");
        });

        it("should set messageIndex matching segment order", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 1000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: true,
                    },
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitMesgs"][0]["messageIndex"]).toBe(0);
            expect(messages["splitMesgs"][1]["messageIndex"]).toBe(1);
            expect(messages["splitMesgs"][2]["messageIndex"]).toBe(2);
        });

        it("should compute per-segment distance and time for active splits", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            const split1 = messages["splitMesgs"][0];
            const split2 = messages["splitMesgs"][1];

            expect(split1["totalDistance"]).toBe(7.5);
            expect(split1["totalElapsedTime"]).toBe(3);
            expect(split2["totalDistance"]).toBe(3.5);
            expect(split2["totalElapsedTime"]).toBe(1);
        });
    });

    describe("split_summary messages", (): void => {
        it("should produce one active split_summary when laps array is empty", (): void => {
            const session = createSplitSession({ laps: [] });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitSummaryMesgs"]).toHaveLength(1);
            expect(messages["splitSummaryMesgs"][0]["splitType"]).toBe("intervalActive");
            expect(messages["splitSummaryMesgs"][0]["numSplits"]).toBe(1);
        });

        it("should produce one active split_summary for two active splits", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitSummaryMesgs"]).toHaveLength(1);
            expect(messages["splitSummaryMesgs"][0]["splitType"]).toBe("intervalActive");
            expect(messages["splitSummaryMesgs"][0]["numSplits"]).toBe(2);
        });

        it("should produce active and rest split_summaries for pause session", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 1000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: true,
                    },
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitSummaryMesgs"]).toHaveLength(2);
            expect(messages["splitSummaryMesgs"][0]["splitType"]).toBe("intervalActive");
            expect(messages["splitSummaryMesgs"][0]["numSplits"]).toBe(2);
            expect(messages["splitSummaryMesgs"][1]["splitType"]).toBe("intervalRest");
            expect(messages["splitSummaryMesgs"][1]["numSplits"]).toBe(1);
        });

        it("should set messageIndex incrementally on split_summaries", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 1000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: true,
                    },
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitSummaryMesgs"][0]["messageIndex"]).toBe(0);
            expect(messages["splitSummaryMesgs"][1]["messageIndex"]).toBe(1);
        });

        it("should aggregate active split distances in split_summary", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitSummaryMesgs"][0]["totalDistance"]).toBe(11);
            expect(messages["splitSummaryMesgs"][0]["totalTimerTime"]).toBe(4);
        });
    });

    describe("split cadence fields", (): void => {
        it("should set avg and max cadence on each split message", (): void => {
            const session = createSplitSession({ laps: [] });
            const messages = decodeValidMessages(createSessionFitFile(session));
            const split = messages["splitMesgs"][0];

            expect(rawFields(split)["29"]).toBe(27 * 128);
            expect(rawFields(split)["30"]).toBe(30 * 128);
        });

        it("should set avg and max cadence per segment for two active splits", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            // segment 0 records: strokeRate 24, 26, 28 -> avg 26, max 28
            expect(rawFields(messages["splitMesgs"][0])["29"]).toBe(26 * 128);
            expect(rawFields(messages["splitMesgs"][0])["30"]).toBe(28 * 128);
            // segment 1 records: strokeRate 28, 30 -> avg 29, max 30
            expect(rawFields(messages["splitMesgs"][1])["29"]).toBe(29 * 128);
            expect(rawFields(messages["splitMesgs"][1])["30"]).toBe(30 * 128);
        });

        it("should omit cadence fields from rest split", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 1000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: true,
                    },
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 2,
                        type: "manual",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));
            const restSplit = messages["splitMesgs"][1];

            expect(rawFields(restSplit)["29"]).toBeUndefined();
            expect(rawFields(restSplit)["30"]).toBeUndefined();
        });
    });

    describe("split_summary cadence fields", (): void => {
        it("should set avg and max cadence on split_summary", (): void => {
            const session = createSplitSession({ laps: [] });
            const messages = decodeValidMessages(createSessionFitFile(session));
            const summary = messages["splitSummaryMesgs"][0];

            expect(rawFields(summary)["14"]).toBe(27 * 128);
            expect(rawFields(summary)["15"]).toBe(30 * 128);
        });

        it("should aggregate max cadence across active splits in split_summary", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));
            const activeSummary = messages["splitSummaryMesgs"][0];

            // segment 0: avg=26, max=28; segment 1: avg=30, max=30 -> overall avg=28, max=30
            expect(rawFields(activeSummary)["14"]).toBe(28 * 128);
            expect(rawFields(activeSummary)["15"]).toBe(30 * 128);
        });
    });

    describe("split timing and navigation fields", (): void => {
        it("should set lap_index to segment index on each split", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(rawFields(messages["splitMesgs"][0])["67"]).toBe(0);
            expect(rawFields(messages["splitMesgs"][1])["67"]).toBe(1);
        });

        it("should set sport and subSport on each split", (): void => {
            const session = createSplitSession({ laps: [] });
            const messages = decodeValidMessages(createSessionFitFile(session));

            // rowing = 15 in the FIT sport enum; indoorRowing = 14 in the sub_sport enum.
            expect(rawFields(messages["splitMesgs"][0])["11"]).toBe(15);
            expect(rawFields(messages["splitMesgs"][0])["12"]).toBe(14);
        });

        it("should set startTime and endTime for each split", (): void => {
            const lapMarkerMs = baseTime.getTime() + 2000;
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: lapMarkerMs,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));
            const sessionStart = new Date(session.sessionId);

            expect((messages["splitMesgs"][0]["startTime"] as Date).getTime()).toBe(sessionStart.getTime());
            expect((messages["splitMesgs"][0]["endTime"] as Date).getTime()).toBe(lapMarkerMs);
            expect((messages["splitMesgs"][1]["startTime"] as Date).getTime()).toBe(lapMarkerMs);
            // segment 1 endTime = last record timestamp (baseTime + 3000 ms)
            expect((messages["splitMesgs"][1]["endTime"] as Date).getTime()).toBe(baseTime.getTime() + 3000);
        });

        it("should set startDistance from first record of each split segment", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            // segment 0 starts at zeroRecord: 0 m → raw 0
            // segment 1 starts at record2: 7.5 m → raw 750
            expect(rawFields(messages["splitMesgs"][0])["7"]).toBe(0);
            expect(rawFields(messages["splitMesgs"][1])["7"]).toBe(750);
        });

        it("should set totalMovingTime to per-segment elapsed rowing time", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            expect(messages["splitMesgs"][0]["totalMovingTime"]).toBe(3);
            expect(messages["splitMesgs"][1]["totalMovingTime"]).toBe(1);
        });
    });

    describe("split performance stats", (): void => {
        it("should set per-segment avgSpeed and maxSpeed on each split", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            // segment 0: speeds 2.0/2.5/3.0 → avg=2.5, max=3.0
            expect(messages["splitMesgs"][0]["avgSpeed"]).toBe(2.5);
            expect(messages["splitMesgs"][0]["maxSpeed"]).toBe(3.0);
            // segment 1: speeds 3.0/3.5 → avg=3.25, max=3.5
            expect(messages["splitMesgs"][1]["avgSpeed"]).toBe(3.25);
            expect(messages["splitMesgs"][1]["maxSpeed"]).toBe(3.5);
        });

        it("should set per-segment avgPower and maxPower on each split", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            // segment 0: powers 150/160/170 → avg=160, max=170
            expect(rawFields(messages["splitMesgs"][0])["40"]).toBe(160);
            expect(rawFields(messages["splitMesgs"][0])["41"]).toBe(170);
            // segment 1: powers 170/180 → avg=175, max=180
            expect(rawFields(messages["splitMesgs"][1])["40"]).toBe(175);
            expect(rawFields(messages["splitMesgs"][1])["41"]).toBe(180);
        });

        it("should set per-segment avgHeartRate and maxHeartRate on each split", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));

            // segment 0: HR 120/130/140 → avg=130, max=140
            expect(rawFields(messages["splitMesgs"][0])["15"]).toBe(130);
            expect(rawFields(messages["splitMesgs"][0])["16"]).toBe(140);
            // segment 1: HR 140/150 → avg=145, max=150
            expect(rawFields(messages["splitMesgs"][1])["15"]).toBe(145);
            expect(rawFields(messages["splitMesgs"][1])["16"]).toBe(150);
        });
    });

    describe("split_summary aggregated stats", (): void => {
        it("should set avgSpeed and maxSpeed on split_summary", (): void => {
            const session = createSplitSession({ laps: [] });
            const messages = decodeValidMessages(createSessionFitFile(session));
            const summary = messages["splitSummaryMesgs"][0];

            // single segment: totalDistance=11 m, totalTimerTime=4 s → avg=2.75, max=3.5
            expect(summary["avgSpeed"]).toBe(2.75);
            expect(summary["maxSpeed"]).toBe(3.5);
        });

        it("should set avgHeartRate and maxHeartRate on split_summary", (): void => {
            const session = createSplitSession({ laps: [] });
            const messages = decodeValidMessages(createSessionFitFile(session));
            const summary = messages["splitSummaryMesgs"][0];

            // single segment: HR 120/130/140/150 → avg=135, max=150
            expect(summary["avgHeartRate"]).toBe(135);
            expect(summary["maxHeartRate"]).toBe(150);
        });

        it("should aggregate avgSpeed and HR across multiple active splits in split_summary", (): void => {
            const session = createSplitSession({
                laps: [
                    {
                        timeStamp: baseTime.getTime() + 2000,
                        strokeIndex: 3,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });
            const messages = decodeValidMessages(createSessionFitFile(session));
            const summary = messages["splitSummaryMesgs"][0];

            // totalDistance=11 m, totalTimerTime=4 s → avg_speed=2.75, max_speed=3.5
            expect(summary["avgSpeed"]).toBe(2.75);
            expect(summary["maxSpeed"]).toBe(3.5);
            // hR across 2 segments: (avg130 + avg145)/2 = 137.5 → Math.round = 138; max=150
            expect(summary["avgHeartRate"]).toBe(138);
            expect(summary["maxHeartRate"]).toBe(150);
        });
    });
});
