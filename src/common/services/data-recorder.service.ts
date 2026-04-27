import { Injectable } from "@angular/core";
import { Dexie, IndexableTypePart, liveQuery } from "dexie";
import { exportDB, ExportProgress, importInto, peakImportFile } from "dexie-export-import";
import { ImportProgress } from "dexie-export-import/dist/import";
import { filter, from, Observable } from "rxjs";

import { ISessionData, ISessionSummary } from "../common.interfaces";
import {
    IConnectedDeviceEntity,
    IDeltaTimesEntity,
    IExportHandleForces,
    IExportRecord,
    IExportSession,
    IHandleForcesEntity,
    ILapEntity,
    ILapExport,
    IMetricsEntity,
    LapType,
} from "../database.interfaces";
import { appDB } from "../utils/app-database";
import { createSessionFitFile } from "../utils/fit-file/fit-file";
import { downloadFiles } from "../utils/utility.functions";

@Injectable({
    providedIn: "root",
})
export class DataRecorderService {
    private _sessionId: number = Date.now();

    get currentSessionId(): number {
        return this._sessionId;
    }

    addConnectedDevice(deviceName: string): Promise<number> {
        const sessionId = this.currentSessionId;

        return appDB.connectedDevice.put({ deviceName, sessionId });
    }

    addLap(strokeIndex: number, type: LapType, isPause: boolean = false): Promise<number> {
        return appDB.laps.add({
            sessionId: this.currentSessionId,
            timeStamp: Date.now(),
            strokeIndex,
            type,
            isPause,
        });
    }

    addDeltaTimes(deltaTimes: Array<number>): Promise<number> {
        const sessionId = this.currentSessionId;

        return appDB.deltaTimes.put({
            sessionId,
            timeStamp: Date.now(),
            deltaTimes,
        });
    }

    addSessionData(rowingData: ISessionData): Promise<void> {
        const timeStamp: number = Date.now();
        const sessionId: number = this.currentSessionId;

        return appDB.transaction("rw", appDB.sessionData, appDB.handleForces, async (): Promise<void> => {
            await Promise.all([
                appDB.sessionData.add({
                    sessionId,
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
                    elapsedTime: rowingData.elapsedTime,
                    heartRate: rowingData.heartRate,
                }),
                appDB.handleForces.put({
                    timeStamp:
                        (
                            await appDB.handleForces
                                .where({
                                    sessionId,
                                    strokeId: rowingData.strokeCount,
                                })
                                .last()
                        )?.timeStamp ?? timeStamp,
                    sessionId,
                    strokeId: rowingData.strokeCount,
                    handleForces: rowingData.handleForces,
                    driveLength: rowingData.driveLength,
                }),
            ]);
        });
    }

    async hasSessions(): Promise<boolean> {
        return (await appDB.sessionData.count()) > 0;
    }

    deleteSession(sessionId: number): Promise<void> {
        return appDB.transaction(
            "rw",
            [
                appDB.sessionData,
                appDB.deltaTimes,
                appDB.handleForces,
                appDB.connectedDevice,
                appDB.laps,
                appDB.sessionUploads,
            ],
            async (): Promise<void> => {
                await Promise.all([
                    appDB.sessionData.where({ sessionId }).delete(),
                    appDB.deltaTimes.where({ sessionId }).delete(),
                    appDB.handleForces.where({ sessionId }).delete(),
                    appDB.connectedDevice.where({ sessionId }).delete(),
                    appDB.laps.where({ sessionId }).delete(),
                    appDB.sessionUploads.where({ sessionId }).delete(),
                ]);
            },
        );
    }

    async export(progressCallback?: (progress: ExportProgress) => boolean): Promise<void> {
        const database = await exportDB(appDB, { progressCallback });
        const name = `${new Date().toDateTimeStringFormat()} - database.json`;

        downloadFiles([{ blob: database, name }]);
    }

    async exportSessionToJson(sessionId: number): Promise<void> {
        const [deltaTimes, exportSession]: [Array<number>, IExportSession] = await Promise.all([
            this.getDeltaTimes(sessionId),
            this.buildExportSession(sessionId),
        ]);

        const files: Array<{ blob: Blob; name: string }> = [
            {
                blob: new Blob([JSON.stringify(exportSession)], { type: "application/json" }),
                name: `${new Date(sessionId).toDateTimeStringFormat()} - session.json`,
            },
        ];

        if (deltaTimes.length > 0) {
            const blob = new Blob([JSON.stringify(deltaTimes)], { type: "application/json" });
            const name = `${new Date(sessionId).toDateTimeStringFormat()} - deltaTimes.json`;
            files.push({ blob, name });
        }

        downloadFiles(files);
    }

    async generateFitFile(sessionId: number): Promise<Blob> {
        const exportSession = await this.buildExportSession(sessionId);
        const fitData = createSessionFitFile(exportSession);

        return new Blob([fitData as ArrayBuffer], { type: "application/vnd.ant.fit" });
    }

    async exportSessionToFit(sessionId: number): Promise<void> {
        const blob = await this.generateFitFile(sessionId);
        const name = `${new Date(sessionId).toDateTimeStringFormat()} - session.fit`;
        downloadFiles([{ blob, name }]);
    }

