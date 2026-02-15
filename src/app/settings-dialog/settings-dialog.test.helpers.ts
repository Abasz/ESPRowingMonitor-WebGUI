/**
 * Test helpers for SettingsDialogComponent tests
 * Provides mock form creation utilities and mock data shared across test files
 */

import { vi } from "vitest";

import { IDeviceInformation } from "../../common/ble.interfaces";
import { IErgConnectionStatus, IRowerSettings } from "../../common/common.interfaces";

import type { SettingsDialogComponent } from "./settings-dialog.component";

export interface IMockGeneralForm {
    dirty: boolean;
    controls: Record<
        string,
        {
            dirty: boolean;
            value: unknown;
        }
    >;
    value: Record<string, unknown>;
}

export interface IMockRowingForm {
    dirty: boolean;
    controls: Record<
        string,
        {
            dirty: boolean;
            getRawValue: () => unknown;
        }
    >;
    value: Record<string, unknown>;
}

export interface IMockDisplayForm {
    dirty: boolean;
    controls: {
        showPeakForceInTitle: {
            dirty: boolean;
            value: boolean;
        };
        unitSystem: {
            dirty: boolean;
            value: string;
        };
    };
    value: {
        showPeakForceInTitle: boolean;
        unitSystem: string;
    };
}

export const createMockGeneralForm: (
    dirty?: boolean,
    controlValues?: Record<string, unknown>,
) => IMockGeneralForm = (
    dirty: boolean = false,
    controlValues: Record<string, unknown> = {},
): IMockGeneralForm => {
    const defaultControlValues: Record<string, unknown> = {
        logLevel: 1,
        deltaTimeLogging: false,
        logToSdCard: false,
        bleMode: 0,
        heartRateMonitor: "none",
        ...controlValues,
    };

    return {
        dirty,
        controls: Object.keys(defaultControlValues).reduce(
            (
                acc: Record<
                    string,
                    {
                        dirty: boolean;
                        value: unknown;
                    }
                >,
                key: string,
            ): Record<
                string,
                {
                    dirty: boolean;
                    value: unknown;
                }
            > => {
                acc[key] = {
                    dirty:
                        (
                            defaultControlValues[key] as {
                                dirty: boolean;
                            }
                        ).dirty ?? dirty,
                    value: defaultControlValues[key],
                };

                return acc;
            },
            {} as Record<
                string,
                {
                    dirty: boolean;
                    value: unknown;
                }
            >,
        ),
        value: defaultControlValues,
    };
};

export const createMockRowingForm: (
    dirty?: boolean,
    controlValues?: Record<string, unknown>,
) => IMockRowingForm = (
    dirty: boolean = false,
    controlValues: Record<string, unknown> = {},
): IMockRowingForm => {
    const defaultControlValues: Record<string, unknown> = {
        machineSettings: {},
        dragFactorSettings: {},
        sensorSignalSettings: {},
        strokeDetectionSettings: {},
        ...controlValues,
    };

    return {
        dirty,
        controls: Object.keys(defaultControlValues).reduce(
            (
                acc: Record<
                    string,
                    {
                        dirty: boolean;
                        getRawValue: () => unknown;
                    }
                >,
                key: string,
            ): Record<
                string,
                {
                    dirty: boolean;
                    getRawValue: () => unknown;
                }
            > => {
                acc[key] = {
                    dirty:
                        (
                            defaultControlValues[key] as {
                                dirty: boolean;
                            }
                        ).dirty ?? dirty,
                    getRawValue: (): unknown => defaultControlValues[key],
                };

                return acc;
            },
            {} as Record<
                string,
                {
                    dirty: boolean;
                    getRawValue: () => unknown;
                }
            >,
        ),
        value: defaultControlValues,
    };
};

export const createMockDisplayForm: (dirty?: boolean, value?: boolean) => IMockDisplayForm = (
    dirty: boolean = false,
    value: boolean = true,
): IMockDisplayForm => {
    return {
        dirty,
        controls: {
            showPeakForceInTitle: {
                dirty,
                value,
            },
            unitSystem: {
                dirty,
                value: "metric",
            },
        },
        value: {
            showPeakForceInTitle: value,
            unitSystem: "metric",
        },
    };
};

/**
 * Creates mock rower settings data for testing
 */
