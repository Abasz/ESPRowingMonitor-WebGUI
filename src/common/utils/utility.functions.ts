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

                // eslint-disable-next-line no-null/no-null
                controlFieldControl1.setErrors(null);
                // eslint-disable-next-line no-null/no-null
                controlFieldControl2.setErrors(null);
            }

            // eslint-disable-next-line no-null/no-null
            return null;
        };
    }
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, id-blacklist
    interface String {
        camelize(): string;
        pascalize(): string;
        toFirstLowerCase(): string;
        toFirstUpperCase(): string;
    }
}

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
