import { FitDevInfo, FitWriter } from "@markw65/fit-file-writer";

import { IExportHandleForces, IExportRecord, IExportSession } from "../../database.interfaces";

import {
    APPLICATION_UUID,
    buildLapSegments,
    computeMaxCurvePointCount,
    computeMeanForce,
    computeStats,
    DEVELOPER_FIELD_DEFS,
    DevFieldId,
    FitEventType,
    getSegmentStartDistance,
    getSportConfig,
    LapSegment,
    SessionStats,
    SPLIT_USER_MESSAGES,
    SplitType,
    SportConfig,
} from "./fit-file.utils";

export class FitFileBuilder {
    private readonly fitWriter: FitWriter = new FitWriter();
    private readonly records: Array<IExportRecord>;
    private readonly startDateTime: number;
    private readonly endDateTime: number;
    private readonly endTime: Date;
    private readonly wallClockTotal: number;
    private readonly elapsedTimeTotal: number;
    private readonly stats: SessionStats;
    private readonly sportConfig: SportConfig;
    private readonly maxCurvePointCount: number;
    private readonly segments: Array<LapSegment>;
    private readonly segmentStats: Array<SessionStats>;

    constructor(private readonly exportSession: IExportSession) {
        const { records }: { records: Array<IExportRecord> } = exportSession;
        if (records.length === 0) {
            throw new Error("Cannot create FIT file from empty session");
        }
        this.records = records;

        const startTime = new Date(exportSession.sessionId);
        const zeroRecord: IExportRecord = {
            timeStamp: startTime,
            distance: 0,
            strokeCount: 0,
            avgStrokePower: 0,
            driveDuration: 0,
            recoveryDuration: 0,
            dragFactor: 0,
            speed: 0,
            strokeRate: 0,
            distPerStroke: 0,
            totalWork: 0,
            elapsedTime: 0,
        };
        const recordsWithZero = [zeroRecord, ...records];

        this.endTime = records[records.length - 1].timeStamp;
        this.startDateTime = this.fitWriter.time(startTime);
        this.endDateTime = this.fitWriter.time(this.endTime);
        this.wallClockTotal = (this.endTime.getTime() - startTime.getTime()) / 1000;
        this.elapsedTimeTotal = records[records.length - 1].elapsedTime;
        this.stats = computeStats(recordsWithZero, exportSession.handleForces);
        this.sportConfig = getSportConfig(exportSession.deviceName);
        this.maxCurvePointCount = computeMaxCurvePointCount(exportSession.handleForces);
        this.segments = buildLapSegments(
            recordsWithZero,
            exportSession.laps,
            startTime.getTime(),
            exportSession.handleForces,
        );
        this.segmentStats = this.segments.map((segment: LapSegment): SessionStats => {
            const records = segment.isPause ? segment.records.slice(1, -1) : segment.records;

            return computeStats(records, segment.handleForces);
        });
    }

    build(): ArrayBufferLike {
        this.writeFileHeader();
        this.writeDeveloperFieldDescriptions();
        this.writeRecords();
        this.writeHRMessages();
        this.writeEvents();
        this.writeLaps();
        this.writeSplitSummaries();
        this.writeSplits();
        this.writeSession();
        this.writeActivity();

        const data = this.fitWriter.finish();

        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }

    private writeFileHeader(): void {
        this.fitWriter.writeMessage("file_id", {
            type: "activity",
            manufacturer: "development",
            product: 0,
            time_created: this.startDateTime,
            serial_number: 123456,
        });

        this.fitWriter.writeMessage("file_creator", {
            software_version: 720,
        });

        this.fitWriter.writeMessage("device_info", {
            device_index: 0,
            manufacturer: "development",
            product: 0,
            product_name: this.exportSession.deviceName ?? "ESP Rowing Monitor",
            timestamp: this.startDateTime,
        });

        this.fitWriter.writeMessage("sport", {
            sport: this.sportConfig.sport,
            sub_sport: this.sportConfig.subSport,
            name: this.sportConfig.name,
        });

        this.fitWriter.writeMessage("event", {
            event: "timer",
            event_type: "start",
            event_group: 0,
            timestamp: this.startDateTime,
        });
    }

    private writeRecords(): void {
        for (const record of this.records) {
            const currentHandleForces = this.exportSession.handleForces[record.strokeCount];
            const dragFactor = Math.round(record.dragFactor);

            this.fitWriter.writeMessage(
                "record",
                {
                    timestamp: this.fitWriter.time(record.timeStamp),
                    distance: record.distance / 100,
                    enhanced_speed: record.speed,
                    cadence: Math.round(record.strokeRate),
                    power: Math.round(record.avgStrokePower),
                    total_cycles: record.strokeCount,
                    cycle_length16: record.distPerStroke,
                    accumulated_power: Math.round(record.totalWork),
                    activity_type: "fitnessEquipment",
                    ...(record.heartRate !== undefined && { heart_rate: record.heartRate.heartRate }),
                    ...(currentHandleForces !== undefined && {
                        force: Math.round(computeMeanForce(currentHandleForces.handleForces)),
                    }),
                    ...(dragFactor > 0 && dragFactor < 255 && { resistance: dragFactor }),
                },
                this.buildRecordDevFields(record, currentHandleForces),
            );
        }
    }

