/**
 * Test helpers for SettingsDialogComponent tests
 * Provides mock form creation utilities and mock data shared across test files
 */

import { signal } from "@angular/core";
import { vi } from "vitest";

import { IDeviceInformation } from "../../common/ble.interfaces";
import {
    Config,
    IDisplayLayoutConfig,
    IErgConnectionStatus,
    IRowerSettings,
} from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DEFAULT_LANDSCAPE_LAYOUT, DEFAULT_PORTRAIT_LAYOUT } from "../dashboard/dashboard-tile-definitions";

import type { SettingsDialogComponent } from "./settings-dialog.component";

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

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
        showGridLines: {
            dirty: boolean;
            value: boolean;
        };
        showAxisLabels: {
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
        showGridLines: boolean;
        showAxisLabels: boolean;
        unitSystem: string;
    };
    getRawValue: () => {
        showPeakForceInTitle: boolean;
        showGridLines: boolean;
        showAxisLabels: boolean;
        unitSystem: string;
    };
}

/**
 * Creates a default mock Config object for testing
 * Provides defaults that match the application's default configuration
 *
 * @param overrides - Partial config to override defaults (supports deep merge for nested properties)
 * @returns A complete Config object suitable for testing
 */
export const createMockConfig: (overrides?: DeepPartial<Config>) => Config = (
    overrides: DeepPartial<Config> = {},
): Config => {
    const defaultConfig: Config = {
        general: {
            ergoMonitorBleId: "",
            heartRateBleId: "",
            heartRateMonitor: "off",
        },
        display: {
            general: {
                unitSystem: "metric",
            },
            forceCurve: {
                showPeakForceInTitle: true,
                showGridLines: true,
                showAxisLabels: true,
            },
            layout: {
                landscape: DEFAULT_LANDSCAPE_LAYOUT,
                portrait: DEFAULT_PORTRAIT_LAYOUT,
                orientationLock: "auto" as const,
            },
        },
    };

    return {
        general: {
            ...defaultConfig.general,
            ...(overrides.general ?? {}),
        },
        display: {
            general: {
                ...defaultConfig.display.general,
                ...(overrides.display?.general ?? {}),
            },
            forceCurve: {
                ...defaultConfig.display.forceCurve,
                ...(overrides.display?.forceCurve ?? {}),
            },
            layout: (overrides.display?.layout as IDisplayLayoutConfig) ?? defaultConfig.display.layout,
        },
    };
};

/**
 * Creates a mock ConfigManagerService with getConfig, getGroup, and setGroup methods
 * The mock is properly configured to return appropriate values based on which group is requested
 *
 * @param config - Optional config to use (defaults to createMockConfig())
 * @returns A mocked ConfigManagerService suitable for dependency injection in tests
 */
export const createMockConfigManagerService: (
    config?: Config,
) => Pick<ConfigManagerService, "getConfig" | "getGroup" | "setGroup"> = (
    config: Config = createMockConfig(),
): Pick<ConfigManagerService, "getConfig" | "getGroup" | "setGroup"> => {
    const mockService = {
        getConfig: vi.fn(),
        getGroup: vi.fn(),
        setGroup: vi.fn(),
    };

    vi.mocked(mockService.getConfig).mockReturnValue(config);
    vi.mocked(mockService.getGroup).mockImplementation(
        (group: keyof Config): Config[keyof Config] => config[group],
    );

    return mockService;
};

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
            showGridLines: {
                dirty,
                value: true,
            },
            showAxisLabels: {
                dirty,
                value: true,
            },
            unitSystem: {
                dirty,
                value: "metric",
            },
        },
        value: {
            showPeakForceInTitle: value,
            showGridLines: true,
            showAxisLabels: true,
            unitSystem: "metric",
        },
        getRawValue(): {
            showPeakForceInTitle: boolean;
            showGridLines: boolean;
            showAxisLabels: boolean;
            unitSystem: string;
        } {
            return this.value;
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
        isLayoutDirty: signal(false),
        getLayoutConfig: vi.fn().mockReturnValue({
            landscape: DEFAULT_LANDSCAPE_LAYOUT,
            portrait: DEFAULT_PORTRAIT_LAYOUT,
            orientationLock: "auto",
        }),
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
        isLayoutDirty: signal(false),
        getLayoutConfig: vi.fn().mockReturnValue({
            landscape: DEFAULT_LANDSCAPE_LAYOUT,
            portrait: DEFAULT_PORTRAIT_LAYOUT,
            orientationLock: "auto",
        }),
    } as unknown as ReturnType<typeof component.displaySettings>);

    component.onGeneralFormValidityChange(false);
    component.onDisplayFormValidityChange(false);
    component.currentTabIndex.set(2);
};
