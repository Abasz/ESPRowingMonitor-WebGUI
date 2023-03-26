import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: "secondsToTime",
})
export class SecondsToTimePipe implements PipeTransform {
    private days: number = 0;
    private hours: number = 0;
    private mins: number = 0;
    private seconds: number = 0;

    transform(seconds: number, format: "full" | "simple" | "pace" = "full"): string {
        /**
         * Pipe for converting seconds to comma separated elapsed time string
         * (e.g.: 1 day, 20 horus, 3 minutes).
         *
         * @param seconds The actual time in seconds.
         */
        this.days = Math.floor(seconds / 86400);
        this.hours = Math.floor((seconds % 86400) / 3600);
        this.mins = Math.floor(((seconds % 86400) % 3600) / 60);
        this.seconds = seconds;

        if (format === "simple") {
            return this.formatSimple();
        }

        if (format === "pace") {
            return this.formatPace();
        }

        return this.formatFull();
    }

    private formatFull(): string {
        switch (true) {
            case this.seconds === 0:
                return "0";
            case this.seconds === 1:
                return "1 second";
            case this.seconds < 60:
                return `${this.seconds} seconds`;
            default:
                let timeString = "";
                if (this.days > 0) {
                    timeString += `${this.days} ${this.days === 1 ? "day" : "days"}${
                        this.hours + this.mins > 0 ? ", " : ""
                    }`;
                }
                if (this.hours > 0) {
                    timeString += `${this.hours} ${this.hours === 1 ? "hour" : "hours"}${
                        this.mins > 0 ? ", " : ""
                    }`;
                }
                if (this.mins > 0) {
                    timeString += `${this.mins} ${this.mins === 1 ? "minute" : "minutes"}`;
                }

                return timeString;
        }
    }

    private formatPace(): string {
        if (this.seconds === Infinity || isNaN(this.seconds)) return "--";
        if (this.hours > 0) {
            return `${this.hours}:${this.mins.toString().padStart(2, "0")}:${(Math.round(this.seconds) % 60)
                .toString()
                .padStart(2, "0")}`;
        } else {
            return `${this.mins}:${(Math.round(this.seconds) % 60).toString().padStart(2, "0")}`;
        }
    }

    private formatSimple(): string {
        let timeString = "";

        switch (true) {
            case this.seconds === 0:
                return "0";
            case this.seconds < 60:
                return `${this.seconds}s`;
            default:
                if (this.days > 0) {
                    timeString += `${this.days}d${this.hours + this.mins > 0 ? " " : ""}`;
                }
                if (this.hours > 0) {
                    timeString += `${this.hours}h${this.mins > 0 ? " " : ""}`;
                }
                if (this.mins > 0) {
                    timeString += `${this.mins}m`;
                }

                return timeString;
        }
    }
}
