import { beforeEach, describe, expect, it } from "vitest";

import { IExportRecord, IExportSession } from "../../database.interfaces";

import { createSessionFitFile } from "./fit-file";
import { createTestSession, DecodedMessages, decodeValidMessages, rawFields } from "./fit-file.spec.helpers";

describe("createSessionFitFile developer fields", (): void => {
    let testSession: IExportSession;

    beforeEach((): void => {
        testSession = createTestSession();
    });

    describe("developer fields", (): void => {
        it("should include developer_data_id message", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["developerDataIdMesgs"]).toHaveLength(1);
            expect(messages["developerDataIdMesgs"][0]["developerDataIndex"]).toBe(0);
        });

        it("should include all 11 field descriptions when handle forces have curves", (): void => {
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["fieldDescriptionMesgs"]).toHaveLength(11);
        });

        it("should include only 7 field descriptions when no handle forces exist", (): void => {
            testSession = createTestSession({ handleForces: {} });
            const messages = decodeValidMessages(createSessionFitFile(testSession));

            expect(messages["fieldDescriptionMesgs"]).toHaveLength(7);
        });
    });

    describe("as part of developer field values", (): void => {
        const mapDevFieldsByName = (
            messages: DecodedMessages,
            mesgKey: keyof DecodedMessages,
            index: number,
        ): Record<string, unknown> => {
            const fieldDescs = messages["fieldDescriptionMesgs"];
            const mesg = rawFields(messages[mesgKey][index]);
            const devFields = mesg["developerFields"] as Record<string, unknown>;
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(devFields)) {
                const fd = fieldDescs[Number(key)];
                result[fd["fieldName"] as string] = value;
            }

            return result;
        };

        describe("on Record messages", (): void => {
            it("should include StrokeDriveTime, DragFactor, and StrokeRecoveryTime on every record", (): void => {
                const messages = decodeValidMessages(createSessionFitFile(testSession));

                const devFields0 = mapDevFieldsByName(messages, "recordMesgs", 0);
                expect(devFields0["StrokeDriveTime"]).toBe(800);
                expect(devFields0["DragFactor"]).toBe(110);
                expect(devFields0["StrokeRecoveryTime"]).toBe(1700);

                const devFields2 = mapDevFieldsByName(messages, "recordMesgs", 2);
                expect(devFields2["StrokeDriveTime"]).toBe(700);
                expect(devFields2["DragFactor"]).toBe(115);
                expect(devFields2["StrokeRecoveryTime"]).toBe(1400);
            });

            it("should omit StrokeDriveTime when driveDuration is 0", (): void => {
                testSession = createTestSession({
                    records: testSession.records.map(
                        (record: IExportRecord): IExportRecord => ({
                            ...record,
                            driveDuration: 0,
                        }),
                    ),
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "recordMesgs", 0);

                expect(devFields["StrokeDriveTime"]).toBeUndefined();
                expect(devFields["StrokeRecoveryTime"]).toBeDefined();
            });

            it("should omit StrokeRecoveryTime when recoveryDuration is 0", (): void => {
                testSession = createTestSession({
                    records: testSession.records.map(
                        (record: IExportRecord): IExportRecord => ({
                            ...record,
                            recoveryDuration: 0,
                        }),
                    ),
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "recordMesgs", 0);

                expect(devFields["StrokeRecoveryTime"]).toBeUndefined();
                expect(devFields["StrokeDriveTime"]).toBeDefined();
            });

            it("should not include handle-force-dependent fields when no handle forces exist", (): void => {
                testSession = createTestSession({ handleForces: {} });
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "recordMesgs", 0);

                expect(devFields["DriveLength"]).toBeUndefined();
                expect(devFields["AverageDriveForceN"]).toBeUndefined();
                expect(devFields["PeakDriveForceN"]).toBeUndefined();
                expect(devFields["PeakForcePositionNorm"]).toBeUndefined();
            });

            it("should include all scalar developer fields when handle forces exist", (): void => {
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "recordMesgs", 0);

                // record 0: strokeCount=1, handleForces[1] = {forces: [100, 200], peak: 200, pos: 0.6, drive: 1.2}
                expect(devFields["DriveLength"]).toBe(120);
                expect(devFields["StrokeDriveTime"]).toBe(800);
                expect(devFields["DragFactor"]).toBe(110);
                expect(devFields["StrokeRecoveryTime"]).toBe(1700);
                expect(devFields["AverageDriveForceN"]).toBe(150 * 10);
                expect(devFields["PeakDriveForceN"]).toBe(200 * 10);
                expect(devFields["PeakForcePositionNorm"]).toBe(60 * 100);
            });

            it("should include zero PeakDriveForceN and PeakForcePositionNorm when peakForce is 0", (): void => {
                testSession = createTestSession({
                    handleForces: {
                        1: {
                            peakForce: 0,
                            peakForcePositionNorm: 0,
                            driveLength: 1.2,
                            handleForces: [100, 200, 100],
                        },
                        2: {
                            peakForce: 0,
                            peakForcePositionNorm: 0,
                            driveLength: 1.3,
                            handleForces: [150, 250, 150],
                        },
                        3: {
                            peakForce: 0,
                            peakForcePositionNorm: 0,
                            driveLength: 1.25,
                            handleForces: [120, 220, 120],
                        },
                    },
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "recordMesgs", 0);

                expect(devFields["DriveLength"]).toBe(120);
                expect(devFields["AverageDriveForceN"]).toBeDefined();
                expect(devFields["PeakDriveForceN"]).toBe(0);
                expect(devFields["PeakForcePositionNorm"]).toBe(0);
            });

            it("should include zero AverageDriveForceN when handle forces array is empty", (): void => {
                testSession = createTestSession({
                    handleForces: {
                        1: {
                            peakForce: 250,
                            peakForcePositionNorm: 35,
                            driveLength: 1.2,
                            handleForces: [],
                        },
                        2: {
                            peakForce: 300,
                            peakForcePositionNorm: 40,
                            driveLength: 1.3,
                            handleForces: [],
                        },
                        3: {
                            peakForce: 280,
                            peakForcePositionNorm: 38,
                            driveLength: 1.25,
                            handleForces: [],
                        },
                    },
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "recordMesgs", 0);

                expect(devFields["DriveLength"]).toBe(120);
                expect(devFields["PeakDriveForceN"]).toBe(250 * 10);
                expect(devFields["PeakForcePositionNorm"]).toBe(350 * 10);
                expect(devFields["AverageDriveForceN"]).toBe(0);
            });

            it("should include DragFactor developer field even when native resistance is omitted", (): void => {
                testSession = createTestSession({
                    records: testSession.records.map(
                        (record: IExportRecord): IExportRecord => ({
                            ...record,
                            dragFactor: 255,
                        }),
                    ),
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "recordMesgs", 0);

                expect(messages["recordMesgs"][0]["resistance"]).toBeUndefined();
                expect(devFields["DragFactor"]).toBe(255);
            });
        });

        describe("on Lap and Session messages", (): void => {
            it("should include average DragFactor on Lap", (): void => {
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "lapMesgs", 0);

                // mean of 110, 112, 115 = 112.33 → rounded to 112
                expect(devFields["DragFactor"]).toBe(112);
            });

            it("should include average DragFactor on Session", (): void => {
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "sessionMesgs", 0);

                // mean of 110, 112, 115 = 112.33 → rounded to 112
                expect(devFields["DragFactor"]).toBe(112);
            });

            it("should include average DragFactor on Split", (): void => {
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "splitMesgs", 0);

                // mean of 110, 112, 115 = 112.33 → rounded to 112
                expect(devFields["DragFactor"]).toBe(112);
            });
        });

        describe("on Record force curves", (): void => {
            it("should include HandleForceCurve with scaled values padded to maxCurvePointCount", (): void => {
                testSession = createTestSession({
                    handleForces: {
                        1: {
                            peakForce: 250,
                            peakForcePositionNorm: 35,
                            driveLength: 1.2,
                            handleForces: [100, 200, 250, 200, 100],
                        },
                        2: {
                            peakForce: 300,
                            peakForcePositionNorm: 40,
                            driveLength: 1.3,
                            handleForces: [150, 300, 150],
                        },
                        3: {
                            peakForce: 280,
                            peakForcePositionNorm: 38,
                            driveLength: 1.25,
                            handleForces: [120, 220, 280, 120],
                        },
                    },
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));

                const devFields0 = mapDevFieldsByName(messages, "recordMesgs", 0);
                expect(devFields0["HandleForceCurve"]).toEqual([
                    100 * 10,
                    200 * 10,
                    250 * 10,
                    200 * 10,
                    100 * 10,
                ]);

                const devFields1 = mapDevFieldsByName(messages, "recordMesgs", 1);
                expect(devFields1["HandleForceCurve"]).toEqual([150 * 10, 300 * 10, 150 * 10, 0, 0]);

                const devFields2 = mapDevFieldsByName(messages, "recordMesgs", 2);
                expect(devFields2["HandleForceCurve"]).toEqual([120 * 10, 220 * 10, 280 * 10, 120 * 10, 0]);
            });

            it("should include abscissa metadata for each record with curve data", (): void => {
                testSession = createTestSession({
                    handleForces: {
                        1: {
                            peakForce: 250,
                            peakForcePositionNorm: 35,
                            driveLength: 1.2,
                            handleForces: [100, 200, 250, 200, 100],
                        },
                        2: {
                            peakForce: 300,
                            peakForcePositionNorm: 40,
                            driveLength: 1.3,
                            handleForces: [150, 300, 150],
                        },
                    },
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));

                const devFields0 = mapDevFieldsByName(messages, "recordMesgs", 0);
                expect(devFields0["InstrokeAbscissaType"]).toBe(2);
                expect(devFields0["InstrokeSampleInterval"]).toBe(2400);
                expect(devFields0["InstrokePointCount"]).toBe(5);

                const devFields1 = mapDevFieldsByName(messages, "recordMesgs", 1);
                expect(devFields1["InstrokeAbscissaType"]).toBe(2);
                expect(devFields1["InstrokeSampleInterval"]).toBe(4333);
                expect(devFields1["InstrokePointCount"]).toBe(3);
            });

            it("should omit curve fields when handle forces array is empty", (): void => {
                testSession = createTestSession({
                    handleForces: {
                        1: {
                            peakForce: 250,
                            peakForcePositionNorm: 35,
                            driveLength: 1.2,
                            handleForces: [],
                        },
                        2: {
                            peakForce: 300,
                            peakForcePositionNorm: 40,
                            driveLength: 1.3,
                            handleForces: [],
                        },
                        3: {
                            peakForce: 280,
                            peakForcePositionNorm: 38,
                            driveLength: 1.25,
                            handleForces: [],
                        },
                    },
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "recordMesgs", 0);

                expect(devFields["HandleForceCurve"]).toBeUndefined();
                expect(devFields["InstrokeAbscissaType"]).toBeUndefined();
                expect(devFields["InstrokeSampleInterval"]).toBeUndefined();
                expect(devFields["InstrokePointCount"]).toBeUndefined();
            });

            it("should truncate curve to 127 points when stroke has 128 or more points", (): void => {
                const longCurve = Array.from(
                    { length: 130 },
                    (_: undefined, index: number): number => index * 2,
                );
                testSession = createTestSession({
                    handleForces: {
                        1: {
                            peakForce: 250,
                            peakForcePositionNorm: 35,
                            driveLength: 1.5,
                            handleForces: longCurve,
                        },
                        2: {
                            peakForce: 300,
                            peakForcePositionNorm: 40,
                            driveLength: 1.5,
                            handleForces: longCurve,
                        },
                        3: {
                            peakForce: 280,
                            peakForcePositionNorm: 38,
                            driveLength: 1.5,
                            handleForces: longCurve,
                        },
                    },
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));
                const devFields = mapDevFieldsByName(messages, "recordMesgs", 0);

                expect(devFields["AverageDriveForceN"]).toBeDefined();
                expect(devFields["HandleForceCurve"]).toEqual(
                    longCurve.slice(0, 127).map((force: number): number => force * 10),
                );
                expect(devFields["InstrokePointCount"]).toBe(127);
                expect(devFields["InstrokeSampleInterval"]).toBe(Math.round((1.5 / 130) * 10000));
            });

            it("should handle mixed curves where some strokes have data and others are empty", (): void => {
                testSession = createTestSession({
                    handleForces: {
                        1: {
                            peakForce: 250,
                            peakForcePositionNorm: 35,
                            driveLength: 1.2,
                            handleForces: [100, 200, 250, 200, 100],
                        },
                        2: {
                            peakForce: 300,
                            peakForcePositionNorm: 40,
                            driveLength: 1.3,
                            handleForces: [],
                        },
                        3: {
                            peakForce: 280,
                            peakForcePositionNorm: 38,
                            driveLength: 1.25,
                            handleForces: [120, 220, 280],
                        },
                    },
                });
                const messages = decodeValidMessages(createSessionFitFile(testSession));

                const devFields0 = mapDevFieldsByName(messages, "recordMesgs", 0);
                expect(devFields0["HandleForceCurve"]).toEqual([
                    100 * 10,
                    200 * 10,
                    250 * 10,
                    200 * 10,
                    100 * 10,
                ]);
                expect(devFields0["InstrokePointCount"]).toBe(5);

                const devFields1 = mapDevFieldsByName(messages, "recordMesgs", 1);
                expect(devFields1["HandleForceCurve"]).toBeUndefined();
                expect(devFields1["InstrokeAbscissaType"]).toBeUndefined();

                const devFields2 = mapDevFieldsByName(messages, "recordMesgs", 2);
                expect(devFields2["HandleForceCurve"]).toEqual([120 * 10, 220 * 10, 280 * 10, 0, 0]);
                expect(devFields2["InstrokePointCount"]).toBe(3);
            });
        });
    });
});
