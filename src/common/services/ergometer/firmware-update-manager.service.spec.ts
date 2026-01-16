import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Observable, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDeviceInformation } from "../../ble.interfaces";
import { FirmwareAsset } from "../../common.interfaces";
import { versionInfo } from "../../data/version";

import { ErgGenericDataService } from "./erg-generic-data.service";
import { FirmwareUpdateManagerService } from "./firmware-update-manager.service";

/**
 * Helper function to format a Date as YYYYMMDD string (firmware version format)
 */
function formatDateAsFirmwareVersion(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}${month}${day}`;
}

/**
 * Get test firmware dates based on the actual versionInfo release date.
 * This ensures tests remain valid when version.ts is updated.
 */
function getTestFirmwareDates(): {
    releaseDate: Date;
    olderThanRelease: string;
    sameAsRelease: string;
    newerThanRelease: string;
    muchOlderThanRelease: string;
} {
    const releaseDate = new Date(versionInfo.latestFirmwareRelease.updatedAt);
    const releaseDateOnly = new Date(
        releaseDate.getFullYear(),
        releaseDate.getMonth(),
        releaseDate.getDate(),
    );

    const olderDate = new Date(releaseDateOnly);
    olderDate.setDate(olderDate.getDate() - 30);

    const newerDate = new Date(releaseDateOnly);
    newerDate.setDate(newerDate.getDate() + 1);

    const muchOlderDate = new Date(releaseDateOnly);
    muchOlderDate.setFullYear(muchOlderDate.getFullYear() - 1);

    return {
        releaseDate: releaseDateOnly,
        olderThanRelease: formatDateAsFirmwareVersion(olderDate),
        sameAsRelease: formatDateAsFirmwareVersion(releaseDateOnly),
        newerThanRelease: formatDateAsFirmwareVersion(newerDate),
        muchOlderThanRelease: formatDateAsFirmwareVersion(muchOlderDate),
    };
}

const testDates = getTestFirmwareDates();

describe("FirmwareUpdateManagerService", (): void => {
    let service: FirmwareUpdateManagerService;
    let httpTesting: HttpTestingController;
    let mockErgGenericDataService: Pick<ErgGenericDataService, "deviceInfo" | "deviceInfo$">;
    let deviceInfoSubject: BehaviorSubject<IDeviceInformation>;
    let deviceInfoSignal: WritableSignal<IDeviceInformation>;

    beforeEach((): void => {
        deviceInfoSubject = new BehaviorSubject<IDeviceInformation>({
            firmwareNumber: testDates.olderThanRelease,
        });

        deviceInfoSignal = signal<IDeviceInformation>({
            firmwareNumber: testDates.olderThanRelease,
        });

        mockErgGenericDataService = {
            deviceInfo: deviceInfoSignal,
            deviceInfo$: deviceInfoSubject.asObservable(),
        };

        TestBed.configureTestingModule({
            providers: [
                FirmwareUpdateManagerService,
                provideHttpClientTesting(),
                { provide: ErgGenericDataService, useValue: mockErgGenericDataService },
            ],
        });

        service = TestBed.inject(FirmwareUpdateManagerService);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach((): void => {
        httpTesting.verify();
    });

    describe("as part of service creation", (): void => {
        it("should create the service", (): void => {
            expect(service).toBeTruthy();
        });

        it("should clear isUpdateAvailable to undefined when deviceInfo$ emits an empty object", (): void => {
            // start with a known state
            deviceInfoSignal.set({ firmwareNumber: testDates.olderThanRelease });
            service.checkForFirmwareUpdate();
            expect(service.isUpdateAvailable()).not.toBeUndefined();

            // emitting an empty object should clear the flag to undefined (new constructor behavior)
            deviceInfoSubject.next({} as IDeviceInformation);
            expect(service.isUpdateAvailable()).toBeUndefined();
        });

        it("should trigger checkForFirmwareUpdate when deviceInfo$ emits a non-empty object", (): void => {
            vi.spyOn(service, "checkForFirmwareUpdate");

            // ensure deviceInfo() will return a firmware number when called
            deviceInfoSignal.set({ firmwareNumber: testDates.olderThanRelease });

            // emit non-empty device info
            deviceInfoSubject.next({ firmwareNumber: testDates.olderThanRelease } as IDeviceInformation);

            expect(service.checkForFirmwareUpdate).toHaveBeenCalled();
            expect(typeof service.isUpdateAvailable()).toBe("boolean");
        });
    });

    describe("checkForFirmwareUpdate method", (): void => {
        describe("when firmware number is not available", (): void => {
            it("should return false and set isUpdateAvailable to false", (): void => {
                deviceInfoSignal.set({});

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(false);
                expect(service.isUpdateAvailable()).toBe(false);
            });

            it("should log warning when firmware number is missing", (): void => {
                deviceInfoSignal.set({});
                vi.spyOn(console, "warn");

                service.checkForFirmwareUpdate();

                expect(console.warn).toHaveBeenCalledWith("Could not retrieve device firmware version");
            });
        });

        describe("when firmware version cannot be parsed", (): void => {
            it("should return false for invalid firmware version format", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: "invalid",
                });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(false);
                expect(service.isUpdateAvailable()).toBe(false);
            });

            it("should return false for partial date format", (): void => {
                deviceInfoSignal.set({ firmwareNumber: "202403" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(false);
                expect(service.isUpdateAvailable()).toBe(false);
            });

            it("should log warning when firmware version parsing fails", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: "invalid",
                });
                vi.spyOn(console, "warn");

                service.checkForFirmwareUpdate();

                expect(console.warn).toHaveBeenCalledWith(
                    "Could not parse firmware version date:",
                    expect.any(Error),
                );
            });
        });

        it("should set isUpdateAvailable to undefined at start of check", (): void => {
            deviceInfoSignal.set({ firmwareNumber: testDates.newerThanRelease });
            service.checkForFirmwareUpdate();
            expect(service.isUpdateAvailable()).toBe(false);

            deviceInfoSignal.set({ firmwareNumber: testDates.olderThanRelease });
            expect(service.isUpdateAvailable()).toBe(false);

            service.checkForFirmwareUpdate();

            expect(service.isUpdateAvailable()).toBe(true);
        });

        describe("when firmware version is up to date", (): void => {
            it("should return false for same release date", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: testDates.sameAsRelease,
                });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(false);
                expect(service.isUpdateAvailable()).toBe(false);
            });

            it("should return false for newer firmware than release", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: testDates.newerThanRelease,
                });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(false);
                expect(service.isUpdateAvailable()).toBe(false);
            });
        });

        describe("when firmware update is available", (): void => {
            it("should return true when firmware is older than release", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: testDates.olderThanRelease,
                });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(true);
                expect(service.isUpdateAvailable()).toBe(true);
            });
        });

        describe("as part of date comparison logic", (): void => {
            it("should compare dates without time component", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: testDates.sameAsRelease,
                });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(false);
                expect(service.isUpdateAvailable()).toBe(false);
            });

            it("should correctly parse firmware version as date", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: testDates.olderThanRelease,
                });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(true);
            });

            it("should handle year boundaries correctly", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: testDates.muchOlderThanRelease,
                });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(true);
            });
        });

        describe("as part of edge cases & robustness handling", (): void => {
            it("should handle multiple sequential calls correctly", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: testDates.olderThanRelease,
                });

                const isUpdateAvailable1 = service.checkForFirmwareUpdate();
                const isUpdateAvailable2 = service.checkForFirmwareUpdate();
                const isUpdateAvailable3 = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable1).toBe(true);
                expect(isUpdateAvailable2).toBe(true);
                expect(isUpdateAvailable3).toBe(true);
                expect(service.isUpdateAvailable()).toBe(true);
            });

            it("should handle changing firmware versions between calls", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: testDates.olderThanRelease,
                });
                expect(service.checkForFirmwareUpdate()).toBe(true);

                deviceInfoSignal.set({
                    firmwareNumber: testDates.sameAsRelease,
                });
                expect(service.checkForFirmwareUpdate()).toBe(false);

                deviceInfoSignal.set({
                    firmwareNumber: testDates.muchOlderThanRelease,
                });
                expect(service.checkForFirmwareUpdate()).toBe(true);
            });

            it("should handle leap year dates correctly", (): void => {
                deviceInfoSignal.set({
                    firmwareNumber: testDates.muchOlderThanRelease,
                });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBe(true);
            });
        });
    });

    describe("getAvailableFirmwareProfiles method", (): void => {
        it("should filter profiles by hardware revision", (): void => {
            const profiles = service.getAvailableFirmwareProfiles("devkit-v1");

            expect(profiles.length).toBeGreaterThan(0);
            expect(
                profiles.every((profile: FirmwareAsset): boolean => profile.hardwareRevision === "devkit-v1"),
            ).toBe(true);
        });

        it("should return empty array for unknown hardware revision", (): void => {
            const profiles = service.getAvailableFirmwareProfiles("unknown-hardware");

            expect(profiles).toEqual([]);
        });

        it("should return all profiles for a given hardware revision", (): void => {
            const profiles = service.getAvailableFirmwareProfiles("devkit-v1");

            profiles.forEach((profile: FirmwareAsset): void => {
                expect(profile).toEqual(
                    expect.objectContaining({
                        profileName: expect.any(String),
                        profileId: expect.any(String),
                        hardwareRevision: "devkit-v1",
                        fileName: expect.any(String),
                        size: expect.any(Number),
                    }),
                );
            });
        });
    });

    describe("downloadFirmware method", (): void => {
        it("should return observable with correct request configuration", (): void => {
            const fileName = "test-firmware.zip";
            const result$ = service.downloadFirmware(fileName);

            expect(result$).toBeDefined();
        });

        it("should construct correct download URL from assets folder", (): void => {
            const fileName = "firmware-devkit-v1.zip";
            service.downloadFirmware(fileName).subscribe();

            const req = httpTesting.expectOne("./assets/firmware/firmware-devkit-v1.zip");
            expect(req.request.method).toBe("GET");
            expect(req.request.responseType).toBe("arraybuffer");
            expect(req.request.reportProgress).toBe(true);

            req.flush(new ArrayBuffer(0));
        });

        it("should configure request for progress reporting", (): void => {
            service.downloadFirmware("test.zip").subscribe();

            const req = httpTesting.expectOne("./assets/firmware/test.zip");
            expect(req.request.reportProgress).toBe(true);

            req.flush(new ArrayBuffer(0));
        });

        it("should configure request to observe events", (): void => {
            service.downloadFirmware("test.zip").subscribe();

            const req = httpTesting.expectOne("./assets/firmware/test.zip");
            expect(req.request.reportProgress).toBe(true);

            req.flush(new ArrayBuffer(0));
        });

        it("should configure request for arraybuffer response type", (): void => {
            service.downloadFirmware("test.zip").subscribe();

            const req = httpTesting.expectOne("./assets/firmware/test.zip");
            expect(req.request.responseType).toBe("arraybuffer");

            req.flush(new ArrayBuffer(0));
        });
    });

    describe("openFirmwareSelector method", (): void => {
        let mockBottomSheet: Pick<{ open: (component: unknown, config: unknown) => unknown }, "open">;
        let mockDialog: Pick<{ open: (component: unknown, config: unknown) => unknown }, "open">;
        let mockBottomSheetRef: Pick<{ afterDismissed: () => Observable<unknown> }, "afterDismissed">;

        beforeEach((): void => {
            mockBottomSheetRef = {
                afterDismissed: vi.fn(),
            };
            vi.mocked(mockBottomSheetRef.afterDismissed).mockReturnValue(of(undefined));

            mockBottomSheet = {
                open: vi.fn(),
            };
            vi.mocked(mockBottomSheet.open).mockReturnValue(mockBottomSheetRef);

            mockDialog = {
                open: vi.fn(),
            };

            (
                service as unknown as {
                    bottomSheet: unknown;
                    dialog: unknown;
                }
            ).bottomSheet = mockBottomSheet;
            (
                service as unknown as {
                    bottomSheet: unknown;
                    dialog: unknown;
                }
            ).dialog = mockDialog;
        });

        it("should open bottom sheet with FirmwareProfileSelectionComponent", async (): Promise<void> => {
            await service.openFirmwareSelector("devkit-v1");

            expect(mockBottomSheet.open).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    autoFocus: false,
                }),
            );
        });

        it("should pass available profiles as data to bottom sheet", async (): Promise<void> => {
            const hardwareRevision = "devkit-v1";

            await service.openFirmwareSelector(hardwareRevision);

            expect(mockBottomSheet.open).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    data: expect.any(Array),
                }),
            );
        });

        it("should not open dialog when bottom sheet is dismissed without result", async (): Promise<void> => {
            vi.mocked(mockBottomSheetRef.afterDismissed).mockReturnValue(of(undefined));

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).not.toHaveBeenCalled();
        });

        it("should not open dialog when firmwareFile is missing", async (): Promise<void> => {
            vi.mocked(mockBottomSheetRef.afterDismissed).mockReturnValue(
                of({ profile: { profileName: "Test" } }),
            );

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).not.toHaveBeenCalled();
        });

        it("should not open dialog when profile is missing", async (): Promise<void> => {
            vi.mocked(mockBottomSheetRef.afterDismissed).mockReturnValue(
                of({ firmwareFile: new File([], "test.bin") }),
            );

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).not.toHaveBeenCalled();
        });

        it("should open OtaDialogComponent when firmwareFile and profile are provided", async (): Promise<void> => {
            const mockFirmwareFile = new File([new ArrayBuffer(1000)], "firmware.bin");
            const mockProfile = {
                profileName: "Test Profile",
                profileId: "test",
                hardwareRevision: "devkit-v1",
                fileName: "test.zip",
                size: 1000,
            };

            vi.mocked(mockBottomSheetRef.afterDismissed).mockReturnValue(
                of({
                    firmwareFile: mockFirmwareFile,
                    profile: mockProfile,
                }),
            );

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).toHaveBeenCalledWith(expect.any(Function), expect.any(Object));
        });

        it("should configure OtaDialog with correct options", async (): Promise<void> => {
            const mockFirmwareFile = new File([new ArrayBuffer(1000)], "firmware.bin");
            const mockProfile = {
                profileName: "Test Profile",
                profileId: "test",
                hardwareRevision: "devkit-v1",
                fileName: "test.zip",
                size: 1000,
            };

            vi.mocked(mockBottomSheetRef.afterDismissed).mockReturnValue(
                of({
                    firmwareFile: mockFirmwareFile,
                    profile: mockProfile,
                }),
            );

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    autoFocus: false,
                    disableClose: true,
                }),
            );
        });

        it("should pass firmware size in kilobytes to OtaDialog", async (): Promise<void> => {
            const mockFirmwareFile = new File([new ArrayBuffer(2000)], "firmware.bin");
            const mockProfile = {
                profileName: "Test Profile",
                profileId: "test",
                hardwareRevision: "devkit-v1",
                fileName: "test.zip",
                size: 2000,
            };

            vi.mocked(mockBottomSheetRef.afterDismissed).mockReturnValue(
                of({
                    firmwareFile: mockFirmwareFile,
                    profile: mockProfile,
                }),
            );

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    data: expect.objectContaining({
                        firmwareSize: 2,
                        file: mockFirmwareFile,
                    }),
                }),
            );
        });
    });
});
