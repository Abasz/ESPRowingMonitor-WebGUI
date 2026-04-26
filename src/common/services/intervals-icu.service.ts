import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { liveQuery } from "dexie";
import { firstValueFrom, from, Observable } from "rxjs";
import { map } from "rxjs/operators";

import { IIntervalsIcuConfig } from "../common.interfaces";
import { ISessionUploadEntity } from "../database.interfaces";
import { appDB } from "../utils/app-database";
import { getSportConfig } from "../utils/fit-file/fit-file.utils";
import { withDelay } from "../utils/utility.functions";

import { ConfigManagerService } from "./config-manager.service";
import { DataRecorderService } from "./data-recorder.service";

export interface BulkUploadResult {
    uploaded: number;
    failed: number;
    cancelled: boolean;
}

@Injectable({ providedIn: "root" })
export class IntervalsIcuService {
    private static readonly BASE_URL: string = "https://intervals.icu/api/v1";

    readonly isUploading: Signal<boolean>;

    private _isUploading: WritableSignal<boolean> = signal(false);
    private _abortController: AbortController = new AbortController();

    constructor(
        private http: HttpClient,
        private dataRecorder: DataRecorderService,
        private configManager: ConfigManagerService,
        private snackBar: MatSnackBar,
    ) {
        this.isUploading = this._isUploading.asReadonly();
    }

    getUploadedSessionIds$(): Observable<Array<number>> {
        return from(
            liveQuery((): Promise<Array<ISessionUploadEntity>> => appDB.sessionUploads.toArray()),
        ).pipe(
            map(
                (uploads: Array<ISessionUploadEntity>): Array<number> =>
                    uploads.map((upload: ISessionUploadEntity): number => upload.sessionId),
            ),
        );
    }

    async runBulkUpload(
        resetTracking: boolean,
        onProgress?: (uploaded: number, failed: number, total: number) => void,
    ): Promise<BulkUploadResult> {
        if (this._isUploading()) {
            return { uploaded: 0, failed: 0, cancelled: false };
        }

        this._abortController = new AbortController();

        try {
            this._isUploading.set(true);

            if (resetTracking) {
                await appDB.sessionUploads.clear();
            }

            const { intervalsIcu }: { intervalsIcu: IIntervalsIcuConfig } =
                this.configManager.getGroup("general");

            const allSessionIds = (await appDB.sessionData
                .orderBy("sessionId")
                .uniqueKeys()) as Array<number>;

            const uploadedIds = new Set(
                (await appDB.sessionUploads.toArray()).map(
                    (upload: ISessionUploadEntity): number => upload.sessionId,
                ),
            );

            const toUpload = allSessionIds.filter((id: number): boolean => !uploadedIds.has(id));

            let uploaded = 0;
            let failed = 0;

            for (const sessionId of toUpload) {
                if (this._abortController.signal.aborted) {
                    return { uploaded, failed, cancelled: true };
                }

                (await this.uploadSession(sessionId, intervalsIcu)) ? uploaded++ : failed++;

                onProgress?.(uploaded, failed, toUpload.length);

                if (!this._abortController.signal.aborted) {
                    await withDelay(300);
                }
            }

            return { uploaded, failed, cancelled: this._abortController.signal.aborted };
        } finally {
            this._isUploading.set(false);
        }
    }

    cancelBulkUpload(): void {
        this._abortController.abort();
    }

    async uploadSession(sessionId: number, config?: IIntervalsIcuConfig): Promise<boolean> {
        const { apiKey, athleteId }: IIntervalsIcuConfig =
            config ?? this.configManager.getGroup("general").intervalsIcu;

        const connectedDevice = await appDB.connectedDevice.get(sessionId);
        const { sport }: { sport: string } = getSportConfig(connectedDevice?.deviceName);
        const activityType = sport.toFirstUpperCase();

        try {
            const fitBlob = await this.dataRecorder.generateFitFile(sessionId);
            await firstValueFrom(
                this.buildUploadRequest(athleteId, apiKey, fitBlob, sessionId, activityType),
            );

            await appDB.sessionUploads.put({ sessionId, uploadedAt: Date.now() });

            return true;
        } catch (error: unknown) {
            if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
                this.snackBar.open("Invalid Intervals.icu API key", "Dismiss");
            }

            return false;
        }
    }

    private buildUploadRequest(
        athleteId: string,
        apiKey: string,
        fitData: Blob,
        sessionId: number,
        activityType: string,
    ): Observable<unknown> {
        const url = `${IntervalsIcuService.BASE_URL}/athlete/${athleteId || "0"}/activities`;

        const formData = new FormData();
        formData.append("file", fitData, `session-${sessionId}.fit`);
        formData.append("external_id", String(sessionId));
        formData.append("type", activityType);
        formData.append("trainer", "1");
        formData.append("indoor", "1");

        return this.http.post<unknown>(url, formData, {
            headers: { Authorization: `Basic ${btoa("API_KEY:" + apiKey)}` },
        });
    }
}
