/**
 * Test helpers for SettingsDialogComponent tests
 * Provides mock form creation utilities and mock data shared across test files
 */

import { Provider, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { SwUpdate } from "@angular/service-worker";
import { BehaviorSubject, EMPTY, of } from "rxjs";
import { vi } from "vitest";

import { IDeviceInformation } from "../../../common/ble.interfaces";
import { Config, IErgConnectionStatus, IRowerSettings } from "../../../common/common.interfaces";
import { SpinnerOverlay } from "../../../common/overlay/spinner-overlay.service";
import { ConfigManagerService } from "../../../common/services/config-manager.service";
import { DataRecorderService } from "../../../common/services/data-recorder.service";
import { ErgConnectionService } from "../../../common/services/ergometer/erg-connection.service";
import { ErgSettingsService } from "../../../common/services/ergometer/erg-settings.service";
import { UtilsService } from "../../../common/services/utils.service";
import { deepMerge, DeepPartial } from "../../../common/utils/utility.functions";
import {
    DEFAULT_LANDSCAPE_LAYOUT,
    DEFAULT_PORTRAIT_LAYOUT,
} from "../../dashboard/dashboard-tile-definitions";

import { SettingsDialogComponent } from "./settings-dialog.component";

export interface IMockGeneralForm {
    dirty: boolean;
    controls: Record<
        string,
        {
            dirty: boolean;
            value: unknown;
            getRawValue?: () => unknown;
        }
    >;
    value: Record<string, unknown>;
    getRawValue?: () => Record<string, unknown>;
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
): Config => deepMerge(new Config(), overrides);

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
    const defaultValues: Record<string, unknown> = {
        logLevel: 1,
        deltaTimeLogging: false,
        logToSdCard: false,
        bleMode: 0,
        heartRateMonitor: "none",
        autoSession: "autoStart",
        autoLap: "off",
        autoLapValue: 500,
        intervalsApiKey: "",
        intervalsAthleteId: "",
        intervalsAutoUpload: false,
    };

    const controls: Record<
        string,
        {
            dirty: boolean;
            value: unknown;
            getRawValue?: () => unknown;
        }
    > = {};

    Object.keys(defaultValues).forEach((key: string): void => {
        const spec = controlValues[key];
        const isSpecObject = spec !== null && typeof spec === "object" && "value" in spec;
        const controlValue = isSpecObject ? (spec as { value: unknown }).value : (spec ?? defaultValues[key]);
        const isControlDirty = isSpecObject ? ((spec as { dirty?: boolean }).dirty ?? dirty) : dirty;

        const control: { dirty: boolean; value: unknown; getRawValue?: () => unknown } = {
            dirty: isControlDirty,
            value: controlValue,
        };

        if (key.startsWith("intervals")) {
            control.getRawValue = (): unknown => control.value;
        }

        controls[key] = control;
    });

    const defaultControlValues = Object.keys(defaultValues).reduce(
        (acc: Record<string, unknown>, key: string): Record<string, unknown> => {
            const spec = controlValues[key];
            const isSpecObject = spec !== null && typeof spec === "object" && "value" in spec;
            acc[key] = isSpecObject ? (spec as { value: unknown }).value : (spec ?? defaultValues[key]);

            return acc;
        },
        {},
    );

    const form = {
        dirty,
        controls,
        value: defaultControlValues,
        getRawValue: (): Record<string, unknown> => defaultControlValues,
    };

    return form as IMockGeneralForm;
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
    hasApiKeyChanged?: boolean,
    isFirstTimeSetup?: boolean,
) => void = (
    component: SettingsDialogComponent,
    generalFormDirty: boolean = false,
    rowingFormDirty: boolean = false,
    isProfileLoaded: boolean = false,
    displayFormDirty: boolean = false,
    hasApiKeyChanged: boolean = false,
    isFirstTimeSetup: boolean = true,
): void => {
    const mockGeneralForm = createMockGeneralForm(generalFormDirty);
    const mockRowingForm = createMockRowingForm(rowingFormDirty);
    const mockDisplayForm = createMockDisplayForm(displayFormDirty);

    vi.spyOn(component, "generalSettings").mockReturnValue({
        getForm: vi.fn().mockReturnValue(mockGeneralForm),
        hasApiKeyChanged: vi.fn().mockReturnValue(hasApiKeyChanged),
        isFirstTimeSetup: vi.fn().mockReturnValue(isFirstTimeSetup),
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
        getAveragingConfig: vi.fn().mockReturnValue({
            mode: "off",
            windowSize: 3,
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
        hasApiKeyChanged: vi.fn().mockReturnValue(false),
        isFirstTimeSetup: vi.fn().mockReturnValue(true),
    } as unknown as ReturnType<typeof component.generalSettings>);

    vi.spyOn(component, "displaySettings").mockReturnValue({
        getForm: vi.fn().mockReturnValue(createMockDisplayForm(false)),
        isLayoutDirty: signal(false),
        getLayoutConfig: vi.fn().mockReturnValue({
            landscape: DEFAULT_LANDSCAPE_LAYOUT,
            portrait: DEFAULT_PORTRAIT_LAYOUT,
            orientationLock: "auto",
        }),
        getAveragingConfig: vi.fn().mockReturnValue({
            mode: "off",
            windowSize: 3,
        }),
    } as unknown as ReturnType<typeof component.displaySettings>);

    component.onGeneralFormValidityChange(false);
    component.onDisplayFormValidityChange(false);
    component.currentTabIndex.set(2);
};

// ─── Shared mock factories ────────────────────────────────────────────────────

/**
 * Creates a mock DataRecorderService with hasSessions resolving to true by default.
 */
export const createMockDataRecorderService = (): Pick<DataRecorderService, "hasSessions"> => {
    const mock = { hasSessions: vi.fn() };

    vi.mocked(mock.hasSessions).mockResolvedValue(true);

    return mock;
};

/**
 * Creates a fully mocked ErgSettingsService with all 9 methods pre-resolved.
 */
export const createMockErgSettingsService = (): Pick<
    ErgSettingsService,
    | "changeLogLevel"
    | "changeDeltaTimeLogging"
    | "changeLogToSdCard"
    | "changeBleServiceType"
    | "changeMachineSettings"
    | "changeDragFactorSettings"
    | "changeSensorSignalSettings"
    | "changeStrokeSettings"
    | "restartDevice"
> => {
    const mock = {
        changeLogLevel: vi.fn(),
        changeDeltaTimeLogging: vi.fn(),
        changeLogToSdCard: vi.fn(),
        changeBleServiceType: vi.fn(),
        changeMachineSettings: vi.fn(),
        changeDragFactorSettings: vi.fn(),
        changeSensorSignalSettings: vi.fn(),
        changeStrokeSettings: vi.fn(),
        restartDevice: vi.fn(),
    };
    vi.mocked(mock.changeLogLevel).mockResolvedValue(undefined);
    vi.mocked(mock.changeDeltaTimeLogging).mockResolvedValue(undefined);
    vi.mocked(mock.changeLogToSdCard).mockResolvedValue(undefined);
    vi.mocked(mock.changeBleServiceType).mockResolvedValue(undefined);
    vi.mocked(mock.changeMachineSettings).mockResolvedValue(undefined);
    vi.mocked(mock.changeDragFactorSettings).mockResolvedValue(undefined);
    vi.mocked(mock.changeSensorSignalSettings).mockResolvedValue(undefined);
    vi.mocked(mock.changeStrokeSettings).mockResolvedValue(undefined);
    vi.mocked(mock.restartDevice).mockResolvedValue(undefined);

    return mock;
};

/**
 * Creates a mock ErgConnectionService with reconnect and connectionStatus$ configured.
 */
export const createMockErgConnectionService = (
    ergConnectionStatus: IErgConnectionStatus,
): Pick<ErgConnectionService, "reconnect" | "connectionStatus$"> => {
    const mock = {
        reconnect: vi.fn(),
        connectionStatus$: vi.fn(),
    };
    vi.mocked(mock.reconnect).mockResolvedValue(undefined);
    vi.mocked(mock.connectionStatus$).mockReturnValue(of(ergConnectionStatus));

    return mock;
};

/**
 * Creates a mock MatDialogRef with close/updateSize/backdropClick/keydownEvents/disableClose.
 * backdropClick and keydownEvents return EMPTY by default.
 */
export const createMockMatDialogRef = (): Pick<
    MatDialogRef<SettingsDialogComponent>,
    "close" | "updateSize" | "backdropClick" | "keydownEvents" | "afterClosed" | "disableClose"
> => {
    const mock = {
        close: vi.fn(),
        updateSize: vi.fn(),
        backdropClick: vi.fn(),
        keydownEvents: vi.fn(),
        afterClosed: vi.fn(),
        disableClose: false,
    };
    vi.mocked(mock.backdropClick).mockReturnValue(EMPTY);
    vi.mocked(mock.keydownEvents).mockReturnValue(EMPTY);
    vi.mocked(mock.afterClosed).mockReturnValue(EMPTY);

    return mock;
};

/**
 * Creates a mock MatSnackBar with open and openFromComponent configured.
 * openFromComponent returns a ref whose onAction emits of(true) by default.
 */
export const createMockSnackBar = (): Pick<MatSnackBar, "open" | "openFromComponent"> => {
    const mock = {
        open: vi.fn(),
        openFromComponent: vi.fn(),
    };
    vi.mocked(mock.openFromComponent).mockReturnValue({
        onAction: vi.fn().mockReturnValue(of(true)),
    } as unknown as MatSnackBarRef<TextOnlySnackBar>);

    return mock;
};

// ─── TestBed setup ────────────────────────────────────────────────────────────

export interface ISettingsDialogTestBedOptions {
    /** Additional providers appended to the standard module provider list */
    extraProviders?: Array<Provider>;
    /** Providers injected via overrideComponent for component-level tokens (e.g. SettingsExportService) */
    componentProviders?: Array<Provider>;
}

export interface ISettingsDialogTestBedResult {
    fixture: ComponentFixture<SettingsDialogComponent>;
    component: SettingsDialogComponent;
    mockMatDialogRef: ReturnType<typeof createMockMatDialogRef>;
    mockConfigManagerService: ReturnType<typeof createMockConfigManagerService>;
    mockDataRecorderService: ReturnType<typeof createMockDataRecorderService>;
    mockErgSettingsService: ReturnType<typeof createMockErgSettingsService>;
    mockErgConnectionService: ReturnType<typeof createMockErgConnectionService>;
    mockSnackBar: ReturnType<typeof createMockSnackBar>;
    mockSpinnerOverlay: Pick<SpinnerOverlay, "open">;
    mockUtilsService: Pick<UtilsService, "breakpointHelper">;
    mockSwUpdate: Pick<SwUpdate, "checkForUpdate" | "isEnabled">;
    breakpointSubject: BehaviorSubject<{ maxW599: boolean }>;
}

/**
 * Configures a TestBed for SettingsDialogComponent with all standard mocks.
 * Stubs navigator.bluetooth, creates all mock services, and wires up the Angular TestBed.
 *
 * @param options.extraProviders    - Additional module-level providers (e.g. MatDialog for the export spec)
 * @param options.componentProviders - Providers applied via overrideComponent (e.g. SettingsExportService)
 */
export const createSettingsDialogTestBed = async (
    options: ISettingsDialogTestBedOptions = {},
): Promise<ISettingsDialogTestBedResult> => {
    vi.spyOn(navigator, "bluetooth", "get").mockReturnValue({
        getDevices: (): Promise<Array<BluetoothDevice>> => Promise.resolve([]),
    } as unknown as Bluetooth);

    const mockDialogData = createMockDialogData();
    const mockMatDialogRef = createMockMatDialogRef();
    const mockConfigManagerService = createMockConfigManagerService();
    const mockDataRecorderService = createMockDataRecorderService();
    const mockErgSettingsService = createMockErgSettingsService();
    const mockErgConnectionService = createMockErgConnectionService(mockDialogData.ergConnectionStatus);
    const mockSnackBar = createMockSnackBar();
    const mockSpinnerOverlay: Pick<SpinnerOverlay, "open"> = { open: vi.fn() };
    const breakpointSubject = new BehaviorSubject<{ maxW599: boolean }>({ maxW599: false });
    const mockUtilsService: Pick<UtilsService, "breakpointHelper"> = { breakpointHelper: vi.fn() };
    vi.mocked(mockUtilsService.breakpointHelper).mockReturnValue(breakpointSubject.asObservable());
    const mockSwUpdate: Pick<SwUpdate, "checkForUpdate" | "isEnabled"> = {
        checkForUpdate: vi.fn(),
        isEnabled: false,
    };

    let builder = TestBed.configureTestingModule({
        imports: [SettingsDialogComponent],
        providers: [
            { provide: MatDialogRef, useValue: mockMatDialogRef },
            { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
            { provide: ConfigManagerService, useValue: mockConfigManagerService },
            { provide: DataRecorderService, useValue: mockDataRecorderService },
            { provide: ErgSettingsService, useValue: mockErgSettingsService },
            { provide: MatSnackBar, useValue: mockSnackBar },
            { provide: SpinnerOverlay, useValue: mockSpinnerOverlay },
            { provide: UtilsService, useValue: mockUtilsService },
            { provide: SwUpdate, useValue: mockSwUpdate },
            { provide: ErgConnectionService, useValue: mockErgConnectionService },
            ...(options.extraProviders ?? []),
        ],
    });

    if (options.componentProviders?.length) {
        builder = builder.overrideComponent(SettingsDialogComponent, {
            set: { providers: options.componentProviders },
        });
    }

    await builder.compileComponents();

    const fixture = TestBed.createComponent(SettingsDialogComponent);
    const component = fixture.componentInstance;

    return {
        fixture,
        component,
        mockMatDialogRef,
        mockConfigManagerService,
        mockDataRecorderService,
        mockErgSettingsService,
        mockErgConnectionService,
        mockSnackBar,
        mockSpinnerOverlay,
        mockUtilsService,
        mockSwUpdate,
        breakpointSubject,
    };
};
