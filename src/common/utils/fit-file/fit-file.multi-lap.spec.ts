import { LapMesg } from "@garmin/fitsdk";
import { describe, expect, it } from "vitest";

import { IExportSession } from "../../database.interfaces";

import { createSessionFitFile } from "./fit-file";
import { createTestSession, decodeValidMessages, rawFields } from "./fit-file.spec.helpers";

describe("createSessionFitFile multi-lap export", (): void => {
    const baseTime = new Date("2026-01-15T10:00:01Z");

    const createMultiLapSession = (lapOverrides?: Partial<IExportSession>): IExportSession => {
        return createTestSession({
            records: [
                {
                    timeStamp: new Date(baseTime.getTime()),
                    elapsedTime: 1,
                    distance: 200,
                    speed: 2.0,
                    strokeRate: 24,
                    strokeCount: 1,
                    avgStrokePower: 150,
                    distPerStroke: 8.0,
                    driveDuration: 0.8,
                    recoveryDuration: 1.7,
                    dragFactor: 110,
                    totalWork: 375,
                },
                {
                    timeStamp: new Date(baseTime.getTime() + 1000),
                    elapsedTime: 2,
                    distance: 450,
                    speed: 2.5,
                    strokeRate: 26,
                    strokeCount: 2,
                    avgStrokePower: 160,
                    distPerStroke: 8.5,
                    driveDuration: 0.75,
                    recoveryDuration: 1.55,
                    dragFactor: 112,
                    totalWork: 743,
                },
                {
                    timeStamp: new Date(baseTime.getTime() + 2000),
                    elapsedTime: 3,
                    distance: 750,
                    speed: 3.0,
                    strokeRate: 28,
                    strokeCount: 3,
                    avgStrokePower: 170,
                    distPerStroke: 9.0,
                    driveDuration: 0.7,
                    recoveryDuration: 1.4,
                    dragFactor: 115,
                    totalWork: 1100,
                },
                {
                    timeStamp: new Date(baseTime.getTime() + 3000),
                    elapsedTime: 4,
                    distance: 1100,
                    speed: 3.5,
                    strokeRate: 30,
                    strokeCount: 4,
                    avgStrokePower: 180,
                    distPerStroke: 9.5,
                    driveDuration: 0.65,
                    recoveryDuration: 1.35,
                    dragFactor: 118,
                    totalWork: 1500,
                },
            ],
            ...lapOverrides,
        });
    };

    it("should produce single LAP when laps array is empty", (): void => {
        const session = createMultiLapSession({ laps: [] });
        const messages = decodeValidMessages(createSessionFitFile(session));

        expect(messages["lapMesgs"]).toHaveLength(1);
        expect(messages["sessionMesgs"][0]["numLaps"]).toBe(1);
    });

    it("should produce two active LAPs for a distance marker", (): void => {
        const session = createMultiLapSession({
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

        expect(messages["lapMesgs"]).toHaveLength(2);
        expect(messages["lapMesgs"][0]["messageIndex"]).toBe(0);
        expect(messages["lapMesgs"][1]["messageIndex"]).toBe(1);
        expect(messages["sessionMesgs"][0]["numLaps"]).toBe(2);
    });

    it("should set lapTrigger to distance for distance markers", (): void => {
        const session = createMultiLapSession({
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

        expect(messages["lapMesgs"][0]["lapTrigger"]).toBe("distance");
        expect(messages["lapMesgs"][1]["lapTrigger"]).toBe("sessionEnd");
    });

    it("should set lapTrigger to time for time markers", (): void => {
        const session = createMultiLapSession({
            laps: [
                {
                    timeStamp: baseTime.getTime() + 1000,
                    strokeIndex: 2,
                    type: "time",
                    isPause: false,
                },
            ],
        });
        const messages = decodeValidMessages(createSessionFitFile(session));

        expect(messages["lapMesgs"][0]["lapTrigger"]).toBe("time");
        expect(messages["lapMesgs"][1]["lapTrigger"]).toBe("sessionEnd");
    });

    it("should set lapTrigger to manual for manual markers", (): void => {
        const session = createMultiLapSession({
            laps: [
                {
                    timeStamp: baseTime.getTime() + 1000,
                    strokeIndex: 2,
                    type: "manual",
                    isPause: false,
                },
            ],
        });
        const messages = decodeValidMessages(createSessionFitFile(session));

        expect(messages["lapMesgs"][0]["lapTrigger"]).toBe("manual");
    });

    it("should insert rest LAP for pause and resume markers", (): void => {
        const session = createMultiLapSession({
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

        expect(messages["lapMesgs"]).toHaveLength(3);
        expect(messages["lapMesgs"][0]["intensity"]).toBe("active");
        expect(messages["lapMesgs"][0]["lapTrigger"]).toBe("manual");
        expect(messages["lapMesgs"][1]["intensity"]).toBe("rest");
        expect(messages["lapMesgs"][1]["lapTrigger"]).toBe("manual");
        expect(messages["lapMesgs"][2]["intensity"]).toBe("active");
        expect(messages["lapMesgs"][2]["lapTrigger"]).toBe("sessionEnd");
        expect(messages["sessionMesgs"][0]["numLaps"]).toBe(3);
    });

    it("should produce active and rest LAPs for a single pause marker", (): void => {
        const session = createMultiLapSession({
            laps: [
                {
                    timeStamp: baseTime.getTime() + 2000,
                    strokeIndex: 3,
                    type: "manual",
                    isPause: true,
                },
            ],
        });
        const messages = decodeValidMessages(createSessionFitFile(session));

        expect(messages["lapMesgs"]).toHaveLength(2);
        expect(messages["lapMesgs"][0]["intensity"]).toBe("active");
        expect(messages["lapMesgs"][0]["lapTrigger"]).toBe("manual");
        expect(messages["lapMesgs"][1]["intensity"]).toBe("rest");
        expect(messages["lapMesgs"][1]["lapTrigger"]).toBe("sessionEnd");
        expect(messages["sessionMesgs"][0]["numLaps"]).toBe(2);
    });

    it("should write timer stop and start events around pause rest period", (): void => {
        const session = createMultiLapSession({
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
        const events = messages["eventMesgs"];

        expect(events).toHaveLength(4);
        expect(events[0]["eventType"]).toBe("start");
        expect(events[1]["eventType"]).toBe("stop");
        expect(events[2]["eventType"]).toBe("start");
        expect(events[3]["eventType"]).toBe("stopAll");
    });

    it("should compute per-segment stats for active laps", (): void => {
        const session = createMultiLapSession({
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

        const lap1 = messages["lapMesgs"][0];
        const lap2 = messages["lapMesgs"][1];

        expect(lap1["totalDistance"]).toBe(7.5);
        expect(lap1["totalElapsedTime"]).toBe(3);
        expect(lap1["totalCycles"]).toBe(3);
        expect(lap1["totalWork"]).toBe(1100);
        expect(lap2["totalDistance"]).toBe(3.5);
        expect(lap2["totalElapsedTime"]).toBe(1);
        expect(lap2["totalCycles"]).toBe(1);
        expect(lap2["totalWork"]).toBe(400);
        expect(lap1["sport"]).toBe("rowing");
        expect(lap1["subSport"]).toBe("indoorRowing");
    });

    it("should produce per-segment totals that sum to session totals", (): void => {
        const session = createMultiLapSession({
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

        const lap1 = messages["lapMesgs"][0];
        const lap2 = messages["lapMesgs"][1];
        const sessionMesg = messages["sessionMesgs"][0];

        const lapTotalDistance = (lap1["totalDistance"] as number) + (lap2["totalDistance"] as number);
        const lapTotalCycles = (lap1["totalCycles"] as number) + (lap2["totalCycles"] as number);
        const lapTotalWork = (lap1["totalWork"] as number) + (lap2["totalWork"] as number);

        expect(lapTotalDistance).toBe(sessionMesg["totalDistance"]);
        expect(lapTotalCycles).toBe(sessionMesg["totalCycles"]);
        expect(lapTotalWork).toBe(sessionMesg["totalWork"]);
    });

    it("should always set last active lap lapTrigger to sessionEnd", (): void => {
        const session = createMultiLapSession({
            laps: [
                {
                    timeStamp: baseTime.getTime() + 1000,
                    strokeIndex: 2,
                    type: "distance",
                    isPause: false,
                },
                {
                    timeStamp: baseTime.getTime() + 2000,
                    strokeIndex: 3,
                    type: "time",
                    isPause: false,
                },
            ],
        });
        const messages = decodeValidMessages(createSessionFitFile(session));

        expect(messages["lapMesgs"]).toHaveLength(3);
        expect(messages["lapMesgs"][0]["lapTrigger"]).toBe("distance");
        expect(messages["lapMesgs"][1]["lapTrigger"]).toBe("time");
        expect(messages["lapMesgs"][2]["lapTrigger"]).toBe("sessionEnd");
        expect(messages["sessionMesgs"][0]["numLaps"]).toBe(3);
    });

    it("should keep session stats as overall totals regardless of lap splits", (): void => {
        const session = createMultiLapSession({
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
        const sessionMesg = messages["sessionMesgs"][0];

        expect(sessionMesg["totalDistance"]).toBe(11);
        expect(sessionMesg["totalElapsedTime"]).toBe(4);
    });

    it("should write timer stop and stopAll events when session ends during pause", (): void => {
        const session = createMultiLapSession({
            laps: [
                {
                    timeStamp: baseTime.getTime() + 2000,
                    strokeIndex: 3,
                    type: "manual",
                    isPause: true,
                },
            ],
        });
        const messages = decodeValidMessages(createSessionFitFile(session));
        const events = messages["eventMesgs"];

        expect(events).toHaveLength(3);
        expect(events[0]["eventType"]).toBe("start");
        expect(events[1]["eventType"]).toBe("stop");
        expect(events[2]["eventType"]).toBe("stopAll");
    });

    it("should produce per-segment totals that sum to session totals with pause segments", (): void => {
        const session = createTestSession({
            records: [
                {
                    timeStamp: new Date(baseTime.getTime()),
                    elapsedTime: 1,
                    distance: 200,
                    speed: 2.0,
                    strokeRate: 24,
                    strokeCount: 1,
                    avgStrokePower: 150,
                    distPerStroke: 8.0,
                    driveDuration: 0.8,
                    recoveryDuration: 1.7,
                    dragFactor: 110,
                    totalWork: 375,
                },
                {
                    timeStamp: new Date(baseTime.getTime() + 1000),
                    elapsedTime: 2,
                    distance: 450,
                    speed: 2.5,
                    strokeRate: 26,
                    strokeCount: 2,
                    avgStrokePower: 160,
                    distPerStroke: 8.5,
                    driveDuration: 0.75,
                    recoveryDuration: 1.55,
                    dragFactor: 112,
                    totalWork: 743,
                },
                {
                    timeStamp: new Date(baseTime.getTime() + 3000),
                    elapsedTime: 2,
                    distance: 450,
                    speed: 2.5,
                    strokeRate: 26,
                    strokeCount: 2,
                    avgStrokePower: 160,
                    distPerStroke: 8.5,
                    driveDuration: 0.75,
                    recoveryDuration: 1.55,
                    dragFactor: 112,
                    totalWork: 743,
                },
                {
                    timeStamp: new Date(baseTime.getTime() + 4000),
                    elapsedTime: 3,
                    distance: 750,
                    speed: 3.0,
                    strokeRate: 28,
                    strokeCount: 3,
                    avgStrokePower: 170,
                    distPerStroke: 9.0,
                    driveDuration: 0.7,
                    recoveryDuration: 1.4,
                    dragFactor: 115,
                    totalWork: 1100,
                },
                {
                    timeStamp: new Date(baseTime.getTime() + 5000),
                    elapsedTime: 4,
                    distance: 1100,
                    speed: 3.5,
                    strokeRate: 30,
                    strokeCount: 4,
                    avgStrokePower: 180,
                    distPerStroke: 9.5,
                    driveDuration: 0.65,
                    recoveryDuration: 1.35,
                    dragFactor: 118,
                    totalWork: 1500,
                },
            ],
            laps: [
                {
                    timeStamp: baseTime.getTime() + 1000,
                    strokeIndex: 2,
                    type: "manual",
                    isPause: true,
                },
                {
                    timeStamp: baseTime.getTime() + 3000,
                    strokeIndex: 2,
                    type: "manual",
                    isPause: false,
                },
            ],
        });
        const messages = decodeValidMessages(createSessionFitFile(session));
        const sessionMesg = messages["sessionMesgs"][0];
        const laps = messages["lapMesgs"];

        expect(laps).toHaveLength(3);

        const lapTotalDistance = laps.reduce(
            (sum: number, lap: LapMesg): number => sum + (lap.totalDistance as number),
            0,
        );
        const lapTotalCycles = laps.reduce(
            (sum: number, lap: LapMesg): number => sum + (lap.totalCycles as number),
            0,
        );
        const lapTotalWork = laps.reduce(
            (sum: number, lap: LapMesg): number => sum + (lap.totalWork as number),
            0,
        );

        expect(lapTotalDistance).toBe(sessionMesg["totalDistance"]);
        expect(lapTotalCycles).toBe(sessionMesg["totalCycles"]);
        expect(lapTotalWork).toBe(sessionMesg["totalWork"]);
    });

    it("should compute per-segment averages for active laps", (): void => {
        const session = createMultiLapSession({
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

        const lap1 = messages["lapMesgs"][0];
        const lap2 = messages["lapMesgs"][1];

        // segment 0 records: strokeRates 24, 26, 28 → avg=26, max=28; powers 150/160/170 → avg=160, max=170
        expect(lap1["avgCadence"]).toBe(26);
        expect(lap1["maxCadence"]).toBe(28);
        expect(lap1["avgPower"]).toBe(160);
        expect(lap1["maxPower"]).toBe(170);
        expect(lap1["enhancedAvgSpeed"]).toBe(2.5);
        expect(lap1["enhancedMaxSpeed"]).toBe(3.0);
        expect(lap1["avgStrokeDistance"]).toBe(8.5);

        // segment 1 records: strokeRates 28, 30 → avg=29, max=30; powers 170/180 → avg=175, max=180
        expect(lap2["avgCadence"]).toBe(29);
        expect(lap2["maxCadence"]).toBe(30);
        expect(lap2["avgPower"]).toBe(175);
        expect(lap2["maxPower"]).toBe(180);
        expect(lap2["enhancedAvgSpeed"]).toBe(3.25);
        expect(lap2["enhancedMaxSpeed"]).toBe(3.5);
        expect(lap2["avgStrokeDistance"]).toBe(9.25);
    });

    it("should include per-segment avgForce and maxForce in laps when handleForces are present", (): void => {
        const session = createMultiLapSession({
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

        const lap1 = messages["lapMesgs"][0];
        const lap2 = messages["lapMesgs"][1];

        // lap1 has handleForces for strokes 1,2,3: means 150/200/250 → avg=200, max=250
        expect(rawFields(lap1)["166"]).toBe(200000);
        expect(rawFields(lap1)["167"]).toBe(250000);
        // lap2 has handleForces for stroke 3 only: mean=250 → avg=250, max=250
        expect(rawFields(lap2)["166"]).toBe(250000);
        expect(rawFields(lap2)["167"]).toBe(250000);
    });

    it("should set startTime to segment start for each lap", (): void => {
        const markerTimeMs = baseTime.getTime() + 2000;
        const session = createMultiLapSession({
            laps: [
                {
                    timeStamp: markerTimeMs,
                    strokeIndex: 3,
                    type: "distance",
                    isPause: false,
                },
            ],
        });
        const messages = decodeValidMessages(createSessionFitFile(session));
        const sessionStart = new Date(session.sessionId);

        expect((messages["lapMesgs"][0]["startTime"] as Date).getTime()).toBe(sessionStart.getTime());
        expect((messages["lapMesgs"][1]["startTime"] as Date).getTime()).toBe(markerTimeMs);
    });
});
