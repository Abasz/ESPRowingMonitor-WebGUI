import { BreakpointObserver, Breakpoints, BreakpointState, MediaMatcher } from "@angular/cdk/layout";
import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { fromEvent, Observable, Subscription } from "rxjs";
import { filter, map, startWith, tap } from "rxjs/operators";

import { IMediaQuery, Navigator, WakeLockSentinel } from "../common.interfaces";
import { SpinnerOverlayRef } from "../overlay/spinner-overlay-ref";
import { SpinnerOverlayService } from "../overlay/spinner-overlay.service";

@Injectable({
    providedIn: "root",
})
export class UtilsService {
    isHandset$: Observable<boolean> = this.breakpointObserver
        .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
        .pipe(map((result: BreakpointState): boolean => result.matches));

    private mainSpinnerRef: SpinnerOverlayRef | undefined;
    private pageVisible: Subscription | undefined;
    private wakeLock: WakeLockSentinel | undefined;

    constructor(
        private snack: MatSnackBar,
        private spinner: SpinnerOverlayService,
        private mediaMatcher: MediaMatcher,
        private breakpointObserver: BreakpointObserver,
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

    async disableWackeLock(): Promise<void> {
        await this.wakeLock?.release();
        this.pageVisible?.unsubscribe();
    }

    async enableWakeLock(): Promise<void> {
        this.pageVisible = fromEvent(document, "visibilitychange")
            .pipe(
                startWith(document.visibilityState),
                filter((): boolean => document.visibilityState === "visible"),
                tap(async (): Promise<void> => {
                    try {
                        if (!("wakeLock" in navigator)) {
                            await this.disableWackeLock();
                            throw Error("Wake lock API is not available");
                        }
                        this.wakeLock = await (navigator as Navigator).wakeLock.request("screen");
                    } catch (error: unknown) {
                        if (error instanceof Error) {
                            setTimeout((): void => {
                                this.snack.open(
                                    `Failed to request wake lock: ${(error as Error).message}`,
                                    "Dismiss",
                                );
                            }, 5000);
                            console.error(error.message);
                        }
                    }
                }),
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
