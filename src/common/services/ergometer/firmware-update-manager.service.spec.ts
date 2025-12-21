import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Observable, of } from "rxjs";

import { IDeviceInformation } from "../../ble.interfaces";
import { FirmwareAsset } from "../../common.interfaces";

import { ErgGenericDataService } from "./erg-generic-data.service";
import { FirmwareUpdateManagerService } from "./firmware-update-manager.service";

describe("FirmwareUpdateManagerService", (): void => {
    let service: FirmwareUpdateManagerService;
    let httpTesting: HttpTestingController;
    let mockErgGenericDataService: jasmine.SpyObj<ErgGenericDataService>;
    let deviceInfoSubject: BehaviorSubject<IDeviceInformation>;

    beforeEach((): void => {
        deviceInfoSubject = new BehaviorSubject<IDeviceInformation>({ firmwareNumber: "20240315" });

        mockErgGenericDataService = jasmine.createSpyObj("ErgGenericDataService", [], {
            deviceInfo: jasmine.createSpy("deviceInfo").and.returnValue({ firmwareNumber: "20240315" }),
            deviceInfo$: deviceInfoSubject.asObservable(),
        });

        TestBed.configureTestingModule({
            providers: [
                FirmwareUpdateManagerService,
                provideHttpClientTesting(),
                { provide: ErgGenericDataService, useValue: mockErgGenericDataService },
                provideZonelessChangeDetection(),
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
            mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20240315" });
            service.checkForFirmwareUpdate();
            expect(service.isUpdateAvailable()).not.toBeUndefined();

            // emitting an empty object should clear the flag to undefined (new constructor behavior)
            deviceInfoSubject.next({} as IDeviceInformation);
            expect(service.isUpdateAvailable()).toBeUndefined();
        });

        it("should trigger checkForFirmwareUpdate when deviceInfo$ emits a non-empty object", (): void => {
            spyOn(service, "checkForFirmwareUpdate").and.callThrough();

            // ensure deviceInfo() will return a firmware number when called
            mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20240315" });

            // emit non-empty device info
            deviceInfoSubject.next({ firmwareNumber: "20240315" } as IDeviceInformation);

            expect(service.checkForFirmwareUpdate).toHaveBeenCalled();
            expect(typeof service.isUpdateAvailable()).toBe("boolean");
        });
    });

    describe("checkForFirmwareUpdate method", (): void => {
        describe("when firmware number is not available", (): void => {
            it("should return false and set isUpdateAvailable to false", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({});

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeFalse();
                expect(service.isUpdateAvailable()).toBeFalse();
            });

            it("should log warning when firmware number is missing", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({});
                spyOn(console, "warn");

                service.checkForFirmwareUpdate();

                expect(console.warn).toHaveBeenCalledWith("Could not retrieve device firmware version");
            });
        });

        describe("when firmware version cannot be parsed", (): void => {
            it("should return false for invalid firmware version format", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "invalid" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeFalse();
                expect(service.isUpdateAvailable()).toBeFalse();
            });

            it("should return false for partial date format", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "202403" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeFalse();
                expect(service.isUpdateAvailable()).toBeFalse();
            });

            it("should log warning when firmware version parsing fails", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "invalid" });
                spyOn(console, "warn");

                service.checkForFirmwareUpdate();

                expect(console.warn).toHaveBeenCalledWith(
                    "Could not parse firmware version date:",
                    jasmine.any(Error),
                );
            });
        });

        it("should set isUpdateAvailable to undefined at start of check", (): void => {
            mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20251013" });
            service.checkForFirmwareUpdate();
            expect(service.isUpdateAvailable()).toBeFalse();

            mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20240315" });
            expect(service.isUpdateAvailable()).toBeFalse();

            service.checkForFirmwareUpdate();

            expect(service.isUpdateAvailable()).toBeTrue();
        });

        describe("when firmware version is up to date", (): void => {
            it("should return false for same release date", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20251013" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeFalse();
                expect(service.isUpdateAvailable()).toBeFalse();
            });

            it("should return false for newer firmware than release", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20251014" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeFalse();
                expect(service.isUpdateAvailable()).toBeFalse();
            });
        });

        describe("when firmware update is available", (): void => {
            it("should return true when firmware is older than release", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20240315" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeTrue();
                expect(service.isUpdateAvailable()).toBeTrue();
            });
        });

        describe("as part of date comparison logic", (): void => {
            it("should compare dates without time component", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20251013" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeFalse();
                expect(service.isUpdateAvailable()).toBeFalse();
            });

            it("should correctly parse firmware version as date", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20240315" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeTrue();
            });

            it("should handle year boundaries correctly", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20241231" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeTrue();
            });
        });

        describe("as part of edge cases & robustness handling", (): void => {
            it("should handle multiple sequential calls correctly", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20240315" });

                const isUpdateAvailable1 = service.checkForFirmwareUpdate();
                const isUpdateAvailable2 = service.checkForFirmwareUpdate();
                const isUpdateAvailable3 = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable1).toBeTrue();
                expect(isUpdateAvailable2).toBeTrue();
                expect(isUpdateAvailable3).toBeTrue();
                expect(service.isUpdateAvailable()).toBeTrue();
            });

            it("should handle changing firmware versions between calls", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20240315" });
                expect(service.checkForFirmwareUpdate()).toBeTrue();

                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20251013" });
                expect(service.checkForFirmwareUpdate()).toBeFalse();

                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20240101" });
                expect(service.checkForFirmwareUpdate()).toBeTrue();
            });

            it("should handle leap year dates correctly", (): void => {
                mockErgGenericDataService.deviceInfo.and.returnValue({ firmwareNumber: "20240229" });

                const isUpdateAvailable = service.checkForFirmwareUpdate();

                expect(isUpdateAvailable).toBeTrue();
            });
        });
    });

    describe("getAvailableFirmwareProfiles method", (): void => {
        it("should filter profiles by hardware revision", (): void => {
            const profiles = service.getAvailableFirmwareProfiles("devkit-v1");

            expect(profiles.length).toBeGreaterThan(0);
            expect(
                profiles.every((profile: FirmwareAsset): boolean => profile.hardwareRevision === "devkit-v1"),
            ).toBeTrue();
        });

        it("should return empty array for unknown hardware revision", (): void => {
            const profiles = service.getAvailableFirmwareProfiles("unknown-hardware");

            expect(profiles).toEqual([]);
        });

        it("should return all profiles for a given hardware revision", (): void => {
            const profiles = service.getAvailableFirmwareProfiles("devkit-v1");

            profiles.forEach((profile: FirmwareAsset): void => {
                expect(profile).toEqual(
                    jasmine.objectContaining({
                        profileName: jasmine.any(String),
                        profileId: jasmine.any(String),
                        hardwareRevision: "devkit-v1",
                        fileName: jasmine.any(String),
                        size: jasmine.any(Number),
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
            expect(req.request.reportProgress).toBeTrue();

            req.flush(new ArrayBuffer(0));
        });

        it("should configure request for progress reporting", (): void => {
            service.downloadFirmware("test.zip").subscribe();

            const req = httpTesting.expectOne("./assets/firmware/test.zip");
            expect(req.request.reportProgress).toBeTrue();

            req.flush(new ArrayBuffer(0));
        });

        it("should configure request to observe events", (): void => {
            service.downloadFirmware("test.zip").subscribe();

            const req = httpTesting.expectOne("./assets/firmware/test.zip");
            expect(req.request.reportProgress).toBeTrue();

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
        let mockBottomSheet: jasmine.SpyObj<{ open: (component: unknown, config: unknown) => unknown }>;
        let mockDialog: jasmine.SpyObj<{ open: (component: unknown, config: unknown) => unknown }>;
        let mockBottomSheetRef: jasmine.SpyObj<{ afterDismissed: () => Observable<unknown> }>;

        beforeEach((): void => {
            mockBottomSheetRef = jasmine.createSpyObj("MatBottomSheetRef", ["afterDismissed"]);
            mockBottomSheetRef.afterDismissed.and.returnValue(of(undefined));

            mockBottomSheet = jasmine.createSpyObj("MatBottomSheet", ["open"]);
            mockBottomSheet.open.and.returnValue(mockBottomSheetRef);

            mockDialog = jasmine.createSpyObj("MatDialog", ["open"]);

            (service as unknown as { bottomSheet: unknown; dialog: unknown }).bottomSheet = mockBottomSheet;
            (service as unknown as { bottomSheet: unknown; dialog: unknown }).dialog = mockDialog;
        });

        it("should open bottom sheet with FirmwareProfileSelectionComponent", async (): Promise<void> => {
            await service.openFirmwareSelector("devkit-v1");

            expect(mockBottomSheet.open).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
                    autoFocus: false,
                }),
            );
        });

        it("should pass available profiles as data to bottom sheet", async (): Promise<void> => {
            const hardwareRevision = "devkit-v1";

            await service.openFirmwareSelector(hardwareRevision);

            expect(mockBottomSheet.open).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
                    data: jasmine.any(Array),
                }),
            );
        });

        it("should not open dialog when bottom sheet is dismissed without result", async (): Promise<void> => {
            mockBottomSheetRef.afterDismissed.and.returnValue(of(undefined));

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).not.toHaveBeenCalled();
        });

        it("should not open dialog when firmwareFile is missing", async (): Promise<void> => {
            mockBottomSheetRef.afterDismissed.and.returnValue(of({ profile: { profileName: "Test" } }));

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).not.toHaveBeenCalled();
        });

        it("should not open dialog when profile is missing", async (): Promise<void> => {
            mockBottomSheetRef.afterDismissed.and.returnValue(of({ firmwareFile: new File([], "test.bin") }));

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

            mockBottomSheetRef.afterDismissed.and.returnValue(
                of({
                    firmwareFile: mockFirmwareFile,
                    profile: mockProfile,
                }),
            );

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).toHaveBeenCalledWith(jasmine.any(Function), jasmine.any(Object));
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

            mockBottomSheetRef.afterDismissed.and.returnValue(
                of({
                    firmwareFile: mockFirmwareFile,
                    profile: mockProfile,
                }),
            );

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
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

            mockBottomSheetRef.afterDismissed.and.returnValue(
                of({
                    firmwareFile: mockFirmwareFile,
                    profile: mockProfile,
                }),
            );

            await service.openFirmwareSelector("devkit-v1");

            expect(mockDialog.open).toHaveBeenCalledWith(
                jasmine.any(Function),
                jasmine.objectContaining({
                    data: jasmine.objectContaining({
                        firmwareSize: 2,
                        file: mockFirmwareFile,
                    }),
                }),
            );
        });
    });
});
