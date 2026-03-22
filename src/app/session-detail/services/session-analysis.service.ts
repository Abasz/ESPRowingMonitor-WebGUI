import { Injectable } from "@angular/core";

import {
    IExportHandleForces,
    IExportRecord,
    IExportSession,
    IHandleForcesEntity,
    IMetricsEntity,
} from "../../../common/database.interfaces";
import { appDB } from "../../../common/utils/app-database";
import {
    ISessionAnalysis,
    ISessionAverages,
    ISessionMaximums,
    ISessionRecord,
    ISessionStatistics,
    ISessionStroke,
} from "../models/session-analysis.interfaces";

import { detectLaps } from "./lap-detection";

@Injectable({
    providedIn: "root",
})
export class SessionAnalysisService {
    async loadSession(sessionId: number): Promise<ISessionAnalysis> {
        return appDB.transaction(
            "r",
            appDB.sessionData,
            appDB.handleForces,
            appDB.connectedDevice,
            async (): Promise<ISessionAnalysis> => {
                const [metricsEntities, handleForcesEntities, connectedDevice]: [
                    Array<IMetricsEntity>,
                    Array<IHandleForcesEntity>,
                    { sessionId: number; deviceName: string } | undefined,
                ] = await Promise.all([
                    appDB.sessionData.where({ sessionId }).sortBy("timeStamp"),
                    appDB.handleForces.where({ sessionId }).toArray(),
                    appDB.connectedDevice.where({ sessionId }).last(),
                ]);

                const handleForcesMap = this.buildHandleForcesMap(handleForcesEntities);
                const records = this.buildRecords(metricsEntities);
                const strokes = this.buildStrokes(metricsEntities, handleForcesMap);
                const statistics = this.computeStatistics(strokes);

                return {
                    sessionId,
                    deviceName: connectedDevice?.deviceName,
                    records,
                    strokes,
                    statistics,
                    laps: detectLaps(strokes),
                };
            },
        );
    }

    loadFromJson(exportSession: IExportSession): ISessionAnalysis {
        const records: Array<ISessionRecord> = exportSession.records.map(
            (entry: IExportRecord, index: number): ISessionRecord => ({
                strokeIndex: entry.strokeCount ?? index,
                timeStamp: new Date(entry.timeStamp).getTime(),
                elapsedTime: entry.elapsedTime,
                speed: entry.speed,
                avgStrokePower: entry.avgStrokePower,
                strokeRate: entry.strokeRate,
                distPerStroke: entry.distPerStroke,
                distance: entry.distance,
                driveDuration: entry.driveDuration,
                recoveryDuration: entry.recoveryDuration,
                dragFactor: entry.dragFactor,
                heartRate: entry.heartRate,
            }),
        );

        const uniqueRecords = new Map<number, ISessionRecord>();
        for (const record of records) {
            uniqueRecords.set(record.strokeIndex, record);
        }

        const strokes: Array<ISessionStroke> = Array.from(uniqueRecords.values()).map(
            (record: ISessionRecord): ISessionStroke => {
                const handleForce: IExportHandleForces | undefined =
                    exportSession.handleForces[record.strokeIndex];

                return {
                    ...record,
                    peakForce: handleForce?.peakForce ?? 0,
                    driveLength: handleForce?.driveLength ?? 0,
                    handleForces: handleForce?.handleForces ?? [],
                };
            },
        );

        const sessionId = exportSession.sessionId;
        const statistics = this.computeStatistics(strokes);

        return {
            sessionId,
            deviceName: exportSession.deviceName,
            records,
            strokes,
            statistics,
            laps: detectLaps(strokes),
        };
    }

    private buildHandleForcesMap(entities: Array<IHandleForcesEntity>): Record<number, IHandleForcesEntity> {
        const map: Record<number, IHandleForcesEntity> = {};
        for (const entity of entities) {
            map[entity.strokeId] = entity;
        }

        return map;
    }

    private buildRecords(metricsEntities: Array<IMetricsEntity>): Array<ISessionRecord> {
        return metricsEntities.map(
            (metric: IMetricsEntity): ISessionRecord => ({
                strokeIndex: metric.strokeCount,
                timeStamp: metric.timeStamp,
                elapsedTime: metric.elapsedTime,
                speed: metric.speed,
                avgStrokePower: metric.avgStrokePower,
                strokeRate: metric.strokeRate,
                distPerStroke: metric.distPerStroke,
                distance: metric.distance,
                driveDuration: metric.driveDuration,
                recoveryDuration: metric.recoveryDuration,
                dragFactor: metric.dragFactor,
                heartRate: metric.heartRate,
            }),
        );
    }