    private writeDeveloperFieldDescriptions(): void {
        this.fitWriter.writeMessage("developer_data_id", {
            application_id: APPLICATION_UUID,
            developer_data_index: 0,
            application_version: 720,
        });

        for (const field of DEVELOPER_FIELD_DEFS) {
            if (field.isCurveField && this.maxCurvePointCount === 0) {
                continue;
            }

            this.fitWriter.writeMessage("field_description", {
                developer_data_index: 0,
                field_definition_number: field.fieldDefinitionNumber,
                fit_base_type_id: field.fitBaseTypeId,
                field_name: field.fieldName,
                scale: field.scale,
                units: field.units,
                ...(field.fieldDefinitionNumber === DevFieldId.HandleForceCurve && {
                    array: this.maxCurvePointCount,
                }),
            });
        }
    }

    private writeHRMessages(): void {
        const hrRecords = this.records.filter(
            (record: IExportRecord): boolean => record.heartRate !== undefined,
        );

        if (hrRecords.length === 0) {
            return;
        }

        const firstHRTime = hrRecords[0].timeStamp.getTime();

        for (const record of hrRecords) {
            const elapsedSeconds = (record.timeStamp.getTime() - firstHRTime) / 1000;

            this.fitWriter.writeMessage("hr", {
                timestamp: this.fitWriter.time(record.timeStamp),
                event_timestamp: [Math.round(elapsedSeconds * 1024)],
                filtered_bpm: [record.heartRate!.heartRate],
            });

            if (record.heartRate?.rrIntervals !== undefined && record.heartRate.rrIntervals.length > 0) {
                this.fitWriter.writeMessage("hrv", {
                    time: record.heartRate.rrIntervals,
                });
            }
        }
    }

    private buildRecordDevFields(
        record: IExportRecord,
        handleForces: IExportHandleForces | undefined,
    ): Array<FitDevInfo> {
        const baseFields: Array<FitDevInfo> = [
            ...(record.driveDuration > 0
                ? [{ field_num: DevFieldId.StrokeDriveTime, value: record.driveDuration * 1000 }]
                : []),
            ...(record.recoveryDuration > 0
                ? [{ field_num: DevFieldId.StrokeRecoveryTime, value: record.recoveryDuration * 1000 }]
                : []),
            { field_num: DevFieldId.DragFactor, value: record.dragFactor },
        ];

        if (handleForces === undefined) {
            return baseFields;
        }

        const avgForceField: Array<FitDevInfo> = [
            {
                field_num: DevFieldId.AverageDriveForceN,
                value: Math.round(computeMeanForce(handleForces.handleForces) * 10),
            },
        ];

        const peakForceFields: Array<FitDevInfo> = [
            { field_num: DevFieldId.PeakDriveForceN, value: Math.round(handleForces.peakForce * 10) },
            {
                field_num: DevFieldId.PeakForcePositionNorm,
                value: Math.round(handleForces.peakForcePositionNorm * 100),
            },
        ];

        return [
            ...baseFields,
            { field_num: DevFieldId.DriveLength, value: Math.round(handleForces.driveLength * 100) },
            ...avgForceField,
            ...peakForceFields,
            ...this.buildCurveFields(handleForces),
        ];
    }

    private buildCurveFields(handleForces: IExportHandleForces): Array<FitDevInfo> {
        const pointCount = Math.min(handleForces.handleForces.length, 127);

        if (pointCount === 0 || this.maxCurvePointCount === 0) {
            return [];
        }

        const paddedCurve = handleForces.handleForces
            .slice(0, pointCount)
            .map((force: number): number => Math.round(force * 10))
            .concat(new Array<number>(this.maxCurvePointCount - pointCount).fill(0));

        return [
            { field_num: DevFieldId.HandleForceCurve, value: paddedCurve },
            { field_num: DevFieldId.InstrokeAbscissaType, value: 2 },
            {
                field_num: DevFieldId.InstrokeSampleInterval,
                value: Math.round((handleForces.driveLength / handleForces.handleForces.length) * 10000),
            },
            { field_num: DevFieldId.InstrokePointCount, value: pointCount },
        ];
    }

