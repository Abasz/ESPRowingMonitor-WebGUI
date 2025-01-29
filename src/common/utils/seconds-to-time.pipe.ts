import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: "secondsToTime",
})
export class SecondsToTimePipe implements PipeTransform {
    private days: number = 0;
    private hours: number = 0;
    private mins: number = 0;
    private seconds: number = 0;

    transform(
        seconds: number,
        format: "verbose" | "full" | "simple" | "pace" = "full",
        round: boolean = false,
    ): string {
        /**
         * Pipe for converting seconds to comma separated elapsed time string
         * (e.g.: 1 day, 20 horus, 3 minutes).
         *
         * @param seconds The actual time in seconds.
         */
        const secondsRounded = Math.round(seconds);
        if (!round) {
            this.days = Math.floor(secondsRounded / 86400);
            this.hours = Math.floor((secondsRounded % 86400) / 3600);
            this.mins = Math.floor(((secondsRounded % 86400) % 3600) / 60);
        } else {
            this.days = Math.round(secondsRounded / 86400);
            this.hours = Math.round((secondsRounded % 86400) / 3600);
            this.mins = Math.round(((secondsRounded % 86400) % 3600) / 60);
        }
        this.seconds = secondsRounded;

        switch (format) {
            case "simple":
                return this.formatSimple();

            case "pace":
                return this.formatPace();

            case "verbose":
                return this.formatVerbose();

            default:
                return this.formatFull();
        }
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
            return `${this.hours}:${this.mins.toString().padStart(2, "0")}:${(this.seconds % 60)
                .toString()
                .padStart(2, "0")}`;
        } else {
            return `${this.mins}:${(this.seconds % 60).toString().padStart(2, "0")}`;
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

    private formatVerbose(): string {
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

                const seconds = Math.round(((this.seconds % 86400) % 3600) % 60);
                if (this.mins > 0) {
                    timeString += `${this.mins} ${this.mins === 1 ? "minute" : "minutes"}${
                        seconds > 0 ? ", " : ""
                    }`;
                }
                if (seconds > 0) {
                    timeString += `${seconds} ${this.mins === 1 ? "second" : "seconds"}`;
                }

                return timeString;
        }
    }
}
