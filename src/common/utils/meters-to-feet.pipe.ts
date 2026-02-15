import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "metersToFeet" })
export class MetersToFeetPipe implements PipeTransform {
    transform(meters: number): number {
        return meters * 3.28084;
    }
}