    private writeEvents(): void {
        const pauseSegments = this.segments.filter((segment: LapSegment): boolean => segment.isPause);
        const lastSegment = this.segments[this.segments.length - 1];

        const writeTimerEvent = (eventType: FitEventType, timestamp: number): void => {
            this.fitWriter.writeMessage("event", {
                event: "timer",
                event_type: eventType,
                event_group: 0,
                timestamp,
            });
        };

        for (const segment of pauseSegments) {
            writeTimerEvent("stop", this.fitWriter.time(segment.startTimeMs));

            if (segment !== lastSegment) {
                writeTimerEvent("start", this.fitWriter.time(segment.endTimeMs));
            }
        }

        writeTimerEvent("stopAll", this.fitWriter.time(this.endTime));
    }

    private writeLaps(): void {
        for (const [lapIndex, segment] of this.segments.entries()) {
            const isLast = lapIndex === this.segments.length - 1;
            const stats = this.segmentStats[lapIndex];
            const elapsedTime = (segment.endTimeMs - segment.startTimeMs) / 1000;
            const startTimestamp = this.fitWriter.time(new Date(segment.startTimeMs));

            this.fitWriter.writeMessage(
                "lap",
                {
                    message_index: { value: lapIndex },
                    timestamp: this.startDateTime,
                    start_time: startTimestamp,
                    event: isLast ? "session" : "lap",
                    event_type: "stop",
                    intensity: segment.isPause ? "rest" : "active",
                    lap_trigger: isLast ? "sessionEnd" : segment.lapTrigger,
                    sport: this.sportConfig.sport,
                    sub_sport: this.sportConfig.subSport,
                    total_elapsed_time: elapsedTime,
                    total_timer_time: elapsedTime,
                    total_moving_time: stats.totalElapsedTime,
                    total_distance: stats.totalDistance,
                    avg_cadence: stats.avgCadence,
                    max_cadence: stats.maxCadence,
                    avg_power: stats.avgPower,
                    max_power: stats.maxPower,
                    enhanced_avg_speed: stats.avgSpeed,
                    enhanced_max_speed: stats.maxSpeed,
                    total_cycles: stats.totalCycles,
                    avg_stroke_distance: stats.avgStrokeDistance,
                    total_work: stats.totalWork,
                    ...(stats.heartRate !== undefined && {
                        avg_heart_rate: stats.heartRate.avg,
                        max_heart_rate: stats.heartRate.max,
                    }),
                    ...(stats.force !== undefined && {
                        avg_force: stats.force.avg,
                        max_force: stats.force.max,
                    }),
                },
                stats.avgDragFactor > 0
                    ? [{ field_num: DevFieldId.DragFactor, value: stats.avgDragFactor }]
                    : [],
            );
        }
    }

    private writeSplitSummaries(): void {
        const indexesBySplitType = new Map<SplitType, Array<number>>();
        for (const [index, segment] of this.segments.entries()) {
            const splitType: SplitType = segment.isPause ? "interval_rest" : "interval_active";
            const indices = indexesBySplitType.get(splitType) ?? [];
            indices.push(index);
            indexesBySplitType.set(splitType, indices);
        }

        for (const [messageIndex, [splitType, segmentIndices]] of [...indexesBySplitType].entries()) {
            const totalTimerTime = segmentIndices.reduce((sum: number, segmentIndex: number): number => {
                const segment = this.segments[segmentIndex];

                return sum + (segment.endTimeMs - segment.startTimeMs) / 1000;
            }, 0);
            const totalDistance = segmentIndices.reduce(
                (sum: number, segmentIndex: number): number =>
                    sum + this.segmentStats[segmentIndex].totalDistance,
                0,
            );

            const heartRate = segmentIndices.reduce(
                (
                    acc: { sum: number; max: number; count: number },
                    segmentIndex: number,
                ): { sum: number; max: number; count: number } => {
                    const stats = this.segmentStats[segmentIndex];
                    if (stats.heartRate !== undefined) {
                        return {
                            sum: acc.sum + stats.heartRate.avg,
                            max: Math.max(acc.max, stats.heartRate.max),
                            count: acc.count + 1,
                        };
                    }

                    return acc;
                },
                { sum: 0, max: 0, count: 0 },
            );

            const cadence = segmentIndices.reduce(
                (
                    acc: { sum: number; max: number; count: number },
                    segmentIndex: number,
                ): { sum: number; max: number; count: number } => {
                    const stats = this.segmentStats[segmentIndex];
                    if (stats.avgCadence > 0) {
                        return {
                            sum: acc.sum + stats.avgCadence,
                            max: Math.max(acc.max, stats.maxCadence),
                            count: acc.count + 1,
                        };
                    }

                    return acc;
                },
                { sum: 0, max: 0, count: 0 },
            );

            this.fitWriter.writeCustomMessage(
                SPLIT_USER_MESSAGES,
                "split_summary",
                {
                    timestamp: this.startDateTime,
                    message_index: { value: messageIndex },
                    split_type: splitType,
                    num_splits: segmentIndices.length,
                    total_timer_time: totalTimerTime,
                    total_distance: totalDistance,
                    avg_speed: totalTimerTime > 0 ? totalDistance / totalTimerTime : 0,
                    max_speed: Math.max(
                        ...segmentIndices.map(
                            (segmentIndex: number): number => this.segmentStats[segmentIndex].maxSpeed,
                        ),
                        0,
                    ),
                    ...(heartRate.count > 0 && {
                        avg_heart_rate: Math.round(heartRate.sum / heartRate.count),
                        max_heart_rate: heartRate.max,
                    }),
                    ...(cadence.count > 0 && {
                        avg_cadence: Math.round(cadence.sum / cadence.count),
                        max_cadence: cadence.max,
                    }),
                },
                [],
            );
        }
    }

