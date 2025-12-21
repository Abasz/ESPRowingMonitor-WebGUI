import { Buffer } from "buffer";
import { promises } from "fs";
import process from "node:process";
import { tmpdir } from "os";
import { join } from "path";

import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

import type { GitHubRelease } from "./auto-version";
import * as autoVersion from "./auto-version";

type FetchSpy = Mock;

describe("auto-version", (): void => {
    let fetchSpy: FetchSpy;

    beforeEach((): void => {
        fetchSpy = vi.spyOn(globalThis, "fetch");
    });

    const releaseBase: GitHubRelease = {
        tag_name: "v1.0.0",
        name: "Release v1.0.0",
        published_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
        assets: [],
    };

    beforeEach((): void => {
        vi.spyOn(console, "log").mockImplementation((): void => {
            /* no-op*/
        });
        vi.spyOn(console, "warn").mockImplementation((): void => {
            /* no-op*/
        });
        vi.spyOn(console, "error").mockImplementation((): void => {
            /* no-op*/
        });
    });

    describe("formatProfileName", (): void => {
        it("should convert camelCase to title case with spaces", (): void => {
            const result = autoVersion.formatProfileName("conceptTwoProfile");
            expect(result).toBe("Concept Two Profile");
        });

        it("should capitalize lowercase names", (): void => {
            const result = autoVersion.formatProfileName("standard");
            expect(result).toBe("Standard");
        });

        it("should insert spaces between digits and capital letters", (): void => {
            const result = autoVersion.formatProfileName("concept2ModelD");
            expect(result).toBe("Concept2 Model D");
        });

        it("should preserve existing separators", (): void => {
            const result = autoVersion.formatProfileName("profile-number2");
            expect(result).toBe("Profile-number2");
        });
    });

    describe("extractFirmwareAssets", (): void => {
        it("should extract firmware assets and format names", (): void => {
            const release: GitHubRelease = {
                ...releaseBase,
                assets: [
                    {
                        name: "firmware-concept2ModelD.zip",
                        browser_download_url: "https://example.com/concept2ModelD",
                        size: 1024,
                        content_type: "application/zip",
                    },
                    {
                        name: "firmware-waterRower-hw2.zip",
                        browser_download_url: "https://example.com/waterRower",
                        size: 2048,
                        content_type: "application/zip",
                    },
                    {
                        name: "notes.txt",
                        browser_download_url: "https://example.com/notes",
                        size: 128,
                        content_type: "text/plain",
                    },
                ],
            };

            const assets = autoVersion.extractFirmwareAssets(release);

            expect(assets).toEqual([
                {
                    profileName: "Concept2 Model D",
                    profileId: "concept2ModelD",
                    hardwareRevision: undefined,
                    fileName: "firmware-concept2ModelD.zip",
                    size: 1024,
                },
                {
                    profileName: "Water Rower",
                    profileId: "waterRower",
                    hardwareRevision: "hw2",
                    fileName: "firmware-waterRower-hw2.zip",
                    size: 2048,
                },
            ]);
        });
    });

    describe("fetchLatestRelease", (): void => {
        it("should fetch the latest release data", async (): Promise<void> => {
            const release: GitHubRelease = {
                ...releaseBase,
                assets: [],
            };

            const response = {
                ok: true,
                status: 200,
                statusText: "OK",
                json: async (): Promise<GitHubRelease> => release,
            } as Response;

            fetchSpy.mockResolvedValue(response);

            const result = await autoVersion.fetchLatestRelease();

            expect(fetchSpy).toHaveBeenCalledWith(
                "https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest",
            );
            expect(result).toEqual(release);
        });

        it("should throw an error when the fetch fails", async (): Promise<void> => {
            const response = {
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
                json: async (): Promise<unknown> => null,
            } as Response;

            fetchSpy.mockResolvedValue(response);

            await expect(autoVersion.fetchLatestRelease()).rejects.toThrowError(
                "Failed to fetch release: 500 Internal Server Error",
            );
        });
    });

    describe("downloadAsset", (): void => {
        it("should download and write an asset to disk", async (): Promise<void> => {
            const tempDir = await promises.mkdtemp(join(tmpdir(), "auto-version-"));
            const outputPath = join(tempDir, "firmware.zip");
            const payload = new TextEncoder().encode("firmware-data");

            const response = {
                ok: true,
                status: 200,
                statusText: "OK",
                body: {},
                arrayBuffer: async (): Promise<ArrayBuffer> => payload.buffer,
            } as Response;

            fetchSpy.mockResolvedValue(response);

            await autoVersion.downloadAsset("https://example.com/firmware.zip", outputPath);

            const fileContents = await promises.readFile(outputPath);
            expect(Buffer.from(fileContents).equals(Buffer.from(payload))).toBe(true);

            await promises.rm(tempDir, { recursive: true, force: true });
        });

        it("should throw an error when the download fails", async (): Promise<void> => {
            const response = {
                ok: false,
                status: 404,
                statusText: "Not Found",
                body: {},
                arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
            } as Response;

            fetchSpy.mockResolvedValue(response);

            await expect(
                autoVersion.downloadAsset("https://example.com/missing.zip", "./missing.zip"),
            ).rejects.toThrowError("Failed to download https://example.com/missing.zip: 404 Not Found");
        });
    });

    describe("main", (): void => {
        it("should create directories, download assets, and write version data", async (): Promise<void> => {
            const release: GitHubRelease = {
                ...releaseBase,
                assets: [
                    {
                        name: "firmware-concept2ModelD.zip",
                        browser_download_url: "https://example.com/concept2ModelD.zip",
                        size: 1234,
                        content_type: "application/zip",
                    },
                ],
            };

            const fetchLatestReleaseSpy = vi.fn().mockResolvedValue(release);
            const downloadSpy = vi.fn().mockResolvedValue(undefined);
            const mkdirSpy = vi.fn().mockResolvedValue(undefined);
            const writeFileSpy = vi.fn().mockResolvedValue(undefined);

            await autoVersion.main({
                fetchLatestRelease: fetchLatestReleaseSpy,
                downloadAsset: downloadSpy,
                mkdir: mkdirSpy,
                writeFile: writeFileSpy,
            });

            expect(mkdirSpy).toHaveBeenCalledWith("./src/assets/firmware", { recursive: true });
            expect(fetchLatestReleaseSpy).toHaveBeenCalled();
            expect(downloadSpy).toHaveBeenCalledWith(
                "https://example.com/concept2ModelD.zip",
                "./src/assets/firmware/firmware-concept2ModelD.zip",
            );
            expect(writeFileSpy).toHaveBeenCalledTimes(1);
            const writeArgs = vi.mocked(writeFileSpy).mock.lastCall as [string, string, string];
            expect(writeArgs[0]).toBe("./src/common/data/version.ts");
            expect(writeArgs[1] as string).toContain("version: 'v1.0.0'");
            expect(writeArgs[1] as string).toContain("firmware-concept2ModelD.zip");
            expect(writeArgs[2]).toBe("utf-8");
        });

        it("should log errors and exit the process on failure", async (): Promise<void> => {
            const failure = new Error("network down");
            const fetchLatestReleaseSpy = vi.fn().mockRejectedValue(failure);
            const exitSpy = vi
                .spyOn(process, "exit")
                .mockImplementation((code?: string | number | null): never => {
                    throw new Error(`exit-${code}`);
                });

            await expect(
                autoVersion.main({ fetchLatestRelease: fetchLatestReleaseSpy }),
            ).rejects.toThrowError("exit-1");

            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });
});
