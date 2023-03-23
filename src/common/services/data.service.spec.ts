import { TestBed } from "@angular/core/testing";

import { DataService } from "./data.service";

describe("DataService", (): void => {
    let service: DataService;

    beforeEach((): void => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(DataService);
    });

    it("should be created", (): void => {
        expect(service).toBeTruthy();
    });
});
