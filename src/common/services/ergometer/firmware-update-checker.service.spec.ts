import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Subject } from "rxjs";

import { ErgGenericDataService } from "./erg-generic-data.service";
import { FirmwareUpdateCheckerService } from "./firmware-update-checker.service";

describe("FirmwareUpdateCheckerService", (): void => {
    let service: FirmwareUpdateCheckerService;
    let httpTestingController: HttpTestingController;
    let mockMatSnackBar: jasmine.SpyObj<MatSnackBar>;
    let mockErgGenericDataService: jasmine.SpyObj<ErgGenericDataService>;
    let windowOpenSpy: jasmine.Spy<typeof window.open>;

    beforeEach((): void => {
        windowOpenSpy = spyOn(window, "open");

        mockMatSnackBar = jasmine.createSpyObj("MatSnackBar", ["open"]);
        mockErgGenericDataService = jasmine.createSpyObj("ErgGenericDataService", [], {
            deviceInfo: jasmine.createSpy("deviceInfo").and.returnValue({ firmwareNumber: "20240315" }),
        });

        TestBed.configureTestingModule({
            providers: [
                FirmwareUpdateCheckerService,
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: MatSnackBar, useValue: mockMatSnackBar },
                { provide: ErgGenericDataService, useValue: mockErgGenericDataService },
                provideZonelessChangeDetection(),
            ],
        });

        service = TestBed.inject(FirmwareUpdateCheckerService);
        httpTestingController = TestBed.inject(HttpTestingController);
    });

    afterEach((): void => {
        httpTestingController.verify();
    });

    describe("as part of service creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });

        it("should initialize isUpdateAvailable signal to undefined", (): void => {
            expect(service.isUpdateAvailable()).toBeUndefined();
        });
    });

    describe("checkForFirmwareUpdate method", (): void => {
        describe("when firmware number is not available", (): void => {
            it("should not make HTTP request", async (): Promise<void> => {
                mockErgGenericDataService.deviceInfo.and.returnValue({});

                httpTestingController.expectNone(
                    "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
                );
                await expectAsync(service.checkForFirmwareUpdate()).not.toBeRejected();
            });

            it("should reset update in progress", async (): Promise<void> => {
                mockErgGenericDataService.deviceInfo.and.returnValues(
                    {},
                    {},
                    {
                        firmwareNumber: "20240315",
                    },
                );
                const promise1 = service.checkForFirmwareUpdate();
                const promise2 = service.checkForFirmwareUpdate();
                const promise3 = service.checkForFirmwareUpdate();

                const req = httpTestingController.expectOne(
                    "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
                );
                req.flush({
                    name: "v20240320",
                    published_at: "2024-03-20T10:00:00Z",
                    updated_at: "2024-03-20T10:00:00Z",
                    tag_name: "v20240320",
                });
                await expectAsync(Promise.all([promise1, promise2, promise3])).not.toBeRejected();
            });
        });

        it("should set isUpdateAvailable to undefined at start of check", async (): Promise<void> => {
            const initSetup = service.checkForFirmwareUpdate();
            const req1 = httpTestingController.expectOne(
                "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
            );
            req1.flush({
                name: "v20240315",
                published_at: "2024-03-15T10:00:00Z",
                updated_at: "2024-03-15T10:00:00Z",
                tag_name: "v20240315",
            });
            await initSetup;
            // verify initial state is false (no update)
            expect(service.isUpdateAvailable()).toBeFalse();

            const sut = service.checkForFirmwareUpdate();
            expect(service.isUpdateAvailable()).toBeUndefined();

            const req2 = httpTestingController.expectOne(
                "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
            );
            req2.flush({
                name: "v20240315",
                published_at: "2024-03-15T10:00:00Z",
                updated_at: "2024-03-15T10:00:00Z",
                tag_name: "v20240315",
            });

            await sut;
        });

        it("should handle GitHub API request failures gracefully", async (): Promise<void> => {
            const sut = service.checkForFirmwareUpdate();

            const req = httpTestingController.expectOne(
                "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
            );
            req.flush("Not Found", { status: 404, statusText: "Not Found" });

            await expectAsync(sut).not.toBeRejected();
            expect(service.isUpdateAvailable()).toBeFalse();
        });

        describe("when firmware version is up to date", (): void => {
            it("should not show update notification for same release date", async (): Promise<void> => {
                const sut = service.checkForFirmwareUpdate();

                const req = httpTestingController.expectOne(
                    "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
                );
                req.flush({
                    name: "v20240315",
                    published_at: "2024-03-15T10:00:00Z",
                    updated_at: "2024-03-15T10:00:00Z",
                    tag_name: "v20240315",
                });

                await sut;
                expect(mockMatSnackBar.open).not.toHaveBeenCalled();
                expect(service.isUpdateAvailable()).toBeFalse();
            });

            it("should not show update notification for newer firmware", async (): Promise<void> => {
                const sut = service.checkForFirmwareUpdate();

                const req = httpTestingController.expectOne(
                    "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
                );
                req.flush({
                    name: "v20240310",
                    published_at: "2024-03-10T10:00:00Z",
                    updated_at: "2024-03-10T10:00:00Z",
                    tag_name: "v20240310",
                });

                await sut;
                expect(mockMatSnackBar.open).not.toHaveBeenCalled();
                expect(service.isUpdateAvailable()).toBeFalse();
            });
        });

        describe("when firmware update is available", (): void => {
            it("should show update notification with correct message", async (): Promise<void> => {
                const mockSnackBarRef = jasmine.createSpyObj("MatSnackBarRef", ["onAction"]);
                const actionSubject = new Subject<void>();
                mockSnackBarRef.onAction.and.returnValue(actionSubject.asObservable());
                mockMatSnackBar.open.and.returnValue(mockSnackBarRef);

                const sut = service.checkForFirmwareUpdate();

                const req = httpTestingController.expectOne(
                    "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
                );
                req.flush({
                    name: "v20240320",
                    published_at: "2024-03-20T10:00:00Z",
                    updated_at: "2024-03-20T10:00:00Z",
                    tag_name: "v20240320",
                });

                await sut;
                expect(mockMatSnackBar.open).toHaveBeenCalledWith(
                    "Firmware update available: v20240320",
                    "View on GitHub",
                    jasmine.objectContaining({
                        duration: 30000,
                    }),
                );
                expect(service.isUpdateAvailable()).toBeTrue();
            });

            it("should open GitHub releases page when action is clicked", async (): Promise<void> => {
                const mockSnackBarRef = jasmine.createSpyObj("MatSnackBarRef", ["onAction"]);
                const actionSubject = new Subject<void>();
                mockSnackBarRef.onAction.and.returnValue(actionSubject.asObservable());
                mockMatSnackBar.open.and.returnValue(mockSnackBarRef);

                const sut = service.checkForFirmwareUpdate();

                const req = httpTestingController.expectOne(
                    "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
                );
                req.flush({
                    name: "v20240320",
                    published_at: "2024-03-20T10:00:00Z",
                    updated_at: "2024-03-20T10:00:00Z",
                    tag_name: "v20240320",
                });

                // allow microtasks to run so the snackBar.open().onAction().subscribe(...) is wired
                await Promise.resolve();
                // emit the action and wait a microtask so subscription runs
                actionSubject.next();
                await Promise.resolve();

                await sut;

                expect(windowOpenSpy).toHaveBeenCalledWith(
                    "https://github.com/Abasz/ESPRowingMonitor/releases/latest",
                    "_blank",
                );
            });
        });

        describe("as part of edge cases & robustness handling", (): void => {
            it("should handle concurrent API calls gracefully", async (): Promise<void> => {
                const mockSnackBarRef = jasmine.createSpyObj("MatSnackBarRef", ["onAction"]);
                const actionSubject = new Subject<void>();
                mockSnackBarRef.onAction.and.returnValue(actionSubject.asObservable());
                mockMatSnackBar.open.and.returnValue(mockSnackBarRef);

                const promise1 = service.checkForFirmwareUpdate();
                const promise2 = service.checkForFirmwareUpdate();
                const promise3 = service.checkForFirmwareUpdate();

                const req = httpTestingController.expectOne(
                    "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
                );
                req.flush({
                    name: "v20240320",
                    published_at: "2024-03-20T10:00:00Z",
                    updated_at: "2024-03-20T10:00:00Z",
                    tag_name: "v20240320",
                });

                await Promise.all([promise1, promise2, promise3]);
                expect(mockErgGenericDataService.deviceInfo).toHaveBeenCalledTimes(1);
                expect(service.isUpdateAvailable()).toBeTrue();
            });

            it("should handle network timeout errors gracefully", async (): Promise<void> => {
                const sut = service.checkForFirmwareUpdate();

                const req = httpTestingController.expectOne(
                    "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
                );
                req.error(new ProgressEvent("timeout"), { status: 0, statusText: "Timeout" });

                await sut;
                expect(service.isUpdateAvailable()).toBeFalse();
            });

            it("should handle malformed GitHub API response", async (): Promise<void> => {
                const sut = service.checkForFirmwareUpdate();

                const req = httpTestingController.expectOne(
                    "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
                );
                req.flush({
                    name: "v20240320",
                    tag_name: "v20240320",
                });

                await expectAsync(sut).not.toBeRejected();
                expect(service.isUpdateAvailable()).toBeFalse();
            });
        });
    });
});
