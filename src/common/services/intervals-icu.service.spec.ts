import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { firstValueFrom } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { IIntervalsIcuConfig } from "../common.interfaces";
import { appDB } from "../utils/app-database";

import { ConfigManagerService } from "./config-manager.service";
import { DataRecorderService } from "./data-recorder.service";
import { BulkUploadResult, IntervalsIcuService } from "./intervals-icu.service";

describe("IntervalsService", (): void => {
    let service: IntervalsIcuService;
    let httpTesting: HttpTestingController;
    let mockDataRecorder: { generateFitFile: Mock };
    let mockConfigManager: { getGroup: Mock };
    let mockSnackBar: Pick<MatSnackBar, "open">;
    let connectedDeviceGetSpy: Mock;
    let sessionUploadsPutSpy: Mock;
    let sessionUploadsToArraySpy: Mock;
    let sessionUploadsClearSpy: Mock;
    let sessionDataOrderBySpy: Mock;

    const sessionId = 1700000000000;
    const fitBlob = new Blob(["fit"], { type: "application/vnd.ant.fit" });
    const config: IIntervalsIcuConfig = {
        apiKey: "secret-key",
        athleteId: "123",
        autoUploadEnabled: true,
    };
    const uploadUrl = `https://intervals.icu/api/v1/athlete/${config.athleteId}/activities`;

    const mockSessionDataKeys = (sessionIds: Array<number>): void => {
        sessionDataOrderBySpy.mockImplementation(
            (): ReturnType<typeof appDB.sessionData.orderBy> =>
                ({
                    uniqueKeys: vi.fn().mockResolvedValue(sessionIds),
                }) as unknown as ReturnType<typeof appDB.sessionData.orderBy>,
        );
    };

    beforeEach((): void => {
        vi.useFakeTimers();

        mockDataRecorder = { generateFitFile: vi.fn().mockResolvedValue(fitBlob) };
        mockConfigManager = { getGroup: vi.fn().mockReturnValue({ intervalsIcu: config }) };
        mockSnackBar = { open: vi.fn() };

        TestBed.configureTestingModule({
            providers: [
                IntervalsIcuService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting(),
                { provide: DataRecorderService, useValue: mockDataRecorder },
                { provide: ConfigManagerService, useValue: mockConfigManager },
                { provide: MatSnackBar, useValue: mockSnackBar },
            ],
        });

        service = TestBed.inject(IntervalsIcuService);
        httpTesting = TestBed.inject(HttpTestingController);

        connectedDeviceGetSpy = vi
            .spyOn(appDB.connectedDevice, "get")
            .mockResolvedValue(undefined as { sessionId: number; deviceName: string } | undefined);
        sessionUploadsPutSpy = vi.spyOn(appDB.sessionUploads, "put").mockResolvedValue(sessionId);
        sessionUploadsToArraySpy = vi.spyOn(appDB.sessionUploads, "toArray").mockResolvedValue([]);
        sessionUploadsClearSpy = vi.spyOn(appDB.sessionUploads, "clear").mockResolvedValue();
        sessionDataOrderBySpy = vi.spyOn(appDB.sessionData, "orderBy");
        mockSessionDataKeys([]);
    });

    afterEach((): void => {
        httpTesting.verify();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe("uploadSession method", (): void => {
        it("should POST to the correct URL with athleteId", async (): Promise<void> => {
            mockConfigManager.getGroup.mockReturnValue({
                intervalsIcu: { ...config, athleteId: "athlete/123" },
            });

            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(`https://intervals.icu/api/v1/athlete/athlete/123/activities`);
            expect(req.request.method).toBe("POST");
            req.flush({}, { status: 200, statusText: "OK" });

            await resultPromise;
        });

        it(`should use "0" as athleteId when config has empty string`, async (): Promise<void> => {
            mockConfigManager.getGroup.mockReturnValue({
                intervalsIcu: { ...config, athleteId: "" },
            });

            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne("https://intervals.icu/api/v1/athlete/0/activities");

            req.flush({}, { status: 200, statusText: "OK" });
            await resultPromise;
        });

        it("should set Authorization header as Basic with API_KEY prefix", async (): Promise<void> => {
            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            expect(req.request.headers.get("Authorization")).toBe(
                `Basic ${btoa("API_KEY:" + config.apiKey)}`,
            );
            req.flush({}, { status: 200, statusText: "OK" });
            await resultPromise;
        });

        it("should send FormData with Rowing type for a rowing device", async (): Promise<void> => {
            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            const body = req.request.body as FormData;
            expect(body.get("external_id")).toBe(String(sessionId));
            expect(body.get("type")).toBe("Rowing");
            expect(body.get("trainer")).toBe("1");
            expect(body.get("indoor")).toBe("1");
            expect(body.get("file")).toBeInstanceOf(File);
            req.flush({}, { status: 200, statusText: "OK" });
            await resultPromise;
        });

        it("should send FormData with Kayaking type for a kayak device", async (): Promise<void> => {
            connectedDeviceGetSpy.mockResolvedValue({ sessionId, deviceName: "ESP Kayak Monitor" });

            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            expect((req.request.body as FormData).get("type")).toBe("Kayaking");
            req.flush({}, { status: 200, statusText: "OK" });

            await resultPromise;
        });

        it("should return true and write tracking row on a successful upload", async (): Promise<void> => {
            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            req.flush({}, { status: 200, statusText: "OK" });

            expect(await resultPromise).toBe(true);
            expect(sessionUploadsPutSpy).toHaveBeenCalledTimes(1);
            expect(sessionUploadsPutSpy).toHaveBeenCalledWith({
                sessionId,
                uploadedAt: expect.any(Number),
            });
        });

        it("should return false and not write tracking row when upload fails", async (): Promise<void> => {
            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            req.error(new ProgressEvent("error"));

            expect(await resultPromise).toBe(false);
            expect(sessionUploadsPutSpy).not.toHaveBeenCalled();
        });

        it("should show invalid API key snackbar on 401", async (): Promise<void> => {
            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            req.flush({}, { status: 401, statusText: "Unauthorized" });

            expect(await resultPromise).toBe(false);
            expect(mockSnackBar.open).toHaveBeenCalledWith("Invalid Intervals.icu API key", "Dismiss");
            expect(sessionUploadsPutSpy).not.toHaveBeenCalled();
        });

        it("should show invalid API key snackbar on 403", async (): Promise<void> => {
            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            req.flush({}, { status: 403, statusText: "Forbidden" });

            expect(await resultPromise).toBe(false);
            expect(mockSnackBar.open).toHaveBeenCalledWith("Invalid Intervals.icu API key", "Dismiss");
            expect(sessionUploadsPutSpy).not.toHaveBeenCalled();
        });

        it("should not show invalid API key snackbar on non-auth failures", async (): Promise<void> => {
            const resultPromise = service.uploadSession(sessionId);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            req.flush({}, { status: 500, statusText: "Server Error" });

            expect(await resultPromise).toBe(false);
            expect(mockSnackBar.open).not.toHaveBeenCalled();
            expect(sessionUploadsPutSpy).not.toHaveBeenCalled();
        });
    });

    describe("getUploadedSessionIds$ method", (): void => {
        it("should emit all uploaded session IDs", async (): Promise<void> => {
            sessionUploadsToArraySpy.mockResolvedValue([
                { sessionId, uploadedAt: Date.now() },
                { sessionId: sessionId + 1, uploadedAt: Date.now() },
            ]);

            const idsPromise = firstValueFrom(service.getUploadedSessionIds$());
            await vi.runAllTimersAsync();

            const ids = await idsPromise;
            expect(ids).toContain(sessionId);
            expect(ids).toContain(sessionId + 1);
        });

        it("should emit an empty array when no sessions have been uploaded", async (): Promise<void> => {
            const idsPromise = firstValueFrom(service.getUploadedSessionIds$());
            await vi.runAllTimersAsync();

            const ids = await idsPromise;
            expect(ids).toEqual([]);
        });
    });

    describe("isUploading signal", (): void => {
        it("should be false initially", (): void => {
            expect(service.isUploading()).toBe(false);
        });

        it("should be true during runBulkUpload and false after it completes", async (): Promise<void> => {
            mockSessionDataKeys([sessionId]);

            const resultPromise = service.runBulkUpload(false);
            expect(service.isUploading()).toBe(true);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            req.flush({}, { status: 200, statusText: "OK" });
            await vi.advanceTimersByTimeAsync(300);

            await resultPromise;
            expect(service.isUploading()).toBe(false);
        });
    });

    describe("runBulkUpload method", (): void => {
        it("should upload all untracked sessions and return counts", async (): Promise<void> => {
            mockSessionDataKeys([sessionId, sessionId + 1]);

            const resultPromise = service.runBulkUpload(false);
            await vi.runAllTimersAsync();

            const firstReq = httpTesting.expectOne(uploadUrl);
            firstReq.flush({}, { status: 200, statusText: "OK" });
            await vi.runAllTimersAsync();

            const secondReq = httpTesting.expectOne(uploadUrl);
            secondReq.flush({}, { status: 200, statusText: "OK" });
            await vi.advanceTimersByTimeAsync(300);

            expect(await resultPromise).toEqual<BulkUploadResult>({
                uploaded: 2,
                failed: 0,
                cancelled: false,
            });
        });

        it("should skip sessions that already have a tracking row", async (): Promise<void> => {
            mockSessionDataKeys([sessionId, sessionId + 1]);
            sessionUploadsToArraySpy.mockResolvedValue([{ sessionId, uploadedAt: Date.now() }]);

            const resultPromise = service.runBulkUpload(false);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            req.flush({}, { status: 200, statusText: "OK" });
            await vi.advanceTimersByTimeAsync(300);

            expect(await resultPromise).toEqual<BulkUploadResult>({
                uploaded: 1,
                failed: 0,
                cancelled: false,
            });
        });

        it("should clear tracking rows and re-upload all when resetTracking is true", async (): Promise<void> => {
            mockSessionDataKeys([sessionId]);

            const resultPromise = service.runBulkUpload(true);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            req.flush({}, { status: 200, statusText: "OK" });
            await vi.advanceTimersByTimeAsync(300);

            expect(sessionUploadsClearSpy).toHaveBeenCalledTimes(1);
            expect(await resultPromise).toEqual<BulkUploadResult>({
                uploaded: 1,
                failed: 0,
                cancelled: false,
            });
        });

        it("should count failed uploads separately from successful ones", async (): Promise<void> => {
            mockSessionDataKeys([sessionId, sessionId + 1]);

            const resultPromise = service.runBulkUpload(false);
            await vi.runAllTimersAsync();

            const firstReq = httpTesting.expectOne(uploadUrl);
            firstReq.flush({}, { status: 200, statusText: "OK" });
            await vi.runAllTimersAsync();

            const secondReq = httpTesting.expectOne(uploadUrl);
            secondReq.error(new ProgressEvent("error"));
            await vi.advanceTimersByTimeAsync(300);

            expect(await resultPromise).toEqual<BulkUploadResult>({
                uploaded: 1,
                failed: 1,
                cancelled: false,
            });
        });

        it("should invoke onProgress callback after each upload with running totals", async (): Promise<void> => {
            mockSessionDataKeys([sessionId, sessionId + 1]);
            const onProgress = vi.fn();

            const resultPromise = service.runBulkUpload(false, onProgress);
            await vi.runAllTimersAsync();

            const firstReq = httpTesting.expectOne(uploadUrl);
            firstReq.flush({}, { status: 200, statusText: "OK" });
            await vi.runAllTimersAsync();

            const secondReq = httpTesting.expectOne(uploadUrl);
            secondReq.flush({}, { status: 200, statusText: "OK" });
            await vi.advanceTimersByTimeAsync(300);

            await resultPromise;
            expect(onProgress).toHaveBeenCalledTimes(2);
            expect(onProgress).toHaveBeenNthCalledWith(1, 1, 0, 2);
            expect(onProgress).toHaveBeenNthCalledWith(2, 2, 0, 2);
        });

        it("should stop after the current upload completes when cancelled mid-run", async (): Promise<void> => {
            mockSessionDataKeys([sessionId, sessionId + 1, sessionId + 2]);

            const resultPromise = service.runBulkUpload(false);
            await vi.runAllTimersAsync();

            const req = httpTesting.expectOne(uploadUrl);
            service.cancelBulkUpload();
            req.flush({}, { status: 200, statusText: "OK" });

            const result = await resultPromise;
            expect(result.cancelled).toBe(true);
            expect(result.uploaded).toBe(1);
        });

        it("should report cancelled when cancel is requested during the only upload", async (): Promise<void> => {
            mockSessionDataKeys([sessionId]);

            const resultPromise = service.runBulkUpload(false);
            await vi.runAllTimersAsync();

            service.cancelBulkUpload();
            httpTesting.expectOne(uploadUrl).flush({}, { status: 200, statusText: "OK" });

            const result = await resultPromise;
            expect(result.cancelled).toBe(true);
            expect(result.uploaded).toBe(1);
        });

        it("should wait 300ms between consecutive uploads", async (): Promise<void> => {
            mockSessionDataKeys([sessionId, sessionId + 1]);

            const resultPromise = service.runBulkUpload(false);
            await vi.runAllTimersAsync();

            httpTesting.expectOne(uploadUrl).flush({}, { status: 200, statusText: "OK" });

            // 300ms delay has started — second request must not be pending yet
            await vi.advanceTimersByTimeAsync(299);
            httpTesting.expectNone(uploadUrl);

            // 1ms more completes the delay
            await vi.advanceTimersByTimeAsync(1);
            httpTesting.expectOne(uploadUrl).flush({}, { status: 200, statusText: "OK" });
            await vi.advanceTimersByTimeAsync(300);

            expect(await resultPromise).toEqual<BulkUploadResult>({
                uploaded: 2,
                failed: 0,
                cancelled: false,
            });
        });

        it("should return immediately with zero counts when already uploading", async (): Promise<void> => {
            mockSessionDataKeys([sessionId]);

            const firstUploadPromise = service.runBulkUpload(false);
            expect(service.isUploading()).toBe(true);

            const secondResult = await service.runBulkUpload(false);
            expect(secondResult).toEqual<BulkUploadResult>({ uploaded: 0, failed: 0, cancelled: false });

            await vi.runAllTimersAsync();
            httpTesting.expectOne(uploadUrl).flush({}, { status: 200, statusText: "OK" });
            await vi.advanceTimersByTimeAsync(300);
            await firstUploadPromise;
        });
    });

    describe("cancelBulkUpload method", (): void => {
        it("should have no effect when no bulk upload is running", (): void => {
            expect((): void => service.cancelBulkUpload()).not.toThrow();
        });
    });
});
