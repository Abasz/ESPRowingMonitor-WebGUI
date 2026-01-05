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

        this.createDownload([{ blob: database, name }]);
    }

    async exportSessionToJson(sessionId: number): Promise<void> {
        const [deltaTimes, rowingSessionData]: [Array<number>, Array<ExportSessionData>] = await Promise.all([
            this.getDeltaTimes(sessionId),
            this.getSessionData(sessionId),
        ]);

        const files: Array<{ blob: Blob; name: string }> = [
            {
                blob: new Blob([JSON.stringify(rowingSessionData)], { type: "application/json" }),
                name: `${new Date(sessionId).toDateTimeStringFormat()} - session.json`,
            },
        ];

        if (deltaTimes.length > 0) {
            const blob = new Blob([JSON.stringify(deltaTimes)], { type: "application/json" });
            const name = `${new Date(sessionId).toDateTimeStringFormat()} - deltaTimes.json`;
            files.push({ blob, name });
        }

        this.createDownload(files);
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
        this.createDownload([{ blob, name }]);
    }

    async exportSessionToCsv(sessionId: number): Promise<void> {
        const [deltaTimes, rowingSessionData]: [Array<number>, Array<ExportSessionData>] = await Promise.all([
            this.getDeltaTimes(sessionId),
            this.getSessionData(sessionId),
        ]);

        const csvContent = this.formatSessionCsv(rowingSessionData);

        const files: Array<{ blob: Blob; name: string }> = [
            {
                blob: new Blob([csvContent], { type: "text/csv" }),
                name: `${new Date(sessionId).toDateTimeStringFormat()} - session.csv`,
            },
        ];

        if (deltaTimes.length > 0) {
            const deltaTimesContent = this.formatDeltaTimesCsv(deltaTimes);
            const blob = new Blob([deltaTimesContent], { type: "text/csv" });
            const name = `${new Date(sessionId).toDateTimeStringFormat()} - deltaTimes.csv`;
            files.push({ blob, name });
        }

        this.createDownload(files);
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

    private async createDownload(files: Array<{ blob: Blob; name: string }>): Promise<void> {
        const shareData: ShareData = {
            files: files.map(
                (file: { blob: Blob; name: string }): File =>
                    new File([file.blob], file.name, { type: file.blob.type }),
            ),
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);

                return;
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    !["AbortError", "NotAllowedError"].includes(error.name)
                ) {
                    console.error("Error sharing file:", error.name);
                }
            }
        }

        for (const file of files) {
            const url = window.URL.createObjectURL(file.blob);
            const downloadTag = document.createElement("a");
            downloadTag.href = url;
            downloadTag.download = file.name;
            downloadTag.click();
            window.URL.revokeObjectURL(url);
        }
    }

    private formatSessionCsv(rowingSessionData: Array<ExportSessionData>): string {
        const headers = [
            "Stroke Number",
            "Elapsed Time",
            "Distance (m)",
            "Pace (500m)",
            "Speed (km/h)",
            "Stroke Power (W)",
            "Stroke Rate",
            "Distance per Stroke (m)",
            "Drive Duration (s)",
            "Recovery Duration (s)",
            "Heart Rate",
            "Drag Factor",
            "Peak Force (N)",
            "Handle Forces (N)",
        ].join(",");

        const startTime = rowingSessionData[0].timeStamp.getTime();
        let csvBody = `${headers}\n`;
        let previousStroke: ExportSessionData | undefined = rowingSessionData[0];

        for (const data of rowingSessionData) {
            if (previousStroke !== data && previousStroke.strokeCount === data.strokeCount) {
                continue;
            }

            const elapsedTime = (data.timeStamp.getTime() - startTime) / 1000;

            const calculatedSpeed =
                previousStroke.distance === 0
                    ? data.distance / 100 / elapsedTime
                    : (data.strokeRate / 60) * data.distPerStroke;

            const handleForcesFormatted = `"${data.handleForces.map((force: number): string => force.toFixed(2)).join(",")}"`;
            const heartRateValue =
                data.heartRate?.heartRate !== null && data.heartRate?.heartRate !== undefined
                    ? data.heartRate.heartRate.toString()
                    : "NaN";

            const isCalculatedSpeedNaN = isNaN(calculatedSpeed);

            const row = [
                data.strokeCount.toString(),
                elapsedTime.toFixed(2),
                (data.distance / 100).toString(),
                (isCalculatedSpeedNaN || calculatedSpeed === 0 ? 0 : 500 / calculatedSpeed).toFixed(2),
                (isCalculatedSpeedNaN ? 0 : calculatedSpeed * 3.6).toFixed(2),
                data.avgStrokePower.toString(),
                Math.round(data.strokeRate).toString(),
                data.distPerStroke.toString(),
                data.driveDuration.toFixed(2),
                data.recoveryDuration.toFixed(2),
                heartRateValue,
                data.dragFactor.toString(),
                data.peakForce.toFixed(2),
                handleForcesFormatted,
            ].join(",");

            csvBody += `${row}\n`;
            previousStroke = data;
        }

        return `${csvBody}\n`;
    }

    private formatDeltaTimesCsv(deltaTimes: Array<number>): string {
        return deltaTimes.map((deltaTime: number): string => deltaTime.toString()).join("\n");
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
