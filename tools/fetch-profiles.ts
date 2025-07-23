#!/usr/bin/env node
"use strict";

import { promises } from "fs";
import process from "node:process";
import { join } from "path";

import { ProfileData } from "../src/common/common.interfaces";

export interface FetchProfilesDependencies {
    fetchRepositoryFiles?: (path: string) => Promise<Array<GitHubFileResponse>>;
    fetchFileContent?: (downloadUrl: string) => Promise<string>;
    mkdir?: typeof promises.mkdir;
    writeFile?: typeof promises.writeFile;
    cwd?: () => string;
}

interface GitHubFileResponse {
    name: string;
    path: string;
    download_url: string;
    type: "file" | "dir";
}

interface RowerProfileFile extends GitHubFileResponse {
    profileId: string;
}

const GITHUB_API_BASE = "https://api.github.com";
const REPO_OWNER = "Abasz";
const REPO_NAME = "ESPRowingMonitor";
const PROFILES_PATH = "src/profiles";
const PROFILE_PATTERN = /^(.+)\.rower-profile\.h$/;

const DEFAULTS = {
    DRIVE_HANDLE_FORCES_MAX_CAPACITY: 255,
};

export async function fetchRepositoryFiles(path: string): Promise<Array<GitHubFileResponse>> {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    const files = (await response.json()) as Array<GitHubFileResponse>;

    return files;
}

export async function fetchFileContent(downloadUrl: string): Promise<string> {
    const response = await fetch(downloadUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    return await response.text();
}

export function extractDeviceInfo(content: string): { deviceName: string; modelNumber: string } {
    const deviceNameMatch = content.match(/#define\s+DEVICE_NAME\s+(\w+)/);
    const modelNumberMatch =
        content.match(/#define\s+MODEL_NUMBER\s+"(.+?)"/) ||
        content.match(/#define\s+MODEL_NUMBER\s+(.+?)(?:\n|$)/);

    if (!deviceNameMatch || !modelNumberMatch) {
        throw new Error(
            `Failed to parse device name or model number from content: ${deviceNameMatch}, ${modelNumberMatch}`,
        );
    }

    return {
        deviceName: deviceNameMatch[1],
        modelNumber: modelNumberMatch[1].replace(/"/g, "").trim(),
    };
}

export function generateProfileKey(deviceName: string, modelNumber: string): string {
    const camelDeviceName = deviceName.charAt(0).toLowerCase() + deviceName.slice(1);

    // split on spaces, hyphens, underscores and process each word
    const words = modelNumber.split(/[\s\-_]+/).filter((word: string): boolean => word.length > 0);
    const camelModelNumber = words
        .map((word: string, index: number): string => {
            if (index === 0) {
                return word.charAt(0).toLowerCase() + word.slice(1);
            } else {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }
        })
        .join("");

    return camelDeviceName + camelModelNumber.charAt(0).toUpperCase() + camelModelNumber.slice(1);
}

export function extractValue(content: string, defineName: string, defaultValue?: number): number {
    const regex = new RegExp(`#define\\s+${defineName}\\s+([-+]?[\\d\\.]+(?:[eE][-+]?\\d+)?)`, "m");
    const match = content.match(regex);

    if (!match) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }

        throw new Error(`Required #define ${defineName} was not found`);
    }

    return parseFloat(match[1]);
}

export function extractStrokeDetectionType(content: string): number {
    if (content.includes("STROKE_DETECTION_SLOPE")) {
        return 1;
    } else if (content.includes("STROKE_DETECTION_BOTH")) {
        return 2;
    }

    return 0;
}

export function parseProfileHeader(content: string, profileId: string): ProfileData {
    const deviceInfo = extractDeviceInfo(content);

    const requiredMachineSettings = {
        flywheelInertia: extractValue(content, "FLYWHEEL_INERTIA"),
        magicConstant: extractValue(content, "CONCEPT_2_MAGIC_NUMBER"),
        sprocketRadius: extractValue(content, "SPROCKET_RADIUS"),
        impulsePerRevolution: extractValue(content, "IMPULSES_PER_REVOLUTION"),
    };

    const requiredSensorSignalSettings = {
        rotationDebounceTime: extractValue(content, "ROTATION_DEBOUNCE_TIME_MIN"),
        rowingStoppedThreshold: extractValue(content, "ROWING_STOPPED_THRESHOLD_PERIOD"),
    };

    const requiredDragFactorSettings = {
        goodnessOfFitThreshold: extractValue(content, "GOODNESS_OF_FIT_THRESHOLD"),
        maxDragFactorRecoveryPeriod: extractValue(content, "MAX_DRAG_FACTOR_RECOVERY_PERIOD"),
        dragFactorLowerThreshold: extractValue(content, "LOWER_DRAG_FACTOR_THRESHOLD"),
        dragFactorUpperThreshold: extractValue(content, "UPPER_DRAG_FACTOR_THRESHOLD"),
        dragCoefficientsArrayLength: extractValue(content, "DRAG_COEFFICIENTS_ARRAY_LENGTH"),
    };

    const requiredStrokeDetectionSettings = {
        strokeDetectionType: extractStrokeDetectionType(content),
        impulseDataArrayLength: extractValue(content, "IMPULSE_DATA_ARRAY_LENGTH"),
        minimumPoweredTorque: extractValue(content, "MINIMUM_POWERED_TORQUE"),
        minimumDragTorque: extractValue(content, "MINIMUM_DRAG_TORQUE"),
        minimumRecoverySlopeMargin: extractValue(content, "MINIMUM_RECOVERY_SLOPE_MARGIN"),
        minimumRecoverySlope: extractValue(content, "MINIMUM_RECOVERY_SLOPE"),
        minimumRecoveryTime: extractValue(content, "MINIMUM_RECOVERY_TIME"),
        minimumDriveTime: extractValue(content, "MINIMUM_DRIVE_TIME"),
        driveHandleForcesMaxCapacity: extractValue(
            content,
            "DRIVE_HANDLE_FORCES_MAX_CAPACITY",
            DEFAULTS.DRIVE_HANDLE_FORCES_MAX_CAPACITY,
        ),
    };

    const profileData: ProfileData = {
        profileId,
        name: `${deviceInfo.deviceName} ${deviceInfo.modelNumber}`,
        settings: {
            machineSettings: requiredMachineSettings,
            sensorSignalSettings: requiredSensorSignalSettings,
            dragFactorSettings: requiredDragFactorSettings,
            strokeDetectionSettings: requiredStrokeDetectionSettings,
        },
    };

    return profileData;
}

function generateTypeScriptCode(profiles: Record<string, ProfileData>): string {
    // convert strokeDetectionType numbers to enum references
    const profilesWithEnums = Object.fromEntries(
        Object.entries(profiles).map(([key, profile]: [string, ProfileData]): [string, unknown] => {
            const strokeDetectionType = profile.settings.strokeDetectionSettings.strokeDetectionType;
            let enumValue = "StrokeDetectionType.Torque";

            if (strokeDetectionType === 1) {
                enumValue = "StrokeDetectionType.Slope";
            } else if (strokeDetectionType === 2) {
                enumValue = "StrokeDetectionType.Both";
            }

            return [
                key,
                {
                    ...profile,
                    settings: {
                        ...profile.settings,
                        strokeDetectionSettings: {
                            ...profile.settings.strokeDetectionSettings,
                            strokeDetectionType: enumValue,
                        },
                    },
                },
            ];
        }),
    );

    let profilesJson = JSON.stringify(profilesWithEnums, undefined, 4)
        // remove quotes around enum values
        .replace(/"strokeDetectionType":\s*"(StrokeDetectionType\.\w+)"/g, '"strokeDetectionType": $1')
        // remove quotes around object property names to make valid TypeScript object literal
        .replace(/"([a-zA-Z_$][a-zA-Z0-9_$]*)":/g, "$1:");

    // add trailing commas for ESLint compliance
    // Pattern 1: Add comma after property values before closing braces
    profilesJson = profilesJson.replace(/([^,\s])\n(\s*[}\]])/g, "$1,\n$2");

    // pattern 2: Add comma after closing braces that are followed by other closing braces
    profilesJson = profilesJson.replace(/(\n\s*})\n(\s*[}\]])/g, "$1,\n$2");

    return `// this file is auto-generated by fetch-profiles.ts
// do not edit manually - changes will be overwritten

import { ProfileData, StrokeDetectionType } from "../common.interfaces";

export const STANDARD_PROFILES: Record<string, ProfileData> = ${profilesJson};

export const CUSTOM_PROFILE_KEY = "custom";
`;
}

