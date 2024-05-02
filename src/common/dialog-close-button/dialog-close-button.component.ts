import { ChangeDetectionStrategy, Component, ElementRef, Input, OnInit } from "@angular/core";

import { Position } from "./dialog-close-button";

@Component({
    selector: "nas-dialog-close-button",
    templateUrl: "./dialog-close-button.component.html",
    styleUrls: ["./dialog-close-button.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogCloseButtonComponent implements OnInit {
    @Input() position: Position = "relative";

    constructor(private elRef: ElementRef) {}

    ngOnInit(): void {
        this.elRef.nativeElement.firstElementChild.style.position = this.position;
        this.elRef.nativeElement.parentElement.style.position = "relative";
        this.elRef.nativeElement.parentElement.style.display = "flex";
        this.elRef.nativeElement.parentElement.style.justifyContent = "space-between";
    }
}
