import { Dexie } from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IHandleForcesEntity, IMetricsEntity } from "../database.interfaces";

import { AppDB } from "./app-database";

describe("AppDB", (): void => {
    const testDbName = "ESPRowingMonitorDB_MigrationTest";
    let appDb: AppDB;

    const seedV2Database = async (
        handleForcesRows: Array<Partial<IHandleForcesEntity>>,
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
});
