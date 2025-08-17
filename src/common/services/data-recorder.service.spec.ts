import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import Dexie from "dexie";
import { skip, take } from "rxjs/operators";

import { ISessionData, ISessionSummary } from "../common.interfaces";
import { IHandleForcesEntity, IMetricsEntity } from "../database.interfaces";
import { appDB } from "../utils/app-database";

import { DataRecorderService } from "./data-recorder.service";

describe("DataRecorderService", (): void => {
    let service: DataRecorderService;
    let mockTransaction: jasmine.Spy;

    // database spy variables for easy callThrough assignment
    let connectedDevicePutSpy: jasmine.Spy;
    let connectedDeviceWhereSpy: jasmine.Spy;
    let deltaTimesPutSpy: jasmine.Spy;
    let deltaTimesWhereSpy: jasmine.Spy;
    let sessionDataAddSpy: jasmine.Spy;
    let sessionDataWhereSpy: jasmine.Spy;
    let sessionDataOrderBySpy: jasmine.Spy;
    let handleForcesPutSpy: jasmine.Spy;
    let handleForcesWhereSpy: jasmine.Spy;

    let clickSpy: jasmine.Spy;

    // mock data
    const mockSessionId = 1234567890;
    const mockTimeStamp = Date.now();
    const mockDeviceName = "TestDevice";

    const mockSessionData: ISessionData = {
        activityStartTime: new Date(),
        avgStrokePower: 150,
        distance: 1000,
        distPerStroke: 10,
        dragFactor: 120,
        driveDuration: 800,
        recoveryDuration: 1200,
        speed: 5.2,
        strokeCount: 100,
        strokeRate: 24,
        peakForce: 300,
        handleForces: [100, 200, 300, 250, 150],
        heartRate: {
            heartRate: 150,
            contactDetected: true,
            rrIntervals: [800, 850],
        },
    };

    const mockMetricsEntity: IMetricsEntity = {
        sessionId: mockSessionId,
        timeStamp: mockTimeStamp,
        avgStrokePower: mockSessionData.avgStrokePower,
        distance: mockSessionData.distance,
        distPerStroke: mockSessionData.distPerStroke,
        dragFactor: mockSessionData.dragFactor,
        driveDuration: mockSessionData.driveDuration,
        recoveryDuration: mockSessionData.recoveryDuration,
        speed: mockSessionData.speed,
        strokeCount: mockSessionData.strokeCount,
        strokeRate: mockSessionData.strokeRate,
        heartRate: mockSessionData.heartRate,
    };

    const mockHandleForcesEntity: IHandleForcesEntity = {
        timeStamp: mockTimeStamp,
        sessionId: mockSessionId,
        strokeId: mockSessionData.strokeCount,
        peakForce: mockSessionData.peakForce,
        handleForces: mockSessionData.handleForces,
    };

    const mockDeltaTimes = [100, 150, 200, 180];

    let anchorElement: HTMLAnchorElement | undefined;

    beforeEach((): void => {
        TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
        service = TestBed.inject(DataRecorderService);

        spyOn(Date, "now").and.returnValue(mockTimeStamp);
        anchorElement = document.createElement("a");
        clickSpy = spyOn(anchorElement, "click").and.callFake((): void => {
            // no-op
        });
        spyOn(document, "createElement").withArgs("a").and.returnValue(anchorElement);

        mockTransaction = spyOn(appDB, "transaction");

        connectedDevicePutSpy = spyOn(appDB.connectedDevice, "put").and.returnValue(Dexie.Promise.resolve(1));
        connectedDeviceWhereSpy = spyOn(appDB.connectedDevice, "where").and.returnValue({
            delete: jasmine.createSpy("delete").and.returnValue(Dexie.Promise.resolve(1)),
            last: jasmine
                .createSpy("last")
                .and.returnValue(Dexie.Promise.resolve({ deviceName: mockDeviceName })),
        } as unknown as ReturnType<typeof appDB.connectedDevice.where>);

        deltaTimesPutSpy = spyOn(appDB.deltaTimes, "put").and.returnValue(Dexie.Promise.resolve(1));
        deltaTimesWhereSpy = spyOn(appDB.deltaTimes, "where").and.returnValue({
            delete: jasmine.createSpy("delete").and.returnValue(Dexie.Promise.resolve(1)),
            toArray: jasmine
                .createSpy("toArray")
                .and.returnValue(
                    Dexie.Promise.resolve([{ deltaTimes: [100, 150] }, { deltaTimes: [200, 180] }]),
                ),
        } as unknown as ReturnType<typeof appDB.deltaTimes.where>);

        sessionDataAddSpy = spyOn(appDB.sessionData, "add").and.returnValue(Dexie.Promise.resolve(1));
        sessionDataWhereSpy = spyOn(appDB.sessionData, "where").and.returnValue({
            delete: jasmine.createSpy("delete").and.returnValue(Dexie.Promise.resolve(1)),
            toArray: jasmine.createSpy("toArray").and.returnValue(Dexie.Promise.resolve([mockMetricsEntity])),
            first: jasmine.createSpy("first").and.returnValue(Dexie.Promise.resolve(mockMetricsEntity)),
            last: jasmine.createSpy("last").and.returnValue(Dexie.Promise.resolve(mockMetricsEntity)),
        } as unknown as ReturnType<typeof appDB.sessionData.where>);
        sessionDataOrderBySpy = spyOn(appDB.sessionData, "orderBy").and.returnValue({
            uniqueKeys: jasmine
                .createSpy("uniqueKeys")
                .and.returnValue(Dexie.Promise.resolve([mockSessionId])),
        } as unknown as ReturnType<typeof appDB.sessionData.orderBy>);

        handleForcesPutSpy = spyOn(appDB.handleForces, "put").and.returnValue(Dexie.Promise.resolve(1));
        handleForcesWhereSpy = spyOn(appDB.handleForces, "where").and.returnValue({
            delete: jasmine.createSpy("delete").and.returnValue(Dexie.Promise.resolve(1)),
            last: jasmine.createSpy("last").and.returnValue(Dexie.Promise.resolve(mockHandleForcesEntity)),
            toArray: jasmine
                .createSpy("toArray")
                .and.returnValue(Dexie.Promise.resolve([mockHandleForcesEntity])),
        } as unknown as ReturnType<typeof appDB.handleForces.where>);
    });

    afterEach((): void => {
        anchorElement = undefined;
    });

    it("should be created", (): void => {
        expect(service).toBeTruthy();
    });

    describe("addConnectedDevice method", (): void => {
        it("should call appDB.connectedDevice.put with correct arguments", async (): Promise<void> => {
            connectedDevicePutSpy.and.returnValue(Dexie.Promise.resolve(123));
            service.reset();

            const result = await service.addConnectedDevice(mockDeviceName);

            expect(connectedDevicePutSpy).toHaveBeenCalledWith({
                deviceName: mockDeviceName,
                sessionId: mockTimeStamp,
            });
            expect(result).toBe(123);
        });

        it("should return the result from database put operation", async (): Promise<void> => {
            const expectedId = 456;
            connectedDevicePutSpy.and.returnValue(Dexie.Promise.resolve(expectedId));

            const result = await service.addConnectedDevice(mockDeviceName);

            expect(result).toBe(expectedId);
        });
    });

    describe("addDeltaTimes method", (): void => {
        it("should call appDB.deltaTimes.put with correct arguments", async (): Promise<void> => {
            deltaTimesPutSpy.and.returnValue(Dexie.Promise.resolve(123));
            service.reset();

            const result = await service.addDeltaTimes(mockDeltaTimes);

            expect(deltaTimesPutSpy).toHaveBeenCalledWith({
                sessionId: mockTimeStamp,
                timeStamp: mockTimeStamp,
                deltaTimes: mockDeltaTimes,
            });
            expect(result).toBe(123);
        });

        it("should return the result from database put operation", async (): Promise<void> => {
            const expectedId = 789;
            deltaTimesPutSpy.and.returnValue(Dexie.Promise.resolve(expectedId));

            const result = await service.addDeltaTimes(mockDeltaTimes);

            expect(result).toBe(expectedId);
        });
    });

    describe("addSessionData method", (): void => {
        it("should execute database transaction with correct tables", async (): Promise<void> => {
            mockTransaction.and.returnValue(Dexie.Promise.resolve());

            await service.addSessionData(mockSessionData);

            expect(mockTransaction).toHaveBeenCalledWith(
                "rw",
                appDB.sessionData,
                appDB.handleForces,
                jasmine.any(Function),
            );
        });

        it("should add session data to sessionData table", async (): Promise<void> => {
            let transactionCallback: () => Promise<void>;
            mockTransaction.and.callFake((mode: string, ...args: Array<unknown>): Dexie.Promise<unknown> => {
                transactionCallback = args[args.length - 1] as () => Promise<void>;

                return Dexie.Promise.resolve();
            });
            service.reset();

            await service.addSessionData(mockSessionData);
            await transactionCallback!();

            expect(sessionDataAddSpy).toHaveBeenCalledWith({
                sessionId: mockTimeStamp,
                timeStamp: mockTimeStamp,
                avgStrokePower: mockSessionData.avgStrokePower,
                distance: mockSessionData.distance,
                distPerStroke: mockSessionData.distPerStroke,
                dragFactor: mockSessionData.dragFactor,
                driveDuration: mockSessionData.driveDuration,
                recoveryDuration: mockSessionData.recoveryDuration,
                speed: mockSessionData.speed,
                strokeCount: mockSessionData.strokeCount,
                strokeRate: mockSessionData.strokeRate,
                heartRate: mockSessionData.heartRate,
            });
        });

        it("should add handle forces data to handleForces table", async (): Promise<void> => {
            let transactionCallback: () => Promise<void>;
            mockTransaction.and.callFake((mode: string, ...args: Array<unknown>): Dexie.Promise<unknown> => {
                transactionCallback = args[args.length - 1] as () => Promise<void>;

                return Dexie.Promise.resolve();
            });

            service.reset();
            await service.addSessionData(mockSessionData);
            await transactionCallback!();

            expect(handleForcesPutSpy).toHaveBeenCalledWith({
                timeStamp: mockTimeStamp,
                sessionId: mockTimeStamp,
                strokeId: mockSessionData.strokeCount,
                peakForce: mockSessionData.peakForce,
                handleForces: mockSessionData.handleForces,
            });
        });

        it("should use existing timestamp from last handle forces entry when available", async (): Promise<void> => {
            const existingTimestamp = mockTimeStamp - 1000;
            const mockLastHandleForces = { ...mockHandleForcesEntity, timeStamp: existingTimestamp };

            handleForcesWhereSpy.and.returnValue({
                last: jasmine.createSpy("last").and.returnValue(Dexie.Promise.resolve(mockLastHandleForces)),
            });

            let transactionCallback: () => Promise<void>;
            mockTransaction.and.callFake((mode: string, ...args: Array<unknown>): Dexie.Promise<unknown> => {
                transactionCallback = args[args.length - 1] as () => Promise<void>;

                return Dexie.Promise.resolve();
            });
            service.reset();

            await service.addSessionData(mockSessionData);
            await transactionCallback!();

            expect(handleForcesPutSpy).toHaveBeenCalledWith({
                timeStamp: existingTimestamp,
                sessionId: mockTimeStamp,
                strokeId: mockSessionData.strokeCount,
                peakForce: mockSessionData.peakForce,
                handleForces: mockSessionData.handleForces,
            });
        });
    });

    describe("deleteSession method", (): void => {
        it("should execute database transaction with correct tables", async (): Promise<void> => {
            mockTransaction.and.returnValue(Dexie.Promise.resolve([1, 1, 1, 1]));

            await service.deleteSession(mockSessionId);

            expect(mockTransaction).toHaveBeenCalledWith(
                "rw",
                appDB.sessionData,
                appDB.deltaTimes,
                appDB.handleForces,
                appDB.connectedDevice,
                jasmine.any(Function),
            );
        });

        it("should delete records from all tables for given sessionId", async (): Promise<void> => {
            let transactionCallback: () => Promise<Array<number>>;
            mockTransaction.and.callFake((mode: string, ...args: Array<unknown>): Dexie.Promise<unknown> => {
                transactionCallback = args[args.length - 1] as () => Promise<Array<number>>;

                return Dexie.Promise.resolve([1, 1, 1, 1]);
            });

            await service.deleteSession(mockSessionId);
            const result = await transactionCallback!();

            expect(sessionDataWhereSpy).toHaveBeenCalledWith({ sessionId: mockSessionId });
            expect(deltaTimesWhereSpy).toHaveBeenCalledWith({ sessionId: mockSessionId });
            expect(handleForcesWhereSpy).toHaveBeenCalledWith({ sessionId: mockSessionId });
            expect(connectedDeviceWhereSpy).toHaveBeenCalledWith({ sessionId: mockSessionId });
            expect(result).toEqual([1, 1, 1, 1]);
        });

        it("should return deletion counts from all tables", async (): Promise<void> => {
            const expectedCounts: [number, number, number, number] = [5, 3, 8, 1];
            mockTransaction.and.returnValue(Dexie.Promise.resolve(expectedCounts));

            const result = await service.deleteSession(mockSessionId);

            expect(result).toEqual(expectedCounts);
        });
    });

    describe("reset method", (): void => {
        it("should update session ID used by subsequent operations", async (): Promise<void> => {
            // first call to establish a baseline
            await service.addConnectedDevice("Device1");
            const firstCall = connectedDevicePutSpy.calls.mostRecent().args[0];

            // reset should change the session ID
            service.reset();

            // second call should use the new session ID (mockTimeStamp)
            await service.addConnectedDevice("Device2");
            const secondCall = connectedDevicePutSpy.calls.mostRecent().args[0];

            expect(secondCall.sessionId).toBe(mockTimeStamp);
            expect(secondCall.sessionId).not.toBe(firstCall.sessionId);
        });
    });

    describe("export method", (): void => {
        let blobSpy: jasmine.Spy;
        const testSessionId = 987654321;
        const testDeviceName = "ExportTestDevice";

        beforeEach(async (): Promise<void> => {
            blobSpy = spyOn(window, "Blob").and.callThrough();

            // enable real database operations for export tests
            mockTransaction.and.callThrough();
            connectedDevicePutSpy.and.callThrough();
            connectedDeviceWhereSpy.and.callThrough();
            deltaTimesPutSpy.and.callThrough();
            deltaTimesWhereSpy.and.callThrough();
            sessionDataAddSpy.and.callThrough();
            sessionDataWhereSpy.and.callThrough();
            sessionDataOrderBySpy.and.callThrough();
            handleForcesPutSpy.and.callThrough();
            handleForcesWhereSpy.and.callThrough();

            // reset database and add test data
            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.connectedDevice,
                appDB.deltaTimes,
                appDB.handleForces,
                async (): Promise<void> => {
                    await appDB.sessionData.clear();
                    await appDB.connectedDevice.clear();
                    await appDB.deltaTimes.clear();
                    await appDB.handleForces.clear();

                    // add test data
                    await appDB.connectedDevice.put({
                        sessionId: testSessionId,
                        deviceName: testDeviceName,
                    });

                    await appDB.sessionData.add({
                        sessionId: testSessionId,
                        timeStamp: 1000000001,
                        avgStrokePower: 120,
                        distance: 600,
                        distPerStroke: 6,
                        dragFactor: 115,
                        driveDuration: 750,
                        recoveryDuration: 1150,
                        speed: 4.8,
                        strokeCount: 100,
                        strokeRate: 25,
                        heartRate: { heartRate: 145, contactDetected: true, rrIntervals: [750] },
                    });

                    await appDB.deltaTimes.put({
                        sessionId: testSessionId,
                        timeStamp: 1000000010,
                        deltaTimes: [120, 130, 140],
                    });
                },
            );
        });

        it("should export database in JSON with correct structure", async (): Promise<void> => {
            const createObjectURLSpy = spyOn(URL, "createObjectURL");

            await service.export();

            expect(blobSpy).toHaveBeenCalled();
            expect(clickSpy).toHaveBeenCalled();
            const exportedData = JSON.parse(
                await (createObjectURLSpy.calls.mostRecent().args[0] as Blob).text(),
            );
            expect(exportedData.formatName).toBe("dexie");
            expect(exportedData.data.databaseName).toBe("ESPRowingMonitorDB");
            expect(exportedData.data.tables).toHaveSize(4);
        });

        it("should include test data with correct sessionId in exported JSON", async (): Promise<void> => {
            const createObjectURLSpy = spyOn(URL, "createObjectURL");

            await service.export();

            const exportData = JSON.parse(
                await (createObjectURLSpy.calls.mostRecent().args[0] as Blob).text(),
            );
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
            expect(sessionDataTable.rows).toHaveSize(1);
            expect(sessionDataTable.rows[0].sessionId).toBe(testSessionId);
            expect(sessionDataTable.rows[0].avgStrokePower).toBe(120);

            expect(connectedDeviceTable).toBeDefined();
            expect(connectedDeviceTable.rows).toBeDefined();
            expect(connectedDeviceTable.rows).toHaveSize(1);
            expect(connectedDeviceTable.rows[0].sessionId).toBe(testSessionId);
            expect(connectedDeviceTable.rows[0].deviceName).toBe(testDeviceName);

            expect(deltaTimesTable).toBeDefined();
            expect(deltaTimesTable.rows).toBeDefined();
            expect(deltaTimesTable.rows).toHaveSize(1);
            expect(deltaTimesTable.rows[0].sessionId).toBe(testSessionId);
            expect(deltaTimesTable.rows[0].deltaTimes).toEqual([120, 130, 140]);
        });

        it("should create download with correct filename format", async (): Promise<void> => {
            await service.export();

            expect(blobSpy).toHaveBeenCalled();
            expect(anchorElement?.download).toMatch(/\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} - database\.json$/);
        });
    });

    describe("exportSessionToJson method", (): void => {
        let blobSpy: jasmine.Spy;
        const testSessionId = 987654321;

        beforeEach(async (): Promise<void> => {
            blobSpy = spyOn(window, "Blob").and.callThrough();

            // enable real database operations for export tests
            mockTransaction.and.callThrough();
            connectedDevicePutSpy.and.callThrough();
            connectedDeviceWhereSpy.and.callThrough();
            deltaTimesPutSpy.and.callThrough();
            deltaTimesWhereSpy.and.callThrough();
            sessionDataAddSpy.and.callThrough();
            sessionDataWhereSpy.and.callThrough();
            sessionDataOrderBySpy.and.callThrough();
            handleForcesPutSpy.and.callThrough();
            handleForcesWhereSpy.and.callThrough();

            // reset database and add test data
            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.connectedDevice,
                appDB.deltaTimes,
                appDB.handleForces,
                async (): Promise<void> => {
                    await appDB.sessionData.clear();
                    await appDB.connectedDevice.clear();
                    await appDB.deltaTimes.clear();
                    await appDB.handleForces.clear();

                    // add test session data
                    await appDB.sessionData.add({
                        sessionId: testSessionId,
                        timeStamp: 1000000001,
                        avgStrokePower: 150,
                        distance: 1000,
                        distPerStroke: 10,
                        dragFactor: 120,
                        driveDuration: 800,
                        recoveryDuration: 1200,
                        speed: 5.2,
                        strokeCount: 100,
                        strokeRate: 24,
                        heartRate: { heartRate: 150, contactDetected: true, rrIntervals: [800, 850] },
                    });

                    await appDB.handleForces.put({
                        sessionId: testSessionId,
                        timeStamp: 1000000001,
                        strokeId: 100,
                        peakForce: 300,
                        handleForces: [100, 200, 300, 250, 150],
                    });
                },
            );
        });

        it("should export session data with delta times when available", async (): Promise<void> => {
            // add delta times data
            await appDB.deltaTimes.put({
                sessionId: testSessionId,
                timeStamp: 1000000010,
                deltaTimes: [100, 150, 200],
            });

            await service.exportSessionToJson(testSessionId);

            // verify blob was created
            expect(blobSpy).toHaveBeenCalledTimes(2);
            const sessionData = JSON.parse(blobSpy.calls.argsFor(1)[0][0]);

            expect(sessionData).toHaveSize(1);
            expect(sessionData[0].strokeCount).toBe(100);
            expect(sessionData[0].avgStrokePower).toBe(150);

            const deltaTimesData = JSON.parse(blobSpy.calls.argsFor(0)[0][0]);
            expect(deltaTimesData).toBeDefined();
            expect(deltaTimesData).toEqual([100, 150, 200]);
        });

        it("should export session data without delta times when not available", async (): Promise<void> => {
            await service.exportSessionToJson(testSessionId);

            // verify blob was created
            expect(blobSpy).toHaveBeenCalledTimes(1);

            // parse the blob content to verify it contains expected data
            const exportData = JSON.parse(blobSpy.calls.mostRecent().args[0][0]);
            expect(exportData).toBeDefined();
            expect(exportData).toHaveSize(1);
            expect(exportData[0].avgStrokePower).toBe(150);
        });

        it("should create blob with correct JSON content type", async (): Promise<void> => {
            await service.exportSessionToJson(testSessionId);

            expect(blobSpy).toHaveBeenCalled();
            const blobArgs = blobSpy.calls.mostRecent().args;
            expect(blobArgs[1].type).toBe("application/json");
        });
    });

    describe("exportSessionToTcx method", (): void => {
        let blobSpy: jasmine.Spy;
        const testSessionId = 1234567890;

        beforeEach(async (): Promise<void> => {
            blobSpy = spyOn(window, "Blob").and.callThrough();

            // enable real database operations for export tests
            mockTransaction.and.callThrough();
            connectedDevicePutSpy.and.callThrough();
            connectedDeviceWhereSpy.and.callThrough();
            deltaTimesPutSpy.and.callThrough();
            deltaTimesWhereSpy.and.callThrough();
            sessionDataAddSpy.and.callThrough();
            sessionDataWhereSpy.and.callThrough();
            sessionDataOrderBySpy.and.callThrough();
            handleForcesPutSpy.and.callThrough();
            handleForcesWhereSpy.and.callThrough();

            // reset database and add test data
            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.connectedDevice,
                appDB.deltaTimes,
                appDB.handleForces,
                async (): Promise<void> => {
                    await appDB.sessionData.clear();
                    await appDB.connectedDevice.clear();
                    await appDB.deltaTimes.clear();
                    await appDB.handleForces.clear();

                    // add test session data
                    await appDB.sessionData.add({
                        sessionId: testSessionId,
                        timeStamp: 1000000001,
                        avgStrokePower: 150,
                        distance: 1000,
                        distPerStroke: 10,
                        dragFactor: 120,
                        driveDuration: 800,
                        recoveryDuration: 1200,
                        speed: 5.2,
                        strokeCount: 100,
                        strokeRate: 24,
                        heartRate: { heartRate: 150, contactDetected: true, rrIntervals: [800, 850] },
                    });

                    await appDB.handleForces.put({
                        sessionId: testSessionId,
                        timeStamp: 1000000001,
                        strokeId: 100,
                        peakForce: 300,
                        handleForces: [100, 200, 300, 250, 150],
                    });
                },
            );
        });

        describe("in generated XML", (): void => {
            it("should include XML declaration", async (): Promise<void> => {
                await service.exportSessionToTcx(mockSessionId);

                expect(blobSpy).toHaveBeenCalled();
                const blobContents = blobSpy.calls.mostRecent().args[0][0];

                expect(blobContents).toContain('<?xml version="1.0"?>');
            });

            it("should include TrainingCenterDatabase root element", async (): Promise<void> => {
                await service.exportSessionToTcx(mockSessionId);

                expect(blobSpy).toHaveBeenCalled();
                const blobContents = blobSpy.calls.mostRecent().args[0][0];

                expect(blobContents).toContain("<TrainingCenterDatabase");
                expect(blobContents).toContain("</TrainingCenterDatabase>");
            });

            it("should include the Garmin TCX namespace on root element", async (): Promise<void> => {
                await service.exportSessionToTcx(mockSessionId);

                const blobContents = blobSpy.calls.mostRecent().args[0][0];

                expect(blobContents).toContain(
                    'xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"',
                );
            });

            it("should include Activities section", async (): Promise<void> => {
                await service.exportSessionToTcx(mockSessionId);

                const blobContents = blobSpy.calls.mostRecent().args[0][0];

                expect(blobContents).toContain("<Activities");
                expect(blobContents).toContain("</Activities>");
            });

            it("should include Author section", async (): Promise<void> => {
                await service.exportSessionToTcx(mockSessionId);

                const blobContents = blobSpy.calls.mostRecent().args[0][0];

                expect(blobContents).toContain("<Author");
                expect(blobContents).toContain("</Author>");
            });
        });

        it("should create TCX blob with correct download filename", async (): Promise<void> => {
            await service.exportSessionToTcx(mockSessionId);

            expect(blobSpy).toHaveBeenCalled();
            const blobArgs = blobSpy.calls.mostRecent().args;
            expect(blobArgs[0] && blobArgs[0][0]).toContain("<TrainingCenterDatabase");

            expect(anchorElement?.download).toMatch(/\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} - session\.tcx$/);
        });

        it("should create blob with correct MIME type", async (): Promise<void> => {
            await service.exportSessionToTcx(mockSessionId);

            expect(blobSpy).toHaveBeenCalled();
            const blobArgs = blobSpy.calls.mostRecent().args;
            expect(blobArgs[1].type).toBe("application/vnd.garmin.tcx+xml");
        });
    });

    describe("import method", (): void => {
        const mockImportData = {
            formatName: "dexie",
            formatVersion: 1,
            data: {
                databaseName: "ESPRowingMonitorDB",
                databaseVersion: 2,
                tables: [
                    { name: "deltaTimes", schema: "timeStamp,sessionId", rowCount: 1 },
                    { name: "handleForces", schema: "timeStamp,sessionId,[sessionId+strokeId]", rowCount: 1 },
                    { name: "sessionData", schema: "timeStamp,sessionId", rowCount: 2 },
                    { name: "connectedDevice", schema: "sessionId", rowCount: 1 },
                ],
                data: [
                    {
                        tableName: "deltaTimes",
                        inbound: true,
                        rows: [
                            {
                                sessionId: 123456789,
                                timeStamp: 1000000001,
                                deltaTimes: [120, 130, 140],
                                $types: { deltaTimes: "arrayNonindexKeys" },
                            },
                        ],
                    },
                    {
                        tableName: "handleForces",
                        inbound: true,
                        rows: [
                            {
                                sessionId: 123456789,
                                timeStamp: 1000000001,
                                strokeId: 1,
                                peakForce: 300,
                                handleForces: [100, 200, 300, 200, 100],
                                $types: { handleForces: "arrayNonindexKeys" },
                            },
                        ],
                    },
                    {
                        tableName: "sessionData",
                        inbound: true,
                        rows: [
                            {
                                sessionId: 123456789,
                                timeStamp: 1000000001,
                                avgStrokePower: 100,
                                distance: 500,
                                distPerStroke: 5,
                                dragFactor: 110,
                                driveDuration: 700,
                                recoveryDuration: 1100,
                                speed: 4.5,
                                strokeCount: 100,
                                strokeRate: 22,
                                heartRate: { heartRate: 140, contactDetected: true, rrIntervals: [700] },
                                $types: { "heartRate.rrIntervals": "arrayNonindexKeys" },
                            },
                            {
                                sessionId: 123456789,
                                timeStamp: 1000000002,
                                avgStrokePower: 110,
                                distance: 510,
                                distPerStroke: 5.1,
                                dragFactor: 110,
                                driveDuration: 710,
                                recoveryDuration: 1110,
                                speed: 4.6,
                                strokeCount: 101,
                                strokeRate: 23,
                                heartRate: { heartRate: 142, contactDetected: true, rrIntervals: [710] },
                                $types: { "heartRate.rrIntervals": "arrayNonindexKeys" },
                            },
                        ],
                    },
                    {
                        tableName: "connectedDevice",
                        inbound: true,
                        rows: [
                            {
                                sessionId: 123456789,
                                deviceName: "TestDevice",
                            },
                        ],
                    },
                ],
            },
        };

        const mockBlob = new Blob([JSON.stringify(mockImportData)]);

        beforeEach(async (): Promise<void> => {
            // enable real database operations for import tests
            mockTransaction.and.callThrough();
            connectedDevicePutSpy.and.callThrough();
            connectedDeviceWhereSpy.and.callThrough();
            deltaTimesPutSpy.and.callThrough();
            deltaTimesWhereSpy.and.callThrough();
            sessionDataAddSpy.and.callThrough();
            sessionDataWhereSpy.and.callThrough();
            sessionDataOrderBySpy.and.callThrough();
            handleForcesPutSpy.and.callThrough();
            handleForcesWhereSpy.and.callThrough();

            // reset database before each test
            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.connectedDevice,
                appDB.deltaTimes,
                appDB.handleForces,
                async (): Promise<void> => {
                    await appDB.sessionData.clear();
                    await appDB.connectedDevice.clear();
                    await appDB.deltaTimes.clear();
                    await appDB.handleForces.clear();
                },
            );
        });

        it("should import data into the database", async (): Promise<void> => {
            // verify database is empty before import
            expect(await appDB.sessionData.count()).toBe(0);
            expect(await appDB.connectedDevice.count()).toBe(0);

            await service.import(mockBlob);

            // verify data was imported
            expect(await appDB.sessionData.count()).toBe(2);
            expect(await appDB.connectedDevice.count()).toBe(1);

            // verify specific imported data
            const sessionData = await appDB.sessionData.toArray();
            const sortedSessionData = sessionData.sort(
                (a: IMetricsEntity, b: IMetricsEntity): number => a.timeStamp - b.timeStamp,
            );
            expect(sortedSessionData[0].sessionId).toBe(123456789);
            expect(sortedSessionData[0].avgStrokePower).toBe(100);
            expect(sortedSessionData[1].avgStrokePower).toBe(110);

            const deviceData = await appDB.connectedDevice.toArray();
            expect(deviceData[0].sessionId).toBe(123456789);
            expect(deviceData[0].deviceName).toBe("TestDevice");
        });

        it("should call progress callback during import", async (): Promise<void> => {
            const progressCallback = jasmine.createSpy("progressCallback").and.returnValue(true);

            await service.import(mockBlob, progressCallback);

            expect(progressCallback).toHaveBeenCalled();
        });

        it("should import without progress callback when not provided", async (): Promise<void> => {
            await service.import(mockBlob);

            expect(await appDB.sessionData.count()).toBe(2);
        });
    });

    describe("getSessionSummaries$ method", (): void => {
        beforeEach(async (): Promise<void> => {
            // enable real database operations for observable tests
            mockTransaction.and.callThrough();
            connectedDevicePutSpy.and.callThrough();
            connectedDeviceWhereSpy.and.callThrough();
            deltaTimesPutSpy.and.callThrough();
            deltaTimesWhereSpy.and.callThrough();
            sessionDataAddSpy.and.callThrough();
            sessionDataWhereSpy.and.callThrough();
            sessionDataOrderBySpy.and.callThrough();
            handleForcesPutSpy.and.callThrough();
            handleForcesWhereSpy.and.callThrough();

            // reset database before each test
            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.connectedDevice,
                appDB.deltaTimes,
                appDB.handleForces,
                async (): Promise<void> => {
                    await appDB.sessionData.clear();
                    await appDB.connectedDevice.clear();
                    await appDB.deltaTimes.clear();
                    await appDB.handleForces.clear();
                },
            );
        });

        it("should emit empty array when no session data exists", async (): Promise<void> => {
            service
                .getSessionSummaries$()
                .pipe(take(1))
                .subscribe({
                    next: (summaries: Array<ISessionSummary>): void => {
                        expect(summaries).toEqual([]);
                    },
                });

            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.connectedDevice,
                async (): Promise<void> => {
                    await appDB.connectedDevice.put({
                        sessionId: 12121221121,
                        deviceName: "TestDevice2",
                    });
                },
            );

            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.connectedDevice,
                async (): Promise<void> => {
                    await appDB.connectedDevice.put({
                        sessionId: 1212122112,
                        deviceName: "TestDevice3",
                    });
                },
            );
        });

        it("should emit session summaries when data changes in database", async (): Promise<void> => {
            const testSessionId1 = 111111111;
            const testSessionId2 = 222222222;
            const testSessionId3 = 333333333;

            const sessionSummaries$ = service.getSessionSummaries$();

            sessionSummaries$.pipe(take(1)).subscribe({
                next: (summaries: Array<ISessionSummary>): void => {
                    expect(summaries).toBeDefined();
                    expect(Array.isArray(summaries)).toBe(true);
                    expect(summaries).toHaveSize(2);

                    const session1 = summaries.find(
                        (s: ISessionSummary): boolean => s.sessionId === testSessionId1,
                    );
                    const session2 = summaries.find(
                        (s: ISessionSummary): boolean => s.sessionId === testSessionId2,
                    );

                    expect(session1).toBeDefined();
                    expect(session1?.deviceName).toBe("TestDevice1");
                    expect(session1?.distance).toBe(600);
                    expect(session1?.strokeCount).toBe(100);

                    expect(session2).toBeDefined();
                    expect(session2?.deviceName).toBe("TestDevice2");
                    expect(session2?.distance).toBe(800);
                    expect(session2?.strokeCount).toBe(100);
                },
            });

            sessionSummaries$.pipe(skip(1), take(1)).subscribe({
                next: (summaries: Array<ISessionSummary>): void => {
                    expect(summaries).toHaveSize(3);
                    expect(summaries[2].sessionId).toBe(testSessionId3);
                    expect(summaries[2].strokeCount).toBe(102);
                },
            });

            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.connectedDevice,
                async (): Promise<void> => {
                    await appDB.connectedDevice.put({
                        sessionId: testSessionId1,
                        deviceName: "TestDevice1",
                    });

                    await appDB.connectedDevice.put({
                        sessionId: testSessionId2,
                        deviceName: "TestDevice2",
                    });

                    await appDB.sessionData.add({
                        sessionId: testSessionId1,
                        timeStamp: 1000000001,
                        avgStrokePower: 120,
                        distance: 600,
                        distPerStroke: 6,
                        dragFactor: 115,
                        driveDuration: 750,
                        recoveryDuration: 1150,
                        speed: 4.8,
                        strokeCount: 100,
                        strokeRate: 25,
                        heartRate: { heartRate: 145, contactDetected: true, rrIntervals: [750] },
                    });

                    await appDB.sessionData.add({
                        sessionId: testSessionId2,
                        timeStamp: 1000000002,
                        avgStrokePower: 140,
                        distance: 800,
                        distPerStroke: 8,
                        dragFactor: 125,
                        driveDuration: 850,
                        recoveryDuration: 1250,
                        speed: 5.2,
                        strokeCount: 100,
                        strokeRate: 28,
                        heartRate: { heartRate: 155, contactDetected: true, rrIntervals: [650] },
                    });
                },
            );

            await appDB.transaction(
                "rw",
                appDB.sessionData,
                appDB.connectedDevice,
                async (): Promise<void> => {
                    // add more session data for the same session
                    await appDB.sessionData.add({
                        sessionId: testSessionId3,
                        timeStamp: 10000001000,
                        avgStrokePower: 120,
                        distance: 510,
                        distPerStroke: 5.1,
                        dragFactor: 110,
                        driveDuration: 710,
                        recoveryDuration: 1110,
                        speed: 4.6,
                        strokeCount: 102,
                        strokeRate: 24,
                        heartRate: { heartRate: 142, contactDetected: true, rrIntervals: [680] },
                    });
                },
            );
        });
    });
});
