import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IHandleForcesEntity, IMetricsEntity } from "../../../common/database.interfaces";
import { appDB } from "../../../common/utils/app-database";

import { SessionAnalysisService } from "./session-analysis.service";

describe("SessionAnalysisService", (): void => {
    const mockSessionId = 1700000000000;
    let service: SessionAnalysisService;

    const createMetricsEntity = (overrides: Partial<IMetricsEntity> = {}): IMetricsEntity => ({
        sessionId: mockSessionId,
        timeStamp: mockSessionId + 1000,
        avgStrokePower: 150,
        distance: 500,
        distPerStroke: 8,
        dragFactor: 110,
        driveDuration: 0.8,
        recoveryDuration: 1.2,
        speed: 4.2,
        strokeCount: 1,
        strokeRate: 24,
        elapsedTime: 1,
        ...overrides,
    });

    const createHandleForcesEntity = (overrides: Partial<IHandleForcesEntity> = {}): IHandleForcesEntity => ({
        timeStamp: mockSessionId + 1000,
        sessionId: mockSessionId,
        strokeId: 1,
        peakForce: 350,
        handleForces: [100, 200, 300],
        driveLength: 1.5,
        ...overrides,
    });

    const seedSession = async (
        metrics: Array<IMetricsEntity>,
        handleForces: Array<IHandleForcesEntity>,
        deviceName?: string,
    ): Promise<void> => {
        await appDB.sessionData.bulkAdd(metrics);
        await appDB.handleForces.bulkPut(handleForces);
        if (deviceName !== undefined) {
            await appDB.connectedDevice.put({ sessionId: mockSessionId, deviceName });
        }
    };

    beforeEach((): void => {
        TestBed.configureTestingModule({
            providers: [SessionAnalysisService],
        });

        service = TestBed.inject(SessionAnalysisService);
    });

    afterEach(async (): Promise<void> => {
        await appDB.sessionData.clear();
        await appDB.handleForces.clear();
        await appDB.connectedDevice.clear();
        await appDB.deltaTimes.clear();
    });

    describe("loadSession method", (): void => {
        it("should return the correct sessionId and deviceName", async (): Promise<void> => {
            await seedSession([createMetricsEntity()], [createHandleForcesEntity()], "ESP Rowing Monitor");

            const result = await service.loadSession(mockSessionId);

            expect(result.sessionId).toBe(mockSessionId);
            expect(result.deviceName).toBe("ESP Rowing Monitor");
        });

        it("should return undefined deviceName when no device is stored", async (): Promise<void> => {
            await seedSession([createMetricsEntity()], [createHandleForcesEntity()]);

            const result = await service.loadSession(mockSessionId);

            expect(result.deviceName).toBeUndefined();
        });

        it("should return empty laps array", async (): Promise<void> => {
            await seedSession([createMetricsEntity()], [createHandleForcesEntity()]);

            const result = await service.loadSession(mockSessionId);

            expect(result.laps).toEqual([]);
        });
    });

    describe("stroke building", (): void => {
        it("should join metrics and handle forces by stroke count", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({ strokeCount: 1, timeStamp: mockSessionId + 1000 }),
                    createMetricsEntity({ strokeCount: 2, timeStamp: mockSessionId + 2000 }),
                ],
                [
                    createHandleForcesEntity({
                        strokeId: 1,
                        peakForce: 300,
                        handleForces: [100, 200],
                        timeStamp: mockSessionId + 1000,
                    }),
                    createHandleForcesEntity({
                        strokeId: 2,
                        peakForce: 400,
                        handleForces: [150, 250],
                        timeStamp: mockSessionId + 2000,
                    }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.strokes).toHaveLength(2);
            expect(result.strokes[0].strokeIndex).toBe(1);
            expect(result.strokes[0].peakForce).toBe(300);
            expect(result.strokes[0].handleForces).toEqual([100, 200]);
            expect(result.strokes[1].strokeIndex).toBe(2);
            expect(result.strokes[1].peakForce).toBe(400);
        });

        it("should default to zero values when handle forces are missing", async (): Promise<void> => {
            await seedSession([createMetricsEntity({ strokeCount: 5 })], []);

            const result = await service.loadSession(mockSessionId);

            expect(result.strokes[0].peakForce).toBe(0);
            expect(result.strokes[0].driveLength).toBe(0);
            expect(result.strokes[0].handleForces).toEqual([]);
        });

        it("should deduplicate strokes by stroke count keeping last entry", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({
                        strokeCount: 1,
                        avgStrokePower: 100,
                        timeStamp: mockSessionId + 1000,
                        elapsedTime: 1,
                    }),
                    createMetricsEntity({
                        strokeCount: 1,
                        avgStrokePower: 0,
                        timeStamp: mockSessionId + 3000,
                        elapsedTime: 3,
                    }),
                    createMetricsEntity({
                        strokeCount: 2,
                        avgStrokePower: 180,
                        timeStamp: mockSessionId + 5000,
                        elapsedTime: 5,
                    }),
                ],
                [
                    createHandleForcesEntity({ strokeId: 1, timeStamp: mockSessionId + 1000 }),
                    createHandleForcesEntity({ strokeId: 2, timeStamp: mockSessionId + 5000 }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.records).toHaveLength(3);
            expect(result.strokes).toHaveLength(2);
            expect(result.strokes[0].strokeIndex).toBe(1);
            expect(result.strokes[1].strokeIndex).toBe(2);
        });

        it("should map all metric fields to stroke fields", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({
                        strokeCount: 1,
                        speed: 3.5,
                        avgStrokePower: 200,
                        strokeRate: 28,
                        distPerStroke: 10,
                        distance: 1000,
                        driveDuration: 0.9,
                        recoveryDuration: 1.1,
                        dragFactor: 115,
                        elapsedTime: 5,
                        heartRate: { heartRate: 145, contactDetected: true },
                    }),
                ],
                [createHandleForcesEntity()],
            );

            const result = await service.loadSession(mockSessionId);
            const stroke = result.strokes[0];

            expect(stroke.speed).toBe(3.5);
            expect(stroke.avgStrokePower).toBe(200);
            expect(stroke.strokeRate).toBe(28);
            expect(stroke.distPerStroke).toBe(10);
            expect(stroke.distance).toBe(1000);
            expect(stroke.driveDuration).toBe(0.9);
            expect(stroke.recoveryDuration).toBe(1.1);
            expect(stroke.dragFactor).toBe(115);
            expect(stroke.elapsedTime).toBe(5);
            expect(stroke.heartRate).toEqual({ heartRate: 145, contactDetected: true });
        });
    });

    describe("statistics computation", (): void => {
        it("should return empty statistics for empty session", async (): Promise<void> => {
            const result = await service.loadSession(mockSessionId);

            expect(result.statistics.totalDistance).toBe(0);
            expect(result.statistics.totalTime).toBe(0);
            expect(result.statistics.totalStrokeCount).toBe(0);
            expect(result.statistics.avg.heartRate).toBeUndefined();
        });

        it("should calculate totals from last stroke", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({
                        strokeCount: 1,
                        distance: 500,
                        elapsedTime: 5,
                        timeStamp: mockSessionId + 1000,
                    }),
                    createMetricsEntity({
                        strokeCount: 2,
                        distance: 1200,
                        elapsedTime: 12,
                        timeStamp: mockSessionId + 2000,
                    }),
                ],
                [
                    createHandleForcesEntity({ strokeId: 1, timeStamp: mockSessionId + 1000 }),
                    createHandleForcesEntity({ strokeId: 2, timeStamp: mockSessionId + 2000 }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.statistics.totalDistance).toBe(12);
            expect(result.statistics.totalTime).toBe(12);
            expect(result.statistics.totalStrokeCount).toBe(2);
        });

        it("should use last stroke index for totalStrokeCount when gaps exist", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({
                        strokeCount: 1,
                        distance: 500,
                        elapsedTime: 5,
                        timeStamp: mockSessionId + 1000,
                    }),
                    createMetricsEntity({
                        strokeCount: 5,
                        distance: 2500,
                        elapsedTime: 25,
                        timeStamp: mockSessionId + 5000,
                    }),
                ],
                [
                    createHandleForcesEntity({ strokeId: 1, timeStamp: mockSessionId + 1000 }),
                    createHandleForcesEntity({ strokeId: 5, timeStamp: mockSessionId + 5000 }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.strokes).toHaveLength(2);
            expect(result.statistics.totalStrokeCount).toBe(5);
        });

        it("should calculate maximums across all strokes", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({
                        strokeCount: 1,
                        speed: 3.0,
                        avgStrokePower: 100,
                        strokeRate: 20,
                        distPerStroke: 7,
                        driveDuration: 0.7,
                        recoveryDuration: 1.0,
                        timeStamp: mockSessionId + 1000,
                    }),
                    createMetricsEntity({
                        strokeCount: 2,
                        speed: 5.0,
                        avgStrokePower: 250,
                        strokeRate: 30,
                        distPerStroke: 12,
                        driveDuration: 1.1,
                        recoveryDuration: 1.5,
                        timeStamp: mockSessionId + 2000,
                    }),
                ],
                [
                    createHandleForcesEntity({
                        strokeId: 1,
                        peakForce: 200,
                        driveLength: 1.2,
                        timeStamp: mockSessionId + 1000,
                    }),
                    createHandleForcesEntity({
                        strokeId: 2,
                        peakForce: 450,
                        driveLength: 1.8,
                        timeStamp: mockSessionId + 2000,
                    }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.statistics.max.speed).toBe(5.0);
            expect(result.statistics.max.strokePower).toBe(250);
            expect(result.statistics.max.strokeRate).toBe(30);
            expect(result.statistics.max.peakForce).toBe(450);
            expect(result.statistics.max.distPerStroke).toBe(12);
            expect(result.statistics.max.driveLength).toBe(1.8);
            expect(result.statistics.max.driveDuration).toBe(1.1);
            expect(result.statistics.max.recoveryDuration).toBe(1.5);
        });

        it("should calculate averages across all strokes", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({
                        strokeCount: 1,
                        speed: 3.0,
                        avgStrokePower: 100,
                        strokeRate: 20,
                        distPerStroke: 8,
                        driveDuration: 0.7,
                        recoveryDuration: 1.0,
                        dragFactor: 100,
                        timeStamp: mockSessionId + 1000,
                    }),
                    createMetricsEntity({
                        strokeCount: 2,
                        speed: 5.0,
                        avgStrokePower: 200,
                        strokeRate: 30,
                        distPerStroke: 10,
                        driveDuration: 0.9,
                        recoveryDuration: 1.4,
                        dragFactor: 120,
                        timeStamp: mockSessionId + 2000,
                    }),
                ],
                [
                    createHandleForcesEntity({
                        strokeId: 1,
                        driveLength: 1.2,
                        timeStamp: mockSessionId + 1000,
                    }),
                    createHandleForcesEntity({
                        strokeId: 2,
                        driveLength: 1.6,
                        timeStamp: mockSessionId + 2000,
                    }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.statistics.avg.speed).toBe(4.0);
            expect(result.statistics.avg.strokePower).toBe(150);
            expect(result.statistics.avg.strokeRate).toBe(25);
            expect(result.statistics.avg.distPerStroke).toBe(9);
            expect(result.statistics.avg.driveLength).toBe(1.4);
            expect(result.statistics.avg.driveDuration).toBeCloseTo(0.8);
            expect(result.statistics.avg.recoveryDuration).toBe(1.2);
            expect(result.statistics.avg.dragFactor).toBe(110);
        });

        it("should calculate heart rate average only from strokes with heart rate", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({
                        strokeCount: 1,
                        heartRate: { heartRate: 140, contactDetected: true },
                        timeStamp: mockSessionId + 1000,
                    }),
                    createMetricsEntity({
                        strokeCount: 2,
                        timeStamp: mockSessionId + 2000,
                    }),
                    createMetricsEntity({
                        strokeCount: 3,
                        heartRate: { heartRate: 160, contactDetected: true },
                        timeStamp: mockSessionId + 3000,
                    }),
                ],
                [
                    createHandleForcesEntity({ strokeId: 1, timeStamp: mockSessionId + 1000 }),
                    createHandleForcesEntity({ strokeId: 2, timeStamp: mockSessionId + 2000 }),
                    createHandleForcesEntity({ strokeId: 3, timeStamp: mockSessionId + 3000 }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.statistics.avg.heartRate).toBe(150);
        });

        it("should return undefined heart rate average when no strokes have heart rate", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({ strokeCount: 1, timeStamp: mockSessionId + 1000 }),
                    createMetricsEntity({ strokeCount: 2, timeStamp: mockSessionId + 2000 }),
                ],
                [
                    createHandleForcesEntity({ strokeId: 1, timeStamp: mockSessionId + 1000 }),
                    createHandleForcesEntity({ strokeId: 2, timeStamp: mockSessionId + 2000 }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.statistics.avg.heartRate).toBeUndefined();
        });
    });
});