    private buildStrokes(
        metricsEntities: Array<IMetricsEntity>,
        handleForcesMap: Record<number, IHandleForcesEntity>,
    ): Array<ISessionStroke> {
        const uniqueByStrokeCount = new Map<number, IMetricsEntity>();
        for (const metric of metricsEntities) {
            uniqueByStrokeCount.set(metric.strokeCount, metric);
        }

        return Array.from(uniqueByStrokeCount.values()).map(
            (metric: IMetricsEntity): ISessionStroke => ({
                strokeIndex: metric.strokeCount,
                timeStamp: metric.timeStamp,
                elapsedTime: metric.elapsedTime,
                speed: metric.speed,
                avgStrokePower: metric.avgStrokePower,
                strokeRate: metric.strokeRate,
                distPerStroke: metric.distPerStroke,
                distance: metric.distance,
                driveDuration: metric.driveDuration,
                recoveryDuration: metric.recoveryDuration,
                dragFactor: metric.dragFactor,
                heartRate: metric.heartRate,
                peakForce: Math.max(...(handleForcesMap[metric.strokeCount]?.handleForces ?? []), 0),
                driveLength: handleForcesMap[metric.strokeCount]?.driveLength ?? 0,
                handleForces: handleForcesMap[metric.strokeCount]?.handleForces ?? [],
            }),
        );
    }

    private computeStatistics(strokes: Array<ISessionStroke>): ISessionStatistics {
        if (strokes.length === 0) {
            return this.emptyStatistics();
        }

        const lastStroke = strokes[strokes.length - 1];

        const max: ISessionMaximums = {
            speed: 0,
            strokePower: 0,
            strokeRate: 0,
            peakForce: 0,
            distPerStroke: 0,
            driveLength: 0,
            driveDuration: 0,
            recoveryDuration: 0,
        };

        let sumSpeed = 0;
        let sumPower = 0;
        let sumStrokeRate = 0;
        let sumDistPerStroke = 0;
        let sumDriveLength = 0;
        let sumDriveDuration = 0;
        let sumRecoveryDuration = 0;
        let sumDragFactor = 0;
        let sumHeartRate = 0;
        let heartRateCount = 0;

        for (const stroke of strokes) {
            if (stroke.speed > max.speed) {
                max.speed = stroke.speed;
            }
            if (stroke.avgStrokePower > max.strokePower) {
                max.strokePower = stroke.avgStrokePower;
            }
            if (stroke.strokeRate > max.strokeRate) {
                max.strokeRate = stroke.strokeRate;
            }
            if (stroke.peakForce > max.peakForce) {
                max.peakForce = stroke.peakForce;
            }
            if (stroke.distPerStroke > max.distPerStroke) {
                max.distPerStroke = stroke.distPerStroke;
            }
            if (stroke.driveLength > max.driveLength) {
                max.driveLength = stroke.driveLength;
            }
            if (stroke.driveDuration > max.driveDuration) {
                max.driveDuration = stroke.driveDuration;
            }
            if (stroke.recoveryDuration > max.recoveryDuration) {
                max.recoveryDuration = stroke.recoveryDuration;
            }

            sumSpeed += stroke.speed;
            sumPower += stroke.avgStrokePower;
            sumStrokeRate += stroke.strokeRate;
            sumDistPerStroke += stroke.distPerStroke;
            sumDriveLength += stroke.driveLength;
            sumDriveDuration += stroke.driveDuration;
            sumRecoveryDuration += stroke.recoveryDuration;
            sumDragFactor += stroke.dragFactor;

            if (stroke.heartRate !== undefined) {
                sumHeartRate += stroke.heartRate.heartRate;
                heartRateCount++;
            }
        }

        const count = strokes.length;

        const avg: ISessionAverages = {
            speed: sumSpeed / count,
            strokePower: sumPower / count,
            strokeRate: sumStrokeRate / count,
            distPerStroke: sumDistPerStroke / count,
            driveLength: sumDriveLength / count,
            driveDuration: sumDriveDuration / count,
            recoveryDuration: sumRecoveryDuration / count,
            heartRate: heartRateCount > 0 ? sumHeartRate / heartRateCount : undefined,
            dragFactor: sumDragFactor / count,
        };

        return {
            totalDistance: lastStroke.distance / 100,
            totalTime: lastStroke.elapsedTime,
            totalStrokeCount: lastStroke.strokeIndex,
            max,
            avg,
        };
    }

    private emptyStatistics(): ISessionStatistics {
        return {
            totalDistance: 0,
            totalTime: 0,
            totalStrokeCount: 0,
            max: {
                speed: 0,
                strokePower: 0,
                strokeRate: 0,
                peakForce: 0,
                distPerStroke: 0,
                driveLength: 0,
                driveDuration: 0,
                recoveryDuration: 0,
            },
            avg: {
                speed: 0,
                strokePower: 0,
                strokeRate: 0,
                distPerStroke: 0,
                driveLength: 0,
                driveDuration: 0,
                recoveryDuration: 0,
                heartRate: undefined,
                dragFactor: 0,
            },
        };
    }
}
