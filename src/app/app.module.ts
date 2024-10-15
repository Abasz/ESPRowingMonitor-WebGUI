import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { DestroyRef, isDevMode, NgModule } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { ServiceWorkerModule } from "@angular/service-worker";

import { CoreModule } from "../common/core.module";
import { DialogCloseButtonModule } from "../common/dialog-close-button/dialog-close-button.module";
import { AntHeartRateService } from "../common/services/ant-heart-rate.service";
import { ErrorInterceptor } from "../common/services/error.interceptor.service";
import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";

import { AppComponent } from "./app.component";
import { ForceCurveComponent } from "./force-curve/force-curve.component";
import { LogbookDialogComponent } from "./logbook-dialog/logbook-dialog.component";
import { MetricComponent } from "./metric/metric.component";
import { SettingsBarComponent } from "./settings-bar/settings-bar.component";
import { SettingsDialogComponent } from "./settings-dialog/settings-dialog.component";

@NgModule({
    declarations: [
        AppComponent,
        SnackBarConfirmComponent,
        MetricComponent,
        SettingsBarComponent,
        LogbookDialogComponent,
        ForceCurveComponent,
        SettingsDialogComponent,
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        CoreModule,
        ServiceWorkerModule.register("ngsw-worker.js", {
            enabled: !isDevMode(),
            // register the ServiceWorker as soon as the application is stable
            // or after 10 seconds (whichever comes first).
            registrationStrategy: "registerWhenStable:10000",
        }),
        DialogCloseButtonModule,
    ],
    providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        {
            provide: AntHeartRateService,
            useFactory: (snack: MatSnackBar, destroyRef: DestroyRef): AntHeartRateService => {
                if (isSecureContext) {
                    return new AntHeartRateService(snack, destroyRef);
                }

                return {
                    discover: (): Promise<void> => {
                        throw Error("WebUSB API is not available");
                    },
                } as unknown as AntHeartRateService;
            },
            deps: [MatSnackBar, DestroyRef],
        },
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}