    async exportSessionToCsv(sessionId: number): Promise<void> {
        const [deltaTimes, exportSession]: [Array<number>, IExportSession] = await Promise.all([
            this.getDeltaTimes(sessionId),
            this.buildExportSession(sessionId),
        ]);

        const csvContent = this.formatSessionCsv(exportSession);

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

        downloadFiles(files);
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
                                            elapsedTime: last.elapsedTime,
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

    getLaps(sessionId: number): Promise<Array<ILapEntity>> {
        return appDB.laps.where({ sessionId }).sortBy("timeStamp");
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

    async reset(connectedDeviceName?: string): Promise<void> {
        this._sessionId = Date.now();

        if (connectedDeviceName) {
            await this.addConnectedDevice(connectedDeviceName);
        }
    }

    private formatSessionCsv(exportSession: IExportSession): string {
        const {
            records,
            handleForces,
        }: { records: Array<IExportRecord>; handleForces: Record<number, IExportHandleForces> } =
            exportSession;
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
            "Drive Length (m)",
            "Heart Rate",
            "Drag Factor",
            "Peak Force (N)",
            "Peak Force Position (%)",
            "Handle Forces (N)",
        ].join(",");

        let csvBody = `${headers}\n`;
        let previousStroke: IExportRecord | undefined = records[0];

        for (const data of records) {
            if (previousStroke !== data && previousStroke.strokeCount === data.strokeCount) {
                continue;
            }

            const calculatedSpeed =
                previousStroke.distance === 0
                    ? data.elapsedTime > 0
                        ? data.distance / 100 / data.elapsedTime
                        : 0
                    : (data.strokeRate / 60) * data.distPerStroke;

            const handleForce: IExportHandleForces = handleForces[data.strokeCount] ?? {
                handleForces: [],
                driveLength: 0,
                peakForce: 0,
                peakForcePositionNorm: 0,
            };
            const handleForcesFormatted = `"${handleForce.handleForces.map((force: number): string => force.toFixed(2)).join(",")}"`;
            const heartRateValue =
                data.heartRate?.heartRate !== null && data.heartRate?.heartRate !== undefined
                    ? data.heartRate.heartRate.toString()
                    : "NaN";

            const isCalculatedSpeedNaN = isNaN(calculatedSpeed);

            const row = [
                data.strokeCount.toString(),
                data.elapsedTime.toFixed(2),
                (data.distance / 100).toString(),
                (isCalculatedSpeedNaN || calculatedSpeed === 0 ? 0 : 500 / calculatedSpeed).toFixed(2),
                (isCalculatedSpeedNaN ? 0 : calculatedSpeed * 3.6).toFixed(2),
                data.avgStrokePower.toString(),
                Math.round(data.strokeRate).toString(),
                data.distPerStroke.toString(),
                data.driveDuration.toFixed(2),
                data.recoveryDuration.toFixed(2),
                handleForce.driveLength.toFixed(2),
                heartRateValue,
                data.dragFactor.toString(),
                handleForce.peakForce.toFixed(2),
                handleForce.peakForcePositionNorm.toFixed(1),
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

    private async buildExportSession(sessionId: number): Promise<IExportSession> {
        return appDB.transaction(
            "r",
            appDB.sessionData,
            appDB.handleForces,
            appDB.connectedDevice,
            appDB.laps,
            async (): Promise<IExportSession> => {
                const [metricsEntities, handleForcesEntities, connectedDevice, lapEntities]: [
                    Array<IMetricsEntity>,
                    Array<IHandleForcesEntity>,
                    { sessionId: number; deviceName: string } | undefined,
                    Array<ILapEntity>,
                ] = await Promise.all([
                    appDB.sessionData.where({ sessionId }).toArray(),
                    appDB.handleForces.where({ sessionId }).toArray(),
                    appDB.connectedDevice.where({ sessionId }).last(),
                    appDB.laps.where({ sessionId }).sortBy("timeStamp"),
                ]);

                const records: Array<IExportRecord> = [];
                let totalWork = 0;

                for (const metric of metricsEntities) {
                    totalWork += metric.avgStrokePower * (metric.driveDuration + metric.recoveryDuration);
                    records.push({
                        avgStrokePower: metric.avgStrokePower,
                        distance: metric.distance,
                        distPerStroke: metric.distPerStroke,
                        dragFactor: metric.dragFactor,
                        driveDuration: metric.driveDuration,
                        recoveryDuration: metric.recoveryDuration,
                        speed: metric.speed,
                        strokeCount: metric.strokeCount,
                        strokeRate: metric.strokeRate,
                        elapsedTime: metric.elapsedTime,
                        heartRate: metric.heartRate,
                        timeStamp: new Date(metric.timeStamp),
                        totalWork,
                    });
                }

                const handleForces: Record<number, IExportHandleForces> = {};
                for (const entity of handleForcesEntities) {
                    const { peakForce, peakForceIndex }: { peakForce: number; peakForceIndex: number } =
                        entity.handleForces.reduce(
                            (
                                accumulator: { peakForce: number; peakForceIndex: number },
                                force: number,
                                index: number,
                            ): { peakForce: number; peakForceIndex: number } =>
                                force > accumulator.peakForce
                                    ? { peakForce: force, peakForceIndex: index }
                                    : accumulator,
                            { peakForce: 0, peakForceIndex: 0 },
                        );

                    handleForces[entity.strokeId] = {
                        peakForce,
                        peakForcePositionNorm:
                            entity.handleForces.length > 1
                                ? (peakForceIndex / (entity.handleForces.length - 1)) * 100
                                : 0,
                        driveLength: entity.driveLength,
                        handleForces: entity.handleForces,
                    };
                }

                return {
                    sessionId,
                    deviceName: connectedDevice?.deviceName,
                    records,
                    handleForces,
                    laps: lapEntities.map(
                        (lap: ILapEntity): ILapExport => ({
                            timeStamp: lap.timeStamp,
                            strokeIndex: lap.strokeIndex,
                            type: lap.type,
                            isPause: lap.isPause,
                        }),
                    ),
                };
            },
        );
    }
}