export const createMockRowerSettings: () => IRowerSettings = (): IRowerSettings => ({
    generalSettings: {
        bleServiceFlag: 0,
        logLevel: 1,
        logToSdCard: false,
        logDeltaTimes: false,
        isRuntimeSettingsEnabled: false,
        isCompiledWithDouble: true,
    },
    rowingSettings: {
        machineSettings: {
            flywheelInertia: 0.05,
            magicConstant: 2.8,
            sprocketRadius: 1.5,
            impulsePerRevolution: 11,
        },
        sensorSignalSettings: {
            rotationDebounceTime: 25,
            rowingStoppedThreshold: 3000,
        },
        dragFactorSettings: {
            goodnessOfFitThreshold: 0.96,
            maxDragFactorRecoveryPeriod: 8,
            dragFactorLowerThreshold: 90,
            dragFactorUpperThreshold: 220,
            dragCoefficientsArrayLength: 4,
        },
        strokeDetectionSettings: {
            strokeDetectionType: 0,
            impulseDataArrayLength: 6,
            minimumPoweredTorque: 0.01,
            minimumDragTorque: 0.005,
            minimumRecoverySlopeMargin: 0.05,
            minimumRecoverySlope: 0.1,
            minimumRecoveryTime: 400,
            minimumDriveTime: 200,
            driveHandleForcesMaxCapacity: 20,
        },
    },
});

/**
 * Creates mock erg connection status for testing
 */
export const createMockErgConnectionStatus: () => IErgConnectionStatus = (): IErgConnectionStatus => ({
    deviceName: "Test Device",
    status: "connected",
});

/**
 * Creates mock device info for testing
 */
export const createMockDeviceInfo: () => IDeviceInformation = (): IDeviceInformation => ({
    modelNumber: "Test Model",
    firmwareNumber: "1.0.0",
    manufacturerName: "Test Manufacturer",
});

/**
 * Creates mock dialog data combining all test data
 */
export const createMockDialogData = (): {
    rowerSettings: IRowerSettings;
    ergConnectionStatus: IErgConnectionStatus;
    deviceInfo: IDeviceInformation;
} => ({
    rowerSettings: createMockRowerSettings(),
    ergConnectionStatus: createMockErgConnectionStatus(),
    deviceInfo: createMockDeviceInfo(),
});

/**
 * Sets up mock child components (generalSettings, displaySettings, rowingSettings) for the SettingsDialogComponent
 */
export const setupMockChildComponents: (
    component: SettingsDialogComponent,
    generalFormDirty?: boolean,
    rowingFormDirty?: boolean,
    isProfileLoaded?: boolean,
    displayFormDirty?: boolean,
) => void = (
    component: SettingsDialogComponent,
    generalFormDirty: boolean = false,
    rowingFormDirty: boolean = false,
    isProfileLoaded: boolean = false,
    displayFormDirty: boolean = false,
): void => {
    const mockGeneralForm = createMockGeneralForm(generalFormDirty);
    const mockRowingForm = createMockRowingForm(rowingFormDirty);
    const mockDisplayForm = createMockDisplayForm(displayFormDirty);

    vi.spyOn(component, "generalSettings").mockReturnValue({
        getForm: vi.fn().mockReturnValue(mockGeneralForm),
    } as unknown as ReturnType<typeof component.generalSettings>);

    component.onGeneralFormValidityChange(true);

    vi.spyOn(component, "displaySettings").mockReturnValue({
        getForm: vi.fn().mockReturnValue(mockDisplayForm),
    } as unknown as ReturnType<typeof component.displaySettings>);

    component.onDisplayFormValidityChange(true);

    vi.spyOn(component, "rowingSettings").mockReturnValue({
        getForm: vi.fn().mockReturnValue(mockRowingForm),
        saveAsCustomProfile: vi.fn(),
        isProfileLoaded,
    } as unknown as ReturnType<typeof component.rowingSettings>);

    component.onRowingFormValidityChange(true);
};

/**
 * Sets up clean (non-dirty, invalid) general and display forms and sets currentTabIndex to rowing tab (2)
 */
export const setupCleanGeneralAndDisplayForms: (component: SettingsDialogComponent) => void = (
    component: SettingsDialogComponent,
): void => {
    vi.spyOn(component, "generalSettings").mockReturnValue({
        getForm: vi.fn().mockReturnValue(createMockGeneralForm(false)),
    } as unknown as ReturnType<typeof component.generalSettings>);

    vi.spyOn(component, "displaySettings").mockReturnValue({
        getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
    } as unknown as ReturnType<typeof component.displaySettings>);

    component.onGeneralFormValidityChange(false);
    component.onDisplayFormValidityChange(false);
    component.currentTabIndex.set(2);
};
