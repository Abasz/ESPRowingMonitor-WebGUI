import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: "roundNumber",
})
export class RoundNumberPipe implements PipeTransform {
    transform(value: number, precision: number = 0): string | number {
        if (value === undefined || value === null || value === Infinity || isNaN(value) || value === 0)
            return "--";

        const decimal = Math.pow(10, precision);

        return Math.round(value * decimal) / decimal;
    }
}
