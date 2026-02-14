/**
 * Test helpers for SettingsDialogComponent tests
 * Provides mock form creation utilities shared across test files
 */

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
