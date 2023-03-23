import { TestBed } from "@angular/core/testing";

import { WebSocketService } from "./websocket.service";

describe("WebsocketService", (): void => {
    let service: WebSocketService;

    beforeEach((): void => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(WebSocketService);
    });

    it("should be created", (): void => {
        expect(service).toBeTruthy();
    });
});
