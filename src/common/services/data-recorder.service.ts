import { Injectable } from "@angular/core";

import { IRowerDataDto, IRowerSettings, ISessionData } from "../common.interfaces";

@Injectable({
    providedIn: "root",
})
export class DataRecorderService {
    private rowingData: Array<IRowerDataDto | IRowerSettings> = [];
    private rowingSessionData: Array<ISessionData> = [];

    add(rowingData: ISessionData): void {
        this.rowingSessionData.push(rowingData);
    }

    addRaw(rowingData: IRowerDataDto | IRowerSettings): void {
        this.rowingData.push(rowingData);
    }

    download(): void {
        const blob = new Blob([JSON.stringify(this.rowingSessionData)], { type: "application/json" });
        this.createDownload(blob, "session");
    }

    downloadRaw(): void {
        const blob = new Blob([JSON.stringify(this.rowingData)], { type: "application/json" });
        this.createDownload(blob, "raw");
    }

    reset(): void {
        this.rowingSessionData = [];
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
