import { Dexie, Table, Transaction } from "dexie";

import {
    IConnectedDeviceEntity,
    IDeltaTimesEntity,
    IHandleForcesEntity,
    ILapEntity,
    IMetricsEntity,
    ISessionUploadEntity,
} from "../database.interfaces";

export class AppDB extends Dexie {
    static dbVersion: number = 4;

    connectedDevice!: Table<IConnectedDeviceEntity, number>;
    deltaTimes!: Table<IDeltaTimesEntity, number>;
    handleForces!: Table<IHandleForcesEntity, number>;
    laps!: Table<ILapEntity, number>;
    sessionData!: Table<IMetricsEntity, number>;
    sessionUploads!: Table<ISessionUploadEntity, number>;

    private upgradeProgressCallback: ((processed: number, total: number) => void) | undefined;

    constructor(name: string = "ESPRowingMonitorDB") {
        super(name);

        this.version(2).stores({
            deltaTimes: "&timeStamp, sessionId",
            handleForces: "&timeStamp, sessionId, [sessionId+strokeId]",
            sessionData: "&timeStamp, sessionId",
            connectedDevice: "&sessionId",
        });

        this.version(3)
            .stores({
                deltaTimes: "&timeStamp, sessionId",
                handleForces: "&timeStamp, sessionId, [sessionId+strokeId]",
                sessionData: "&timeStamp, sessionId",
                connectedDevice: "&sessionId",
            })
            .upgrade(async (transaction: Transaction): Promise<void> => {
                console.log("Running version 3 migration");

                const handleForcesTable = transaction.table<IHandleForcesEntity>("handleForces");
                const sessionDataTable = transaction.table<IMetricsEntity>("sessionData");

                const counts = await Promise.all([handleForcesTable.count(), sessionDataTable.count()]);

                const total = counts[0] + counts[1];
                let processed = 0;
                this.upgradeProgressCallback?.(0, total);

                const reportProgress = (): void => {
                    processed++;
                    if (processed % 500 === 0 || processed === total) {
                        this.upgradeProgressCallback?.(processed, total);
                    }
                };

                await Promise.all([
                    handleForcesTable.toCollection().modify((record: IHandleForcesEntity): void => {
                        reportProgress();

                        delete (record as IHandleForcesEntity & { peakForce?: number })?.peakForce;

                        if (record.driveLength !== undefined) {
                            return;
                        }

                        record.driveLength = 0;
                    }),
                    sessionDataTable.toCollection().modify((record: IMetricsEntity): void => {
                        reportProgress();
                        if (record.elapsedTime !== undefined) {
                            return;
                        }

                        record.elapsedTime = (record.timeStamp - record.sessionId) / 1000;
                    }),
                ]);

                console.log("Version 3 migration completed");
            });

        this.version(AppDB.dbVersion).stores({
            deltaTimes: "&timeStamp, sessionId",
            handleForces: "&timeStamp, sessionId, [sessionId+strokeId]",
            sessionData: "&timeStamp, sessionId",
            connectedDevice: "&sessionId",
            laps: "&timeStamp, sessionId",
            sessionUploads: "&sessionId",
        });
    }

    setUpgradeProgressCallback(fn: ((processed: number, total: number) => void) | undefined): void {
        this.upgradeProgressCallback = fn;
    }
}

export const appDB = new AppDB();
