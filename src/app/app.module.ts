import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { CoreModule } from "../common/core.module";
import { ErrorInterceptor } from "../common/services/error.interceptor.service";
import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";

import { AppComponent } from "./app.component";
import { ForceCurveComponent } from "./force-curve/force-curve.component";
import { MetricComponent } from "./metric/metric.component";
import { SettingsBarComponent } from "./settings-bar/settings-bar.component";
import { SettingsDialogComponent } from "./settings-dialog/settings-dialog.component";

@NgModule({
    declarations: [
        AppComponent,
        SnackBarConfirmComponent,
        MetricComponent,
        SettingsBarComponent,
        ForceCurveComponent,
        SettingsDialogComponent,
    ],
    imports: [BrowserModule, BrowserAnimationsModule, CoreModule],
    providers: [{ provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }],
    bootstrap: [AppComponent],
})
export class AppModule {}
