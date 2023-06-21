import { TestBed } from "@angular/core/testing";

import { HeartRateService } from "./heart-rate.service";

describe("BluetoothService", (): void => {
    let service: HeartRateService;

    beforeEach((): void => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(HeartRateService);
    });

    it("should be created", (): void => {
        expect(service).toBeTruthy();
    });
});
