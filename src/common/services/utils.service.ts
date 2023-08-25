import { BreakpointObserver, Breakpoints, BreakpointState, MediaMatcher } from "@angular/cdk/layout";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { IMediaQuery } from "../common.interfaces";
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

    constructor(
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
