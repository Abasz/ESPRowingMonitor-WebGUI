import { ChangeDetectionStrategy, Component, ElementRef, input, InputSignal, OnInit } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";

import { Position } from "./dialog-close-button";

@Component({
    selector: "app-dialog-close-button",
    templateUrl: "./dialog-close-button.component.html",
    styleUrls: ["./dialog-close-button.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconButton, MatTooltip, MatIcon],
})
export class DialogCloseButtonComponent implements OnInit {
    readonly position: InputSignal<Position> = input<Position>("relative");

    constructor(private elRef: ElementRef) {}

    ngOnInit(): void {
        this.elRef.nativeElement.firstElementChild.style.position = this.position;
    }
}
