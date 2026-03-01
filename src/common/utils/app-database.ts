import { Dexie, Table, Transaction } from "dexie";

import {
    IConnectedDeviceEntity,
    IDeltaTimesEntity,
    IHandleForcesEntity,
    IMetricsEntity,
} from "../database.interfaces";

export class AppDB extends Dexie {
    connectedDevice!: Table<IConnectedDeviceEntity, number>;
    deltaTimes!: Table<IDeltaTimesEntity, number>;
    handleForces!: Table<IHandleForcesEntity, number>;
    sessionData!: Table<IMetricsEntity, number>;

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
                await transaction
                    .table<IHandleForcesEntity>("handleForces")
                    .filter((record: IHandleForcesEntity): boolean => record.driveLength === undefined)
                    .modify({ driveLength: 0 });

                console.log("Version 3 migration completed");
            });
    }
}

export const appDB = new AppDB();
