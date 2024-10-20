import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: "batteryLevel",
    standalone: true,
})
export class BatteryLevelPipe implements PipeTransform {
    transform(value: number): string {
        switch (true) {
            case value > 88:
                return "battery_full";
            case value > 76:
                return "battery_6_bar";
            case value > 64:
                return "battery_5_bar";
            case value > 54:
                return "battery_4_bar";
            case value > 42:
                return "battery_3_bar";
            case value > 30:
                return "battery_2_bar";
            case value > 18:
                return "battery_1_bar";
            default:
                return "battery_0_bar";
        }
    }
}
