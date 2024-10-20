import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: "enumToArray",
    standalone: true,
})
export class EnumToArrayPipe implements PipeTransform {
    transform(data: object): Array<{ key: string | number; value: string | number }> {
        return Object.keys(data)
            .filter((key: string): boolean => isNaN(+key))
            .map((key: string): { key: string | number; value: string | number } => ({
                key: data[key as keyof object],
                value: key,
            }));
    }
}
