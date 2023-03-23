import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { interval, map, Observable, startWith } from "rxjs";

import { BleServiceFlag } from "../../common/common.interfaces";

import { ButtonClickedTargets } from "./settings-bar.interfaces";

@Component({
    selector: "app-settings-bar",
    templateUrl: "./settings-bar.component.html",
    styleUrls: ["./settings-bar.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsBarComponent {
    BleServiceFlag: typeof BleServiceFlag = BleServiceFlag;

    @Input() batteryLevel: number = 100;
    @Input() bleServiceType: BleServiceFlag = BleServiceFlag.CpsService;

    @Output() readonly buttonClicked: EventEmitter<ButtonClickedTargets> = new EventEmitter();

    @Input() connectionStatus: boolean = false;

    timeOfDay$: Observable<number> = interval(1000).pipe(
        startWith(Date.now()),
        map((): number => Date.now())
    );

    click(target: ButtonClickedTargets): void {
        this.buttonClicked.emit(target);
    }
}
