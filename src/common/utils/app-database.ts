import Dexie, { Table } from "dexie";

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

    constructor() {
        super("ESPRowingMonitorDB");
        this.version(2).stores({
            deltaTimes: "&timeStamp, sessionId",
            handleForces: "&timeStamp, sessionId, [sessionId+strokeId]",
            sessionData: "&timeStamp, sessionId",
            connectedDevice: "&sessionId",
        });
    }
}

export const appDB = new AppDB();