export async function main({
    fetchRepositoryFiles: fetchRepoFiles = fetchRepositoryFiles,
    fetchFileContent: fetchContent = fetchFileContent,
    mkdir = promises.mkdir,
    writeFile = promises.writeFile,
    cwd = process.cwd.bind(process),
}: FetchProfilesDependencies = {}): Promise<void> {
    console.log("🚀 Starting profile fetch from ESPRowingMonitor repository...\n");

    try {
        const files = await fetchRepoFiles(PROFILES_PATH);

        const profileFiles = files.reduce(
            (accumulator: Array<RowerProfileFile>, file: GitHubFileResponse): Array<RowerProfileFile> => {
                if (file.type !== "file") {
                    return accumulator;
                }

                const match = file.name.match(PROFILE_PATTERN);

                if (!match) {
                    return accumulator;
                }

                accumulator.push({ ...file, profileId: match[1] });

                return accumulator;
            },
            [],
        );

        console.log(
            `Found ${profileFiles.length} profile files:`,
            profileFiles.map((file: RowerProfileFile): string => file.name),
            "\n",
        );

        if (profileFiles.length === 0) {
            console.warn("No rower profile files found!");

            return;
        }

        const profiles: Record<string, ProfileData> = {};

        for (const file of profileFiles) {
            try {
                const content = await fetchContent(file.download_url);

                const deviceInfo = extractDeviceInfo(content);
                const profileKey = generateProfileKey(deviceInfo.deviceName, deviceInfo.modelNumber);

                profiles[profileKey] = parseProfileHeader(content, file.profileId);
            } catch (error) {
                console.error(`Failed to process ${file.name}:`, error);
            }
        }

        const typeScriptCode = generateTypeScriptCode(profiles);

        const outputDir = join(cwd(), "src", "common", "data");
        await mkdir(outputDir, { recursive: true });

        const outputPath = join(outputDir, "standard-profiles.ts");
        await writeFile(outputPath, typeScriptCode, "utf-8");

        console.log(`✅ Successfully generated ${Object.keys(profiles).length} profiles:`);

        for (const [key, profile] of Object.entries(profiles)) {
            console.log(`   - ${key}: ${profile.name}`);
        }
    } catch (error) {
        console.error("❌ Failed to fetch profiles:", error);
        process.exit(1);
    }
}

main();
