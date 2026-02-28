import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { SwUpdate } from "@angular/service-worker";
import { BehaviorSubject, EMPTY, of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpinnerOverlay } from "../../common/overlay/spinner-overlay.service";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { ErgConnectionService } from "../../common/services/ergometer/erg-connection.service";
import { ErgSettingsService } from "../../common/services/ergometer/erg-settings.service";
import { UtilsService } from "../../common/services/utils.service";
import { DEFAULT_LANDSCAPE_LAYOUT, DEFAULT_PORTRAIT_LAYOUT } from "../dashboard/dashboard-tile-definitions";

import { SettingsDialogComponent } from "./settings-dialog.component";
import {
    createMockConfigManagerService,
    createMockDialogData,
    createMockDisplayForm,
    createMockGeneralForm,
    createMockRowingForm,
    setupMockChildComponents,
} from "./settings-dialog.test.helpers";

describe("SettingsDialogComponent tabs", (): void => {
    let component: SettingsDialogComponent;
    let fixture: ComponentFixture<SettingsDialogComponent>;
    let mockMatDialogRef: Pick<
        MatDialogRef<SettingsDialogComponent>,
        "close" | "updateSize" | "backdropClick" | "keydownEvents" | "disableClose"
    >;
    let mockConfigManagerService: Pick<ConfigManagerService, "getConfig" | "getGroup" | "setGroup">;
    let mockErgSettingsService: Pick<ErgSettingsService, "restartDevice">;
    let mockErgConnectionService: Pick<ErgConnectionService, "reconnect" | "connectionStatus$">;
    let mockSnackBar: Pick<MatSnackBar, "open" | "openFromComponent">;
    let mockSpinnerOverlay: Pick<SpinnerOverlay, "open">;
    let mockUtilsService: Pick<UtilsService, "breakpointHelper">;
    let mockSwUpdate: Pick<SwUpdate, "checkForUpdate" | "isEnabled">;
    let breakpointSubject: BehaviorSubject<{ maxW599: boolean }>;

    beforeEach(async (): Promise<void> => {
        vi.spyOn(navigator, "bluetooth", "get").mockReturnValue({
            getDevices: (): Promise<Array<BluetoothDevice>> => Promise.resolve([]),
        } as unknown as Bluetooth);

        const mockDialogData = createMockDialogData();

        mockMatDialogRef = {
            close: vi.fn(),
            updateSize: vi.fn(),
            backdropClick: vi.fn(),
            keydownEvents: vi.fn(),
            disableClose: false,
        };
        vi.mocked(mockMatDialogRef.backdropClick).mockReturnValue(EMPTY);
        vi.mocked(mockMatDialogRef.keydownEvents).mockReturnValue(EMPTY);

        mockConfigManagerService = createMockConfigManagerService();

        mockErgSettingsService = {
            restartDevice: vi.fn(),
        };
        vi.mocked(mockErgSettingsService.restartDevice).mockResolvedValue();

        mockErgConnectionService = {
            reconnect: vi.fn(),
            connectionStatus$: vi.fn(),
        };
        vi.mocked(mockErgConnectionService.reconnect).mockResolvedValue();
        vi.mocked(mockErgConnectionService.connectionStatus$).mockReturnValue(
            of(mockDialogData.ergConnectionStatus),
        );

        mockSnackBar = {
            open: vi.fn(),
            openFromComponent: vi.fn(),
        };
        vi.mocked(mockSnackBar.openFromComponent).mockReturnValue({
            onAction: vi.fn().mockReturnValue(of(true)),
        } as unknown as MatSnackBarRef<TextOnlySnackBar>);

        mockSpinnerOverlay = {
            open: vi.fn(),
        };

        breakpointSubject = new BehaviorSubject<{ maxW599: boolean }>({ maxW599: false });

        mockUtilsService = {
            breakpointHelper: vi.fn(),
        };
        vi.mocked(mockUtilsService.breakpointHelper).mockReturnValue(breakpointSubject.asObservable());

        mockSwUpdate = {
            checkForUpdate: vi.fn(),
            isEnabled: false,
        };

        await TestBed.configureTestingModule({
            imports: [SettingsDialogComponent],
            providers: [
                { provide: MatDialogRef, useValue: mockMatDialogRef },
                { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
                { provide: ConfigManagerService, useValue: mockConfigManagerService },
                { provide: ErgSettingsService, useValue: mockErgSettingsService },
                { provide: MatSnackBar, useValue: mockSnackBar },
                { provide: SpinnerOverlay, useValue: mockSpinnerOverlay },
                { provide: UtilsService, useValue: mockUtilsService },
                { provide: SwUpdate, useValue: mockSwUpdate },
                { provide: ErgConnectionService, useValue: mockErgConnectionService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsDialogComponent);
        component = fixture.componentInstance;
    });

    it("should render tabs and child components", (): void => {
        const tabGroup = fixture.debugElement.nativeElement.querySelector("mat-tab-group");

        expect(tabGroup).toBeTruthy();
        expect(tabGroup.getAttribute("ng-reflect-selected-index")).toBeDefined();
        expect(component.generalSettings).toBeDefined();
        expect(component.displaySettings).toBeDefined();
        expect(component.rowingSettings).toBeDefined();
    });

    it("should update currentTabIndex when onTabChange is called", (): void => {
        expect(component.currentTabIndex()).toBe(0);

        component.onTabChange(1);
        expect(component.currentTabIndex()).toBe(1);

        component.onTabChange(2);
        expect(component.currentTabIndex()).toBe(2);

        component.onTabChange(0);
        expect(component.currentTabIndex()).toBe(0);
    });

    it("should handle switching with dirty forms correctly", (): void => {
        setupMockChildComponents(component, true, false);

        component.currentTabIndex.set(0);
        component.onTabChange(2);
        expect(component.currentTabIndex()).toBe(2);

        const generalForm = component.generalSettings().getForm();
        const rowingForm = component.rowingSettings().getForm();
        expect(generalForm.dirty).toBe(true);
        expect(rowingForm.dirty).toBe(false);
    });

    it("should update save button state when switching", (): void => {
        setupMockChildComponents(component, true, true, false, true);

        component.onGeneralFormValidityChange(true);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(false);

        component.currentTabIndex.set(0);
        expect(component.isSaveButtonEnabled()).toBe(true);

        component.onTabChange(1);
        expect(component.isSaveButtonEnabled()).toBe(true);

        component.onDisplayFormValidityChange(false);
        expect(component.isSaveButtonEnabled()).toBe(false);

        component.onTabChange(2);
        expect(component.isSaveButtonEnabled()).toBe(false);

        component.onRowingFormValidityChange(true);
        expect(component.isSaveButtonEnabled()).toBe(true);
    });

    it("should enable save button when display form is dirty", (): void => {
        setupMockChildComponents(component, false, false, false, true);

        component.onGeneralFormValidityChange(false);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(false);

        component.currentTabIndex.set(1);
        expect(component.isSaveButtonEnabled()).toBe(true);
    });

    it("should save display settings when form is dirty", async (): Promise<void> => {
        const mockDisplayForm = createMockDisplayForm(true, false);

        vi.spyOn(component, "generalSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(createMockGeneralForm(false)),
        } as unknown as ReturnType<typeof component.generalSettings>);
        vi.spyOn(component, "displaySettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(mockDisplayForm),
            isLayoutDirty: signal(false),
            getLayoutConfig: vi.fn().mockReturnValue({
                landscape: DEFAULT_LANDSCAPE_LAYOUT,
                portrait: DEFAULT_PORTRAIT_LAYOUT,
                orientationLock: "auto",
            }),
        } as unknown as ReturnType<typeof component.displaySettings>);
        vi.spyOn(component, "rowingSettings").mockReturnValue({
            getForm: vi.fn().mockReturnValue(createMockRowingForm(false)),
            saveAsCustomProfile: vi.fn(),
            isProfileLoaded: false,
        } as unknown as ReturnType<typeof component.rowingSettings>);

        component.onGeneralFormValidityChange(false);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(false);

        component.currentTabIndex.set(1);

        await component.saveSettings();

        expect(mockConfigManagerService.setGroup).toHaveBeenCalledWith(
            "display",
            expect.objectContaining({
                forceCurve: expect.objectContaining({
                    showPeakForceInTitle: false,
                }),
            }),
        );
    });

    it("should not prompt for confirmation when switching tabs with clean forms", (): void => {
        setupMockChildComponents(component, false, false);

        component.currentTabIndex.set(0);
        component.onTabChange(2);

        expect(component.currentTabIndex()).toBe(2);
        expect(mockSnackBar.openFromComponent).not.toHaveBeenCalled();
    });

    it("should maintain form validity state across tab switches", (): void => {
        setupMockChildComponents(component, true, true);
        component.onGeneralFormValidityChange(true);
        component.onRowingFormValidityChange(false);

        component.currentTabIndex.set(0);
        expect(component.isSaveButtonEnabled()).toBe(true);

        component.onTabChange(2);
        expect(component.isSaveButtonEnabled()).toBe(false);

        component.onRowingFormValidityChange(true);
        expect(component.isSaveButtonEnabled()).toBe(true);
    });

    it("should handle rapid tab switching correctly", (): void => {
        setupMockChildComponents(component, false, false);

        component.onTabChange(1);
        component.onTabChange(2);
        component.onTabChange(0);
        component.onTabChange(1);

        expect(component.currentTabIndex()).toBe(1);
    });

    it("should enable save on rowing tab when profile is loaded even with clean forms", (): void => {
        setupMockChildComponents(component, false, false, true, false);
        component.onGeneralFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        component.currentTabIndex.set(2);
        expect(component.isSaveButtonEnabled()).toBe(true);
    });

    it("should disable save on general tab when profile is loaded but forms are clean", (): void => {
        setupMockChildComponents(component, false, false, true, false);
        component.onGeneralFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        component.currentTabIndex.set(0);
        expect(component.isSaveButtonEnabled()).toBe(false);
    });

    it("should handle all three forms becoming dirty simultaneously", (): void => {
        setupMockChildComponents(component, true, true, false, true);
        component.onGeneralFormValidityChange(true);
        component.onDisplayFormValidityChange(true);
        component.onRowingFormValidityChange(true);

        component.currentTabIndex.set(0);
        expect(component.isSaveButtonEnabled()).toBe(true);

        component.currentTabIndex.set(1);
        expect(component.isSaveButtonEnabled()).toBe(true);

        component.currentTabIndex.set(2);
        expect(component.isSaveButtonEnabled()).toBe(true);
    });
});
