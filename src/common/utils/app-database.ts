import Dexie, { Table } from "dexie";

import { IDeltaTimesEntity, IHandleForcesEntity, IMetricsEntity } from "../database.interfaces";

export class AppDB extends Dexie {
    deltaTimes!: Table<IDeltaTimesEntity, number>;
    handleForces!: Table<IHandleForcesEntity, number>;
    sessionData!: Table<IMetricsEntity, number>;

    constructor() {
        super("ESPRowingMonitorDB");
        this.version(1).stores({
            deltaTimes: "&timeStamp, sessionId",
            handleForces: "&timeStamp, sessionId, [sessionId+strokeId]",
            sessionData: "&timeStamp, sessionId",
        });
    }
}

export const appDB = new AppDB();
