import { TestBed } from "@angular/core/testing";

import { AntHeartRateService } from "./ant-heart-rate.service";

describe("AntHeartRateService", (): void => {
    let service: AntHeartRateService;

    beforeEach((): void => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(AntHeartRateService);
    });

    it("should be created", (): void => {
        expect(service).toBeTruthy();
    });
});
