import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { ISessionData, ISessionSummary } from "../common.interfaces";
import { IExportSession, ILapEntity } from "../database.interfaces";
import { appDB } from "../utils/app-database";

import { DataRecorderService } from "./data-recorder.service";
import {
    mockImportData,
    setupSpeedCalculationFilterDuplicates,
    setupSpeedCalculationFirstStrokeStartTime,
    setupSpeedCalculationThreeStrokes,
    setupSpeedCalculationZeroDistance,
    setupSpeedCalculationZeroTimeDelta,
} from "./data-recorder.test.helpers";

function setupNavigatorWithShare(shareSpy: Mock): void {
    Object.defineProperty(navigator, "canShare", {
        value: (): boolean => true,
        writable: true,
        configurable: true,
    });
    Object.defineProperty(navigator, "share", {
        value: shareSpy,
        writable: true,
        configurable: true,
    });
}

function setupNavigatorWithoutShare(): void {
    Object.defineProperty(navigator, "canShare", {
        value: undefined,
        writable: true,
        configurable: true,
    });
    Object.defineProperty(navigator, "share", {
        value: undefined,
        writable: true,
        configurable: true,
    });
}

describe("DataRecorderService", (): void => {
    const mockTimeStamp = 1700000000000;
    let service: DataRecorderService;

    let connectedDevicePutSpy: Mock;
    let connectedDeviceWhereSpy: Mock;
    let deltaTimesPutSpy: Mock;
    let deltaTimesWhereSpy: Mock;
    let lapsAddSpy: Mock;
    let lapsWhereSpy: Mock;
    let sessionDataAddSpy: Mock;
    let sessionDataWhereSpy: Mock;
    let handleForcesPutSpy: Mock;
    let handleForcesWhereSpy: Mock;
    let transactionSpy: Mock;

    const createMockSessionData = (): ISessionData => {
        return {
            avgStrokePower: 150,
            distance: 5000,
            distPerStroke: 8,
            dragFactor: 110,
            driveDuration: 800,
            recoveryDuration: 1200,
            speed: 4.2,
            strokeCount: 50,
            strokeRate: 24,
            elapsedTime: 0,
            peakForce: 350,
            peakForcePositionNorm: 0,
            handleForces: [100, 200, 300],
            driveLength: 1.5,
            totalWork: 0,
            powerBalance: 0.5,
        };
    };

    beforeEach((): void => {
        vi.useFakeTimers();
        vi.setSystemTime(mockTimeStamp);

        connectedDevicePutSpy = vi.spyOn(appDB.connectedDevice, "put");
        connectedDeviceWhereSpy = vi.spyOn(appDB.connectedDevice, "where");
        deltaTimesPutSpy = vi.spyOn(appDB.deltaTimes, "put");
        deltaTimesWhereSpy = vi.spyOn(appDB.deltaTimes, "where");
        lapsAddSpy = vi.spyOn(appDB.laps, "add");
        lapsWhereSpy = vi.spyOn(appDB.laps, "where");
        sessionDataAddSpy = vi.spyOn(appDB.sessionData, "add");
        sessionDataWhereSpy = vi.spyOn(appDB.sessionData, "where");
        vi.spyOn(appDB.sessionData, "orderBy");
        handleForcesPutSpy = vi.spyOn(appDB.handleForces, "put");
        handleForcesWhereSpy = vi.spyOn(appDB.handleForces, "where");
        transactionSpy = vi.spyOn(appDB, "transaction");

        TestBed.configureTestingModule({
            providers: [DataRecorderService],
        });

        service = TestBed.inject(DataRecorderService);
    });

    afterEach(async (): Promise<void> => {
        vi.restoreAllMocks();
        vi.useRealTimers();

        await appDB.connectedDevice.clear();
        await appDB.deltaTimes.clear();
        await appDB.sessionData.clear();
        await appDB.handleForces.clear();
        await appDB.laps.clear();
    });

    describe("addConnectedDevice method", (): void => {
        const deviceName = "ESP Rowing Monitor";

        it("should call appDB.connectedDevice.put with correct arguments", async (): Promise<void> => {
            await service.addConnectedDevice(deviceName);

            expect(connectedDevicePutSpy).toHaveBeenCalledTimes(1);
            expect(connectedDevicePutSpy).toHaveBeenCalledWith({
                deviceName,
                sessionId: mockTimeStamp,
            });
        });

        it("should store the device in the database", async (): Promise<void> => {
            await service.addConnectedDevice(deviceName);

            const lastDevice = await appDB.connectedDevice.where({ sessionId: mockTimeStamp }).last();
            expect(lastDevice?.deviceName).toBe(deviceName);
        });
    });

    describe("addDeltaTimes method", (): void => {
        const deltaTimes = [100, 110, 105];

        it("should call appDB.deltaTimes.put with correct arguments", async (): Promise<void> => {
            await service.addDeltaTimes(deltaTimes);

            expect(deltaTimesPutSpy).toHaveBeenCalledTimes(1);
            expect(deltaTimesPutSpy).toHaveBeenCalledWith({
                sessionId: mockTimeStamp,
                timeStamp: mockTimeStamp,
                deltaTimes,
            });
        });

        it("should store the delta times in the database", async (): Promise<void> => {
            await service.addDeltaTimes(deltaTimes);

            const storedData = await appDB.deltaTimes.where({ sessionId: mockTimeStamp }).toArray();
            expect(storedData).toHaveLength(1);
            expect(storedData[0].deltaTimes).toEqual(deltaTimes);
        });
    });

    describe("addSessionData method", (): void => {
        it("should execute database transaction with correct tables", async (): Promise<void> => {
            await service.addSessionData(
                createMockSessionData() as Parameters<typeof service.addSessionData>[0],
            );

            expect(transactionSpy).toHaveBeenCalledTimes(1);
            expect(transactionSpy).toHaveBeenCalledWith(
                "rw",
                appDB.sessionData,
                appDB.handleForces,
                expect.any(Function),
            );
        });

        it("should call sessionData.add with correct metrics data", async (): Promise<void> => {
            const sessionData = createMockSessionData();

            await service.addSessionData(sessionData as Parameters<typeof service.addSessionData>[0]);

            expect(sessionDataAddSpy).toHaveBeenCalledTimes(1);
            expect(sessionDataAddSpy).toHaveBeenCalledWith({
                sessionId: mockTimeStamp,
                timeStamp: mockTimeStamp,
                avgStrokePower: sessionData.avgStrokePower,
                distance: sessionData.distance,
                distPerStroke: sessionData.distPerStroke,
                dragFactor: sessionData.dragFactor,
                driveDuration: sessionData.driveDuration,
                recoveryDuration: sessionData.recoveryDuration,
                speed: sessionData.speed,
                strokeCount: sessionData.strokeCount,
                strokeRate: sessionData.strokeRate,
                elapsedTime: sessionData.elapsedTime,
                heartRate: undefined,
            });
        });

        it("should call handleForces.where to check for existing stroke data", async (): Promise<void> => {
            const sessionData = createMockSessionData();
            await service.addSessionData(sessionData as Parameters<typeof service.addSessionData>[0]);

            expect(handleForcesWhereSpy).toHaveBeenCalledWith({
                sessionId: mockTimeStamp,
                strokeId: sessionData.strokeCount,
            });
        });

        it("should call handleForces.put with correct handle forces data", async (): Promise<void> => {
            const sessionData = createMockSessionData();
            await service.addSessionData(sessionData as Parameters<typeof service.addSessionData>[0]);

            expect(handleForcesPutSpy).toHaveBeenCalledTimes(1);
            expect(handleForcesPutSpy).toHaveBeenCalledWith({
                timeStamp: mockTimeStamp,
                sessionId: mockTimeStamp,
                strokeId: sessionData.strokeCount,
                handleForces: sessionData.handleForces,
                driveLength: sessionData.driveLength,
            });
        });

        it("should use existing timestamp when handleForces record exists for same stroke", async (): Promise<void> => {
            const existingTimestamp = mockTimeStamp - 1000;
            await appDB.handleForces.put({
                timeStamp: existingTimestamp,
                sessionId: mockTimeStamp,
                strokeId: 50,
                driveLength: 1.0,
                handleForces: [80, 150, 200],
            });

            handleForcesPutSpy.mockClear();

            await service.addSessionData(
                createMockSessionData() as Parameters<typeof service.addSessionData>[0],
            );

            expect(handleForcesPutSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    timeStamp: existingTimestamp,
                }),
            );
        });

        it("should include heart rate data when provided", async (): Promise<void> => {
            const sessionDataWithHR = {
                ...createMockSessionData(),
                heartRate: { heartRate: 140, contactDetected: true },
            };

            await service.addSessionData(sessionDataWithHR as Parameters<typeof service.addSessionData>[0]);

            expect(sessionDataAddSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    heartRate: { heartRate: 140, contactDetected: true },
                }),
            );
        });
    });

    describe("addLap method", (): void => {
        it("should call appDB.laps.add with correct arguments", async (): Promise<void> => {
            await service.addLap(10, "manual");

            expect(lapsAddSpy).toHaveBeenCalledTimes(1);
            expect(lapsAddSpy).toHaveBeenCalledWith({
                sessionId: mockTimeStamp,
                timeStamp: mockTimeStamp,
                strokeIndex: 10,
                type: "manual",
                isPause: false,
            });
        });

        it("should pass isPause flag when provided", async (): Promise<void> => {
            await service.addLap(5, "manual", true);

            expect(lapsAddSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    isPause: true,
                }),
            );
        });

        it("should store the lap in the database", async (): Promise<void> => {
            await service.addLap(10, "manual");

            const storedLaps: Array<ILapEntity> = await appDB.laps
                .where({ sessionId: mockTimeStamp })
                .toArray();
            expect(storedLaps).toHaveLength(1);
            expect(storedLaps[0].strokeIndex).toBe(10);
            expect(storedLaps[0].type).toBe("manual");
            expect(storedLaps[0].isPause).toBe(false);
        });
    });

    describe("getLaps method", (): void => {
        const sessionId = 1700000000000;

        it("should return laps sorted by timeStamp", async (): Promise<void> => {
            await appDB.laps.add({
                sessionId,
                timeStamp: sessionId + 2000,
                strokeIndex: 20,
                type: "manual",
                isPause: false,
            });
            await appDB.laps.add({
                sessionId,
                timeStamp: sessionId + 1000,
                strokeIndex: 10,
                type: "manual",
                isPause: true,
            });

            const laps = await service.getLaps(sessionId);

            expect(laps).toHaveLength(2);
            expect(laps[0].strokeIndex).toBe(10);
            expect(laps[1].strokeIndex).toBe(20);
        });

        it("should return empty array when no laps exist", async (): Promise<void> => {
            const laps = await service.getLaps(sessionId);

            expect(laps).toHaveLength(0);
        });

        it("should only return laps for the given session", async (): Promise<void> => {
            const otherSessionId = sessionId + 100000;
            await appDB.laps.add({
                sessionId,
                timeStamp: sessionId + 1000,
                strokeIndex: 10,
                type: "manual",
                isPause: false,
            });
            await appDB.laps.add({
                sessionId: otherSessionId,
                timeStamp: otherSessionId + 1000,
                strokeIndex: 5,
                type: "manual",
                isPause: false,
            });

            const laps = await service.getLaps(sessionId);

            expect(laps).toHaveLength(1);
            expect(laps[0].strokeIndex).toBe(10);
        });
    });

    describe("hasSessions method", (): void => {
        it("should return false when the logbook is empty", async (): Promise<void> => {
            expect(await service.hasSessions()).toBe(false);
        });

        it("should return true when at least one session exists", async (): Promise<void> => {
            const sessionId = 1700000000000;
            await appDB.sessionData.add({ sessionId, timeStamp: sessionId } as Parameters<
                typeof appDB.sessionData.add
            >[0]);

            expect(await service.hasSessions()).toBe(true);
        });
    });

    describe("deleteSession method", (): void => {
        const sessionId = 1700000000000;

        beforeEach(async (): Promise<void> => {
            await appDB.connectedDevice.put({ sessionId, deviceName: "Test Device" });
            await appDB.deltaTimes.put({ sessionId, timeStamp: sessionId, deltaTimes: [100] });
            await appDB.sessionData.add({ sessionId, timeStamp: sessionId } as Parameters<
                typeof appDB.sessionData.add
            >[0]);
            await appDB.handleForces.put({
                sessionId,
                timeStamp: sessionId,
                strokeId: 1,
                driveLength: 1.0,
                handleForces: [100],
            });
            await appDB.laps.add({
                sessionId,
                timeStamp: sessionId,
                strokeIndex: 10,
                type: "manual",
                isPause: false,
            });
            await appDB.sessionUploads.put({ sessionId, uploadedAt: sessionId + 1000 });

            connectedDeviceWhereSpy.mockClear();
            deltaTimesWhereSpy.mockClear();
            lapsWhereSpy.mockClear();
            sessionDataWhereSpy.mockClear();
            handleForcesWhereSpy.mockClear();
            transactionSpy.mockClear();
        });

        it("should call transaction with rw mode and all tables", async (): Promise<void> => {
            await service.deleteSession(sessionId);

            expect(transactionSpy).toHaveBeenCalledWith(
                "rw",
                [
                    appDB.sessionData,
                    appDB.deltaTimes,
                    appDB.handleForces,
                    appDB.connectedDevice,
                    appDB.laps,
                    appDB.sessionUploads,
                ],
                expect.any(Function),
            );
        });

        it("should call sessionData.where with correct sessionId", async (): Promise<void> => {
            await service.deleteSession(sessionId);

            expect(sessionDataWhereSpy).toHaveBeenCalledWith({ sessionId });
        });

        it("should call deltaTimes.where with correct sessionId", async (): Promise<void> => {
            await service.deleteSession(sessionId);

            expect(deltaTimesWhereSpy).toHaveBeenCalledWith({ sessionId });
        });

        it("should call handleForces.where with correct sessionId", async (): Promise<void> => {
            await service.deleteSession(sessionId);

            expect(handleForcesWhereSpy).toHaveBeenCalledWith({ sessionId });
        });

        it("should call connectedDevice.where with correct sessionId", async (): Promise<void> => {
            await service.deleteSession(sessionId);

            expect(connectedDeviceWhereSpy).toHaveBeenCalledWith({ sessionId });
        });

        it("should call laps.where with correct sessionId", async (): Promise<void> => {
            await service.deleteSession(sessionId);

            expect(lapsWhereSpy).toHaveBeenCalledWith({ sessionId });
        });

        it("should delete session data from all tables", async (): Promise<void> => {
            await service.deleteSession(sessionId);

            const connectedDevices = await appDB.connectedDevice.where({ sessionId }).toArray();
            const deltaTimes = await appDB.deltaTimes.where({ sessionId }).toArray();
            const sessionData = await appDB.sessionData.where({ sessionId }).toArray();
            const handleForces = await appDB.handleForces.where({ sessionId }).toArray();
            const laps = await appDB.laps.where({ sessionId }).toArray();
            const sessionUploads = await appDB.sessionUploads.where({ sessionId }).toArray();

            expect(connectedDevices).toHaveLength(0);
            expect(deltaTimes).toHaveLength(0);
            expect(sessionData).toHaveLength(0);
            expect(handleForces).toHaveLength(0);
            expect(laps).toHaveLength(0);
            expect(sessionUploads).toHaveLength(0);
        });

        it("should resolve when all tables are cleared", async (): Promise<void> => {
            await expect(service.deleteSession(sessionId)).resolves.toBeUndefined();
        });
    });

    describe("reset method", (): void => {
        it("should update the session id to current timestamp", async (): Promise<void> => {
            vi.advanceTimersByTime(5000);
            await service.reset();

            await service.addConnectedDevice("Test Device");

            expect(connectedDevicePutSpy).toHaveBeenCalledWith({
                deviceName: "Test Device",
                sessionId: mockTimeStamp + 5000,
            });
        });

        it("should create new session id on consecutive resets", async (): Promise<void> => {
            await service.reset();
            vi.advanceTimersByTime(1000);
            await service.reset();

            await service.addConnectedDevice("Test Device");

            expect(connectedDevicePutSpy).toHaveBeenCalledWith({
                deviceName: "Test Device",
                sessionId: mockTimeStamp + 1000,
            });
        });

        it("should call addConnectedDevice with device name and new session id when connectedDeviceName is provided", async (): Promise<void> => {
            vi.advanceTimersByTime(5000);
            const deviceName = "ESP Rowing Monitor";

            await service.reset(deviceName);

            expect(connectedDevicePutSpy).toHaveBeenCalledWith({
                deviceName,
                sessionId: mockTimeStamp + 5000,
            });
        });

        it("should store the connected device with the new session id in the database after reset with device name", async (): Promise<void> => {
            vi.advanceTimersByTime(3000);
            const deviceName = "ESP Rowing Monitor";

            await service.reset(deviceName);

            const stored = await appDB.connectedDevice.where({ sessionId: mockTimeStamp + 3000 }).last();
            expect(stored?.deviceName).toBe(deviceName);
        });

        it("should not call addConnectedDevice when no device name is provided", async (): Promise<void> => {
            await service.reset();

            expect(connectedDevicePutSpy).not.toHaveBeenCalled();
        });
    });

    describe("export method", (): void => {
        const testSessionId = 987654321;
        const testDeviceName = "ExportTestDevice";
        let mockAnchor: { href: string; download: string; click: Mock };
        let createObjectURLSpy: Mock;
        let revokeObjectURLSpy: Mock;
        let createdBlobs: Array<Blob>;

        beforeEach(async (): Promise<void> => {
            createdBlobs = [];
            mockAnchor = { href: "", download: "", click: vi.fn() };
            vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
            createObjectURLSpy = vi
                .spyOn(window.URL, "createObjectURL")
                .mockImplementation((obj: Blob | MediaSource): string => {
                    createdBlobs.push(obj as Blob);

                    return "blob:test-url";
                });
            revokeObjectURLSpy = vi
                .spyOn(window.URL, "revokeObjectURL")
                .mockImplementation((): void => undefined);
            setupNavigatorWithoutShare();

            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.deltaTimes,
                appDB.handleForces,
                appDB.connectedDevice,
                (): void => {
                    appDB.connectedDevice.put({
                        sessionId: testSessionId,
                        deviceName: testDeviceName,
                    });
                    appDB.deltaTimes.put({
                        sessionId: testSessionId,
                        timeStamp: testSessionId + 500,
                        deltaTimes: [120, 130, 140],
                    });
                    appDB.sessionData.add({
                        sessionId: testSessionId,
                        timeStamp: testSessionId + 1000,
                        avgStrokePower: 120,
                        distance: 2500,
                        distPerStroke: 7,
                        dragFactor: 105,
                        driveDuration: 750,
                        recoveryDuration: 1050,
                        speed: 4.0,
                        strokeCount: 55,
                        strokeRate: 22,
                        elapsedTime: 1,
                    });
                    appDB.handleForces.put({
                        sessionId: testSessionId,
                        timeStamp: testSessionId + 1000,
                        strokeId: 55,
                        handleForces: [90, 180, 270],
                        driveLength: 1.2,
                    });
                },
            );
        });

        it("should export database in JSON with correct structure", async (): Promise<void> => {
            await service.export();

            expect(createdBlobs).toHaveLength(1);
            expect(mockAnchor.click).toHaveBeenCalled();
            expect(createObjectURLSpy).toHaveBeenCalled();
            expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:test-url");

            const exportedData = JSON.parse(await createdBlobs[0].text());
            expect(exportedData.formatName).toBe("dexie");
            expect(exportedData.data.databaseName).toBe("ESPRowingMonitorDB");
            expect(exportedData.data.tables).toHaveLength(6);
        });

        it("should include test data with correct sessionId in exported JSON", async (): Promise<void> => {
            await service.export();

            const exportData = JSON.parse(await createdBlobs[0].text());
            const sessionDataTable = exportData.data.data.find(
                (table: { tableName: string }): boolean => table.tableName === "sessionData",
            );
            const connectedDeviceTable = exportData.data.data.find(
                (table: { tableName: string }): boolean => table.tableName === "connectedDevice",
            );
            const deltaTimesTable = exportData.data.data.find(
                (table: { tableName: string }): boolean => table.tableName === "deltaTimes",
            );

            expect(sessionDataTable).toBeDefined();
            expect(sessionDataTable.rows).toBeDefined();
            expect(sessionDataTable.rows).toHaveLength(1);
            expect(sessionDataTable.rows[0].sessionId).toBe(testSessionId);
            expect(sessionDataTable.rows[0].avgStrokePower).toBe(120);

            expect(connectedDeviceTable).toBeDefined();
            expect(connectedDeviceTable.rows).toBeDefined();
            expect(connectedDeviceTable.rows).toHaveLength(1);
            expect(connectedDeviceTable.rows[0].sessionId).toBe(testSessionId);
            expect(connectedDeviceTable.rows[0].deviceName).toBe(testDeviceName);

            expect(deltaTimesTable).toBeDefined();
            expect(deltaTimesTable.rows).toBeDefined();
            expect(deltaTimesTable.rows).toHaveLength(1);
            expect(deltaTimesTable.rows[0].sessionId).toBe(testSessionId);
            expect(deltaTimesTable.rows[0].deltaTimes).toEqual([120, 130, 140]);
        });

        it("should create download with correct filename format", async (): Promise<void> => {
            await service.export();

            expect(mockAnchor.download).toMatch(/\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} - database\.json$/);
            expect(mockAnchor.click).toHaveBeenCalled();
            expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:test-url");
        });

        describe("when Web Share API is available", (): void => {
            let shareSpy: Mock;

            beforeEach((): void => {
                shareSpy = vi.fn().mockResolvedValue(undefined);
                setupNavigatorWithShare(shareSpy);
            });

            it("should use navigator.share instead of download", async (): Promise<void> => {
                await service.export();

                expect(shareSpy).toHaveBeenCalled();
                expect(mockAnchor.click).not.toHaveBeenCalled();

                const shareCallArgs = shareSpy.mock.lastCall?.[0] as ShareData;
                expect(shareCallArgs.files).toBeDefined();
                expect(shareCallArgs.files?.length).toBe(1);
                expect(shareCallArgs.files?.[0].name).toMatch(
                    /\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} - database\.json$/,
                );
            });

            it("should fallback to download when share is aborted", async (): Promise<void> => {
                const abortError = new DOMException("Share aborted", "AbortError");
                shareSpy.mockRejectedValue(abortError);

                await service.export();

                expect(mockAnchor.click).toHaveBeenCalled();
            });

            it("should fallback to download when share permission is denied", async (): Promise<void> => {
                const notAllowedError = new DOMException("Not allowed", "NotAllowedError");
                shareSpy.mockRejectedValue(notAllowedError);

                await service.export();

                expect(mockAnchor.click).toHaveBeenCalled();
            });

            it("should fallback when share fails with other errors", async (): Promise<void> => {
                const otherError = new DOMException("Network error", "NetworkError");
                shareSpy.mockRejectedValue(otherError);

                await service.export();

                expect(mockAnchor.click).toHaveBeenCalled();
            });
        });

        it("should fallback to download when Web Share API is not available", async (): Promise<void> => {
            setupNavigatorWithoutShare();

            await service.export();

            expect(mockAnchor.click).toHaveBeenCalled();
        });
    });

    describe("exportSessionToJson method", (): void => {
        const testSessionId = 1700000000000;
        let createObjectURLSpy: Mock;
        let mockAnchor: { href: string; download: string; click: Mock };

        beforeEach(async (): Promise<void> => {
            mockAnchor = { href: "", download: "", click: vi.fn() };
            vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
            createObjectURLSpy = vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:test-url");
            vi.spyOn(window.URL, "revokeObjectURL").mockImplementation((): void => undefined);
            setupNavigatorWithoutShare();

            await appDB.transaction("rw", appDB.sessionData, appDB.handleForces, (): void => {
                appDB.sessionData.add({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 1000,
                    avgStrokePower: 150,
                    distance: 5000,
                    distPerStroke: 8,
                    dragFactor: 110,
                    driveDuration: 0.8,
                    recoveryDuration: 1.2,
                    speed: 4.2,
                    strokeCount: 50,
                    strokeRate: 24,
                    elapsedTime: 1,
                });
                appDB.handleForces.put({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 1000,
                    strokeId: 50,
                    handleForces: [100, 200, 300],
                    driveLength: 1.5,
                });
            });
        });

        it("should export session data with delta times when available", async (): Promise<void> => {
            const clickedFiles: Array<string> = [];
            const createdBlobs: Array<Blob> = [];
            mockAnchor.click = vi.fn((): void => {
                clickedFiles.push(mockAnchor.download);
            });
            createObjectURLSpy.mockImplementation((blob: Blob): string => {
                createdBlobs.push(blob);

                return "blob:test-url";
            });

            await appDB.deltaTimes.put({
                sessionId: testSessionId,
                timeStamp: testSessionId + 500,
                deltaTimes: [100, 110, 105],
            });

            await service.exportSessionToJson(testSessionId);

            expect(mockAnchor.click).toHaveBeenCalledTimes(2);
            expect(clickedFiles[0]).toMatch(/session\.json$/);
            expect(clickedFiles[1]).toMatch(/deltaTimes.*\.json$/);

            const sessionContent = await createdBlobs[0].text();
            const exportData = JSON.parse(sessionContent) as IExportSession;
            const records = exportData["records"];
            expect(Array.isArray(records)).toBe(true);
            expect(records[0]).toHaveProperty("avgStrokePower");
            expect(records[0]).toHaveProperty("distance");
            expect(records[0]).toHaveProperty("strokeCount");

            const deltaTimesContent = await createdBlobs[1].text();
            const deltaTimesData = JSON.parse(deltaTimesContent) as Array<number>;
            expect(Array.isArray(deltaTimesData)).toBe(true);
            expect(deltaTimesData).toEqual([100, 110, 105]);
        });

        it("should export session data without delta times when not available", async (): Promise<void> => {
            const createdBlobs: Array<Blob> = [];
            createObjectURLSpy.mockImplementation((blob: Blob): string => {
                createdBlobs.push(blob);

                return "blob:test-url";
            });

            await service.exportSessionToJson(testSessionId);

            expect(mockAnchor.click).toHaveBeenCalledTimes(1);
            expect(mockAnchor.download).toMatch(/\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} - session\.json$/);

            const sessionContent = await createdBlobs[0].text();
            const exportData = JSON.parse(sessionContent) as Record<string, unknown>;
            const records = exportData["records"] as Array<Record<string, unknown>>;
            expect(Array.isArray(records)).toBe(true);
            expect(records[0]).toHaveProperty("avgStrokePower");
            expect(records[0]).toHaveProperty("distance");
            expect(records[0]).toHaveProperty("strokeCount");
        });

        it("should create blob with correct JSON content type", async (): Promise<void> => {
            await service.exportSessionToJson(testSessionId);

            expect(createObjectURLSpy).toHaveBeenCalled();
            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            expect(blobArg.type).toBe("application/json");
        });

        it("should include deviceName in exported JSON when connected device exists", async (): Promise<void> => {
            const createdBlobs: Array<Blob> = [];
            createObjectURLSpy.mockImplementation((blob: Blob): string => {
                createdBlobs.push(blob);

                return "blob:test-url";
            });

            await appDB.connectedDevice.put({ sessionId: testSessionId, deviceName: "ESP Rowing Monitor" });

            await service.exportSessionToJson(testSessionId);

            const sessionContent = await createdBlobs[0].text();
            const sessionData = JSON.parse(sessionContent) as Record<string, unknown>;
            expect(sessionData["deviceName"]).toBe("ESP Rowing Monitor");
        });

        it("should include laps in exported JSON", async (): Promise<void> => {
            const createdBlobs: Array<Blob> = [];
            createObjectURLSpy.mockImplementation((blob: Blob): string => {
                createdBlobs.push(blob);

                return "blob:test-url";
            });

            await appDB.laps.bulkAdd([
                {
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 4000,
                    strokeIndex: 2,
                    type: "time",
                    isPause: false,
                },
                {
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 2000,
                    strokeIndex: 1,
                    type: "distance",
                    isPause: false,
                },
            ]);

            await service.exportSessionToJson(testSessionId);

            const sessionContent = await createdBlobs[0].text();
            const exportData = JSON.parse(sessionContent) as IExportSession;
            expect(exportData.laps).toHaveLength(2);
            expect(exportData.laps[0]).toEqual({
                timeStamp: testSessionId + 2000,
                strokeIndex: 1,
                type: "distance",
                isPause: false,
            });
            expect(exportData.laps[1]).toEqual({
                timeStamp: testSessionId + 4000,
                strokeIndex: 2,
                type: "time",
                isPause: false,
            });
            expect(exportData.laps[0]).not.toHaveProperty("sessionId");
        });

        it("should export empty laps array when no laps exist", async (): Promise<void> => {
            const createdBlobs: Array<Blob> = [];
            createObjectURLSpy.mockImplementation((blob: Blob): string => {
                createdBlobs.push(blob);

                return "blob:test-url";
            });

            await service.exportSessionToJson(testSessionId);

            const sessionContent = await createdBlobs[0].text();
            const exportData = JSON.parse(sessionContent) as IExportSession;
            expect(exportData.laps).toEqual([]);
        });

        describe("when Web Share API is available", (): void => {
            let shareSpy: Mock;

            beforeEach((): void => {
                shareSpy = vi.fn().mockResolvedValue(undefined);
                setupNavigatorWithShare(shareSpy);
            });

            it("should use navigator.share for session export", async (): Promise<void> => {
                await service.exportSessionToJson(testSessionId);

                expect(shareSpy).toHaveBeenCalled();
                const shareData = shareSpy.mock.calls[0][0] as ShareData;
                expect(shareData.files).toHaveLength(1);
            });

            it("should share both session and delta times when available", async (): Promise<void> => {
                await appDB.deltaTimes.put({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 500,
                    deltaTimes: [100, 110],
                });

                await service.exportSessionToJson(testSessionId);

                const shareData = shareSpy.mock.calls[0][0] as ShareData;
                expect(shareData.files).toHaveLength(2);
            });
        });
    });

    describe("exportSessionToFit method", (): void => {
        const testSessionId = 1700000000000;
        let createObjectURLSpy: Mock;
        let mockAnchor: { href: string; download: string; click: Mock };

        beforeEach(async (): Promise<void> => {
            mockAnchor = { href: "", download: "", click: vi.fn() };
            vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
            createObjectURLSpy = vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:test-url");
            vi.spyOn(window.URL, "revokeObjectURL").mockImplementation((): void => undefined);
            setupNavigatorWithoutShare();

            await appDB.transaction("rw", appDB.sessionData, appDB.handleForces, (): void => {
                appDB.sessionData.add({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 1000,
                    avgStrokePower: 150,
                    distance: 5000,
                    distPerStroke: 8,
                    dragFactor: 110,
                    driveDuration: 0.8,
                    recoveryDuration: 1.2,
                    speed: 4.2,
                    strokeCount: 50,
                    strokeRate: 24,
                    elapsedTime: 1,
                });
                appDB.handleForces.put({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 1000,
                    strokeId: 50,
                    handleForces: [100, 200, 300],
                    driveLength: 1.5,
                });
            });
        });

        it("should create FIT blob with correct download filename", async (): Promise<void> => {
            await service.exportSessionToFit(testSessionId);

            expect(mockAnchor.download).toContain("session.fit");
            expect(mockAnchor.click).toHaveBeenCalled();
        });

        it("should create blob with correct MIME type", async (): Promise<void> => {
            await service.exportSessionToFit(testSessionId);

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            expect(blobArg.type).toBe("application/vnd.ant.fit");
        });

        describe("when Web Share API is available", (): void => {
            let shareSpy: Mock;

            beforeEach((): void => {
                shareSpy = vi.fn().mockResolvedValue(undefined);
                setupNavigatorWithShare(shareSpy);
            });

            it("should use navigator.share for FIT export", async (): Promise<void> => {
                await service.exportSessionToFit(testSessionId);

                expect(shareSpy).toHaveBeenCalled();
            });

            it("should include FIT content in shared file", async (): Promise<void> => {
                await service.exportSessionToFit(testSessionId);

                const shareData = shareSpy.mock.calls[0][0] as ShareData;
                expect(shareData.files).toHaveLength(1);
                expect(shareData.files![0].name).toContain(".fit");
            });
        });
    });

    describe("generateFitFile method", (): void => {
        const testSessionId = 1700000000000;

        beforeEach(async (): Promise<void> => {
            await appDB.transaction("rw", appDB.sessionData, appDB.handleForces, (): void => {
                appDB.sessionData.add({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 1000,
                    avgStrokePower: 150,
                    distance: 5000,
                    distPerStroke: 8,
                    dragFactor: 110,
                    driveDuration: 0.8,
                    recoveryDuration: 1.2,
                    speed: 4.2,
                    strokeCount: 50,
                    strokeRate: 24,
                    elapsedTime: 1,
                });
                appDB.handleForces.put({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 1000,
                    strokeId: 50,
                    handleForces: [100, 200, 300],
                    driveLength: 1.5,
                });
            });
        });

        it("should return a Blob with the FIT MIME type", async (): Promise<void> => {
            const blob = await service.generateFitFile(testSessionId);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe("application/vnd.ant.fit");
        });

        it("should return a non-empty Blob", async (): Promise<void> => {
            const blob = await service.generateFitFile(testSessionId);

            expect(blob.size).toBeGreaterThan(0);
        });
    });

    describe("exportSessionToCsv method", (): void => {
        const testSessionId = 1700000000000;
        let createObjectURLSpy: Mock;
        let mockAnchor: { href: string; download: string; click: Mock };

        beforeEach(async (): Promise<void> => {
            mockAnchor = { href: "", download: "", click: vi.fn() };
            vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
            createObjectURLSpy = vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:test-url");
            vi.spyOn(window.URL, "revokeObjectURL").mockImplementation((): void => undefined);
            setupNavigatorWithoutShare();

            await appDB.transaction("rw", appDB.sessionData, appDB.handleForces, (): void => {
                appDB.sessionData.add({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 1000,
                    avgStrokePower: 150,
                    distance: 5000,
                    distPerStroke: 8,
                    dragFactor: 110,
                    driveDuration: 0.8,
                    recoveryDuration: 1.2,
                    speed: 4.2,
                    strokeCount: 50,
                    strokeRate: 24,
                    heartRate: { heartRate: 140, contactDetected: true },
                    elapsedTime: 1,
                });
                appDB.handleForces.put({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 1000,
                    strokeId: 50,
                    handleForces: [100.5, 200.25, 300.75],
                    driveLength: 1.5,
                });
            });
        });

        it("should create CSV blob with correct download filename", async (): Promise<void> => {
            await service.exportSessionToCsv(testSessionId);

            expect(mockAnchor.download).toMatch(/\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} - session\.csv$/);
            expect(mockAnchor.click).toHaveBeenCalled();
        });

        it("should create blob with correct MIME type", async (): Promise<void> => {
            await service.exportSessionToCsv(testSessionId);

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            expect(blobArg.type).toBe("text/csv");
        });

        it("should include CSV headers in exported content", async (): Promise<void> => {
            await service.exportSessionToCsv(testSessionId);

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            const content = await blobArg.text();
            expect(content).toContain("Stroke Number");
            expect(content).toContain("Elapsed Time");
            expect(content).toContain("Distance (m)");
            expect(content).toContain("Heart Rate");
            expect(content).toContain("Drive Length (m)");
            expect(content).toContain("Peak Force Position (%)");
            expect(content).toContain("Handle Forces (N)");
        });

        it("should include session data in CSV format", async (): Promise<void> => {
            await service.exportSessionToCsv(testSessionId);

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            const content = await blobArg.text();
            expect(content, "stroke count").toContain("50");
            expect(content, "heart rate").toContain("140");
        });

        it("should include drive length value in CSV row", async (): Promise<void> => {
            await service.exportSessionToCsv(testSessionId);

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            const content = await blobArg.text();
            const rows = content.trim().split("\n");
            const dataRow = rows[1].split(",");
            const driveLengthHeader = rows[0].split(",").indexOf("Drive Length (m)");
            expect(dataRow[driveLengthHeader]).toBe("1.50");
        });

        it("should format handle forces as quoted comma-separated values", async (): Promise<void> => {
            await service.exportSessionToCsv(testSessionId);

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            const content = await blobArg.text();
            expect(content).toContain('"100.50,200.25,300.75"');
        });

        it("should include peak force position in CSV row", async (): Promise<void> => {
            await service.exportSessionToCsv(testSessionId);

            const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
            const content = await blobArg.text();
            const rows = content.trim().split("\n");
            const dataRow = rows[1].split(",");
            const header = rows[0].split(",").indexOf("Peak Force Position (%)");
            expect(dataRow[header]).toBe("100.0");
        });

        it("should export session data with deltaTimes when available", async (): Promise<void> => {
            const clickedFiles: Array<string> = [];
            mockAnchor.click = vi.fn((): void => {
                clickedFiles.push(mockAnchor.download);
            });

            await appDB.deltaTimes.put({
                sessionId: testSessionId,
                timeStamp: testSessionId + 500,
                deltaTimes: [100, 110, 105],
            });

            await service.exportSessionToCsv(testSessionId);

            expect(mockAnchor.click).toHaveBeenCalledTimes(2);
            expect(clickedFiles[0]).toMatch(/session\.csv$/);
            expect(clickedFiles[1]).toMatch(/deltaTimes.*\.csv$/);
        });

        it("should export session data without deltaTimes when not available", async (): Promise<void> => {
            await service.exportSessionToCsv(testSessionId);

            expect(mockAnchor.click).toHaveBeenCalledTimes(1);
        });

        describe("when Web Share API is available", (): void => {
            let shareSpy: Mock;

            beforeEach((): void => {
                shareSpy = vi.fn().mockResolvedValue(undefined);
                setupNavigatorWithShare(shareSpy);
            });

            it("should use navigator.share for CSV export", async (): Promise<void> => {
                await service.exportSessionToCsv(testSessionId);

                expect(shareSpy).toHaveBeenCalled();
            });

            it("should include CSV content in shared file", async (): Promise<void> => {
                await service.exportSessionToCsv(testSessionId);

                const shareData = shareSpy.mock.calls[0][0] as ShareData;
                expect(shareData.files).toHaveLength(1);
                expect(shareData.files![0].name).toContain(".csv");
            });

            it("should share both session and deltaTimes CSV when available", async (): Promise<void> => {
                await appDB.deltaTimes.put({
                    sessionId: testSessionId,
                    timeStamp: testSessionId + 500,
                    deltaTimes: [100, 110],
                });

                await service.exportSessionToCsv(testSessionId);

                const shareData = shareSpy.mock.calls[0][0] as ShareData;
                expect(shareData.files).toHaveLength(2);
            });
        });

        describe("speed calculation", (): void => {
            beforeEach(async (): Promise<void> => {
                await setupSpeedCalculationThreeStrokes();
            });

            it("should calculate speed using strokeRate and distPerStroke", async (): Promise<void> => {
                await service.exportSessionToCsv(testSessionId);

                const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
                const content = await blobArg.text();
                const lines = content.split("\n").filter((line: string): boolean => line.length > 0);

                const dataLines = lines.slice(1);

                const stroke1 = dataLines[0].split(",");
                expect(parseFloat(stroke1[4]), "stroke 1: (24/60) * 5 = 2.0 m/s = 7.2 km/h").toBeCloseTo(
                    7.2,
                    1,
                );
                expect(parseFloat(stroke1[3]), "stroke 1 pace (500m): 500/2.0 = 250s").toBeCloseTo(250, 0);

                const stroke2 = dataLines[1].split(",");
                expect(parseFloat(stroke2[4]), "stroke 2: (30/60) * 6 = 3.0 m/s = 10.8 km/h").toBeCloseTo(
                    10.8,
                    1,
                );
                expect(parseFloat(stroke2[3]), "stroke 2 pace (500m): 500/3.0 = 166.67s").toBeCloseTo(
                    166.67,
                    0,
                );

                const stroke3 = dataLines[2].split(",");
                expect(parseFloat(stroke3[4]), "stroke 3: (25/60) * 7 = 2.917 m/s = 10.5 km/h").toBeCloseTo(
                    10.5,
                    1,
                );
                expect(parseFloat(stroke3[3]), "stroke 3 pace (500m): 500/2.917 = 171.4s").toBeCloseTo(
                    171.4,
                    0,
                );
            });

            it("should filter out duplicate stroke entries with same strokeCount", async (): Promise<void> => {
                await setupSpeedCalculationFilterDuplicates();

                await service.exportSessionToCsv(testSessionId);

                const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
                const content = await blobArg.text();
                const lines = content.split("\n").filter((line: string): boolean => line.length > 0);

                expect(lines.length).toBe(5);

                const stroke4 = lines[4].split(",");
                expect(parseFloat(stroke4[4]), "stroke 4: (30/60) * 6 = 3.0 m/s = 10.8 km/h").toBeCloseTo(
                    10.8,
                    1,
                );
            });

            it("should handle strokes with accumulated distance", async (): Promise<void> => {
                await setupSpeedCalculationFirstStrokeStartTime();

                await service.exportSessionToCsv(testSessionId);

                const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
                const content = await blobArg.text();
                const lines = content.split("\n").filter((line: string): boolean => line.length > 0);
                const stroke3 = lines[3].split(",");
                expect(parseFloat(stroke3[4]), "stroke 3: 11.46 / 4.30 = 2.653 m/s = 9.55 km/h").toBeCloseTo(
                    9.55,
                    1,
                );
            });

            it("should calculate speed independent of timestamp deltas", async (): Promise<void> => {
                await setupSpeedCalculationZeroTimeDelta();

                await service.exportSessionToCsv(testSessionId);

                const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
                const content = await blobArg.text();
                const lines = content.split("\n").filter((line: string): boolean => line.length > 0);

                const stroke1 = lines[1].split(",");
                expect(parseFloat(stroke1[4]), "stroke 1: (24/60) * 5 = 2.0 m/s = 7.2 km/h").toBeCloseTo(
                    7.2,
                    1,
                );
            });

            it("should handle edge case with zero distance", async (): Promise<void> => {
                await setupSpeedCalculationZeroDistance();

                await service.exportSessionToCsv(testSessionId);

                const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
                const content = await blobArg.text();
                const lines = content.split("\n").filter((line: string): boolean => line.length > 0);
                const stroke1 = lines[1].split(",");
                expect(stroke1[4]).toBe("0.00");
            });
        });
    });

    describe("import method", (): void => {
        const mockBlob = new Blob([JSON.stringify(mockImportData)]);

        beforeEach((): void => {
            vi.spyOn(console, "log").mockImplementation((): void => undefined);
        });

        it("should import data into appDB tables", async (): Promise<void> => {
            await service.import(mockBlob);

            // verify data was imported into the database
            const sessionData = await appDB.sessionData.where({ sessionId: 123456789 }).toArray();
            const deltaTimes = await appDB.deltaTimes.where({ sessionId: 123456789 }).toArray();
            const handleForces = await appDB.handleForces.where({ sessionId: 123456789 }).toArray();
            const connectedDevice = await appDB.connectedDevice.where({ sessionId: 123456789 }).toArray();

            expect(sessionData).toHaveLength(2);
            expect(sessionData[0].avgStrokePower).toBe(100);
            expect(sessionData[1].avgStrokePower).toBe(110);

            expect(deltaTimes).toHaveLength(1);
            expect(deltaTimes[0].deltaTimes).toEqual([120, 130, 140]);

            expect(handleForces).toHaveLength(1);
            expect(handleForces[0].handleForces).toEqual([100, 200, 300, 200, 100]);

            expect(connectedDevice).toHaveLength(1);
            expect(connectedDevice[0].deviceName).toBe("TestDevice");
        });

        it("should call progress callback during import", async (): Promise<void> => {
            const progressCallback = vi.fn().mockReturnValue(true);

            await service.import(mockBlob, progressCallback);

            expect(progressCallback).toHaveBeenCalled();
        });

        it("should import data successfully without progress callback", async (): Promise<void> => {
            await service.import(mockBlob);

            const sessionData = await appDB.sessionData.where({ sessionId: 123456789 }).toArray();
            expect(sessionData).toHaveLength(2);
        });
    });

    describe("getSessionSummaries$ method", (): void => {
        const testSessionId1 = 1700000000001;
        const testSessionId2 = 1700000000002;

        beforeEach(async (): Promise<void> => {
            vi.useRealTimers();
        });

        it("should emit empty array when no session data exists", async (): Promise<void> => {
            const sessions = firstValueFrom(service.getSessionSummaries$());

            await appDB.transaction("rw", appDB.connectedDevice, (): void => {
                appDB.connectedDevice.put({
                    sessionId: 12121221121,
                    deviceName: "TestDevice2",
                });
                appDB.connectedDevice.put({
                    sessionId: 1212122112,
                    deviceName: "TestDevice3",
                });
            });

            expect(await sessions).toHaveLength(0);
        });

        it("should return observable that emits session summaries with correct data", async (): Promise<void> => {
            await appDB.transaction("rw", appDB.sessionData, appDB.connectedDevice, (): void => {
                appDB.connectedDevice.put({
                    sessionId: testSessionId1,
                    deviceName: "TestDevice1",
                });
                appDB.connectedDevice.put({
                    sessionId: testSessionId2,
                    deviceName: "TestDevice2",
                });
                appDB.sessionData.add({
                    sessionId: testSessionId1,
                    timeStamp: testSessionId1 + 1000,
                    avgStrokePower: 100,
                    distance: 5000,
                    distPerStroke: 8,
                    dragFactor: 110,
                    driveDuration: 800,
                    recoveryDuration: 1200,
                    speed: 4.2,
                    strokeCount: 50,
                    strokeRate: 24,
                    elapsedTime: 1,
                });
                appDB.sessionData.add({
                    sessionId: testSessionId2,
                    timeStamp: testSessionId2 + 1000,
                    avgStrokePower: 120,
                    distance: 6000,
                    distPerStroke: 9,
                    dragFactor: 115,
                    driveDuration: 850,
                    recoveryDuration: 1150,
                    speed: 4.5,
                    strokeCount: 60,
                    strokeRate: 26,
                    elapsedTime: 1,
                });
            });

            const summaries = await firstValueFrom(service.getSessionSummaries$());

            expect(summaries).toBeDefined();
            expect(Array.isArray(summaries)).toBe(true);
            expect(summaries).toHaveLength(2);

            const session1 = summaries.find(
                (session: ISessionSummary): boolean => session.sessionId === testSessionId1,
            );
            const session2 = summaries.find(
                (session: ISessionSummary): boolean => session.sessionId === testSessionId2,
            );

            expect(session1).toBeDefined();
            expect(session1?.deviceName).toBe("TestDevice1");
            expect(session1?.distance).toBe(5000);
            expect(session1?.strokeCount).toBe(50);

            expect(session2).toBeDefined();
            expect(session2?.deviceName).toBe("TestDevice2");
            expect(session2?.distance).toBe(6000);
            expect(session2?.strokeCount).toBe(60);
        });

        it("should emit updated summaries when database changes", async (): Promise<void> => {
            const testSessionId3 = 1700000000003;
            await appDB.transaction("rw", appDB.sessionData, appDB.connectedDevice, (): void => {
                appDB.connectedDevice.put({
                    sessionId: testSessionId1,
                    deviceName: "TestDevice1",
                });
                appDB.connectedDevice.put({
                    sessionId: testSessionId2,
                    deviceName: "TestDevice2",
                });
                appDB.sessionData.add({
                    sessionId: testSessionId1,
                    timeStamp: testSessionId1 + 1000,
                    avgStrokePower: 100,
                    distance: 5000,
                    distPerStroke: 8,
                    dragFactor: 110,
                    driveDuration: 800,
                    recoveryDuration: 1200,
                    speed: 4.2,
                    strokeCount: 50,
                    strokeRate: 24,
                    elapsedTime: 1,
                });
                appDB.sessionData.add({
                    sessionId: testSessionId2,
                    timeStamp: testSessionId2 + 1000,
                    avgStrokePower: 120,
                    distance: 6000,
                    distPerStroke: 9,
                    dragFactor: 115,
                    driveDuration: 850,
                    recoveryDuration: 1150,
                    speed: 4.5,
                    strokeCount: 60,
                    strokeRate: 26,
                    elapsedTime: 1,
                });
            });

            const summariesPromise = firstValueFrom(service.getSessionSummaries$());

            // add new session data to trigger update
            await appDB.transaction("rw", appDB.sessionData, appDB.connectedDevice, (): void => {
                appDB.connectedDevice.put({
                    sessionId: testSessionId3,
                    deviceName: "TestDevice3",
                });
                appDB.sessionData.add({
                    sessionId: testSessionId3,
                    timeStamp: testSessionId3 + 1000,
                    avgStrokePower: 130,
                    distance: 7000,
                    distPerStroke: 10,
                    dragFactor: 120,
                    driveDuration: 900,
                    recoveryDuration: 1100,
                    speed: 4.8,
                    strokeCount: 102,
                    strokeRate: 28,
                    elapsedTime: 1,
                });
            });

            const summaries = await summariesPromise;

            expect(summaries).toHaveLength(3);
            expect(summaries[2].sessionId).toBe(testSessionId3);
            expect(summaries[2].strokeCount).toBe(102);
        });
    });
});
