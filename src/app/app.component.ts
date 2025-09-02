import { AfterViewInit, ChangeDetectionStrategy, Component, isDevMode } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatIconRegistry } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { RouterOutlet } from "@angular/router";
import { SwUpdate, VersionEvent, VersionReadyEvent } from "@angular/service-worker";
import { filter, Observable, switchMap } from "rxjs";

import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet],
})
export class AppComponent implements AfterViewInit {
    constructor(
        private matIconReg: MatIconRegistry,
        private swUpdate: SwUpdate,
        private snackBar: MatSnackBar,
    ) {
        this.matIconReg.setDefaultFontSetClass("material-symbols-sharp");

        if (!isDevMode()) {
            this.swUpdate.versionUpdates
                .pipe(
                    filter((evt: VersionEvent): evt is VersionReadyEvent => evt.type === "VERSION_READY"),
                    switchMap((evt: VersionReadyEvent): Observable<void> => {
                        console.log(`Current app version: ${evt.currentVersion.hash}`);
                        console.log(`New app version ready for use: ${evt.latestVersion.hash}`);

                        return this.snackBar
                            .openFromComponent(SnackBarConfirmComponent, {
                                duration: undefined,
                                data: { text: "Update Available", confirm: "Update" },
                            })
                            .onAction();
                    }),
                    takeUntilDestroyed(),
                )
                .subscribe((): void => {
                    window.location.reload();
                });
        }
    }

    async ngAfterViewInit(): Promise<void> {
        if (!isDevMode()) {
            try {
                await this.swUpdate.checkForUpdate();
            } catch (err) {
                this.snackBar.open(`Failed to check for updates: ", ${err}`, "Dismiss");
                console.error("Failed to check for updates:", err);
            }
        }

        if (isSecureContext !== true || navigator.bluetooth === undefined) {
            this.snackBar.open("Bluetooth API is not available", "Dismiss", {
                duration: undefined,
            });
        }

        if (navigator.storage === undefined) {
            console.error("StorageManager API is not found or not supported");

            return;
        }

        try {
            if (await navigator.storage.persisted()) {
                return;
            }
        } catch (error) {
            this.snackBar.open("Error while checking storage persistence", "Dismiss", {
                duration: undefined,
            });

            console.error("Error checking storage persistence:", error);

            return;
        }

        try {
            if (!(await navigator.storage.persist())) {
                console.warn("Failed to make storage persisted");
            }
        } catch (error) {
            this.snackBar.open("Error while making storage persistent", "Dismiss", {
                duration: undefined,
            });

            console.error("Error making storage persistent:", error);
        }
    }
}
