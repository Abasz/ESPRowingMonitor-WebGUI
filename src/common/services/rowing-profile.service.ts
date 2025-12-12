import { Injectable } from "@angular/core";

import { IRowingProfileSettings, ProfileData } from "../common.interfaces";
import { CUSTOM_PROFILE_KEY, STANDARD_PROFILES } from "../data/standard-profiles";

@Injectable({
    providedIn: "root",
})
export class RowingProfileService {
    private readonly CUSTOM_PROFILE_STORAGE_KEY: string = "rowingSettingsCustomProfile";

    getAllProfiles(): Record<string, ProfileData> {
        const profiles = { ...STANDARD_PROFILES };

        const customSettings = this.getCustomProfile();
        if (customSettings) {
            profiles[CUSTOM_PROFILE_KEY] = {
                name: "Custom Profile",
                profileId: CUSTOM_PROFILE_KEY,
                settings: customSettings,
            };
        }

        return profiles;
    }

    getProfile(profileKey: string): ProfileData | undefined {
        if (profileKey === CUSTOM_PROFILE_KEY) {
            const customSettings = this.getCustomProfile();
            if (customSettings) {
                return {
                    name: "Custom Profile",
                    profileId: CUSTOM_PROFILE_KEY,
                    settings: customSettings,
                };
            }

            return undefined;
        }

        return STANDARD_PROFILES[profileKey];
    }

    getCustomProfile(): IRowingProfileSettings | undefined {
        try {
            const stored = localStorage.getItem(this.CUSTOM_PROFILE_STORAGE_KEY);
            if (!stored) {
                return undefined;
            }

            return JSON.parse(stored) as IRowingProfileSettings;
        } catch (error) {
            console.warn("Failed to load custom profile from localStorage:", error);

            return undefined;
        }
    }

    saveAsCustomProfile(settings: IRowingProfileSettings): void {
        try {
            localStorage.setItem(this.CUSTOM_PROFILE_STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save custom profile to localStorage:", error);
        }
    }
}
