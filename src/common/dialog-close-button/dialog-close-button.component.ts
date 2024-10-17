import { ChangeDetectionStrategy, Component, ElementRef, input, InputSignal, OnInit } from "@angular/core";

import { Position } from "./dialog-close-button";

@Component({
    selector: "app-dialog-close-button",
    templateUrl: "./dialog-close-button.component.html",
    styleUrls: ["./dialog-close-button.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogCloseButtonComponent implements OnInit {
    readonly position: InputSignal<Position> = input("relative" as Position);

    constructor(private elRef: ElementRef) {}

    ngOnInit(): void {
        this.elRef.nativeElement.firstElementChild.style.position = this.position;
    }
}
