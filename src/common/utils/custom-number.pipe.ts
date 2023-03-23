import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: "customNumber",
})
export class CustomNumberPipe implements PipeTransform {
    transform(value: number): string | number {
        // eslint-disable-next-line no-null/no-null
        if (value === undefined || value === null || value === Infinity || isNaN(value) || value === 0)
            return "--";

        return Math.round(value);
    }
}
