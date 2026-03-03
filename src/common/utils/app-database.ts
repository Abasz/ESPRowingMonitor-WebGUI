import { Dexie, Table, Transaction } from "dexie";

import {
    IConnectedDeviceEntity,
    IDeltaTimesEntity,
    IHandleForcesEntity,
    IMetricsEntity,
} from "../database.interfaces";

export class AppDB extends Dexie {
    static dbVersion: number = 3;

    connectedDevice!: Table<IConnectedDeviceEntity, number>;
    deltaTimes!: Table<IDeltaTimesEntity, number>;
    handleForces!: Table<IHandleForcesEntity, number>;
    sessionData!: Table<IMetricsEntity, number>;

    private upgradeProgressCallback: ((processed: number, total: number) => void) | undefined;

    constructor(name: string = "ESPRowingMonitorDB") {
        super(name);

        this.version(2).stores({
            deltaTimes: "&timeStamp, sessionId",
            handleForces: "&timeStamp, sessionId, [sessionId+strokeId]",
            sessionData: "&timeStamp, sessionId",
            connectedDevice: "&sessionId",
        });

        this.version(AppDB.dbVersion)
            .stores({
                deltaTimes: "&timeStamp, sessionId",
                handleForces: "&timeStamp, sessionId, [sessionId+strokeId]",
                sessionData: "&timeStamp, sessionId",
                connectedDevice: "&sessionId",
            })
            .upgrade(async (transaction: Transaction): Promise<void> => {
                console.log("Running version 3 migration: Adding driveLength to handleForces records");

                const table = transaction.table<IHandleForcesEntity>("handleForces");
                const total = await table.count();

                let processed = 0;
                this.upgradeProgressCallback?.(0, total);

                await table.toCollection().modify((record: IHandleForcesEntity): void => {
                    processed++;
                    if (processed % 500 === 0 || processed === total) {
                        this.upgradeProgressCallback?.(processed, total);
                    }

                    if (record.driveLength !== undefined) {
                        return;
                    }

                    record.driveLength = 0;
                });

                console.log("Version 3 migration completed");
            });
    }

    setUpgradeProgressCallback(fn: ((processed: number, total: number) => void) | undefined): void {
        this.upgradeProgressCallback = fn;
    }
}

export const appDB = new AppDB();
