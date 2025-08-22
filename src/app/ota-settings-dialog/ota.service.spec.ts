/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { TestBed } from "@angular/core/testing";

import { OtaError, OtaRequestOpCodes, OtaResponseOpCodes } from "../../common/ble.interfaces";
import { ErgGenericDataService } from "../../common/services/ergometer/erg-generic-data.service";

import { OtaService } from "./ota.service";

// mock helper to create fake characteristics
function createMockCharacteristic(): jasmine.SpyObj<BluetoothRemoteGATTCharacteristic> {
    const spy = jasmine.createSpyObj("BluetoothRemoteGATTCharacteristic", [
        "writeValueWithoutResponse",
        "startNotifications",
        "stopNotifications",
        "addEventListener",
        "removeEventListener",
    ]);

    spy.service = jasmine.createSpyObj("BluetoothRemoteGATTService", ["device"]);
    spy.service.device = jasmine.createSpyObj("BluetoothDevice", ["addEventListener", "removeEventListener"]);

    return spy;
}

// mock helper to create test files
function createTestFile(sizeInBytes: number, name: string = "test.bin"): File {
    const content = new Uint8Array(sizeInBytes).fill(42); // fill with arbitrary test data

    return new File([content], name, { type: "application/octet-stream" });
}

// mock helper to create Begin response DataView
function createBeginResponseDataView(
    responseCode: OtaResponseOpCodes,
    attr: number = 20,
    buffer: number = 100,
): DataView {
    const data = new Uint8Array(9);
    data[0] = responseCode;
    // little-endian encoding for attr (bytes 1-4)
    data[1] = attr & 0xff;
    data[2] = (attr >> 8) & 0xff;
    data[3] = (attr >> 16) & 0xff;
    data[4] = (attr >> 24) & 0xff;
    // little-endian encoding for buffer (bytes 5-8)
    data[5] = buffer & 0xff;
    data[6] = (buffer >> 8) & 0xff;
    data[7] = (buffer >> 16) & 0xff;
    data[8] = (buffer >> 24) & 0xff;

    return new DataView(data.buffer);
}

// mock helper to create single-byte response DataView
function createSingleByteResponse(responseCode: OtaResponseOpCodes): DataView {
    return new DataView(new Uint8Array([responseCode]).buffer);
}

