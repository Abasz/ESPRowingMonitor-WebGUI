import { TestBed } from "@angular/core/testing";

import { BLEHeartRateService } from "./ble-heart-rate.service";

describe("BLEHeartRateService", (): void => {
    let service: BLEHeartRateService;

    beforeEach((): void => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(BLEHeartRateService);
    });

    it("should be created", (): void => {
        expect(service).toBeTruthy();
    });
});
