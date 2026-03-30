import { beforeEach, describe, expect, it } from "vitest";

import { IExportHandleForces, IExportRecord } from "../database.interfaces";

import { computeForceStats, computeMeanForce, computeStats, getSportConfig } from "./fit-file.utils";

describe("getSportConfig function", (): void => {
    describe("when device is a kayak", (): void => {
        it("should return kayaking config for KayakFirst device", (): void => {
            const config = getSportConfig("KayakFirst");

            expect(config.sport).toBe("kayaking");
            expect(config.subSport).toBe("generic");
            expect(config.name).toBe("Indoor Kayaking");
            expect(config.sportProfileName).toBe("Kayak Indoor");
        });

        it("should match case-insensitively", (): void => {
            expect(getSportConfig("KAYAKFIRST").sport).toBe("kayaking");
            expect(getSportConfig("olddanube").sport).toBe("kayaking");
            expect(getSportConfig("OLDDANUBE").sport).toBe("kayaking");
        });

        it("should match partial device name containing kayak", (): void => {
            expect(getSportConfig("MyKayakDevice").sport).toBe("kayaking");
        });
    });

    describe("when device is a rower", (): void => {
        it("should return rowing config for non-kayak devices", (): void => {
            const config = getSportConfig("Generic Rower");

            expect(config.sport).toBe("rowing");
            expect(config.subSport).toBe("indoorRowing");
            expect(config.name).toBe("Indoor Rowing");
            expect(config.sportProfileName).toBe("Row Indoor");
        });

        it("should default to rowing when deviceName is undefined", (): void => {
            expect(getSportConfig(undefined).sport).toBe("rowing");
        });

        it("should default to rowing when deviceName is empty string", (): void => {
            expect(getSportConfig("").sport).toBe("rowing");
        });
    });
});

describe("computeMeanForce function", (): void => {
    it("should compute mean of a single-element array", (): void => {
        expect(computeMeanForce([100])).toBe(100);
    });

    it("should compute mean of multiple forces", (): void => {
        expect(computeMeanForce([100, 200, 300])).toBe(200);
    });

    it("should return 0 for an empty array", (): void => {
        expect(computeMeanForce([])).toBe(0);
    });

    it("should handle non-integer forces", (): void => {
        expect(computeMeanForce([10.5, 20.5])).toBe(15.5);
    });
});

describe("computeForceStats function", (): void => {
    it("should return undefined for an empty handleForces object", (): void => {
        expect(computeForceStats({})).toBeUndefined();
    });

    it("should return undefined when all entries have empty force arrays", (): void => {
        const handleForces: Record<number, IExportHandleForces> = {
            1: { handleForces: [], peakForce: 0, peakForcePositionNorm: 0, driveLength: 1.0 },
            2: { handleForces: [], peakForce: 0, peakForcePositionNorm: 0, driveLength: 1.0 },
        };

        expect(computeForceStats(handleForces)).toBeUndefined();
    });

    it("should compute avg and max for a single entry", (): void => {
        const handleForces: Record<number, IExportHandleForces> = {
            1: { handleForces: [100, 200], peakForce: 200, peakForcePositionNorm: 60, driveLength: 1.2 },
        };

        const result = computeForceStats(handleForces);

        expect(result).toEqual({ avg: 150, max: 150 });
    });

    it("should compute avg and max across multiple entries", (): void => {
        const handleForces: Record<number, IExportHandleForces> = {
            1: { handleForces: [100, 200], peakForce: 200, peakForcePositionNorm: 60, driveLength: 1.2 },
            2: { handleForces: [150, 250], peakForce: 250, peakForcePositionNorm: 55, driveLength: 1.3 },
            3: { handleForces: [200, 300], peakForce: 300, peakForcePositionNorm: 50, driveLength: 1.4 },
        };

        const result = computeForceStats(handleForces);

        expect(result).toEqual({ avg: 200, max: 250 });
    });

    it("should skip entries with empty force arrays", (): void => {
        const handleForces: Record<number, IExportHandleForces> = {
            1: { handleForces: [100, 200], peakForce: 200, peakForcePositionNorm: 60, driveLength: 1.2 },
            2: { handleForces: [], peakForce: 0, peakForcePositionNorm: 0, driveLength: 0 },
            3: { handleForces: [200, 300], peakForce: 300, peakForcePositionNorm: 50, driveLength: 1.4 },
        };

        const result = computeForceStats(handleForces);

        expect(result).toEqual({ avg: 200, max: 250 });
    });
});

