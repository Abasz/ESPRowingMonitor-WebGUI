#!/usr/bin/env node
"use strict";

import { Buffer } from "buffer";
import { createWriteStream, promises } from "fs";
import process from "node:process";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { inspect } from "util";

import { FirmwareAsset } from "../src/common/common.interfaces";

interface MainDependencyOverrides {
    fetchLatestRelease?: typeof fetchLatestRelease;
    downloadAsset?: typeof downloadAsset;
    mkdir?: typeof promises.mkdir;
    writeFile?: typeof promises.writeFile;
}

export interface GitHubAsset {
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
}

export interface GitHubRelease {
    published_at: string;
    updated_at: string;
    tag_name: string;
    name: string;
    assets: Array<GitHubAsset>;
}

export async function fetchLatestRelease(): Promise<GitHubRelease> {
    console.log("Fetching latest firmware release...");
    const response = await fetch("https://api.github.com/repos/Abasz/ESPRowingMonitor/releases/latest");

    if (!response.ok) {
        throw new Error(`Failed to fetch release: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<GitHubRelease>;
}

export async function downloadAsset(url: string, outputPath: string): Promise<void> {
    console.log(`Downloading ${url}...`);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
        throw new Error(`No response body for ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const nodeStream = Readable.from(buffer);
    const fileStream = createWriteStream(outputPath);
    await pipeline(nodeStream, fileStream);
    console.log(`Downloaded ${url} to ${outputPath}`);
}

export function formatProfileName(profileName: string): string {
    const withSpaces = profileName
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");

    return withSpaces.replace(/(^|\s)([a-z])/g, (_match: string, boundary: string, char: string): string => {
        return `${boundary}${char.toUpperCase()}`;
    });
}

export function extractFirmwareAssets(release: GitHubRelease): Array<FirmwareAsset> {
    const assets: Array<FirmwareAsset> = [];

    for (const asset of release.assets) {
        const nameMatch = /^firmware[_-]([^_-]+?)(?:-([^_]+?))?(?:_.+?)?\.zip$/i.exec(asset.name);
        if (!nameMatch) {
            continue;
        }

        const [, profileName, assetHardwareRevision]: RegExpMatchArray = nameMatch;

        assets.push({
            profileName: formatProfileName(profileName),
            profileId: profileName,
            hardwareRevision: assetHardwareRevision,
            fileName: asset.name,
            size: asset.size,
        });
    }

    return assets;
}

export async function main({
    fetchLatestRelease: fetchRelease = fetchLatestRelease,
    downloadAsset: download = downloadAsset,
    mkdir = promises.mkdir,
    writeFile = promises.writeFile,
}: MainDependencyOverrides = {}): Promise<void> {
    try {
        const release = await fetchRelease();

        await mkdir("./src/assets/firmware", { recursive: true });

        const firmwareAssets = extractFirmwareAssets(release);

        console.log(`Found ${firmwareAssets.length} firmware assets to download`);

        for (const asset of firmwareAssets) {
            const outputPath = `./src/assets/firmware/${asset.fileName}`;
            const downloadUrl = release.assets.find(
                (remoteAsset: GitHubAsset): boolean => remoteAsset.name === asset.fileName,
            )?.browser_download_url;

            if (!downloadUrl) {
                console.warn(`Download URL not found for asset: ${asset.fileName}`);
                continue;
            }

            await download(downloadUrl, outputPath);
        }

        const versionData = {
            timeStamp: new Date().toJSON(),
            latestFirmwareRelease: {
                version: release.tag_name,
                name: release.name,
                publishedAt: release.published_at,
                updatedAt: release.updated_at,
                assets: firmwareAssets,
            },
        };

        let objectLiteral = inspect(versionData, {
            depth: null,
            compact: false,
            breakLength: 80,
            sorted: false,
        });
        const versionFileContent = `export const versionInfo = ${objectLiteral};
`;

        await writeFile("./src/common/data/version.ts", versionFileContent, "utf-8");

        console.log(`✅ Version file updated with firmware release ${release.tag_name}`);
        console.log(`✅ Downloaded ${firmwareAssets.length} firmware assets`);
    } catch (error) {
        console.error("❌ Error updating version:", error);
        process.exit(1);
    }
}

main();
