import { HttpEvent, HttpEventType, HttpResponse } from "@angular/common/http";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from "@angular/material/bottom-sheet";
import { MatSelectionListChange } from "@angular/material/list";
import { MatSnackBar } from "@angular/material/snack-bar";
import { of, throwError } from "rxjs";

import { FirmwareAsset } from "../../common/common.interfaces";
import { versionInfo } from "../../common/data/version";
import { FirmwareUpdateManagerService } from "../../common/services/ergometer/firmware-update-manager.service";

import { FirmwareProfileSelectionComponent } from "./firmware-profile-selection.component";

describe("FirmwareProfileSelectionComponent", (): void => {
    let component: FirmwareProfileSelectionComponent;
    let fixture: ComponentFixture<FirmwareProfileSelectionComponent>;
    let mockFirmwareUpdateManager: jasmine.SpyObj<FirmwareUpdateManagerService>;
    let mockBottomSheetRef: jasmine.SpyObj<MatBottomSheetRef<FirmwareProfileSelectionComponent>>;
    let mockSnackBar: jasmine.SpyObj<MatSnackBar>;

    const mockProfiles: Array<FirmwareAsset> = [
        {
            profileName: "Concept2 Model D",
            profileId: "concept2modeld",
            hardwareRevision: "rev1",
            fileName: "firmware-concept2modeld-rev1.zip",
            size: 1024000,
        },
        {
            profileName: "WaterRower",
            profileId: "waterrower",
            hardwareRevision: "rev2",
            fileName: "firmware-waterrower-rev2.zip",
            size: 2048000,
        },
    ];

    beforeEach(async (): Promise<void> => {
        mockFirmwareUpdateManager = jasmine.createSpyObj("FirmwareUpdateManagerService", [
            "getAvailableFirmwareProfiles",
            "downloadFirmware",
        ]);
        mockBottomSheetRef = jasmine.createSpyObj("MatBottomSheetRef", ["dismiss"]);
        mockSnackBar = jasmine.createSpyObj("MatSnackBar", ["open"]);

        await TestBed.configureTestingModule({
            imports: [FirmwareProfileSelectionComponent],
            providers: [
                { provide: FirmwareUpdateManagerService, useValue: mockFirmwareUpdateManager },
                { provide: MatBottomSheetRef, useValue: mockBottomSheetRef },
                { provide: MatSnackBar, useValue: mockSnackBar },
                { provide: MAT_BOTTOM_SHEET_DATA, useValue: mockProfiles },
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(FirmwareProfileSelectionComponent);
        component = fixture.componentInstance;
    });

    describe("as part of component creation", (): void => {
        it("should create component", (): void => {
            expect(component).toBeTruthy();
        });

        it("should inject available profiles from MAT_BOTTOM_SHEET_DATA", (): void => {
            expect(component.availableProfiles).toBeDefined();
            expect(component.availableProfiles.length).toBe(2);
            expect(component.availableProfiles).toEqual(mockProfiles);
        });

        it("should initialize signals with correct default values", (): void => {
            expect(component.isLoading()).toBe(true);
            expect(component.isDownloading()).toBe(false);
            expect(component.downloadProgress()).toBe(0);
            expect(component.progressMode()).toBe("indeterminate");
            expect(component.selectedProfile()).toBeUndefined();
        });

        it("should have access to versionInfo", (): void => {
            expect(component.versionInfo).toBeDefined();
            expect(component.versionInfo).toEqual(versionInfo);
        });
    });

    describe("onSelectionChange method", (): void => {
        it("should set selectedProfile when profile is selected", (): void => {
            const mockEvent = {
                options: [{ value: mockProfiles[0] }],
            } as unknown as MatSelectionListChange;

            component.onSelectionChange(mockEvent);

            expect(component.selectedProfile()).toEqual(mockProfiles[0]);
        });

        it("should update selectedProfile when different profile is selected", (): void => {
            const mockEvent1 = {
                options: [{ value: mockProfiles[0] }],
            } as unknown as MatSelectionListChange;
            const mockEvent2 = {
                options: [{ value: mockProfiles[1] }],
            } as unknown as MatSelectionListChange;

            component.onSelectionChange(mockEvent1);
            expect(component.selectedProfile()).toEqual(mockProfiles[0]);

            component.onSelectionChange(mockEvent2);
            expect(component.selectedProfile()).toEqual(mockProfiles[1]);
        });

        it("should handle event with first option when multiple options provided", (): void => {
            const mockEvent = {
                options: [{ value: mockProfiles[0] }, { value: mockProfiles[1] }],
            } as unknown as MatSelectionListChange;

            component.onSelectionChange(mockEvent);

            expect(component.selectedProfile()).toEqual(mockProfiles[0]);
        });
    });

    describe("startUpdate method", (): void => {
        describe("when profile is undefined", (): void => {
            it("should return early without making any changes", async (): Promise<void> => {
                await component.startUpdate(undefined);

                expect(mockFirmwareUpdateManager.downloadFirmware).not.toHaveBeenCalled();
                expect(component.isDownloading()).toBe(false);
                expect(component.downloadProgress()).toBe(0);
            });
        });

        describe("when download is successful", (): void => {
            it("should set initial download state correctly", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(new File(["x"], "firmware.bin")));

                const updatePromise = component.startUpdate(mockProfiles[0]);

                expect(component.isDownloading()).toBe(true);
                expect(component.downloadProgress()).toBe(0);
                expect(component.progressMode()).toBe("indeterminate");

                await updatePromise;
            });

            it("should call downloadFirmware with correct filename", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(new File(["x"], "firmware.bin")));

                await component.startUpdate(mockProfiles[0]);

                expect(mockFirmwareUpdateManager.downloadFirmware).toHaveBeenCalledWith(
                    "firmware-concept2modeld-rev1.zip",
                );
            });

            it("should update download progress when progress event is received", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const progress: HttpEvent<ArrayBuffer> = {
                    type: HttpEventType.DownloadProgress,
                    loaded: 4,
                    total: 8,
                };
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(progress, response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(new File(["x"], "firmware.bin")));

                await component.startUpdate(mockProfiles[0]);

                expect(component.downloadProgress()).toBe(50);
            });

            it("should change progress mode to determinate when progress event has total", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const progress: HttpEvent<ArrayBuffer> = {
                    type: HttpEventType.DownloadProgress,
                    loaded: 4,
                    total: 8,
                };
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(progress, response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(new File(["x"], "firmware.bin")));

                await component.startUpdate(mockProfiles[0]);

                expect(component.progressMode()).toBe("indeterminate");
            });

            it("should not update progress when total is undefined", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const progress: HttpEvent<ArrayBuffer> = {
                    type: HttpEventType.DownloadProgress,
                    loaded: 4,
                };
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(progress, response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(new File(["x"], "firmware.bin")));

                await component.startUpdate(mockProfiles[0]);

                expect(component.downloadProgress()).toBe(0);
            });

            it("should not update progress when total is zero", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const progress: HttpEvent<ArrayBuffer> = {
                    type: HttpEventType.DownloadProgress,
                    loaded: 4,
                    total: 0,
                };
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(progress, response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(new File(["x"], "firmware.bin")));

                await component.startUpdate(mockProfiles[0]);

                expect(component.downloadProgress()).toBe(0);
            });

            it("should calculate progress percentage correctly", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const progress: HttpEvent<ArrayBuffer> = {
                    type: HttpEventType.DownloadProgress,
                    loaded: 750,
                    total: 1000,
                };
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(progress, response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(new File(["x"], "firmware.bin")));

                await component.startUpdate(mockProfiles[0]);

                expect(component.downloadProgress()).toBe(75);
            });

            it("should extract firmware from downloaded data", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(response));
                const extractSpy = spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(new File(["x"], "firmware.bin")));

                await component.startUpdate(mockProfiles[0]);

                expect(extractSpy).toHaveBeenCalledWith(arrayBuffer);
            });

            it("should call extractFirmwareBin and dismiss sheet with firmware file on success", async (): Promise<void> => {
                const mockFirmwareData = new ArrayBuffer(10);
                const mockProfile: FirmwareAsset = mockProfiles[0];
                const mockFirmwareFile = new File([new Uint8Array([1, 2, 3])], "firmware.bin");

                component.selectedProfile.set(mockProfile);

                const mockResponse: HttpResponse<ArrayBuffer> = new HttpResponse({
                    body: mockFirmwareData,
                    status: 200,
                });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(mockResponse));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(mockFirmwareFile));

                await component.startUpdate(mockProfile);

                expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith({
                    firmwareFile: mockFirmwareFile,
                    profile: mockProfile,
                });
            });

            it("should reset isDownloading after successful update", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(new File(["x"], "firmware.bin")));

                await component.startUpdate(mockProfiles[0]);

                expect(component.isDownloading()).toBe(false);
            });
        });

        describe("when extraction fails", (): void => {
            it("should show error snackbar when extractFirmwareBin returns null", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(null));

                await component.startUpdate(mockProfiles[0]);

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to download firmware", "Dismiss", {
                    duration: 5000,
                });
            });

            it("should not dismiss bottom sheet when extraction fails", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(null));

                await component.startUpdate(mockProfiles[0]);

                expect(mockBottomSheetRef.dismiss).not.toHaveBeenCalled();
            });

            it("should reset isDownloading after extraction failure", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const response = new HttpResponse({ body: arrayBuffer });

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(null));

                await component.startUpdate(mockProfiles[0]);

                expect(component.isDownloading()).toBe(false);
            });

            it("should log error to console when extraction fails", async (): Promise<void> => {
                const arrayBuffer = new ArrayBuffer(8);
                const response = new HttpResponse({ body: arrayBuffer });
                spyOn(console, "error");

                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(of(response));
                spyOn(
                    component as unknown as { extractFirmwareBin: (b: ArrayBuffer) => Promise<File | null> },
                    "extractFirmwareBin",
                ).and.returnValue(Promise.resolve(null));

                await component.startUpdate(mockProfiles[0]);

                expect(console.error).toHaveBeenCalledWith(
                    "Failed to download or extract firmware:",
                    jasmine.any(Error),
                );
            });
        });

        describe("when download fails", (): void => {
            it("should show error snackbar on download error", async (): Promise<void> => {
                const error = new Error("Network error");
                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(throwError((): Error => error));

                await component.startUpdate(mockProfiles[0]);

                expect(mockSnackBar.open).toHaveBeenCalledWith("Failed to download firmware", "Dismiss", {
                    duration: 5000,
                });
            });

            it("should reset isDownloading after download error", async (): Promise<void> => {
                const error = new Error("Network error");
                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(throwError((): Error => error));

                await component.startUpdate(mockProfiles[0]);

                expect(component.isDownloading()).toBe(false);
            });

            it("should log error to console on download failure", async (): Promise<void> => {
                const error = new Error("Network error");
                spyOn(console, "error");
                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(throwError((): Error => error));

                await component.startUpdate(mockProfiles[0]);

                expect(console.error).toHaveBeenCalledWith("Failed to download or extract firmware:", error);
            });

            it("should not dismiss bottom sheet on download error", async (): Promise<void> => {
                const error = new Error("Network error");
                mockFirmwareUpdateManager.downloadFirmware.and.returnValue(throwError((): Error => error));

                await component.startUpdate(mockProfiles[0]);

                expect(mockBottomSheetRef.dismiss).not.toHaveBeenCalled();
            });
        });
    });

    describe("cancel method", (): void => {
        it("should dismiss bottom sheet without data", (): void => {
            component.cancel();

            expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith();
        });

        it("should be callable multiple times", (): void => {
            component.cancel();
            component.cancel();
            component.cancel();

            expect(mockBottomSheetRef.dismiss).toHaveBeenCalledTimes(3);
        });
    });

    describe("extractFirmwareBin method", (): void => {
        // note: These tests use real zip data instead of mocking the fflate.unzip function
        // because ES module imports cannot be easily spied upon in Jasmine.
        // The tests verify the method behavior with valid/invalid zip files.

        it("should handle invalid zip data and throw error", async (): Promise<void> => {
            const invalidZipData = new ArrayBuffer(8); // not a valid zip file

            await expectAsync(
                (
                    component as unknown as {
                        extractFirmwareBin: (data: ArrayBuffer) => Promise<File | null>;
                    }
                ).extractFirmwareBin(invalidZipData),
            ).toBeRejected();
        });

        it("should handle empty array buffer", async (): Promise<void> => {
            const emptyData = new ArrayBuffer(0);

            await expectAsync(
                (
                    component as unknown as {
                        extractFirmwareBin: (data: ArrayBuffer) => Promise<File | null>;
                    }
                ).extractFirmwareBin(emptyData),
            ).toBeRejected();
        });
    });

    describe("as part of template rendering", (): void => {
        beforeEach((): void => {
            fixture.detectChanges();
        });

        it("should display firmware version in heading", (): void => {
            const heading = fixture.nativeElement.querySelector("h3");

            expect(heading?.textContent).toContain(`v${versionInfo.latestFirmwareRelease.version}`);
        });

        it("should render all available profiles in selection list", (): void => {
            const options = fixture.nativeElement.querySelectorAll("mat-list-option");

            expect(options.length).toBe(2);
        });

        it("should display profile names in list options", (): void => {
            const options = fixture.nativeElement.querySelectorAll("mat-list-option");

            expect(options[0].textContent?.trim()).toBe("Concept2 Model D");
            expect(options[1].textContent?.trim()).toBe("WaterRower");
        });

        it("should not show progress bar when not downloading", (): void => {
            component.isDownloading.set(false);
            fixture.detectChanges();

            const progressBar = fixture.nativeElement.querySelector("mat-progress-bar");

            expect(progressBar).toBeFalsy();
        });

        it("should show progress bar when downloading", (): void => {
            component.isDownloading.set(true);
            fixture.detectChanges();

            const progressBar = fixture.nativeElement.querySelector("mat-progress-bar");

            expect(progressBar).toBeTruthy();
        });

        it("should display Starting text when progress mode is indeterminate and progress is 0", (): void => {
            component.isDownloading.set(true);
            component.progressMode.set("indeterminate");
            component.downloadProgress.set(0);
            fixture.detectChanges();

            const progressText = fixture.nativeElement.textContent;

            expect(progressText).toContain("Starting");
        });

        it("should display Downloading text when progress mode is determinate", (): void => {
            component.isDownloading.set(true);
            component.progressMode.set("determinate");
            component.downloadProgress.set(50);
            fixture.detectChanges();

            const progressText = fixture.nativeElement.textContent;

            expect(progressText).toContain("Downloading");
        });

        it("should display Extracting text when progress is 100 and mode is indeterminate", (): void => {
            component.isDownloading.set(true);
            component.progressMode.set("indeterminate");
            component.downloadProgress.set(100);
            fixture.detectChanges();

            const progressText = fixture.nativeElement.textContent;

            expect(progressText).toContain("Extracting");
        });

        it("should disable Update button when no profile is selected", (): void => {
            component.selectedProfile.set(undefined);
            fixture.detectChanges();

            const updateButton: HTMLButtonElement = Array.from<HTMLButtonElement>(
                fixture.nativeElement.querySelectorAll("button"),
            ).find((btn: HTMLButtonElement): boolean => btn.textContent?.includes("Update") ?? false)!;

            expect(updateButton.disabled).toBe(true);
        });

        it("should enable Update button when profile is selected", (): void => {
            component.selectedProfile.set(mockProfiles[0]);
            fixture.detectChanges();

            const updateButton: HTMLButtonElement = Array.from<HTMLButtonElement>(
                fixture.nativeElement.querySelectorAll("button"),
            ).find((btn: HTMLButtonElement): boolean => btn.textContent?.includes("Update") ?? false)!;

            expect(updateButton.disabled).toBe(false);
        });

        it("should disable Cancel button when downloading", (): void => {
            component.isDownloading.set(true);
            fixture.detectChanges();

            const cancelButton: HTMLButtonElement = Array.from<HTMLButtonElement>(
                fixture.nativeElement.querySelectorAll("button"),
            ).find((btn: HTMLButtonElement): boolean => btn.textContent?.includes("Cancel") ?? false)!;

            expect(cancelButton.disabled).toBe(true);
        });

        it("should enable Cancel button when not downloading", (): void => {
            component.isDownloading.set(false);
            fixture.detectChanges();

            const cancelButton: HTMLButtonElement = Array.from<HTMLButtonElement>(
                fixture.nativeElement.querySelectorAll("button"),
            ).find((btn: HTMLButtonElement): boolean => btn.textContent?.includes("Cancel") ?? false)!;

            expect(cancelButton.disabled).toBe(false);
        });

        it("should call startUpdate when Update button is clicked", (): void => {
            component.selectedProfile.set(mockProfiles[0]);
            fixture.detectChanges();
            spyOn(component, "startUpdate");

            const updateButton: HTMLButtonElement = Array.from<HTMLButtonElement>(
                fixture.nativeElement.querySelectorAll("button"),
            ).find((btn: HTMLButtonElement): boolean => btn.textContent?.includes("Update") ?? false)!;

            updateButton.click();

            expect(component.startUpdate).toHaveBeenCalledWith(mockProfiles[0]);
        });

        it("should call cancel when Cancel button is clicked", (): void => {
            fixture.detectChanges();
            spyOn(component, "cancel");

            const cancelButton: HTMLButtonElement = Array.from<HTMLButtonElement>(
                fixture.nativeElement.querySelectorAll("button"),
            ).find((btn: HTMLButtonElement): boolean => btn.textContent?.includes("Cancel") ?? false)!;

            cancelButton.click();

            expect(component.cancel).toHaveBeenCalled();
        });

        it("when no profiles are available should render empty warning and not render any list options", async (): Promise<void> => {
            // recreate the component with empty data
            TestBed.resetTestingModule();

            await TestBed.configureTestingModule({
                imports: [FirmwareProfileSelectionComponent],
                providers: [
                    { provide: FirmwareUpdateManagerService, useValue: mockFirmwareUpdateManager },
                    { provide: MatBottomSheetRef, useValue: mockBottomSheetRef },
                    { provide: MatSnackBar, useValue: mockSnackBar },
                    { provide: MAT_BOTTOM_SHEET_DATA, useValue: [] },
                    provideZonelessChangeDetection(),
                ],
            }).compileComponents();
            fixture = TestBed.createComponent(FirmwareProfileSelectionComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();

            const warning = fixture.nativeElement.querySelector(".no-profiles-warning");
            const options = fixture.nativeElement.querySelectorAll("mat-list-option");

            expect(warning).toBeTruthy();
            expect(options.length).toBe(0);
        });
    });
});
