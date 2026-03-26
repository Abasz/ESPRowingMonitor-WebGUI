import {
    AbstractControl,
    FormArray,
    FormControl,
    FormGroup,
    FormRecord,
    NgForm,
    ValidationErrors,
    ValidatorFn,
} from "@angular/forms";

import { IValidationError, IValidationErrors } from "../common.interfaces";

export async function downloadFiles(files: Array<{ blob: Blob; name: string }>): Promise<void> {
    const shareData: ShareData = {
        files: files.map(
            (file: { blob: Blob; name: string }): File =>
                new File([file.blob], file.name, { type: file.blob.type }),
        ),
    };

    if (navigator.canShare && navigator.canShare(shareData)) {
        try {
            await navigator.share(shareData);

            return;
        } catch (error) {
            if (error instanceof DOMException && !["AbortError", "NotAllowedError"].includes(error.name)) {
                console.error("Error sharing file:", error.name);
            }
        }
    }

    for (const file of files) {
        const url = window.URL.createObjectURL(file.blob);
        const downloadTag = document.createElement("a");
        downloadTag.href = url;
        downloadTag.download = file.name;
        downloadTag.click();
        window.URL.revokeObjectURL(url);
    }
}

export function getValidationErrors<
    TControl extends {
        [K in keyof TControl]: FormControl | FormGroup | FormArray | FormRecord;
    },
>(controls: {
    [K in keyof TControl]: FormControl | FormGroup | FormArray | FormRecord;
}): ValidationErrors {
    const validationErrors: ValidationErrors = {};

    Object.keys(controls).forEach((controlName: string): void => {
        const control = controls[controlName as keyof TControl];

        if (control instanceof FormGroup || control instanceof FormArray || control instanceof FormRecord) {
            validationErrors[controlName] = getValidationErrors(
                control.controls as {
                    [key: string]: FormGroup | FormArray | FormRecord;
                },
            );

            return;
        }

        validationErrors[controlName] = control.errors;
    });

    return validationErrors;
}

export function parseErrors<TControl extends { [K in keyof TControl]: AbstractControl<unknown, unknown> }>(
    form: FormGroup<TControl> | NgForm,
    errors: IValidationErrors,
): void {
    Object.keys(errors).forEach((key: string): void => {
        errors[key].forEach((error: IValidationError): void => {
            if ("get" in form) {
                form.get(key)?.setErrors({
                    [error.validatorKey]: true,
                });
                form.get(key)?.markAsTouched();

                return;
            }

            form.form.get(key)?.setErrors({
                [error.validatorKey]: true,
            });
            form.form.get(key)?.markAsTouched();
        });
    });
}

export class CustomValidators {
    static greaterThanCrossFieldValidator(field1: string, field2: string): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const controlFieldControl1 = control.get(field1);
            const controlFieldControl2 = control.get(field2);
            if (controlFieldControl1 && controlFieldControl2) {
                if (controlFieldControl1.value - controlFieldControl2.value <= 0) {
                    controlFieldControl1.markAsTouched();
                    controlFieldControl2.markAsTouched();
                    controlFieldControl1.setErrors({ invalidRecoveryDelta: true });
                    controlFieldControl2.setErrors({ invalidRecoveryDelta: true });

                    return { invalidRecoveryDelta: true };
                }

                controlFieldControl1.setErrors(null);
                controlFieldControl2.setErrors(null);
            }

            return null;
        };
    }
}

export function withDelay<T>(ms: number, value?: Promise<T>): Promise<T> {
    return new Promise<T>(
        (resolve: (value: Promise<T>) => void, reject: (reason?: unknown) => void): number =>
            window.setTimeout(resolve, ms, value?.catch(reject)),
    );
}

export function deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        if (sourceValue === undefined) {
            continue;
        }
        const targetValue = target[key];
        if (
            sourceValue !== null &&
            typeof sourceValue === "object" &&
            !Array.isArray(sourceValue) &&
            targetValue !== null &&
            targetValue !== undefined &&
            typeof targetValue === "object" &&
            !Array.isArray(targetValue)
        ) {
            result[key] = deepMerge(
                targetValue as Record<string, unknown>,
                sourceValue as Record<string, unknown>,
            );
        } else {
            result[key] = sourceValue;
        }
    }

    return result;
}

declare global {
    interface String {
        camelize(): string;
        pascalize(): string;
        toFirstLowerCase(): string;
        pascalCaseToSentence(): string;
        toFirstUpperCase(): string;
    }
    interface Date {
        toDateTimeStringFormat(): string;
    }
}

Date.prototype.toDateTimeStringFormat = function (): string {
    const self: Date = this as Date;

    return `${self.getFullYear()}-${(self.getMonth() + 1).toString().padStart(2, "0")}-${self
        .getDate()
        .toString()
        .padStart(2, "0")} ${self.getHours().toString().padStart(2, "0")}-${self
        .getMinutes()
        .toString()
        .padStart(2, "0")}-${self.getSeconds().toString().padStart(2, "0")}`;
};

String.prototype.pascalCaseToSentence = function (): string {
    const self: string = this as string;

    return self
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
        .toLowerCase()
        .replace(/^./, (char: string): string => char.toUpperCase());
};

String.prototype.toFirstUpperCase = function (): string {
    const self: string = this as string;

    return self[0].toUpperCase() + self.slice(1);
};

String.prototype.toFirstLowerCase = function (): string {
    const self: string = this as string;

    return self[0].toLowerCase() + self.slice(1);
};

String.prototype.camelize = function (): string {
    const self: string = this as string;

    return self
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter: string, index: number): string => {
            return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
        })
        .replace(/\s+/g, "");
};

String.prototype.pascalize = function (): string {
    const self: string = this as string;

    return self
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter: string): string => {
            return letter.toUpperCase();
        })
        .replace(/\s+/g, "");
};
