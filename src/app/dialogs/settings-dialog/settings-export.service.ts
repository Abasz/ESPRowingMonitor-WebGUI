import { Injectable } from "@angular/core";

import { IRowingProfileSettings, IStrokeDetectionSettings } from "../../../common/common.interfaces";
import { generateProfileHeader } from "../../../common/utils/profile-header.generator";
import { downloadFiles } from "../../../common/utils/utility.functions";

@Injectable()
export class SettingsExportService {
    async exportRowerProfile(
        settings: IRowingProfileSettings,
        deviceName: string,
        modelNumber: string,
    ): Promise<void> {
        const {
            minimumRecoverySlopeMargin: _,
            ...strokeDetectionSettings
        }: Omit<IStrokeDetectionSettings, "isCompiledWithDouble"> = settings.strokeDetectionSettings;
        const profileSettings: IRowingProfileSettings = { ...settings, strokeDetectionSettings };

        const headerContent = generateProfileHeader(profileSettings, deviceName, modelNumber);

        const blob = new Blob([headerContent], { type: "text/plain" });

        const fileName = `${deviceName.camelize()}.rower-profile.h`;

        await downloadFiles([{ blob, name: fileName }]);
    }
}