describe("computeStats function", (): void => {
    const baseTime = new Date("2026-01-15T10:00:01Z");

    const createRecord = (overrides: Partial<IExportRecord> = {}): IExportRecord => {
        return {
            timeStamp: new Date(baseTime.getTime()),
            elapsedTime: 1,
            distance: 200,
            speed: 2.0,
            strokeRate: 24,
            strokeCount: 1,
            avgStrokePower: 150,
            distPerStroke: 8.0,
            driveDuration: 0.8,
            recoveryDuration: 1.7,
            dragFactor: 110,
            totalWork: 375,
            ...overrides,
        };
    };

    let records: Array<IExportRecord>;
    let emptyForces: Record<number, IExportHandleForces>;

    beforeEach((): void => {
        records = [
            createRecord(),
            createRecord({
                timeStamp: new Date(baseTime.getTime() + 1000),
                elapsedTime: 2,
                distance: 450,
                speed: 2.5,
                strokeRate: 26,
                strokeCount: 2,
                avgStrokePower: 160,
                distPerStroke: 8.5,
                dragFactor: 112,
                totalWork: 743,
            }),
        ];
        emptyForces = {};
    });

    describe("as part of cadence stats", (): void => {
        it("should compute average and max cadence", (): void => {
            const stats = computeStats(records, emptyForces);

            expect(stats.avgCadence).toBe(25);
            expect(stats.maxCadence).toBe(26);
        });

        it("should return 0 cadence when all strokeRates are 0", (): void => {
            records = records.map((record: IExportRecord): IExportRecord => ({ ...record, strokeRate: 0 }));
            const stats = computeStats(records, emptyForces);

            expect(stats.avgCadence).toBe(0);
            expect(stats.maxCadence).toBe(0);
        });
    });

    describe("as part of power stats", (): void => {
        it("should compute average and max power", (): void => {
            const stats = computeStats(records, emptyForces);

            expect(stats.avgPower).toBe(155);
            expect(stats.maxPower).toBe(160);
        });

        it("should return 0 power when all avgStrokePower are 0", (): void => {
            records = records.map(
                (record: IExportRecord): IExportRecord => ({ ...record, avgStrokePower: 0 }),
            );
            const stats = computeStats(records, emptyForces);

            expect(stats.avgPower).toBe(0);
            expect(stats.maxPower).toBe(0);
        });
    });

    describe("as part of heart rate stats", (): void => {
        it("should return undefined when no heart rate data exists", (): void => {
            records = records.map(
                (record: IExportRecord): IExportRecord => ({ ...record, heartRate: undefined }),
            );
            const stats = computeStats(records, emptyForces);

            expect(stats.heartRate).toBeUndefined();
        });

        it("should compute paired avg and max heart rate", (): void => {
            records = [
                createRecord({ heartRate: { heartRate: 120, contactDetected: true } }),
                createRecord({ heartRate: { heartRate: 140, contactDetected: true } }),
            ];
            const stats = computeStats(records, emptyForces);

            expect(stats.heartRate).toEqual({ avg: 130, max: 140 });
        });
    });

    describe("as part of force stats", (): void => {
        it("should return undefined force when handleForces is empty", (): void => {
            const stats = computeStats(records, {});

            expect(stats.force).toBeUndefined();
        });

        it("should compute paired avg and max force from handleForces", (): void => {
            const handleForces: Record<number, IExportHandleForces> = {
                1: { handleForces: [100, 200], peakForce: 200, peakForcePositionNorm: 60, driveLength: 1.2 },
                2: { handleForces: [200, 300], peakForce: 300, peakForcePositionNorm: 50, driveLength: 1.4 },
            };
            const stats = computeStats(records, handleForces);

            expect(stats.force).toEqual({ avg: 200, max: 250 });
        });
    });

    describe("as part of derived totals", (): void => {
        it("should derive totalDistance from last record in meters", (): void => {
            const stats = computeStats(records, emptyForces);

            expect(stats.totalDistance).toBe(4.5);
        });

        it("should derive totalCycles from last record strokeCount", (): void => {
            const stats = computeStats(records, emptyForces);

            expect(stats.totalCycles).toBe(2);
        });

        it("should derive totalWork from last record rounded", (): void => {
            const stats = computeStats(records, emptyForces);

            expect(stats.totalWork).toBe(743);
        });
    });
});
