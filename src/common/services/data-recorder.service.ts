import { Injectable } from "@angular/core";

import { ISessionData } from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class DataRecorderService {
    private deltaTimes: Array<number> = [];
    private rowingSessionData: Array<ISessionData & { timeStamp: Date }> = [];

    add(rowingData: ISessionData): void {
        this.rowingSessionData.push({ ...rowingData, timeStamp: new Date() });
    }

    addDeltaTimes(deltaTimes: Array<number>): void {
        this.deltaTimes.push(...deltaTimes);
    }

    download(): void {
        const blob = new Blob([JSON.stringify(this.rowingSessionData)], { type: "application/json" });
        this.createDownload(blob, "session");
    }

    downloadDeltaTimes(): void {
        const blob = new Blob([JSON.stringify(this.deltaTimes)], { type: "application/json" });
        this.createDownload(blob, "deltaTimes");
    }

    reset(): void {
        this.rowingSessionData = [];
        this.deltaTimes = [];
    }

    private createDownload(blob: Blob, name: string): void {
        const url = window.URL.createObjectURL(blob);
        const downloadTag = document.createElement("a");
        downloadTag.href = url;
        const now = new Date(Date.now());
        downloadTag.download = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now
            .getDate()
            .toString()
            .padStart(2, "0")} ${now.getHours().toString().padStart(2, "0")}-${now
            .getMinutes()
            .toString()
            .padStart(2, "0")}-${now.getSeconds().toString().padStart(2, "0")} - ${name}`;
        downloadTag.click();
    }
}
