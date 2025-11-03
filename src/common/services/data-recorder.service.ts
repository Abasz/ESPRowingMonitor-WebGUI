import { Injectable } from "@angular/core";
import { Dexie, IndexableTypePart, liveQuery } from "dexie";
import { exportDB, ExportProgress, importInto, peakImportFile } from "dexie-export-import";
import { ImportProgress } from "dexie-export-import/dist/import";
import { parse } from "js2xmlparser";
import { filter, from, Observable } from "rxjs";

import { ISessionData, ISessionSummary } from "../common.interfaces";
import {
    ExportSessionData,
    IConnectedDeviceEntity,
    IDeltaTimesEntity,
    IHandleForcesEntity,
    IMetricsEntity,
} from "../database.interfaces";
import { appDB } from "../utils/app-database";
import { createSessionTcxObject } from "../utils/utility.functions";

@Injectable({
    providedIn: "root",
})
export class DataRecorderService {
    private currentSessionId: number = Date.now();

    addConnectedDevice(deviceName: string): Promise<number> {
        return appDB.connectedDevice.put({ deviceName, sessionId: this.currentSessionId });
    }

    addDeltaTimes(deltaTimes: Array<number>): Promise<number> {
        return appDB.deltaTimes.put({
            sessionId: this.currentSessionId,
            timeStamp: Date.now(),
            deltaTimes,
        });
    }

    addSessionData(rowingData: ISessionData): Promise<void> {
        return appDB.transaction("rw", appDB.sessionData, appDB.handleForces, async (): Promise<void> => {
            const timeStamp: number = Date.now();

            appDB.sessionData.add({
                sessionId: this.currentSessionId,
                timeStamp,
                avgStrokePower: rowingData.avgStrokePower,
                distance: rowingData.distance,
                distPerStroke: rowingData.distPerStroke,
                dragFactor: rowingData.dragFactor,
                driveDuration: rowingData.driveDuration,
                recoveryDuration: rowingData.recoveryDuration,
                speed: rowingData.speed,
                strokeCount: rowingData.strokeCount,
                strokeRate: rowingData.strokeRate,
                heartRate: rowingData.heartRate,
            });

            appDB.handleForces.put({
                timeStamp:
                    (
                        await appDB.handleForces
                            .where({
                                sessionId: this.currentSessionId,
                                strokeId: rowingData.strokeCount,
                            })
                            .last()
                    )?.timeStamp ?? timeStamp,
                sessionId: this.currentSessionId,
                strokeId: rowingData.strokeCount,
                peakForce: rowingData.peakForce,
                handleForces: rowingData.handleForces,
            });
        });
    }

    deleteSession(sessionId: number): Promise<[number, number, number, number]> {
        return appDB.transaction(
            "rw",
            appDB.sessionData,
            appDB.deltaTimes,
            appDB.handleForces,
            appDB.connectedDevice,
            (): Promise<[number, number, number, number]> =>
                Promise.all([
                    appDB.sessionData.where({ sessionId }).delete(),
                    appDB.deltaTimes.where({ sessionId }).delete(),
                    appDB.handleForces.where({ sessionId }).delete(),
                    appDB.connectedDevice.where({ sessionId }).delete(),
                ]),
        );
    }

    async export(progressCallback?: (progress: ExportProgress) => boolean): Promise<void> {
        const database = await exportDB(appDB, { progressCallback });
        const name = `${new Date().toDateTimeStringFormat()} - database.json`;

        this.createDownload(database, name);
    }

    async exportSessionToJson(sessionId: number): Promise<void> {
        const [deltaTimes, rowingSessionData]: [Array<number>, Array<ExportSessionData>] = await Promise.all([
            this.getDeltaTimes(sessionId),
            this.getSessionData(sessionId),
        ]);

        if (deltaTimes.length > 0) {
            const blob = new Blob([JSON.stringify(deltaTimes)], { type: "application/json" });
            const name = `${new Date(sessionId).toDateTimeStringFormat()} - deltaTimes`;
            this.createDownload(blob, name);
        }

        const blob = new Blob([JSON.stringify(rowingSessionData)], { type: "application/json" });
        const name = `${new Date(sessionId).toDateTimeStringFormat()} - session`;
        this.createDownload(blob, name);
    }

    async exportSessionToTcx(sessionId: number): Promise<void> {
        const rowingSessionData = await this.getSessionData(sessionId);

        const blob = new Blob(
            [
                parse("TrainingCenterDatabase", createSessionTcxObject(sessionId, rowingSessionData), {
                    format: {
                        doubleQuotes: true,
                    },
                }),
            ],
            {
                type: "application/vnd.garmin.tcx+xml",
            },
        );
        const name = `${new Date(sessionId).toDateTimeStringFormat()} - session.tcx`;
        this.createDownload(blob, name);
    }

