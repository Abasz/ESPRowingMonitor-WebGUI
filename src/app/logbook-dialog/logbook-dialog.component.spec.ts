import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { of } from "rxjs";

import { ISessionSummary } from "../../common/common.interfaces";
import { DataRecorderService } from "../../common/services/data-recorder.service";

import { LogbookDialogComponent } from "./logbook-dialog.component";

describe("LogbookDialogComponent", (): void => {
    let component: LogbookDialogComponent;
    let fixture: ComponentFixture<LogbookDialogComponent>;

    beforeEach(async (): Promise<void> => {
        const mockDialogData: Array<ISessionSummary> = [
            {
                sessionId: 1,
                startTime: 0,
                finishTime: 10,
                distance: 1000,
                strokeCount: 50,
                deviceName: "Device 1",
            },
        ];

        const mockDataRecorderService = {
            getSessionSummaries$: jasmine.createSpy("getSessionSummaries$").and.returnValue(of([])),
            deleteSession: jasmine.createSpy("deleteSession").and.returnValue(of([1, 1, 1, 1])),
            export: jasmine.createSpy("export").and.returnValue(Promise.resolve()),
            exportSessionToJson: jasmine.createSpy("exportSessionToJson").and.returnValue(Promise.resolve()),
            exportSessionToTcx: jasmine.createSpy("exportSessionToTcx").and.returnValue(Promise.resolve()),
            import: jasmine.createSpy("import").and.returnValue(Promise.resolve()),
        };

        const mockSnackBar = {
            open: jasmine.createSpy("open").and.returnValue({
                afterDismissed: jasmine.createSpy("afterDismissed").and.returnValue(of({})),
                onAction: jasmine.createSpy("onAction").and.returnValue(of(true)),
            }),
            openFromComponent: jasmine.createSpy("openFromComponent").and.returnValue({
                onAction: jasmine.createSpy("onAction").and.returnValue(of(true)),
            }),
        };

        await TestBed.configureTestingModule({
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
                { provide: DataRecorderService, useValue: mockDataRecorderService },
                { provide: MatSnackBar, useValue: mockSnackBar },
            ],
            imports: [LogbookDialogComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(LogbookDialogComponent);
        component = fixture.componentInstance;
    });

    it("should create", (): void => {
        expect(component).toBeTruthy();
    });
});