describe("OtaService", (): void => {
    let service: OtaService;
    let mockErgGenericDataService: jasmine.SpyObj<ErgGenericDataService>;
    let mockResponseCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    let mockSendCharacteristic: jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
    const valueChangedListenerReady: (
        broadcastValue?: DataView,
        runCount?: number,
    ) => Promise<{ callCount: number }> = async (broadcastValue?: DataView, runCount: number = 1) => {
        let callCount = 1;

        for (; callCount <= runCount; ) {
            await new Promise((resolve: (value: { callCount: number }) => void) => {
                mockResponseCharacteristic.addEventListener
                    .withArgs("characteristicvaluechanged", jasmine.any(Function), undefined)
                    .and.callFake((_: string, handler: (event: Event) => void) => {
                        charValueListener = handler;
                        if (broadcastValue) {
                            charValueListener({
                                target: { value: broadcastValue },
                            } as unknown as Event);
                        }
                        callCount++;
                        resolve({ callCount });
                    });
            });
        }

        return { callCount };
    };

    let charValueListener: ((event: Event) => void) | undefined = undefined;

    beforeEach((): void => {
        mockErgGenericDataService = jasmine.createSpyObj("ErgGenericDataService", ["getOtaCharacteristics"]);
        mockResponseCharacteristic = createMockCharacteristic();
        mockSendCharacteristic = createMockCharacteristic();
        mockErgGenericDataService.getOtaCharacteristics.and.returnValue(
            Promise.resolve({
                responseCharacteristic: mockResponseCharacteristic,
                sendCharacteristic: mockSendCharacteristic,
            }),
        );
        TestBed.configureTestingModule({
            providers: [OtaService, { provide: ErgGenericDataService, useValue: mockErgGenericDataService }],
        });

        service = TestBed.inject(OtaService);

        mockResponseCharacteristic.startNotifications.and.resolveTo(mockResponseCharacteristic);
        mockResponseCharacteristic.stopNotifications.and.resolveTo(mockResponseCharacteristic);

        charValueListener = undefined;

        mockResponseCharacteristic.removeEventListener.and.callFake(
            (_: string, handler: (event: Event) => void) => {
                if (charValueListener === handler) {
                    charValueListener = undefined;
                }
            },
        );
    });

    describe("performOta method", (): void => {
        describe("as part of Begin", (): void => {
            it("should send Begin with 32-bit little-endian firmware size", async (): Promise<void> => {
                const testFile = createTestFile(1024);

                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(createBeginResponseDataView(OtaResponseOpCodes.Ok, 15, 100));
                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.Ok));
                await performOtaPromise;

                expect(mockSendCharacteristic.writeValueWithoutResponse).toHaveBeenCalledWith(
                    new Uint8Array([
                        OtaRequestOpCodes.Begin,
                        1024 & 0xff,
                        (1024 >> 8) & 0xff,
                        (1024 >> 16) & 0xff,
                        (1024 >> 24) & 0xff,
                    ]),
                );
            });

            it("should parse attr (per-package payload) from Begin response payload", async (): Promise<void> => {
                const testFile = createTestFile(100);
                const expectedAttr = 15;
                const expectedBuffer = 1000;

                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(
                    createBeginResponseDataView(OtaResponseOpCodes.Ok, expectedAttr, expectedBuffer),
                );
                mockSendCharacteristic.writeValueWithoutResponse.calls.reset();
                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.Ok));
                await performOtaPromise;

                const endMessageCount = 1;
                expect(mockSendCharacteristic.writeValueWithoutResponse).toHaveBeenCalledTimes(
                    Math.ceil(100 / expectedAttr) + endMessageCount,
                );

                const firstPayload = mockSendCharacteristic.writeValueWithoutResponse.calls.allArgs()[0][0];
                expect(firstPayload.byteLength - 1).toBe(expectedAttr);
            });

            it("should parse buffer size from Begin response payload", async (): Promise<void> => {
                const testFile = createTestFile(200);
                const expectedBuffer = 50;
                const expectedAttribute = 10;

                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(
                    createBeginResponseDataView(OtaResponseOpCodes.Ok, expectedAttribute, expectedBuffer),
                );
                mockSendCharacteristic.writeValueWithoutResponse.calls.reset();
                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.NotOk));

                await expectAsync(performOtaPromise).toBeRejected();
                expect(mockSendCharacteristic.writeValueWithoutResponse).toHaveBeenCalledTimes(
                    expectedBuffer / expectedAttribute,
                );
            });

            it("should treat non-Ok or malformed Begin response as BeginError", async (): Promise<void> => {
                const testFile = createTestFile(100);

                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.NotOk));

                await expectAsync(performOtaPromise).toBeRejectedWith(
                    jasmine.objectContaining({ name: "BeginError" }),
                );
            });

            it("should return IncorrectFormat when Begin payload is not 4 bytes", async (): Promise<void> => {
                const testFile = createTestFile(100);

                const performOtaPromise = service.performOta(testFile);
                const malformedResponse = new DataView(
                    new Uint8Array([OtaResponseOpCodes.IncorrectFormat, 1, 2]).buffer,
                );
                await valueChangedListenerReady(malformedResponse);

                await expectAsync(performOtaPromise).toBeRejectedWithError(OtaError, "IncorrectFormat");
            });

            it("should return IncorrectFirmwareSize when firmware is too large", async (): Promise<void> => {
                const testFile = createTestFile(100);

                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(
                    createSingleByteResponse(OtaResponseOpCodes.IncorrectFirmwareSize),
                );

                await expectAsync(performOtaPromise).toBeRejectedWithError(OtaError, "IncorrectFirmwareSize");
            });

            it("should handle rejection when ErgGenericDataService.getOtaCharacteristics() rejects", async (): Promise<void> => {
                mockErgGenericDataService.getOtaCharacteristics.and.returnValue(
                    Promise.reject(new Error("Connection failed")),
                );
                const testFile = createTestFile(100);

                await expectAsync(service.performOta(testFile)).toBeRejectedWithError(
                    Error,
                    "Connection failed",
                );
            });
        });

        describe("as part of Package transfer", (): void => {
            const testFile = createTestFile(60);
            const expectedAttr = 10;
            const expectedBuffer = 30;

            it("should send Package messages with payloads of size attr until buffer is full", async (): Promise<void> => {
                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(
                    createBeginResponseDataView(OtaResponseOpCodes.Ok, expectedAttr, expectedBuffer),
                );
                mockSendCharacteristic.writeValueWithoutResponse.calls.reset();
                const responseSpy = await valueChangedListenerReady(
                    createSingleByteResponse(OtaResponseOpCodes.Ok),
                );
                await performOtaPromise;

                expect(
                    mockSendCharacteristic.writeValueWithoutResponse.calls
                        .all()
                        .slice(0, -1)
                        .forEach((call: jasmine.CallInfo<(value: BufferSource) => Promise<void>>) => {
                            const payload = call.args[0];
                            expect(payload.byteLength - 1).toBeLessThanOrEqual(expectedAttr);
                        }),
                );

                expect(responseSpy.callCount)
                    .withContext("Should expect file size / expectedBuffer amount of response")
                    .toBe(testFile.size / expectedBuffer);
            });

            it("should update progress after each batch of packages sent", async (): Promise<void> => {
                const performOtaPromise = service.performOta(createTestFile(100));
                await valueChangedListenerReady(
                    createBeginResponseDataView(OtaResponseOpCodes.Ok, expectedAttr, expectedBuffer),
                );
                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.Ok), 2);

                expect(service.progress()).toBeGreaterThan(0);
                expect(service.progress()).toBeLessThanOrEqual(100);

                await performOtaPromise;

                expect(service.progress()).toBe(100);
            });

            it("should throw PackageError if device responds with non-Ok after a batch", async (): Promise<void> => {
                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(createBeginResponseDataView(OtaResponseOpCodes.Ok, 10, 30));

                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.NotOk));

                await expectAsync(performOtaPromise).toBeRejectedWith(
                    jasmine.objectContaining({
                        name: "PackageError",
                    }),
                );
            });

            it("should stop sending if cancellation token is aborted during package send", async (): Promise<void> => {
                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(createBeginResponseDataView(OtaResponseOpCodes.Ok, 10, 50));

                service.abortOta();
                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.Ok));

                await performOtaPromise;
                expect(service.progress()).toBe(0);
            });
        });

        describe("as part of End transfer", (): void => {
            const testFile = createTestFile(60);
            const expectedAttr = 10;
            const expectedBuffer = 30;

            it("should send End opcode followed by 16-byte MD5", async (): Promise<void> => {
                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(
                    createBeginResponseDataView(OtaResponseOpCodes.Ok, expectedAttr, expectedBuffer),
                );

                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.Ok));

                await performOtaPromise;

                const endCall = mockSendCharacteristic.writeValueWithoutResponse.calls.mostRecent()
                    .args[0] as Uint8Array;

                expect(endCall[0]).toBe(OtaRequestOpCodes.End);
                expect(endCall.byteLength).toBe(17);
            });

            it("should throw InstallError when device responds NotOk to End", async (): Promise<void> => {
                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(
                    createBeginResponseDataView(OtaResponseOpCodes.Ok, expectedAttr, expectedBuffer),
                );
                await valueChangedListenerReady(
                    createSingleByteResponse(OtaResponseOpCodes.Ok),
                    testFile.size / expectedBuffer,
                );

                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.NotOk));

                await expectAsync(performOtaPromise).toBeRejectedWith(
                    jasmine.objectContaining({
                        name: "InstallError",
                    }),
                );
            });

            it("should treat checksum error as InstallError", async (): Promise<void> => {
                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(
                    createBeginResponseDataView(OtaResponseOpCodes.Ok, expectedAttr, expectedBuffer),
                );
                await valueChangedListenerReady(
                    createSingleByteResponse(OtaResponseOpCodes.Ok),
                    testFile.size / expectedBuffer,
                );

                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.ChecksumError));

                await expectAsync(performOtaPromise).toBeRejectedWith(
                    jasmine.objectContaining({
                        name: "InstallError",
                    }),
                );
            });
        });
    });

    describe("abortOta method", (): void => {
        beforeEach(async (): Promise<void> => {
            const testFile = createTestFile(10);
            service.performOta(testFile).catch((): void => {
                // no-op
            });
            await valueChangedListenerReady(createBeginResponseDataView(OtaResponseOpCodes.NotOk));
        });

        it("should set progress to 0 when characteristics are undefined", async (): Promise<void> => {
            const testFile = createTestFile(100);
            service.performOta(testFile);
            await valueChangedListenerReady(createBeginResponseDataView(OtaResponseOpCodes.Ok, 10, 20));
            await valueChangedListenerReady(createBeginResponseDataView(OtaResponseOpCodes.Ok), 3);

            expect(service.progress()).toBeGreaterThan(0);

            mockSendCharacteristic =
                undefined as unknown as jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;
            mockResponseCharacteristic =
                undefined as unknown as jasmine.SpyObj<BluetoothRemoteGATTCharacteristic>;

            await service.abortOta();

            expect(service.progress()).toBe(0);
        });

        it("should write Abort opcode", async (): Promise<void> => {
            const abortPromise = service.abortOta();
            await valueChangedListenerReady(createBeginResponseDataView(OtaResponseOpCodes.Ok));

            await abortPromise;

            expect(mockSendCharacteristic.writeValueWithoutResponse).toHaveBeenCalledWith(
                new Uint8Array([OtaRequestOpCodes.Abort]),
            );
        });

        it("should resolve when device responds Ok to abort", async (): Promise<void> => {
            const abortPromise = service.abortOta();

            await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.Ok));

            await expectAsync(abortPromise).toBeResolved();
        });

        it("should throw AbortError when device returns non-Ok for abort", async (): Promise<void> => {
            const abortPromise = service.abortOta();

            await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.NotOk));

            await expectAsync(abortPromise).toBeRejectedWith(
                jasmine.objectContaining({
                    name: "AbortError",
                }),
            );
        });
    });
});
