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
import { ExportSessionData } from "../database.interfaces";
import { ILap, ITrainingCenterDatabase } from "../tcx.interface";

import { ITrackPoint } from "./../tcx.interface";

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

export function withDelay<T>(ms: number, value?: T): Promise<T> {
    return new Promise<T>((resolve: (value: T | PromiseLike<T>) => void): number =>
        window.setTimeout(resolve, ms, value),
    );
}

export function createSessionTcxObject(
    sessionId: number,
    rowingSessionData: Array<ExportSessionData>,
): ITrainingCenterDatabase {
    const lastDataPoint = rowingSessionData[rowingSessionData.length - 1];

    const heartRatePoints: Array<number> = rowingSessionData
        .filter(
            (dataPoint: ExportSessionData): dataPoint is Required<ExportSessionData> =>
                dataPoint.heartRate !== undefined,
        )
        .map((dataPoint: Required<ExportSessionData>): number => dataPoint.heartRate.heartRate);

    const strokeRates: Array<number> = rowingSessionData
        .filter((dataPoint: ExportSessionData): boolean => dataPoint.strokeRate > 0)
        .map((dataPoint: ExportSessionData): number => dataPoint.strokeRate);

    const dragFactors: Array<number> = rowingSessionData
        .filter((dataPoint: ExportSessionData): boolean => dataPoint.dragFactor > 0)
        .map((dataPoint: ExportSessionData): number => dataPoint.dragFactor);

    const lap: ILap = {
        "@": { StartTime: new Date(sessionId).toISOString() },
        TotalTimeSeconds: (lastDataPoint.timeStamp.getTime() - sessionId) / 1000,
        DistanceMeters: lastDataPoint.distance / 100,
        MaximumSpeed: Math.max(
            ...rowingSessionData.map((dataPoint: ExportSessionData): number => dataPoint.speed),
            0,
        ),
        Intensity: "Active",
        Cadence: Math.round(
            strokeRates.reduce((average: number, strokeRate: number): number => average + strokeRate, 0) /
                strokeRates.length,
        ),
        TriggerMethod: "Manual",
        Track: {
            Trackpoint: rowingSessionData.map((dataPoint: ExportSessionData): ITrackPoint => {
                const trackPoint: ITrackPoint = {
                    Time: new Date(dataPoint.timeStamp).toISOString(),
                    DistanceMeters: dataPoint.distance / 100,
                    Cadence: Math.round(dataPoint.strokeRate),
                    Extensions: {
                        "ns3:TPX": {
                            "ns3:Speed": dataPoint.speed ?? 0,
                            "ns3:Watts": dataPoint.avgStrokePower,
                        },
                    },
                };

                if (dataPoint.heartRate) {
                    trackPoint.HeartRateBpm = {
                        Value: dataPoint.heartRate.heartRate,
                    };
                }

                return trackPoint;
            }),
        },
        Extensions: {
            "ns3:LX": {
                "ns3:Steps": lastDataPoint.strokeCount,
                "ns3:AvgSpeed":
                    rowingSessionData.reduce(
                        (average: number, dataPoint: ExportSessionData): number => average + dataPoint.speed,
                        0,
                    ) /
                    (rowingSessionData.length - 1),
                "ns3:AvgWatts": Math.round(
                    rowingSessionData.reduce(
                        (average: number, dataPoint: ExportSessionData): number =>
                            average + dataPoint.avgStrokePower,
                        0,
                    ) /
                        (rowingSessionData.length - 1),
                ),
                "ns3:MaxWatts": Math.max(
                    ...rowingSessionData.map((dataPoint: ExportSessionData): number => dataPoint.peakForce),
                    0,
                ),
            },
        },
    };

    if (heartRatePoints.length > 0) {
        lap.AverageHeartRateBpm = {
            Value: Math.round(
                heartRatePoints.reduce(
                    (average: number, heartRate: number): number => average + heartRate,
                    0,
                ) / heartRatePoints.length,
            ),
        };

        lap.MaximumHeartRateBpm = { Value: Math.max(...heartRatePoints, 0) };
    }

    return {
        "@": {
            "xsi:schemaLocation":
                "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd",
            "xmlns:ns5": "http://www.garmin.com/xmlschemas/ActivityGoals/v1",
            "xmlns:ns3": "http://www.garmin.com/xmlschemas/ActivityExtension/v2",
            "xmlns:ns2": "http://www.garmin.com/xmlschemas/UserProfile/v2",
            xmlns: "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2",
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "xmlns:ns4": "http://www.garmin.com/xmlschemas/ProfileExtension/v1",
        },
        Activities: {
            Activity: [
                {
                    "@": { Sport: "Other" },
                    Id: new Date(sessionId).toISOString(),
                    Lap: [lap],
                    Notes: `Indoor Rowing/Kayaking, Drag factor/Resistance level: ${Math.round(
                        dragFactors.reduce(
                            (average: number, strokeRate: number): number => average + strokeRate,
                            0,
                        ) / dragFactors.length,
                    )}`,
                },
            ],
        },
        Author: {
            "@": {
                "xsi:type": "Application_t",
            },
            Name: "ESP Rowing Monitor",
            Build: {
                Version: {
                    VersionMajor: 0,
                    VersionMinor: 0,
                    BuildMajor: 0,
                    BuildMinor: 0,
                },
                LangID: "en",
                PartNumber: "ESP-32ROW-PM",
            },
        },
    };
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, id-blacklist
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
