import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatIconRegistry } from "@angular/material/icon";
import { RouterOutlet } from "@angular/router";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet],
})
export class AppComponent {
    constructor(private matIconReg: MatIconRegistry) {
        this.matIconReg.setDefaultFontSetClass("material-symbols-sharp");
    }
}
