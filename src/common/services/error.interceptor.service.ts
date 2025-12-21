import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandler,
    HttpInterceptor,
    HttpRequest,
    HttpStatusCode,
} from "@angular/common/http";
import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";

import { IValidationErrors } from "../common.interfaces";

import { UtilsService } from "./utils.service";

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
    constructor(
        private snackBar: MatSnackBar,
        private utils: UtilsService,
    ) {}

    intercept(
        req: HttpRequest<unknown>,
        next: HttpHandler,
    ): Observable<HttpEvent<HttpErrorResponse | IValidationErrors>> {
        return next.handle(req).pipe(
            catchError((error: HttpErrorResponse): Observable<never> => {
                this.utils.mainSpinner().close();

                if (error.status === 422 || error.status === 401) {
                    return throwError((): IValidationErrors => error.error);
                }

                if ((error.status === 400 || error.status === 404 || error.status === 500) && error.error) {
                    if (error.error instanceof ArrayBuffer) {
                        const decoder = new TextDecoder("utf-8");
                        const decodedString = decoder.decode(new Uint8Array(error.error as ArrayBuffer));
                        error = { ...error, error: JSON.parse(decodedString) };
                    }
                    this.snackBar.open(`ERROR: ${error.error.message}`, "Dismiss");
                } else {
                    this.snackBar.open(`ERROR: ${HttpStatusCode[error.status]}`, "Dismiss");
                }

                return throwError((): HttpErrorResponse => error);
            }),
        );
    }
}