    private writeSplits(): void {
        for (const [lapIndex, segment] of this.segments.entries()) {
            const segmentStats = this.segmentStats[lapIndex];
            const elapsedTime = (segment.endTimeMs - segment.startTimeMs) / 1000;
            const startTimestamp = this.fitWriter.time(new Date(segment.startTimeMs));
            const endTimestamp = this.fitWriter.time(new Date(segment.endTimeMs));

            this.fitWriter.writeCustomMessage(
                SPLIT_USER_MESSAGES,
                "split",
                {
                    timestamp: this.startDateTime,
                    message_index: { value: lapIndex },
                    lap_index: lapIndex,
                    sport: this.sportConfig.sport,
                    sub_sport: this.sportConfig.subSport,
                    split_type: segment.isPause ? "interval_rest" : "interval_active",
                    total_elapsed_time: elapsedTime,
                    total_timer_time: elapsedTime,
                    total_moving_time: segmentStats.totalElapsedTime,
                    total_distance: segmentStats.totalDistance,
                    avg_speed: segmentStats.avgSpeed,
                    max_speed: segmentStats.maxSpeed,
                    avg_power: segmentStats.avgPower,
                    max_power: segmentStats.maxPower,
                    start_time: startTimestamp,
                    start_distance: getSegmentStartDistance(segment),
                    end_time: endTimestamp,
                    ...(segmentStats.heartRate !== undefined && {
                        avg_heart_rate: segmentStats.heartRate.avg,
                        max_heart_rate: segmentStats.heartRate.max,
                    }),
                    ...(segmentStats.avgCadence > 0 && {
                        avg_cadence: segmentStats.avgCadence,
                        max_cadence: segmentStats.maxCadence,
                    }),
                },
                segmentStats.avgDragFactor > 0
                    ? [{ field_num: DevFieldId.DragFactor, value: segmentStats.avgDragFactor }]
                    : [],
            );
        }
    }

    private writeSession(): void {
        this.fitWriter.writeMessage(
            "session",
            {
                message_index: { value: 0 },
                timestamp: this.startDateTime,
                start_time: this.startDateTime,
                first_lap_index: 0,
                num_laps: this.segments.length,
                event: "session",
                event_type: "stop",
                trigger: "activityEnd",
                sport_profile_name: this.sportConfig.sportProfileName,
                sport: this.sportConfig.sport,
                sub_sport: this.sportConfig.subSport,
                total_elapsed_time: this.wallClockTotal,
                total_timer_time: this.wallClockTotal,
                total_moving_time: this.elapsedTimeTotal,
                total_distance: this.stats.totalDistance,
                avg_cadence: this.stats.avgCadence,
                max_cadence: this.stats.maxCadence,
                avg_power: this.stats.avgPower,
                max_power: this.stats.maxPower,
                enhanced_avg_speed: this.stats.avgSpeed,
                enhanced_max_speed: this.stats.maxSpeed,
                total_cycles: this.stats.totalCycles,
                avg_stroke_distance: this.stats.avgStrokeDistance,
                total_work: this.stats.totalWork,
                ...(this.stats.heartRate !== undefined && {
                    avg_heart_rate: this.stats.heartRate.avg,
                    max_heart_rate: this.stats.heartRate.max,
                }),
                ...(this.stats.force !== undefined && {
                    avg_force: this.stats.force.avg,
                    max_force: this.stats.force.max,
                }),
            },
            this.stats.avgDragFactor > 0
                ? [{ field_num: DevFieldId.DragFactor, value: this.stats.avgDragFactor }]
                : [],
        );
    }

    private writeActivity(): void {
        this.fitWriter.writeMessage("activity", {
            timestamp: this.endDateTime,
            num_sessions: 1,
            type: "manual",
            total_timer_time: this.wallClockTotal,
            local_timestamp: this.endDateTime + this.endTime.getTimezoneOffset() * -60,
            event: "activity",
            event_type: "stop",
        });
    }
}

export function createSessionFitFile(exportSession: IExportSession): ArrayBufferLike {
    return new FitFileBuilder(exportSession).build();
}
