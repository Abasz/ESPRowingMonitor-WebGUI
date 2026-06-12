import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    IExportRecord,
    IExportSession,
    IHandleForcesEntity,
    IMetricsEntity,
} from "../../../common/database.interfaces";
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
        await appDB.laps.clear();
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

        it("should return empty laps for a session below the minimum stroke count", async (): Promise<void> => {
            await seedSession([createMetricsEntity()], [createHandleForcesEntity()]);

            const result = await service.loadSession(mockSessionId);

            expect(result.laps).toEqual([]);
        });

        it("should detect a single lap for a continuous multi-stroke session", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({
                        strokeCount: 1,
                        timeStamp: mockSessionId + 1000,
                        elapsedTime: 1,
                        strokeRate: 24,
                    }),
                    createMetricsEntity({
                        strokeCount: 2,
                        timeStamp: mockSessionId + 3000,
                        elapsedTime: 3,
                        strokeRate: 24,
                    }),
                    createMetricsEntity({
                        strokeCount: 3,
                        timeStamp: mockSessionId + 5000,
                        elapsedTime: 5,
                        strokeRate: 24,
                    }),
                ],
                [createHandleForcesEntity({ strokeId: 1 })],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.laps).toHaveLength(1);
            expect(result.laps[0].lapNumber).toBe(1);
        });

        it("should use stored laps instead of detectLaps when lap entities exist", async (): Promise<void> => {
            const metrics = [
                createMetricsEntity({
                    strokeCount: 1,
                    timeStamp: mockSessionId + 1000,
                    elapsedTime: 1,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 2,
                    timeStamp: mockSessionId + 3000,
                    elapsedTime: 3,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 3,
                    timeStamp: mockSessionId + 5000,
                    elapsedTime: 5,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 4,
                    timeStamp: mockSessionId + 7000,
                    elapsedTime: 7,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 5,
                    timeStamp: mockSessionId + 9000,
                    elapsedTime: 9,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 6,
                    timeStamp: mockSessionId + 11000,
                    elapsedTime: 11,
                    strokeRate: 24,
                }),
            ];
            await seedSession(metrics, []);
            await appDB.laps.add({
                sessionId: mockSessionId,
                timeStamp: mockSessionId + 5000,
                strokeIndex: 3,
                type: "distance",
                isPause: false,
            });

            const result = await service.loadSession(mockSessionId);

            expect(result.laps).toHaveLength(2);
            expect(result.laps[0].startIndex).toBe(0);
            expect(result.laps[0].endIndex).toBe(2);
            expect(result.laps[1].startIndex).toBe(3);
            expect(result.laps[1].endIndex).toBe(5);
        });

        it("should fallback to detectLaps when no stored laps exist", async (): Promise<void> => {
            const metrics = [
                createMetricsEntity({
                    strokeCount: 1,
                    timeStamp: mockSessionId + 1000,
                    elapsedTime: 1,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 2,
                    timeStamp: mockSessionId + 3000,
                    elapsedTime: 3,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 3,
                    timeStamp: mockSessionId + 5000,
                    elapsedTime: 5,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 4,
                    timeStamp: mockSessionId + 20000,
                    elapsedTime: 20,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 5,
                    timeStamp: mockSessionId + 22000,
                    elapsedTime: 22,
                    strokeRate: 24,
                }),
                createMetricsEntity({
                    strokeCount: 6,
                    timeStamp: mockSessionId + 24000,
                    elapsedTime: 24,
                    strokeRate: 24,
                }),
            ];
            await seedSession(metrics, []);

            const result = await service.loadSession(mockSessionId);

            // detectLaps should detect two laps from the time gap
            expect(result.laps).toHaveLength(2);
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
                        handleForces: [100, 300],
                        timeStamp: mockSessionId + 1000,
                    }),
                    createHandleForcesEntity({
                        strokeId: 2,
                        handleForces: [150, 400],
                        timeStamp: mockSessionId + 2000,
                    }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.strokes).toHaveLength(2);
            expect(result.strokes[0].strokeIndex).toBe(1);
            expect(result.strokes[0].peakForce).toBe(300);
            expect(result.strokes[0].peakForcePositionNorm).toBe(100);
            expect(result.strokes[0].handleForces).toEqual([100, 300]);
            expect(result.strokes[1].strokeIndex).toBe(2);
            expect(result.strokes[1].peakForce).toBe(400);
            expect(result.strokes[1].peakForcePositionNorm).toBe(100);
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
                        handleForces: [100, 200],
                        driveLength: 1.2,
                        timeStamp: mockSessionId + 1000,
                    }),
                    createHandleForcesEntity({
                        strokeId: 2,
                        handleForces: [150, 450],
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

        it("should calculate peakForcePositionNorm average across all strokes", async (): Promise<void> => {
            await seedSession(
                [
                    createMetricsEntity({
                        strokeCount: 1,
                        timeStamp: mockSessionId + 1000,
                    }),
                    createMetricsEntity({
                        strokeCount: 2,
                        timeStamp: mockSessionId + 2000,
                    }),
                ],
                [
                    createHandleForcesEntity({
                        strokeId: 1,
                        handleForces: [100, 200, 300],
                        timeStamp: mockSessionId + 1000,
                    }),
                    createHandleForcesEntity({
                        strokeId: 2,
                        handleForces: [300, 200, 100],
                        timeStamp: mockSessionId + 2000,
                    }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.strokes[0].peakForcePositionNorm).toBe(100);
            expect(result.strokes[1].peakForcePositionNorm).toBe(0);
            expect(result.statistics.avg.peakForcePositionNorm).toBe(50);
        });

        it("should return peakForcePositionNorm of 0 for single element handle forces", async (): Promise<void> => {
            await seedSession(
                [createMetricsEntity({ strokeCount: 1, timeStamp: mockSessionId + 1000 })],
                [
                    createHandleForcesEntity({
                        strokeId: 1,
                        handleForces: [500],
                        timeStamp: mockSessionId + 1000,
                    }),
                ],
            );

            const result = await service.loadSession(mockSessionId);

            expect(result.strokes[0].peakForcePositionNorm).toBe(0);
        });

        it("should return peakForcePositionNorm of 0 for empty handle forces", async (): Promise<void> => {
            await seedSession([createMetricsEntity({ strokeCount: 1, timeStamp: mockSessionId + 1000 })], []);

            const result = await service.loadSession(mockSessionId);

            expect(result.strokes[0].peakForcePositionNorm).toBe(0);
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

    describe("loadFromJson method", (): void => {
        const createExportSession = (overrides: Partial<IExportSession> = {}): IExportSession => ({
            sessionId: mockSessionId,
            deviceName: undefined,
            records: [
                {
                    timeStamp: new Date(mockSessionId + 1000),
                    elapsedTime: 1,
                    speed: 4.2,
                    strokeRate: 24,
                    avgStrokePower: 150,
                    distance: 500,
                    strokeCount: 1,
                    distPerStroke: 8,
                    driveDuration: 0.8,
                    recoveryDuration: 1.2,
                    dragFactor: 110,
                    totalWork: 0,
                },
            ],
            handleForces: {
                1: {
                    peakForce: 100,
                    peakForcePositionNorm: 0,
                    driveLength: 1.5,
                    handleForces: [20, 60, 100, 80, 40],
                },
            },
            laps: [],
            ...overrides,
        });

        it("should convert IExportSession to ISessionAnalysis", (): void => {
            const exportSession = createExportSession({ deviceName: "TestDevice" });

            const result = service.loadFromJson(exportSession);

            expect(result.strokes.length).toBe(1);
            expect(result.deviceName).toBe("TestDevice");
            expect(result.sessionId).toBe(mockSessionId);
            expect(result.strokes[0].speed).toBe(4.2);
            expect(result.strokes[0].strokeRate).toBe(24);
            expect(result.strokes[0].handleForces).toEqual([20, 60, 100, 80, 40]);
        });

        it("should compute statistics from imported data", (): void => {
            const exportSession = createExportSession({
                records: [
                    {
                        timeStamp: new Date(mockSessionId + 1000),
                        elapsedTime: 1,
                        speed: 4.0,
                        avgStrokePower: 100,
                        strokeRate: 24,
                        distance: 500,
                        strokeCount: 1,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                    {
                        timeStamp: new Date(mockSessionId + 2000),
                        elapsedTime: 2,
                        speed: 5.0,
                        avgStrokePower: 200,
                        strokeRate: 24,
                        distance: 1000,
                        strokeCount: 2,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                ],
                handleForces: {
                    1: { peakForce: 100, peakForcePositionNorm: 0, driveLength: 1.5, handleForces: [] },
                    2: { peakForce: 200, peakForcePositionNorm: 0, driveLength: 1.6, handleForces: [] },
                },
            });

            const result = service.loadFromJson(exportSession);

            expect(result.statistics.totalStrokeCount).toBe(2);
            expect(result.statistics.max.speed).toBe(5.0);
            expect(result.statistics.avg.strokePower).toBe(150);
        });

        it("should detect laps from imported data", (): void => {
            const exportSession = createExportSession();

            const result = service.loadFromJson(exportSession);

            expect(result.laps).toBeDefined();
            expect(result.laps.length).toBeGreaterThanOrEqual(0);
        });

        it("should use stored laps from export when laps array is non-empty", (): void => {
            const exportSession = createExportSession({
                records: [
                    {
                        timeStamp: new Date(mockSessionId + 1000),
                        elapsedTime: 1,
                        speed: 4.2,
                        strokeRate: 24,
                        avgStrokePower: 150,
                        distance: 500,
                        strokeCount: 1,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                    {
                        timeStamp: new Date(mockSessionId + 3000),
                        elapsedTime: 3,
                        speed: 4.0,
                        strokeRate: 22,
                        avgStrokePower: 140,
                        distance: 1000,
                        strokeCount: 2,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                    {
                        timeStamp: new Date(mockSessionId + 5000),
                        elapsedTime: 5,
                        speed: 4.5,
                        strokeRate: 26,
                        avgStrokePower: 160,
                        distance: 1500,
                        strokeCount: 3,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                ],
                laps: [
                    {
                        timeStamp: mockSessionId + 3000,
                        strokeIndex: 2,
                        type: "distance",
                        isPause: false,
                    },
                ],
            });

            const result = service.loadFromJson(exportSession);

            expect(result.laps).toHaveLength(2);
            expect(result.laps[0].startIndex).toBe(0);
            expect(result.laps[0].endIndex).toBe(1);
            expect(result.laps[1].startIndex).toBe(2);
            expect(result.laps[1].endIndex).toBe(2);
        });

        it("should fallback to detectLaps when exported laps array is empty", (): void => {
            const exportSession = createExportSession({ laps: [] });

            const result = service.loadFromJson(exportSession);

            expect(result.laps).toBeDefined();
        });

        it("should handle legacy exports without laps field", (): void => {
            const legacyExport = {
                sessionId: mockSessionId,
                deviceName: undefined,
                records: [
                    {
                        timeStamp: new Date(mockSessionId + 1000),
                        elapsedTime: 1,
                        speed: 4.2,
                        strokeRate: 24,
                        avgStrokePower: 150,
                        distance: 500,
                        strokeCount: 1,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                ],
                handleForces: {},
            } as unknown as IExportSession;

            const result = service.loadFromJson(legacyExport);

            expect(result.laps).toBeDefined();
        });

        it("should handle missing handle forces gracefully", (): void => {
            const exportSession = createExportSession({ handleForces: {} });

            const result = service.loadFromJson(exportSession);

            expect(result.strokes[0].peakForce).toBe(0);
            expect(result.strokes[0].driveLength).toBe(0);
            expect(result.strokes[0].handleForces).toEqual([]);
        });

        it("should set deviceName from export session", (): void => {
            const exportSession = createExportSession({ deviceName: "MyDevice" });

            const result = service.loadFromJson(exportSession);

            expect(result.deviceName).toBe("MyDevice");
        });

        it("should set deviceName to undefined when not provided", (): void => {
            const exportSession = createExportSession({ deviceName: undefined });

            const result = service.loadFromJson(exportSession);

            expect(result.deviceName).toBeUndefined();
        });

        it("should handle ISO string timestamps from JSON parse", (): void => {
            const isoString = "2023-11-14T22:13:20.000Z";
            const exportSession = createExportSession({
                records: [
                    {
                        timeStamp: isoString as unknown as Date,
                        elapsedTime: 1,
                        speed: 4.2,
                        strokeRate: 24,
                        avgStrokePower: 150,
                        distance: 500,
                        strokeCount: 1,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                ],
            });

            const result = service.loadFromJson(exportSession);

            expect(result.strokes[0].timeStamp).toBe(new Date(isoString).getTime());
        });

        it("should use sessionId from export session", (): void => {
            const exportSession = createExportSession({ sessionId: 1700099000000 });

            const result = service.loadFromJson(exportSession);

            expect(result.sessionId).toBe(1700099000000);
        });

        it("should deduplicate strokes by stroke count keeping last entry", (): void => {
            const exportSession = createExportSession({
                records: [
                    {
                        timeStamp: new Date(mockSessionId + 1000),
                        elapsedTime: 1,
                        speed: 4.0,
                        avgStrokePower: 100,
                        strokeRate: 24,
                        distance: 500,
                        strokeCount: 1,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                    {
                        timeStamp: new Date(mockSessionId + 2000),
                        elapsedTime: 2,
                        speed: 4.2,
                        avgStrokePower: 0,
                        strokeRate: 24,
                        distance: 600,
                        strokeCount: 1,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                    {
                        timeStamp: new Date(mockSessionId + 3000),
                        elapsedTime: 3,
                        speed: 5.0,
                        avgStrokePower: 200,
                        strokeRate: 24,
                        distance: 1000,
                        strokeCount: 2,
                        distPerStroke: 8,
                        driveDuration: 0.8,
                        recoveryDuration: 1.2,
                        dragFactor: 110,
                        totalWork: 0,
                    },
                ],
                handleForces: {
                    1: { peakForce: 100, peakForcePositionNorm: 0, driveLength: 1.5, handleForces: [] },
                    2: { peakForce: 200, peakForcePositionNorm: 0, driveLength: 1.6, handleForces: [] },
                },
            });

            const result = service.loadFromJson(exportSession);

            expect(result.records).toHaveLength(3);
            expect(result.strokes).toHaveLength(2);
            expect(result.strokes[0].strokeIndex).toBe(1);
            expect(result.strokes[1].strokeIndex).toBe(2);
        });
    });

    describe("session balance computation", (): void => {
        const createRecordEntry = (strokeCount: number, elapsedTime: number): IExportRecord => ({
            timeStamp: new Date(mockSessionId + elapsedTime * 1000),
            elapsedTime,
            speed: 2.5,
            avgStrokePower: 150,
            strokeRate: 24,
            distance: strokeCount * 10,
            strokeCount,
            distPerStroke: 10,
            driveDuration: 0.8,
            recoveryDuration: 1.2,
            dragFactor: 110,
            totalWork: 0,
        });

        const createExportSession = (overrides: Partial<IExportSession> = {}): IExportSession => ({
            sessionId: mockSessionId,
            deviceName: undefined,
            records: [createRecordEntry(1, 1), createRecordEntry(2, 3)],
            handleForces: {},
            laps: [],
            ...overrides,
        });

        it("should return undefined powerBalance when no strokes have handle forces", (): void => {
            const exportSession = createExportSession({ handleForces: {} });

            const result = service.loadFromJson(exportSession);

            expect(result.powerBalance).toBeUndefined();
            expect(result.powerBalanceConsistency).toBeUndefined();
        });

        it("should compute powerBalance when strokes have sufficient paired handle forces", (): void => {
            const exportSession = createExportSession({
                records: [createRecordEntry(1, 1), createRecordEntry(2, 3)],
                handleForces: {
                    // strokeCount 1 (odd = side A), strokeCount 2 (even = side B)
                    1: {
                        peakForce: 0,
                        peakForcePositionNorm: 0,
                        driveLength: 1.5,
                        handleForces: [100, 200, 100],
                    },
                    2: {
                        peakForce: 0,
                        peakForcePositionNorm: 0,
                        driveLength: 1.5,
                        handleForces: [100, 200, 100],
                    },
                },
            });

            const result = service.loadFromJson(exportSession);

            expect(result.powerBalance).toBeCloseTo(0.5);
        });

        it("should return undefined powerBalanceConsistency with fewer than 3 pairs", (): void => {
            // two strokes → one pair → below the minimum-3-pairs threshold
            const exportSession = createExportSession({
                records: [createRecordEntry(1, 1), createRecordEntry(2, 3)],
                handleForces: {
                    1: { peakForce: 0, peakForcePositionNorm: 0, driveLength: 1.5, handleForces: [120] },
                    2: { peakForce: 0, peakForcePositionNorm: 0, driveLength: 1.5, handleForces: [80] },
                },
            });

            const result = service.loadFromJson(exportSession);

            expect(result.powerBalance).toBeDefined();
            expect(result.powerBalanceConsistency).toBeUndefined();
        });

        it("should compute powerBalanceConsistency with 3 or more pairs", async (): Promise<void> => {
            // seed 6 strokes (strokeCount 1–6) giving 3 A/B pairs
            const metrics = [1, 2, 3, 4, 5, 6].map(
                (strokeCount: number): IMetricsEntity =>
                    createMetricsEntity({
                        strokeCount,
                        elapsedTime: strokeCount,
                        timeStamp: mockSessionId + strokeCount * 1000,
                    }),
            );
            const handleForcesEntities = [1, 2, 3, 4, 5, 6].map(
                (strokeId: number): IHandleForcesEntity =>
                    createHandleForcesEntity({
                        strokeId,
                        handleForces: [100, 200, 100],
                        timeStamp: mockSessionId + strokeId * 1000,
                    }),
            );

            await seedSession(metrics, handleForcesEntities);

            const result = await service.loadSession(mockSessionId);

            expect(result.powerBalance).toBeCloseTo(0.5);
            expect(result.powerBalanceConsistency).toBeDefined();
            expect(result.powerBalanceConsistency).toBeCloseTo(0);
        });
    });
});
