import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { DestroyRef, importProvidersFrom, isDevMode } from "@angular/core";
import { MAT_SNACK_BAR_DEFAULT_OPTIONS, MatSnackBar } from "@angular/material/snack-bar";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { ServiceWorkerModule } from "@angular/service-worker";

import { DashboardComponent } from "./app/dashboard/dashboard.component";
import { AppComponent } from "./app/app.component";
import { SpinnerOverlay } from "./common/overlay/spinner-overlay.service";
import { ErrorInterceptor } from "./common/services/error.interceptor.service";
import { AntHeartRateService } from "./common/services/heart-rate/ant-heart-rate.service";

bootstrapApplication(AppComponent, {
    providers: [
        provideRouter([
            {
                path: "",
                loadComponent: async (): Promise<typeof DashboardComponent> =>
                    (await import("./app/dashboard/dashboard.component")).DashboardComponent,
            },
            { path: "**", redirectTo: "" },
        ]),
        SpinnerOverlay,
        provideAnimations(),
        importProvidersFrom(
            ServiceWorkerModule.register("ngsw-worker.js", {
                enabled: !isDevMode(),
                // register the ServiceWorker as soon as the application is stable
                // or after 10 seconds (whichever comes first).
                registrationStrategy: "registerWhenStable:10000",
            }),
        ),
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
        {
            provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
            useValue: {
                duration: 5000,
                verticalPosition: "top",
                horizontalPosition: "end",
            },
        },
    ],
}).catch((err: unknown): void => console.error(err));
