import { TestBed } from "@angular/core/testing";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { appDB } from "../utils/app-database";

import { DatabaseMigrationService } from "./database-migration.service";

const DB_NAME = "ESPRowingMonitorDB";

function createMockDialogRef(): Pick<MatDialogRef<unknown>, "close"> {
    return { close: vi.fn() };
}

describe("DatabaseMigrationService", (): void => {
    let service: DatabaseMigrationService;
    let mockDialog: Pick<MatDialog, "open">;
    let mockDialogRef: ReturnType<typeof createMockDialogRef>;
    let openSpy: Mock;

    beforeEach(async (): Promise<void> => {
        mockDialogRef = createMockDialogRef();
        mockDialog = {
            open: vi.fn().mockReturnValue(mockDialogRef),
        };

        openSpy = vi.spyOn(appDB, "open").mockResolvedValue(appDB);

        await TestBed.configureTestingModule({
            providers: [{ provide: MatDialog, useValue: mockDialog }],
        }).compileComponents();

        service = TestBed.inject(DatabaseMigrationService);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    describe("initialize method", (): void => {
        describe("when the database does not exist (fresh install)", (): void => {
            beforeEach((): void => {
                vi.spyOn(globalThis.indexedDB, "databases").mockResolvedValue([]);
            });

            it("should call appDB.open()", async (): Promise<void> => {
                await service.initialize();
                expect(openSpy).toHaveBeenCalledTimes(1);
            });

            it("should not open a dialog", async (): Promise<void> => {
                await service.initialize();
                expect(mockDialog.open).not.toHaveBeenCalled();
            });
        });

        describe("when the database is already at the current version", (): void => {
            beforeEach((): void => {
                // dexie version 4 is stored as IDB version 40
                vi.spyOn(globalThis.indexedDB, "databases").mockResolvedValue([
                    { name: DB_NAME, version: 40 },
                ]);
            });

            it("should call appDB.open()", async (): Promise<void> => {
                await service.initialize();
                expect(openSpy).toHaveBeenCalledTimes(1);
            });

            it("should not open a dialog", async (): Promise<void> => {
                await service.initialize();
                expect(mockDialog.open).not.toHaveBeenCalled();
            });
        });

        describe("when the database needs migration", (): void => {
            beforeEach((): void => {
                // dexie version 2 is stored as IDB version 20
                vi.spyOn(globalThis.indexedDB, "databases").mockResolvedValue([
                    { name: DB_NAME, version: 20 },
                ]);
            });

            it("should call appDB.open()", async (): Promise<void> => {
                await service.initialize();
                expect(openSpy).toHaveBeenCalledTimes(1);
            });

            it("should open a blocking dialog with disableClose: true", async (): Promise<void> => {
                await service.initialize();
                expect(mockDialog.open).toHaveBeenCalledTimes(1);
                const options = vi.mocked(mockDialog.open).mock.calls[0][1];
                expect(options?.disableClose).toBe(true);
            });

            it("should pass the progress signal as dialog data", async (): Promise<void> => {
                await service.initialize();
                const options = vi.mocked(mockDialog.open).mock.calls[0][1];
                expect(typeof options?.data).toBe("function");
            });

            it("should register the progress callback on appDB before opening", async (): Promise<void> => {
                const setCallbackSpy = vi.spyOn(appDB, "setUpgradeProgressCallback");

                openSpy.mockImplementation(async (): Promise<typeof appDB> => {
                    expect(setCallbackSpy).toHaveBeenCalledWith(expect.any(Function));

                    return appDB;
                });

                await service.initialize();
            });

            it("should clear the progress callback after open() resolves", async (): Promise<void> => {
                const setCallbackSpy = vi.spyOn(appDB, "setUpgradeProgressCallback");

                await service.initialize();

                // last call should clear the callback
                const lastCall = setCallbackSpy.mock.calls[setCallbackSpy.mock.calls.length - 1];
                expect(lastCall[0]).toBeUndefined();
            });

            it("should close the dialog after open() resolves", async (): Promise<void> => {
                await service.initialize();
                expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
            });

            it("should set startedAt on first processed record via the progress callback", async (): Promise<void> => {
                const setCallbackSpy = vi.spyOn(appDB, "setUpgradeProgressCallback");

                openSpy.mockImplementation(async (): Promise<typeof appDB> => {
                    const callback = setCallbackSpy.mock.calls[0][0] as (
                        processed: number,
                        total: number,
                    ) => void;

                    // first call: processed > 0 should set startedAt
                    callback(500, 1000);
                    const dialogData = vi.mocked(mockDialog.open).mock.calls[0][1]?.data as () => {
                        startedAt: number;
                    };
                    expect(dialogData().startedAt).toBeGreaterThan(0);

                    return appDB;
                });

                await service.initialize();
            });
        });

        describe("when appDB.open() rejects", (): void => {
            beforeEach((): void => {
                vi.spyOn(globalThis.indexedDB, "databases").mockResolvedValue([
                    { name: DB_NAME, version: 20 },
                ]);
                openSpy.mockRejectedValue(new Error("open failed"));
            });

            it("should still close the dialog", async (): Promise<void> => {
                await expect(service.initialize()).rejects.toThrow("open failed");
                expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
            });

            it("should still clear the progress callback", async (): Promise<void> => {
                const setCallbackSpy = vi.spyOn(appDB, "setUpgradeProgressCallback");

                await expect(service.initialize()).rejects.toThrow("open failed");

                const lastCall = setCallbackSpy.mock.calls[setCallbackSpy.mock.calls.length - 1];
                expect(lastCall[0]).toBeUndefined();
            });
        });

        describe("when indexedDB.databases() returns a DB with undefined version", (): void => {
            beforeEach((): void => {
                vi.spyOn(globalThis.indexedDB, "databases").mockResolvedValue([
                    { name: DB_NAME, version: undefined },
                ]);
            });

            it("should not open a dialog", async (): Promise<void> => {
                await service.initialize();
                expect(mockDialog.open).not.toHaveBeenCalled();
            });
        });
    });
});
