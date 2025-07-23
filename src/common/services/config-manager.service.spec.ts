import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ConfigManagerService } from "./config-manager.service";

describe("ConfigManagerService", (): void => {
    let service: ConfigManagerService;

    beforeEach((): void => {
        TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
        service = TestBed.inject(ConfigManagerService);
    });

    it("should be created", (): void => {
        expect(service).toBeTruthy();
    });
});
