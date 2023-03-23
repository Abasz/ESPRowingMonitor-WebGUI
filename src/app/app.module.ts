import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { CoreModule } from "../common/core.module";
import { ErrorInterceptor } from "../common/services/error.interceptor.service";
import { SnackBarConfirmComponent } from "../common/snack-bar-confirm/snack-bar-confirm.component";

import { AppComponent } from "./app.component";

@NgModule({
    declarations: [
        AppComponent,
        SnackBarConfirmComponent,
    ],
    imports: [BrowserModule, BrowserAnimationsModule, CoreModule],
    providers: [{ provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }],
    bootstrap: [AppComponent],
})
export class AppModule {}
