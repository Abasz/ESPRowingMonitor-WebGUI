import { Decoder, FitMessages, Stream } from "@garmin/fitsdk";
import { expect } from "vitest";

import { IExportSession } from "../../database.interfaces";

// sdk types every message array as optional; specs assert presence explicitly, so optionality is dropped here rather than at each access site
export type DecodedMessages = { [Key in keyof FitMessages]-?: FitMessages[Key] };

export function decodeValidMessages(fitData: ArrayBufferLike): DecodedMessages {
    const stream = Stream.fromArrayBuffer(fitData as ArrayBuffer);
    const decoder = new Decoder(stream);
    const result: ReturnType<Decoder["read"]> = decoder.read({ includeUnknownData: true });
    expect(result.errors).toHaveLength(0);

    return result.messages as DecodedMessages;
}

// fields absent from the sdk profile surface under their numeric field id when includeUnknownData is set, so they are unreachable through the typed message
export const rawFields = (mesg: object): Record<string, unknown> => mesg as Record<string, unknown>;

export function createTestSession(overrides?: Partial<IExportSession>): IExportSession {
    const sessionId = new Date("2026-01-15T10:00:00Z").getTime();
    const baseTime = new Date("2026-01-15T10:00:01Z");

    return {
        sessionId,
        deviceName: "Test Rower",
        records: [
            {
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
                heartRate: {
                    heartRate: 120,
                    contactDetected: true,
                    rrIntervals: [500, 510],
                },
            },
            {
                timeStamp: new Date(baseTime.getTime() + 1000),
                elapsedTime: 2,
                distance: 450,
                speed: 2.5,
                strokeRate: 26,
                strokeCount: 2,
                avgStrokePower: 160,
                distPerStroke: 8.5,
                driveDuration: 0.75,
                recoveryDuration: 1.55,
                dragFactor: 112,
                totalWork: 743,
                heartRate: {
                    heartRate: 130,
                    contactDetected: true,
                    rrIntervals: [480],
                },
            },
            {
                timeStamp: new Date(baseTime.getTime() + 2000),
                elapsedTime: 3,
                distance: 750,
                speed: 3.0,
                strokeRate: 28,
                strokeCount: 3,
                avgStrokePower: 170,
                distPerStroke: 9.0,
                driveDuration: 0.7,
                recoveryDuration: 1.4,
                dragFactor: 115,
                totalWork: 1100,
                heartRate: {
                    heartRate: 140,
                    contactDetected: true,
                },
            },
        ],
        handleForces: {
            1: { handleForces: [100, 200], peakForce: 200, peakForcePositionNorm: 60, driveLength: 1.2 },
            2: { handleForces: [150, 250], peakForce: 250, peakForcePositionNorm: 55, driveLength: 1.3 },
            3: { handleForces: [200, 300], peakForce: 300, peakForcePositionNorm: 50, driveLength: 1.4 },
        },
        laps: [],
        ...overrides,
    };
}
