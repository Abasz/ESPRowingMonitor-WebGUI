import { Decoder, Stream, Utils } from "@garmin/fitsdk";
import { beforeEach, describe, expect, it } from "vitest";

import { IExportRecord, IExportSession } from "../../database.interfaces";

import { createSessionFitFile } from "./fit-file";
import { createTestSession, decodeValidMessages, rawFields } from "./fit-file.spec.helpers";

describe("createSessionFitFile function", (): void => {
    let testSession: IExportSession;

    beforeEach((): void => {
        testSession = createTestSession();
    });

    describe("as part of FIT file structure", (): void => {
        it("should return an ArrayBuffer", (): void => {
            const result = createSessionFitFile(testSession);

            expect(result).toBeInstanceOf(ArrayBuffer);
            expect(result.byteLength).toBeGreaterThan(0);
        });

        it("should produce a valid FIT file that decodes without errors", (): void => {
            const fitData = createSessionFitFile(testSession);
            const stream = Stream.fromArrayBuffer(fitData as ArrayBuffer);
            const decoder = new Decoder(stream);

            expect(decoder.isFIT()).toBe(true);
            expect(decoder.checkIntegrity()).toBe(true);
        });

        it("should contain a FileId message with type activity", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["fileIdMesgs"]).toHaveLength(1);
            expect(messages["fileIdMesgs"][0]["type"]).toBe("activity");
            expect(messages["fileIdMesgs"][0]["manufacturer"]).toBe("development");
            expect(messages["fileIdMesgs"][0]["serialNumber"]).toBe(123456);
        });

        it("should contain a FileCreator message", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["fileCreatorMesgs"]).toHaveLength(1);
            expect(messages["fileCreatorMesgs"][0]["softwareVersion"]).toBe(720);
        });

        it("should contain a DeviceInfo message with device name", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["deviceInfoMesgs"]).toHaveLength(1);
            expect(messages["deviceInfoMesgs"][0]["productName"]).toBe("Test Rower");
        });

        it("should use default device name when deviceName is undefined", (): void => {
            testSession.deviceName = undefined;
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["deviceInfoMesgs"][0]["productName"]).toBe("ESP Rowing Monitor");
        });

        it("should contain a Sport message with rowing/indoorRowing", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["sportMesgs"]).toHaveLength(1);
            expect(messages["sportMesgs"][0]["sport"]).toBe("rowing");
            expect(messages["sportMesgs"][0]["subSport"]).toBe("indoorRowing");
            expect(messages["sportMesgs"][0]["name"]).toBe("Indoor Rowing");
        });

        it("should contain an Activity message with type manual", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["activityMesgs"]).toHaveLength(1);
            expect(messages["activityMesgs"][0]["numSessions"]).toBe(1);
            expect(messages["activityMesgs"][0]["type"]).toBe("manual");
        });

        it("should set activity event fields and totalTimerTime", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const activity = messages["activityMesgs"][0];

            expect(activity["event"]).toBe("activity");
            expect(activity["eventType"]).toBe("stop");
            // wallClockTotal = lastRecord.timestamp − firstRecord.timestamp = 2 s
            expect(activity["totalTimerTime"]).toBe(3);
        });

        it("should set localTimestamp to UTC timestamp adjusted by timezone offset", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const activity = messages["activityMesgs"][0];
            const utcTimestamp = Utils.convertDateToDateTime(activity["timestamp"] as Date);
            const localTimestamp = activity["localTimestamp"] as number;
            const endTime = testSession.records[testSession.records.length - 1].timeStamp;

            expect(localTimestamp - utcTimestamp).toBe(endTime.getTimezoneOffset() * -60);
        });
    });

    describe("as part of Record messages", (): void => {
        it("should contain one Record per data point", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"]).toHaveLength(3);
        });

        it("should convert distance from cm to meters", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["distance"]).toBe(2);
            expect(messages["recordMesgs"][1]["distance"]).toBe(4.5);
            expect(messages["recordMesgs"][2]["distance"]).toBe(7.5);
        });

        it("should map speed to enhancedSpeed", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["enhancedSpeed"]).toBe(2.0);
            expect(messages["recordMesgs"][1]["enhancedSpeed"]).toBe(2.5);
        });

        it("should round strokeRate to cadence", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["cadence"]).toBe(24);
            expect(messages["recordMesgs"][1]["cadence"]).toBe(26);
        });

        it("should round avgStrokePower to power", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["power"]).toBe(150);
            expect(messages["recordMesgs"][1]["power"]).toBe(160);
        });

        it("should include heartRate when present", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["heartRate"]).toBe(120);
            expect(messages["recordMesgs"][2]["heartRate"]).toBe(140);
        });

        it("should include totalCycles from strokeCount", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["totalCycles"]).toBe(1);
            expect(messages["recordMesgs"][2]["totalCycles"]).toBe(3);
        });

        it("should include resistance from dragFactor", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["resistance"]).toBe(110);
            expect(messages["recordMesgs"][2]["resistance"]).toBe(115);
        });

        it("should include cycleLength16 from distPerStroke", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["cycleLength16"]).toBe(8.0);
            expect(messages["recordMesgs"][1]["cycleLength16"]).toBe(8.5);
            expect(messages["recordMesgs"][2]["cycleLength16"]).toBe(9.0);
        });

        it("should include accumulatedPower from running totalWork", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["accumulatedPower"]).toBe(375);
            expect(messages["recordMesgs"][1]["accumulatedPower"]).toBe(743);
            expect(messages["recordMesgs"][2]["accumulatedPower"]).toBe(1100);
        });

        it("should set activityType to fitnessEquipment", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["activityType"]).toBe("fitnessEquipment");
        });

        it("should set correct timestamps", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const firstTimestamp = messages["recordMesgs"][0]["timestamp"] as Date;
            const secondTimestamp = messages["recordMesgs"][1]["timestamp"] as Date;

            expect(secondTimestamp.getTime() - firstTimestamp.getTime()).toBe(1000);
        });

        it("should produce a larger file when handleForces are present (force fields written)", (): void => {
            const withForces = createSessionFitFile(testSession);
            const withoutForces = createSessionFitFile(createTestSession({ handleForces: {} }));

            decodeValidMessages(withForces);
            expect(withForces.byteLength).toBeGreaterThan(withoutForces.byteLength);
        });

        it("should include mean handle force per record when handleForces are present", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            // fixture strokes: mean([100,200])=150, mean([150,250])=200, mean([200,300])=250
            expect(rawFields(messages["recordMesgs"][0])["148"]).toBe(150000);
            expect(rawFields(messages["recordMesgs"][1])["148"]).toBe(200000);
            expect(rawFields(messages["recordMesgs"][2])["148"]).toBe(250000);
        });
    });

    describe("as part of HRV messages", (): void => {
        it("should emit HRV messages for records with rrIntervals", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["hrvMesgs"]).toHaveLength(2);
        });

        it("should convert rrIntervals from ms to seconds", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["hrvMesgs"][0]["time"]).toEqual([0.5, 0.51]);
            expect(messages["hrvMesgs"][1]["time"]).toEqual([0.48]);
        });

        it("should not emit HRV messages when rrIntervals are absent", (): void => {
            testSession = createTestSession({
                records: testSession.records.map(
                    (record: IExportRecord): IExportRecord => ({
                        ...record,
                        heartRate: record.heartRate
                            ? { heartRate: record.heartRate.heartRate, contactDetected: true }
                            : undefined,
                    }),
                ),
            });
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["hrvMesgs"]).toBeUndefined();
        });
    });

    describe("as part of HR messages", (): void => {
        it("should emit one HR message per record with heart rate", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["hrMesgs"]).toHaveLength(3);
        });

        it("should set filtered_bpm from heartRate", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["hrMesgs"][0]["filteredBpm"]).toEqual([120]);
            expect(messages["hrMesgs"][1]["filteredBpm"]).toEqual([130]);
            expect(messages["hrMesgs"][2]["filteredBpm"]).toEqual([140]);
        });

        it("should set timestamp matching record timestamp", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const baseTime = new Date("2026-01-15T10:00:01Z");

            expect((messages["hrMesgs"][0]["timestamp"] as Date).getTime()).toBe(baseTime.getTime());
            expect((messages["hrMesgs"][2]["timestamp"] as Date).getTime()).toBe(baseTime.getTime() + 2000);
        });

        it("should set event_timestamp as elapsed seconds since first HR (scale 1024)", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            // event_timestamp has scale=1024: decoded = raw/1024
            // record 0: 0s -> raw=0 -> decoded=0
            // record 1: 1s -> raw=1024 -> decoded=1.0
            // record 2: 2s -> raw=2048 -> decoded=2.0
            expect(messages["hrMesgs"][0]["eventTimestamp"]).toEqual([0]);
            expect(messages["hrMesgs"][1]["eventTimestamp"]).toEqual([1]);
            expect(messages["hrMesgs"][2]["eventTimestamp"]).toEqual([2]);
        });

        it("should not emit HR messages when no heartRate data exists", (): void => {
            testSession = createTestSession({
                records: testSession.records.map(
                    (record: IExportRecord): IExportRecord => ({
                        ...record,
                        heartRate: undefined,
                    }),
                ),
            });
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["hrMesgs"]).toBeUndefined();
        });
    });

    describe("as part of Event messages", (): void => {
        it("should contain timer start and stop events", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const events = messages["eventMesgs"];

            expect(events).toHaveLength(2);
            expect(events[0]["event"]).toBe("timer");
            expect(events[0]["eventType"]).toBe("start");
            expect(events[1]["event"]).toBe("timer");
            expect(events[1]["eventType"]).toBe("stopAll");
        });
    });

    describe("as part of Lap summary", (): void => {
        it("should contain one Lap with correct summary stats", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const lap = messages["lapMesgs"][0];

            expect(messages["lapMesgs"]).toHaveLength(1);
            expect(lap["sport"]).toBe("rowing");
            expect(lap["subSport"]).toBe("indoorRowing");
            expect(lap["totalElapsedTime"]).toBe(3);
            expect(lap["totalTimerTime"]).toBe(3);
            expect(lap["totalMovingTime"]).toBe(3);
            expect(lap["totalDistance"]).toBe(7.5);
            expect(lap["totalCycles"]).toBe(3);
        });

        it("should set correct lap event fields", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const lap = messages["lapMesgs"][0];

            expect(lap["event"]).toBe("session");
            expect(lap["eventType"]).toBe("stop");
            expect(lap["intensity"]).toBe("active");
            expect(lap["lapTrigger"]).toBe("sessionEnd");
        });

        it("should set startTime to the session start time", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const lap = messages["lapMesgs"][0];
            const sessionStart = new Date(testSession.sessionId);

            expect((lap["startTime"] as Date).getTime()).toBe(sessionStart.getTime());
        });

        it("should produce valid FIT data with force stats in lap when handleForces are present", (): void => {
            const withForces = createSessionFitFile(testSession);
            const withoutForces = createSessionFitFile(createTestSession({ handleForces: {} }));

            decodeValidMessages(withForces);
            decodeValidMessages(withoutForces);
            expect(withForces.byteLength).toBeGreaterThan(withoutForces.byteLength);
        });

        it("should include avgForce and maxForce in lap when handleForces are present", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const lap = messages["lapMesgs"][0];

            expect(rawFields(lap)["166"]).toBe(200000);
            expect(rawFields(lap)["167"]).toBe(250000);
        });

        it("should omit avgForce and maxForce from lap when handleForces are absent", (): void => {
            const messages = decodeValidMessages(
                createSessionFitFile(createTestSession({ handleForces: {} })),
            );
            const lap = messages["lapMesgs"][0];

            expect(rawFields(lap)["166"]).toBeUndefined();
            expect(rawFields(lap)["167"]).toBeUndefined();
        });
    });

    describe("as part of Session summary", (): void => {
        it("should contain one Session with correct fields", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const session = messages["sessionMesgs"][0];

            expect(messages["sessionMesgs"]).toHaveLength(1);
            expect(session["sport"]).toBe("rowing");
            expect(session["subSport"]).toBe("indoorRowing");
            expect(session["numLaps"]).toBe(1);
            expect(session["firstLapIndex"]).toBe(0);
            expect(session["event"]).toBe("session");
            expect(session["eventType"]).toBe("stop");
            expect(session["trigger"]).toBe("activityEnd");
            expect(session["sportProfileName"]).toBe("Row Indoor");
        });

        it("should set startTime to the session start time", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const session = messages["sessionMesgs"][0];
            const sessionStart = new Date(testSession.sessionId);

            expect((session["startTime"] as Date).getTime()).toBe(sessionStart.getTime());
        });

        it("should contain the same summary stats as the Lap", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const lap = messages["lapMesgs"][0];
            const session = messages["sessionMesgs"][0];

            expect(session["totalElapsedTime"]).toBe(lap["totalElapsedTime"]);
            expect(session["totalTimerTime"]).toBe(lap["totalTimerTime"]);
            expect(session["totalMovingTime"]).toBe(lap["totalMovingTime"]);
            expect(session["totalDistance"]).toBe(lap["totalDistance"]);
            expect(session["totalCycles"]).toBe(lap["totalCycles"]);
            expect(session["avgPower"]).toBe(lap["avgPower"]);
            expect(session["maxPower"]).toBe(lap["maxPower"]);
            expect(session["avgCadence"]).toBe(lap["avgCadence"]);
            expect(session["maxCadence"]).toBe(lap["maxCadence"]);
            expect(session["enhancedAvgSpeed"]).toBe(lap["enhancedAvgSpeed"]);
            expect(session["enhancedMaxSpeed"]).toBe(lap["enhancedMaxSpeed"]);
            expect(session["avgStrokeDistance"]).toBe(lap["avgStrokeDistance"]);
            expect(session["totalWork"]).toBe(lap["totalWork"]);
            expect(session["avgHeartRate"]).toBe(lap["avgHeartRate"]);
            expect(session["maxHeartRate"]).toBe(lap["maxHeartRate"]);
        });

        it("should include avgForce and maxForce in session when handleForces are present", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));
            const session = messages["sessionMesgs"][0];

            // note: session message uses fields 224/225, which differ from lap fields 166/167.
            expect(rawFields(session)["224"]).toBe(200000);
            expect(rawFields(session)["225"]).toBe(250000);
        });

        it("should omit avgForce and maxForce from session when handleForces are absent", (): void => {
            const messages = decodeValidMessages(
                createSessionFitFile(createTestSession({ handleForces: {} })),
            );
            const session = messages["sessionMesgs"][0];

            expect(rawFields(session)["224"]).toBeUndefined();
            expect(rawFields(session)["225"]).toBeUndefined();
        });
    });

    describe("as part of sport type selection", (): void => {
        it("should use kayaking/generic for Kayak First device", (): void => {
            testSession = createTestSession({ deviceName: "KayakFirst" });
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["sportMesgs"][0]["sport"]).toBe("kayaking");
            expect(messages["sportMesgs"][0]["subSport"]).toBe("generic");
            expect(messages["sportMesgs"][0]["name"]).toBe("Indoor Kayaking");
            expect(messages["lapMesgs"][0]["sport"]).toBe("kayaking");
            expect(messages["lapMesgs"][0]["subSport"]).toBe("generic");
            expect(messages["sessionMesgs"][0]["sport"]).toBe("kayaking");
            expect(messages["sessionMesgs"][0]["subSport"]).toBe("generic");
            expect(messages["sessionMesgs"][0]["sportProfileName"]).toBe("Kayak Indoor");
        });
    });

    describe("as part of edge cases & robustness handling", (): void => {
        it("should throw when records array is empty", (): void => {
            testSession = createTestSession({ records: [] });

            expect((): void => {
                createSessionFitFile(testSession);
            }).toThrow("Cannot create FIT file from empty session");
        });

        it("should handle a single-record session", (): void => {
            testSession = createTestSession({
                records: [testSession.records[0]],
            });

            const fitData = createSessionFitFile(testSession);
            const messages = decodeValidMessages(fitData);

            expect(messages["recordMesgs"]).toHaveLength(1);
            expect(messages["lapMesgs"]).toHaveLength(1);
            expect(messages["sessionMesgs"]).toHaveLength(1);
            expect(messages["activityMesgs"]).toHaveLength(1);
        });

        it("should handle session with no heart rate data", (): void => {
            testSession = createTestSession({
                records: testSession.records.map(
                    (record: IExportRecord): IExportRecord => ({
                        ...record,
                        heartRate: undefined,
                    }),
                ),
            });

            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["heartRate"]).toBeUndefined();
            expect(messages["lapMesgs"][0]["avgHeartRate"]).toBeUndefined();
            expect(messages["sessionMesgs"][0]["avgHeartRate"]).toBeUndefined();
            expect(messages["hrvMesgs"]).toBeUndefined();
        });

        it("should omit resistance when dragFactor is 0", (): void => {
            testSession = createTestSession({
                records: testSession.records.map(
                    (record: IExportRecord): IExportRecord => ({
                        ...record,
                        dragFactor: 0,
                    }),
                ),
            });

            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["resistance"]).toBeUndefined();
        });

        it("should omit resistance when dragFactor is 255 or higher", (): void => {
            testSession = createTestSession({
                records: testSession.records.map(
                    (record: IExportRecord): IExportRecord => ({
                        ...record,
                        dragFactor: 255,
                    }),
                ),
            });

            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["recordMesgs"][0]["resistance"]).toBeUndefined();
        });
    });
});
