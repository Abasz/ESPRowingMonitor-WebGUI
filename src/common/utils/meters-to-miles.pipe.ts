import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "metersToMiles" })
export class MetersToMilesPipe implements PipeTransform {
    transform(meters: number): number {
        return meters * 0.000621371;
    }
}
