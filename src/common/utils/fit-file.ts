import { FitWriter } from "@markw65/fit-file-writer";

import { IExportRecord, IExportSession } from "../database.interfaces";

import { computeMeanForce, computeStats, getSportConfig, SessionStats, SportConfig } from "./fit-file.utils";

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

    constructor(private readonly exportSession: IExportSession) {
        const { records }: { records: Array<IExportRecord> } = exportSession;
        if (records.length === 0) {
            throw new Error("Cannot create FIT file from empty session");
        }
        this.records = records;

        const startTime = records[0].timeStamp;
        this.endTime = records[records.length - 1].timeStamp;
        this.startDateTime = this.fitWriter.time(startTime);
        this.endDateTime = this.fitWriter.time(this.endTime);
        this.wallClockTotal = (this.endTime.getTime() - startTime.getTime()) / 1000;
        this.elapsedTimeTotal = records[records.length - 1].elapsedTime;
        this.stats = computeStats(records, exportSession.handleForces);
        this.sportConfig = getSportConfig(exportSession.deviceName);
    }

    build(): ArrayBufferLike {
        this.writeFileHeader();
        this.writeRecords();
        this.writeHRMessages();
        this.writeEventStop();
        this.writeLap();
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
            const dragFactor = Math.round(record.dragFactor);
            const currentHandleForces = this.exportSession.handleForces[record.strokeCount];
            const meanForce =
                currentHandleForces !== undefined && currentHandleForces.handleForces.length > 0
                    ? Math.round(computeMeanForce(currentHandleForces.handleForces))
                    : undefined;

            this.fitWriter.writeMessage("record", {
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
                ...(meanForce !== undefined && { force: meanForce }),
                ...(dragFactor > 0 && dragFactor < 255 && { resistance: dragFactor }),
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

    private writeEventStop(): void {
        this.fitWriter.writeMessage("event", {
            event: "timer",
            event_type: "stopAll",
            event_group: 0,
            timestamp: this.endDateTime,
        });
    }

    private writeLap(): void {
        this.fitWriter.writeMessage("lap", {
            message_index: { value: 0 },
            timestamp: this.startDateTime,
            start_time: this.startDateTime,
            event: "session",
            event_type: "stop",
            intensity: "active",
            lap_trigger: "sessionEnd",
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
        });
    }

    private writeSession(): void {
        this.fitWriter.writeMessage("session", {
            message_index: { value: 0 },
            timestamp: this.startDateTime,
            start_time: this.startDateTime,
            first_lap_index: 0,
            num_laps: 1,
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
        });
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
