import { BreakpointObserver, Breakpoints, BreakpointState, MediaMatcher } from "@angular/cdk/layout";
import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatSnackBar } from "@angular/material/snack-bar";
import NoSleep, { INoSleep } from "@zakj/no-sleep";
import { fromEvent, Observable } from "rxjs";
import { filter, map, startWith, take, tap } from "rxjs/operators";

import { IMediaQuery } from "../common.interfaces";
import { SpinnerOverlayRef } from "../overlay/spinner-overlay-ref";
import { SpinnerOverlay } from "../overlay/spinner-overlay.service";

@Injectable({
    providedIn: "root",
})
export class UtilsService {
    readonly isHandset$: Observable<boolean> = this.breakpointObserver
        .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
        .pipe(map((result: BreakpointState): boolean => result.matches));

    private mainSpinnerRef: SpinnerOverlayRef | undefined;
    private wakeLock: INoSleep = new NoSleep();

    constructor(
        private snack: MatSnackBar,
        private spinner: SpinnerOverlay,
        private mediaMatcher: MediaMatcher,
        private breakpointObserver: BreakpointObserver,
        private destroyRef: DestroyRef,
    ) {}

    breakpointHelper(breakPoints: Array<IMediaQuery>): Observable<{ [key: string]: boolean }> {
        breakPoints = breakPoints.map(
            (query: IMediaQuery): IMediaQuery => [query[0], query[1] || "min", query[2] || "width"],
        );

        return this.breakpointObserver
            .observe(
                breakPoints.map((query: IMediaQuery): string => `(${query[1]}-${query[2]}: ${query[0]}px)`),
            )
            .pipe(
                map((result: BreakpointState): { [key: string]: boolean } =>
                    Object.values(result.breakpoints).reduce(
                        (
                            acc: { [key: string]: boolean },
                            point: boolean,
                            index: number,
                        ): { [key: string]: boolean } => {
                            acc[
                                `${breakPoints[index][1] || "min"}${
                                    breakPoints[index][2]?.[0].toFirstUpperCase() || "W"
                                }${breakPoints[index][0]}`
                            ] = point;

                            return acc;
                        },
                        {},
                    ),
                ),
            );
    }

    disableWakeLock(): void {
        this.wakeLock.disable();
    }

    enableWakeLock(): void {
        fromEvent(document, "visibilitychange")
            .pipe(
                startWith(document.visibilityState),
                filter((): boolean => document.visibilityState === "visible" && !this.wakeLock.enabled),
                tap((): void => {
                    try {
                        fromEvent(document, "click")
                            .pipe(take(1), takeUntilDestroyed(this.destroyRef))
                            .subscribe((): void => {
                                this.wakeLock.enable();
                            });
                    } catch (error: unknown) {
                        if (error instanceof Error) {
                            setTimeout((): void => {
                                this.snack.open(
                                    `Failed to request wake lock: ${(error as Error).message}`,
                                    "Dismiss",
                                );
                            }, 5000);
                        }
                    }
                }),
                take(1),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    mainSpinner(): { close(): void; open(): void } {
        return {
            open: (): void => {
                if (!this.mainSpinnerRef) {
                    this.mainSpinnerRef = this.spinner.open();
                }
            },
            close: (): void => {
                if (this.mainSpinnerRef) {
                    this.mainSpinnerRef.close();
                    this.mainSpinnerRef = undefined;
                }
            },
        };
    }

    mediaQuery(match: "min" | "max", width: number): boolean {
        return this.mediaMatcher.matchMedia(`(${match}-width: ${width}px)`).matches;
    }
}
