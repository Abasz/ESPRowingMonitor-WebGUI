import { Injectable } from "@angular/core";

import { ISessionData } from "../common.interfaces";
import {
    ExportSessionData,
    IDeltaTimesEntity,
    IHandleForcesEntity,
    IMetricsEntity,
} from "../database.interfaces";
import { appDB } from "../utils/app-database";

@Injectable({
    providedIn: "root",
})
export class DataRecorderService {
    private currentSessionId: number = Date.now();

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

    async downloadDeltaTimes(): Promise<void> {
        const deltaTimes: Array<number> = (
            await appDB.deltaTimes.where({ sessionId: this.currentSessionId }).toArray()
        ).reduce((previousValue: Array<number>, currentValue: IDeltaTimesEntity): Array<number> => {
            previousValue.push(...currentValue.deltaTimes);

            return previousValue;
        }, []);

        if (deltaTimes.length === 0) {
            return;
        }

        const blob = new Blob([JSON.stringify(deltaTimes)], { type: "application/json" });
        this.createDownload(blob, "deltaTimes");
    }

    async downloadSessionData(): Promise<void> {
        return appDB.transaction("r", appDB.sessionData, appDB.handleForces, async (): Promise<void> => {
            const [metricsEntity, handleForcesEntity]: [Array<IMetricsEntity>, Array<IHandleForcesEntity>] =
                await Promise.all([
                    appDB.sessionData.where({ sessionId: this.currentSessionId }).toArray(),
                    appDB.handleForces.where({ sessionId: this.currentSessionId }).toArray(),
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

            const blob = new Blob([JSON.stringify(rowingSessionData)], { type: "application/json" });
            this.createDownload(blob, "session");
        });
    }

    reset(): void {
        this.currentSessionId = Date.now();
    }

    private createDownload(blob: Blob, name: string): void {
        const url = window.URL.createObjectURL(blob);
        const downloadTag = document.createElement("a");
        downloadTag.href = url;
        const now = new Date(Date.now());
        downloadTag.download = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now
            .getDate()
            .toString()
            .padStart(2, "0")} ${now.getHours().toString().padStart(2, "0")}-${now
            .getMinutes()
            .toString()
            .padStart(2, "0")}-${now.getSeconds().toString().padStart(2, "0")} - ${name}`;
        downloadTag.click();
    }
}
