import { DecimalPipe } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    InputSignal,
    output,
    OutputEmitterRef,
    Signal,
} from "@angular/core";
import {
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatTable,
} from "@angular/material/table";

import { SecondsToTimePipe } from "../../../../common/utils/seconds-to-time.pipe";
import { ILap } from "../../models/session-analysis.interfaces";

@Component({
    selector: "app-lap-table",
    template: `
        <table mat-table [trackBy]="trackByLapNumber" [dataSource]="laps()">
            <ng-container matColumnDef="lapNumber">
                <mat-header-cell *matHeaderCellDef>Lap</mat-header-cell>
                <mat-cell *matCellDef="let lap">{{ lap.lapNumber }}</mat-cell>
            </ng-container>

            <ng-container matColumnDef="startTime">
                <mat-header-cell *matHeaderCellDef>Start</mat-header-cell>
                <mat-cell *matCellDef="let lap">{{ lap.startTime | secondsToTime: "pace" }}</mat-cell>
            </ng-container>

            <ng-container matColumnDef="duration">
                <mat-header-cell *matHeaderCellDef>Duration</mat-header-cell>
                <mat-cell *matCellDef="let lap">{{ lap.duration | secondsToTime: "pace" }}</mat-cell>
            </ng-container>

            <ng-container matColumnDef="pace">
                <mat-header-cell *matHeaderCellDef>Pace</mat-header-cell>
                <mat-cell *matCellDef="let lap">
                    {{ lap.avgSpeed > 0 ? (500 / lap.avgSpeed | secondsToTime: "pace") : "--" }}
                </mat-cell>
            </ng-container>

            <ng-container matColumnDef="avgPower">
                <mat-header-cell *matHeaderCellDef>Power</mat-header-cell>
                <mat-cell *matCellDef="let lap">{{ lap.avgPower | number: "1.0-0" }} W</mat-cell>
            </ng-container>

            <ng-container matColumnDef="avgStrokeRate">
                <mat-header-cell *matHeaderCellDef>Rate</mat-header-cell>
                <mat-cell *matCellDef="let lap">{{ lap.avgStrokeRate | number: "1.0-0" }} spm</mat-cell>
            </ng-container>

            <ng-container matColumnDef="avgDistPerStroke">
                <mat-header-cell *matHeaderCellDef>Dist/Stroke</mat-header-cell>
                <mat-cell *matCellDef="let lap">{{ lap.avgDistPerStroke | number: "1.1-1" }} m</mat-cell>
            </ng-container>

            <ng-container matColumnDef="powerBalance">
                <mat-header-cell *matHeaderCellDef>Balance</mat-header-cell>
                <mat-cell *matCellDef="let lap">
                    @if (lap.powerBalance !== undefined) {
                        A {{ lap.powerBalance * 100 | number: "1.0-0" }}%
                    } @else {
                        --
                    }
                </mat-cell>
            </ng-container>

            <mat-header-row *matHeaderRowDef="displayedColumns()"></mat-header-row>
            <mat-row
                *matRowDef="let lap; columns: displayedColumns()"
                [class.selected]="selectedLap()?.lapNumber === lap.lapNumber"
                (click)="onRowClick(lap)"
            ></mat-row>
        </table>
    `,
    styleUrls: ["./lap-table.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatTable,
        MatColumnDef,
        MatHeaderCellDef,
        MatHeaderCell,
        MatCellDef,
        MatCell,
        MatHeaderRowDef,
        MatHeaderRow,
        MatRowDef,
        MatRow,
        SecondsToTimePipe,
        DecimalPipe,
    ],
})
export class LapTableComponent {
    readonly laps: InputSignal<Array<ILap>> = input.required<Array<ILap>>();
    readonly selectedLap: InputSignal<ILap | undefined> = input<ILap | undefined>(undefined);
    readonly showBalanceColumn: InputSignal<boolean> = input<boolean>(false);
    readonly lapSelected: OutputEmitterRef<ILap> = output<ILap>();

    readonly displayedColumns: Signal<Array<string>> = computed(
        (): Array<string> => [
            "lapNumber",
            "startTime",
            "duration",
            "pace",
            "avgPower",
            "avgStrokeRate",
            "avgDistPerStroke",
            ...(this.showBalanceColumn() ? ["powerBalance"] : []),
        ],
    );

    trackByLapNumber(_: number, lap: ILap): number {
        return lap.lapNumber;
    }

    onRowClick(lap: ILap): void {
        this.lapSelected.emit(lap);
    }
}
