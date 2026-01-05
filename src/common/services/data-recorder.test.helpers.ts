import { appDB } from "../utils/app-database";

export const mockImportData = {
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

const testSessionId = 1700000000000;

export const setupExportSessionToCsvData = async (): Promise<void> => {
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
        } as Parameters<typeof appDB.sessionData.add>[0]);
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 1000,
            strokeId: 50,
            peakForce: 350,
            handleForces: [100.5, 200.25, 300.75],
        });
    });
};

export const setupSpeedCalculationThreeStrokes = async (): Promise<void> => {
    await appDB.sessionData.clear();
    await appDB.handleForces.clear();

    await appDB.transaction("rw", appDB.sessionData, appDB.handleForces, (): void => {
        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId + 2500,
            avgStrokePower: 200,
            distance: 500,
            distPerStroke: 5,
            dragFactor: 110,
            driveDuration: 0.8,
            recoveryDuration: 1.7,
            speed: 2.0,
            strokeCount: 1,
            strokeRate: 24,
            heartRate: { heartRate: 140, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 2500,
            strokeId: 1,
            peakForce: 350,
            handleForces: [100, 200, 300],
        });

        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId + 4500,
            avgStrokePower: 220,
            distance: 1100,
            distPerStroke: 6,
            dragFactor: 110,
            driveDuration: 0.7,
            recoveryDuration: 1.3,
            speed: 3.0,
            strokeCount: 2,
            strokeRate: 30,
            heartRate: { heartRate: 145, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 4500,
            strokeId: 2,
            peakForce: 380,
            handleForces: [120, 220, 320],
        });
        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId + 7300,
            avgStrokePower: 210,
            distance: 1800,
            distPerStroke: 7,
            dragFactor: 110,
            driveDuration: 0.9,
            recoveryDuration: 1.9,
            speed: 2.5,
            strokeCount: 3,
            strokeRate: 25,
            heartRate: { heartRate: 150, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 7300,
            strokeId: 3,
            peakForce: 360,
            handleForces: [110, 210, 310],
        });
    });
};

export const setupSpeedCalculationFilterDuplicates = async (): Promise<void> => {
    await appDB.transaction("rw", appDB.sessionData, appDB.handleForces, (): void => {
        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId + 8300,
            avgStrokePower: 220,
            distance: 1900,
            distPerStroke: 7,
            dragFactor: 110,
            driveDuration: 0.7,
            recoveryDuration: 1.3,
            speed: 1.0,
            strokeCount: 3,
            strokeRate: 30,
            heartRate: { heartRate: 145, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 8300,
            strokeId: 3,
            peakForce: 360,
            handleForces: [110, 210, 310],
        });

        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId + 9300,
            avgStrokePower: 220,
            distance: 2000,
            distPerStroke: 7,
            dragFactor: 110,
            driveDuration: 0.7,
            recoveryDuration: 1.3,
            speed: 1.2,
            strokeCount: 3,
            strokeRate: 30,
            heartRate: { heartRate: 148, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 9300,
            strokeId: 3,
            peakForce: 360,
            handleForces: [110, 210, 310],
        });

        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId + 10300,
            avgStrokePower: 200,
            distance: 2400,
            distPerStroke: 6,
            dragFactor: 110,
            driveDuration: 0.6,
            recoveryDuration: 1.3,
            speed: 3,
            strokeCount: 4,
            strokeRate: 30,
            heartRate: { heartRate: 148, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 10300,
            strokeId: 4,
            peakForce: 360,
            handleForces: [110, 210, 310],
        });
    });
};

export const setupSpeedCalculationFirstStrokeStartTime = async (): Promise<void> => {
    await appDB.sessionData.clear();
    await appDB.handleForces.clear();

    await appDB.transaction("rw", appDB.sessionData, appDB.handleForces, (): void => {
        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId,
            avgStrokePower: 0,
            distance: 0,
            distPerStroke: 0,
            dragFactor: 110,
            driveDuration: 0.8,
            recoveryDuration: 1.7,
            speed: 0,
            strokeCount: 1,
            strokeRate: 24,
            heartRate: { heartRate: 140, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId,
            strokeId: 1,
            peakForce: 350,
            handleForces: [100, 200, 300],
        });

        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId + 2500,
            avgStrokePower: 0,
            distance: 0,
            distPerStroke: 0,
            dragFactor: 110,
            driveDuration: 0.7,
            recoveryDuration: 1.3,
            speed: 0,
            strokeCount: 2,
            strokeRate: 30,
            heartRate: { heartRate: 145, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 2500,
            strokeId: 2,
            peakForce: 380,
            handleForces: [120, 220, 320],
        });

        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId + 4300,
            avgStrokePower: 210,
            distance: 1146,
            distPerStroke: 11.46,
            dragFactor: 110,
            driveDuration: 0.9,
            recoveryDuration: 1.9,
            speed: 2.5,
            strokeCount: 3,
            strokeRate: 25,
            heartRate: { heartRate: 150, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 4300,
            strokeId: 3,
            peakForce: 360,
            handleForces: [110, 210, 310],
        });
    });
};

export const setupSpeedCalculationZeroTimeDelta = async (): Promise<void> => {
    await appDB.sessionData.clear();
    await appDB.handleForces.clear();

    await appDB.transaction("rw", appDB.sessionData, appDB.handleForces, (): void => {
        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId,
            avgStrokePower: 200,
            distance: 500,
            distPerStroke: 5,
            dragFactor: 110,
            driveDuration: 0,
            recoveryDuration: 0,
            speed: 2.0,
            strokeCount: 1,
            strokeRate: 24,
            heartRate: { heartRate: 140, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId,
            strokeId: 1,
            peakForce: 350,
            handleForces: [100, 200, 300],
        });
    });
};

export const setupSpeedCalculationZeroDistance = async (): Promise<void> => {
    await appDB.sessionData.clear();
    await appDB.handleForces.clear();

    await appDB.transaction("rw", appDB.sessionData, appDB.handleForces, (): void => {
        appDB.sessionData.add({
            sessionId: testSessionId,
            timeStamp: testSessionId + 2000,
            avgStrokePower: 0,
            distance: 0,
            distPerStroke: 0,
            dragFactor: 110,
            driveDuration: 0.8,
            recoveryDuration: 1.2,
            speed: 0,
            strokeCount: 1,
            strokeRate: 0,
            heartRate: { heartRate: 140, contactDetected: true },
        });
        appDB.handleForces.put({
            sessionId: testSessionId,
            timeStamp: testSessionId + 2000,
            strokeId: 1,
            peakForce: 0,
            handleForces: [0, 0, 0],
        });
    });
};
