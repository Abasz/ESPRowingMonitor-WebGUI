import { Dexie, IndexSpec, Table } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IHandleForcesEntity, ILapEntity, IMetricsEntity } from "../database.interfaces";

import { AppDB } from "./app-database";

describe("AppDB", (): void => {
    const testDbName = "ESPRowingMonitorDB_MigrationTest";
    let appDb: AppDB;

    const seedV2Database = async (
        handleForcesRows: Array<Partial<IHandleForcesEntity> & { peakForce?: number }>,
        sessionDataRows: Array<Partial<IMetricsEntity>>,
    ): Promise<void> => {
        const seed = new Dexie(testDbName);
        seed.version(2).stores({
            deltaTimes: "&timeStamp, sessionId",
            handleForces: "&timeStamp, sessionId, [sessionId+strokeId]",
            sessionData: "&timeStamp, sessionId",
            connectedDevice: "&sessionId",
        });
        await seed.open();
        if (handleForcesRows.length > 0) {
            await seed.table("handleForces").bulkPut(handleForcesRows);
        }
        if (sessionDataRows.length > 0) {
            await seed.table("sessionData").bulkPut(sessionDataRows);
        }
        seed.close();
    };

    beforeEach((): void => {
        appDb = new AppDB(testDbName);
    });

    afterEach(async (): Promise<void> => {
        if (appDb.isOpen()) {
            appDb.close();
        }
        await Dexie.delete(testDbName);
    });

    describe("version 3 migration", (): void => {
        describe("handleForces table", (): void => {
            it("should set driveLength to 0 on records that lack it", async (): Promise<void> => {
                await seedV2Database(
                    [
                        {
                            timeStamp: 1000,
                            sessionId: 1,
                            strokeId: 1,
                            peakForce: 300,
                            handleForces: [100, 200],
                        },
                        {
                            timeStamp: 2000,
                            sessionId: 1,
                            strokeId: 2,
                            peakForce: 350,
                            handleForces: [110, 210],
                        },
                    ],
                    [],
                );

                await appDb.open();
                const records = await appDb.table<IHandleForcesEntity>("handleForces").toArray();

                expect(records).toHaveLength(2);
                expect(
                    records.find((record: IHandleForcesEntity): boolean => record.timeStamp === 1000)
                        ?.driveLength,
                ).toBe(0);
                expect(
                    records.find((record: IHandleForcesEntity): boolean => record.timeStamp === 2000)
                        ?.driveLength,
                ).toBe(0);
            });

            it("should delete peakForce from records", async (): Promise<void> => {
                await seedV2Database(
                    [
                        {
                            timeStamp: 1000,
                            sessionId: 1,
                            strokeId: 1,
                            peakForce: 300,
                            handleForces: [100, 200],
                        },
                    ],
                    [],
                );

                await appDb.open();
                const records = await appDb.table("handleForces").toArray();

                expect(records).toHaveLength(1);
                expect(records[0]).not.toHaveProperty("peakForce");
            });

            it("should not overwrite an existing driveLength value", async (): Promise<void> => {
                await seedV2Database(
                    [
                        {
                            timeStamp: 1000,
                            sessionId: 1,
                            strokeId: 1,
                            peakForce: 300,
                            handleForces: [100],
                            driveLength: 1.5,
                        },
                        { timeStamp: 2000, sessionId: 1, strokeId: 2, peakForce: 350, handleForces: [110] },
                    ],
                    [],
                );

                await appDb.open();
                const records = await appDb.table<IHandleForcesEntity>("handleForces").toArray();

                expect(
                    records.find((record: IHandleForcesEntity): boolean => record.timeStamp === 1000)
                        ?.driveLength,
                ).toBe(1.5);
                expect(
                    records.find((record: IHandleForcesEntity): boolean => record.timeStamp === 2000)
                        ?.driveLength,
                ).toBe(0);
            });
        });
    });

    describe("sessionData table", (): void => {
        it("should backfill elapsedTime on records that lack it", async (): Promise<void> => {
            const sessionId = 1000;
            await seedV2Database(
                [],
                [
                    { timeStamp: 2000, sessionId, strokeCount: 1, distance: 10 },
                    { timeStamp: 4500, sessionId, strokeCount: 2, distance: 25 },
                ],
            );

            await appDb.open();
            const records = await appDb.table<IMetricsEntity>("sessionData").toArray();

            expect(records).toHaveLength(2);
            // elapsedTime = (timeStamp - sessionId) / 1000
            expect(
                records.find((record: IMetricsEntity): boolean => record.timeStamp === 2000)?.elapsedTime,
            ).toBe(1);
            expect(
                records.find((record: IMetricsEntity): boolean => record.timeStamp === 4500)?.elapsedTime,
            ).toBe(3.5);
        });

        it("should not overwrite an existing elapsedTime value", async (): Promise<void> => {
            const sessionId = 1000;
            await seedV2Database(
                [],
                [
                    { timeStamp: 2000, sessionId, strokeCount: 1, distance: 10, elapsedTime: 0.5 },
                    { timeStamp: 4500, sessionId, strokeCount: 2, distance: 25 },
                ],
            );

            await appDb.open();
            const records = await appDb.table<IMetricsEntity>("sessionData").toArray();

            expect(
                records.find((record: IMetricsEntity): boolean => record.timeStamp === 2000)?.elapsedTime,
            ).toBe(0.5);
            expect(
                records.find((record: IMetricsEntity): boolean => record.timeStamp === 4500)?.elapsedTime,
            ).toBe(3.5);
        });
    });

    describe("setUpgradeProgressCallback", (): void => {
        it("should invoke the callback with (0, total) before any records are modified", async (): Promise<void> => {
            await seedV2Database(
                [
                    { timeStamp: 1000, sessionId: 1, strokeId: 1, peakForce: 300, handleForces: [100] },
                    { timeStamp: 2000, sessionId: 1, strokeId: 2, peakForce: 350, handleForces: [110] },
                ],
                [],
            );

            const calls: Array<[number, number]> = [];
            appDb.setUpgradeProgressCallback((processed: number, total: number): void => {
                calls.push([processed, total]);
            });

            await appDb.open();

            expect(calls[0]).toEqual([0, 2]);
        });

        it("should invoke the callback with (total, total) when all records have been processed", async (): Promise<void> => {
            await seedV2Database(
                [
                    { timeStamp: 1000, sessionId: 1, strokeId: 1, peakForce: 300, handleForces: [100] },
                    { timeStamp: 2000, sessionId: 1, strokeId: 2, peakForce: 350, handleForces: [110] },
                ],
                [],
            );

            const calls: Array<[number, number]> = [];
            appDb.setUpgradeProgressCallback((processed: number, total: number): void => {
                calls.push([processed, total]);
            });

            await appDb.open();

            const lastCall = calls[calls.length - 1];
            expect(lastCall).toEqual([2, 2]);
        });

        it("should not fire for every individual record (throttled to batches of 500 and final)", async (): Promise<void> => {
            await seedV2Database(
                [
                    { timeStamp: 1000, sessionId: 1, strokeId: 1, peakForce: 300, handleForces: [100] },
                    { timeStamp: 2000, sessionId: 1, strokeId: 2, peakForce: 350, handleForces: [110] },
                    { timeStamp: 3000, sessionId: 1, strokeId: 3, peakForce: 400, handleForces: [120] },
                ],
                [],
            );

            const calls: Array<[number, number]> = [];
            appDb.setUpgradeProgressCallback((processed: number, total: number): void => {
                calls.push([processed, total]);
            });

            await appDb.open();

            // for 3 records: initial (0,3) + final (3,3) = 2 calls, not 4 (one per record + initial)
            expect(calls).toHaveLength(2);
            expect(calls[0]).toEqual([0, 3]);
            expect(calls[1]).toEqual([3, 3]);
        });

        it("should not invoke the callback after it has been cleared with undefined", async (): Promise<void> => {
            await seedV2Database(
                [{ timeStamp: 1000, sessionId: 1, strokeId: 1, peakForce: 300, handleForces: [100] }],
                [],
            );

            const callback = vi.fn();
            appDb.setUpgradeProgressCallback(callback);
            appDb.setUpgradeProgressCallback(undefined);

            await appDb.open();

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("version 4 laps table", (): void => {
        it("should include laps table in schema", async (): Promise<void> => {
            await appDb.open();

            expect(appDb.tables.map((table: Table): string => table.name)).toContain("laps");
        });

        it("should have correct indexes on laps table", async (): Promise<void> => {
            await appDb.open();

            const lapsTable = appDb.table("laps");
            const schema = lapsTable.schema;

            expect(schema.primKey.name).toBe("timeStamp");
            expect(schema.indexes.map((index: IndexSpec): string => index.name)).toContain("sessionId");
        });

        it("should store and retrieve lap entities", async (): Promise<void> => {
            await appDb.open();

            const lap: ILapEntity = {
                sessionId: 1000,
                timeStamp: 2000,
                strokeIndex: 5,
                type: "manual",
                isPause: false,
            };

            await appDb.laps.add(lap);
            const stored = await appDb.laps.get(2000);

            expect(stored).toEqual(lap);
        });

        it("should query laps by sessionId", async (): Promise<void> => {
            await appDb.open();

            await appDb.laps.bulkAdd([
                { sessionId: 1000, timeStamp: 2000, strokeIndex: 5, type: "manual", isPause: false },
                { sessionId: 1000, timeStamp: 3000, strokeIndex: 10, type: "distance", isPause: false },
                { sessionId: 2000, timeStamp: 4000, strokeIndex: 3, type: "time", isPause: false },
            ]);

            const session1Laps = await appDb.laps.where({ sessionId: 1000 }).toArray();
            const session2Laps = await appDb.laps.where({ sessionId: 2000 }).toArray();

            expect(session1Laps).toHaveLength(2);
            expect(session2Laps).toHaveLength(1);
        });

        it("should store pause laps correctly", async (): Promise<void> => {
            await appDb.open();

            const pauseLap: ILapEntity = {
                sessionId: 1000,
                timeStamp: 5000,
                strokeIndex: 15,
                type: "manual",
                isPause: true,
            };

            await appDb.laps.add(pauseLap);
            const stored = await appDb.laps.get(5000);

            expect(stored?.isPause).toBe(true);
            expect(stored?.type).toBe("manual");
        });
    });
});