    getSessionSummaries$(): Observable<Array<ISessionSummary>> {
        return from(
            liveQuery(
                (): Promise<Array<ISessionSummary | undefined>> =>
                    appDB.transaction(
                        "r",
                        appDB.sessionData,
                        appDB.connectedDevice,
                        async (): Promise<Array<ISessionSummary | undefined>> => {
                            const uniqueSessionIds = [];

                            try {
                                uniqueSessionIds.push(
                                    ...(await appDB.sessionData.orderBy("sessionId").uniqueKeys()),
                                );
                            } catch (error) {
                                if (!(error instanceof Dexie.UnknownError)) {
                                    console.error("Error fetching unique session IDs:", error);
                                }
                            }

                            return Promise.all(
                                uniqueSessionIds.map(
                                    async (
                                        sessionId: IndexableTypePart,
                                    ): Promise<ISessionSummary | undefined> => {
                                        const [connectedDevice, first, last]: [
                                            IConnectedDeviceEntity | undefined,
                                            IMetricsEntity | undefined,
                                            IMetricsEntity | undefined,
                                        ] = await Promise.all([
                                            appDB.connectedDevice.where({ sessionId }).last(),
                                            appDB.sessionData.where({ sessionId }).first(),
                                            appDB.sessionData.where({ sessionId }).last(),
                                        ]);

                                        if (first === undefined || last === undefined) {
                                            return undefined;
                                        }

                                        return {
                                            sessionId: last.sessionId,
                                            deviceName: connectedDevice?.deviceName,
                                            startTime: first.timeStamp - first.driveDuration / 1000,
                                            finishTime: last.timeStamp,
                                            distance: last.distance,
                                            strokeCount: last.strokeCount,
                                        };
                                    },
                                ),
                            );
                        },
                    ),
            ),
        ).pipe(
            filter(
                (value: Array<ISessionSummary | undefined>): value is Array<ISessionSummary> =>
                    value !== undefined,
            ),
        );
    }

    async import(blob: Blob, progressCallback?: (progress: ImportProgress) => boolean): Promise<void> {
        const importMeta = await peakImportFile(blob);
        console.log("Database name:", importMeta.data.databaseName);
        console.log("Database version:", importMeta.data.databaseVersion);
        console.log(
            "Tables:",
            importMeta.data.tables
                .map(
                    (table: { name: string; schema: string; rowCount: number }): string =>
                        `${table.name} (${table.rowCount} rows)`,
                )
                .join("\n\t"),
        );

        return importInto(appDB, blob, {
            overwriteValues: true,
            progressCallback,
        });
    }

    reset(): void {
        this.currentSessionId = Date.now();
    }

    private createDownload(blob: Blob, name: string): void {
        const url = window.URL.createObjectURL(blob);
        const downloadTag = document.createElement("a");
        downloadTag.href = url;
        downloadTag.download = name;
        downloadTag.click();
    }

    private async getDeltaTimes(sessionId: number): Promise<Array<number>> {
        return (await appDB.deltaTimes.where({ sessionId }).toArray()).reduce(
            (previousValue: Array<number>, currentValue: IDeltaTimesEntity): Array<number> => {
                previousValue.push(...currentValue.deltaTimes);

                return previousValue;
            },
            [],
        );
    }

    private async getSessionData(sessionId: number): Promise<Array<ExportSessionData>> {
        return appDB.transaction(
            "r",
            appDB.sessionData,
            appDB.handleForces,
            async (): Promise<Array<ExportSessionData>> => {
                const [metricsEntity, handleForcesEntity]: [
                    Array<IMetricsEntity>,
                    Array<IHandleForcesEntity>,
                ] = await Promise.all([
                    appDB.sessionData.where({ sessionId }).toArray(),
                    appDB.handleForces.where({ sessionId }).toArray(),
                ]);

                const handleForces: { [key: number]: IHandleForcesEntity } = handleForcesEntity.reduce(
                    (
                        previousValue: { [key: number]: IHandleForcesEntity },
                        currentValue: IHandleForcesEntity,
                    ): { [key: number]: IHandleForcesEntity } => {
                        previousValue[currentValue.strokeId] = {
                            ...currentValue,
                        };

                        return previousValue;
                    },
                    {},
                );

                const rowingSessionData: Array<ExportSessionData> = metricsEntity.map(
                    (metric: IMetricsEntity): ExportSessionData => ({
                        avgStrokePower: metric.avgStrokePower,
                        distance: metric.distance,
                        distPerStroke: metric.distPerStroke,
                        dragFactor: metric.dragFactor,
                        driveDuration: metric.driveDuration,
                        heartRate: metric.heartRate,
                        recoveryDuration: metric.recoveryDuration,
                        speed: metric.speed,
                        strokeCount: metric.strokeCount,
                        strokeRate: metric.strokeRate,
                        timeStamp: new Date(metric.timeStamp),
                        peakForce: handleForces[metric.strokeCount].peakForce,
                        handleForces: handleForces[metric.strokeCount].handleForces,
                    }),
                );

                return rowingSessionData;
            },
        );
    }
}
