import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { isDevMode, NgModule } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { ServiceWorkerModule } from "@angular/service-worker";
import { BrowserWebBluetooth, WebBluetoothModule } from "@manekinekko/angular-web-bluetooth";

import { CoreModule } from "../common/core.module";
import { AntHeartRateService } from "../common/services/ant-heart-rate.service";
import { ErrorInterceptor } from "../common/services/error.interceptor.service";
import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";

import { AppComponent } from "./app.component";
import { ForceCurveComponent } from "./force-curve/force-curve.component";
import { MetricComponent } from "./metric/metric.component";
import { SettingsBarComponent } from "./settings-bar/settings-bar.component";
import { SettingsDialogComponent } from "./settings-dialog/settings-dialog.component";

const webBluetooth = [];

if (isSecureContext) {
    webBluetooth.push(
        WebBluetoothModule.forRoot({
            enableTracing: true, // or false, this will enable logs in the browser's console
        }),
    );
}

@NgModule({
    declarations: [
        AppComponent,
        SnackBarConfirmComponent,
        MetricComponent,
        SettingsBarComponent,
        ForceCurveComponent,
        SettingsDialogComponent,
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        CoreModule,
        webBluetooth,
        ServiceWorkerModule.register("ngsw-worker.js", {
            enabled: !isDevMode(),
            // register the ServiceWorker as soon as the application is stable
            // or after 10 seconds (whichever comes first).
            registrationStrategy: "registerWhenStable:10000",
        }),
    ],
    providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        {
            provide: BrowserWebBluetooth,
            useFactory: (): BrowserWebBluetooth => {
                if (isSecureContext) {
                    return new BrowserWebBluetooth();
                }

                return {
                    requestDevice: (): Promise<BluetoothDevice> => {
                        throw Error("Bluetooth API is not available");
                    },
                } as unknown as BrowserWebBluetooth;
            },
        },
        {
            provide: AntHeartRateService,
            useFactory: (snack: MatSnackBar): AntHeartRateService => {
                if (isSecureContext) {
                    return new AntHeartRateService(snack);
                }

                return {
                    discover: (): Promise<void> => {
                        throw Error("WebUSB API is not available");
                    },
                } as unknown as AntHeartRateService;
            },
            deps: [MatSnackBar],
        },
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}
