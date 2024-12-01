import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: "byte",
    standalone: true,
})
export class BytePipe implements PipeTransform {
    transform(bytes: number = 0, precision: number = 1): string {
        /**
         * Pipe for converting kB to human readable
         *
         * @param bytes The actual size in kB.
         * @param precision Number of decimal points. Default is 1.
         */
        const units: Array<string> = ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        // validate 'bytes'
        if (isNaN(bytes) || !isFinite(bytes)) {
            return "-";
        }

        if (bytes <= 0) {
            return "0 kB";
        }

        let unitIndex = 0;
        units.forEach((): void => {
            if (bytes >= 1024) {
                bytes = bytes / 1024;
                unitIndex++;
            }
        });

        return `${bytes.toFixed(precision)} ${units[unitIndex]}`;
    }
}
