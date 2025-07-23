import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DataRecorderService } from "./data-recorder.service";

describe("DataRecorderService", (): void => {
    let service: DataRecorderService;

    beforeEach((): void => {
        TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
        service = TestBed.inject(DataRecorderService);
    });

    it("should be created", (): void => {
        expect(service).toBeTruthy();
    });
});
