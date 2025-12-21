import { MediaMatcher } from "@angular/cdk/layout";
import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { DestroyRef, importProvidersFrom, isDevMode, provideZonelessChangeDetection } from "@angular/core";
import { MAT_SNACK_BAR_DEFAULT_OPTIONS, MatSnackBar } from "@angular/material/snack-bar";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { ServiceWorkerModule } from "@angular/service-worker";

import { AppComponent } from "./app/app.component";
import { DashboardComponent } from "./app/dashboard/dashboard.component";
import { SpinnerOverlay } from "./common/overlay/spinner-overlay.service";
import { ErrorInterceptor } from "./common/services/error.interceptor.service";
import { AntHeartRateService } from "./common/services/heart-rate/ant-heart-rate.service";
import { CustomMediaMatcher } from "./common/utils/media-matcher-override";

bootstrapApplication(AppComponent, {
    providers: [
        provideZonelessChangeDetection(),
        provideRouter([
            {
                path: "",
                loadComponent: async (): Promise<typeof DashboardComponent> =>
                    (await import("./app/dashboard/dashboard.component")).DashboardComponent,
            },
            { path: "**", redirectTo: "" },
        ]),
        SpinnerOverlay,
        // workaround to override Angular Material's no animation in case of reduced motion preference
        { provide: MediaMatcher, useClass: CustomMediaMatcher },
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
                if (isSecureContext === true && "usb" in navigator) {
                    return new AntHeartRateService(snack, destroyRef);
                }

                return {
                    discover: (): Promise<void> => {
                        throw Error("WebUSB API is not available");
                    },
                    disconnectDevice: (): Promise<void> => Promise.resolve(),
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
}).catch((err: unknown): void => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
    const browser = (ua.match(/CriOS|Chrome|Safari|Firefox|Edg/) || [])[0];

    const overlay = document.getElementById("global-error-overlay");
    const msg = document.getElementById("global-error-message");
    const advice = document.getElementById("global-error-advice");
    if (overlay && msg && advice) {
        overlay.classList.add("active");
        msg.textContent = err instanceof Error ? err.message : String(err);
        if (isIOS) {
            advice.innerHTML = `<p><strong>Browser compatibility:</strong></p>
                <p>You are using iOS (${browser ?? "Unknown"}). Web Bluetooth is <b>not supported</b> in any browser on iOS due to Apple platform restrictions. Please use a supported browser on Android, Windows, Linux, or macOS.</p>`;
        } else {
            advice.innerHTML = "";
        }
    }

    console.error(
        "Angular bootstrap failed:",
        err instanceof Error ? `${err.message}\n${err.stack}` : String(err),
    );
});
