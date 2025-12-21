import { TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OtaError, OtaRequestOpCodes, OtaResponseOpCodes } from "../../common/ble.interfaces";
import { ErgGenericDataService } from "../../common/services/ergometer/erg-generic-data.service";

import { OtaService } from "./ota.service";

// mock helper to create fake characteristics
function createMockCharacteristic(): BluetoothRemoteGATTCharacteristic {
    return {
        writeValueWithoutResponse: vi.fn(),
        startNotifications: vi.fn(),
        stopNotifications: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        service: {
            device: {
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            } as unknown as BluetoothDevice,
        } as BluetoothRemoteGATTService,
    } as unknown as BluetoothRemoteGATTCharacteristic;
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
    let mockErgGenericDataService: Pick<ErgGenericDataService, "getOtaCharacteristics">;
    let mockResponseCharacteristic: BluetoothRemoteGATTCharacteristic;
    let mockSendCharacteristic: BluetoothRemoteGATTCharacteristic;

    const valueChangedListenerReady: (
        broadcastValue?: DataView,
        runCount?: number,
    ) => Promise<{
        callCount: number;
    }> = async (broadcastValue?: DataView, runCount: number = 1): Promise<{ callCount: number }> => {
        let callCount = 1;

        for (; callCount <= runCount; ) {
            await new Promise((resolve: (value: { callCount: number }) => void): void => {
                vi.mocked(mockResponseCharacteristic.addEventListener).mockImplementation(
                    (
                        _: string,
                        handler: EventListenerOrEventListenerObject,
                        options?: boolean | AddEventListenerOptions,
                    ): void => {
                        charValueListener = handler;
                        if (
                            broadcastValue &&
                            typeof charValueListener === "function" &&
                            options === undefined
                        ) {
                            charValueListener({
                                target: { value: broadcastValue },
                            } as unknown as Event);
                        }
                        callCount++;
                        resolve({ callCount });
                    },
                );
            });
        }

        return { callCount };
    };

    let charValueListener: EventListenerOrEventListenerObject | undefined = undefined;

    beforeEach((): void => {
        mockErgGenericDataService = {
            getOtaCharacteristics: vi.fn(),
        } as unknown as Pick<ErgGenericDataService, "getOtaCharacteristics">;
        mockResponseCharacteristic = createMockCharacteristic();
        mockSendCharacteristic = createMockCharacteristic();
        vi.mocked(mockErgGenericDataService.getOtaCharacteristics).mockResolvedValue({
            responseCharacteristic:
                mockResponseCharacteristic as unknown as BluetoothRemoteGATTCharacteristic,
            sendCharacteristic: mockSendCharacteristic as unknown as BluetoothRemoteGATTCharacteristic,
        });
        TestBed.configureTestingModule({
            providers: [OtaService, { provide: ErgGenericDataService, useValue: mockErgGenericDataService }],
        });

        service = TestBed.inject(OtaService);

        vi.mocked(mockResponseCharacteristic.startNotifications).mockResolvedValue(
            mockResponseCharacteristic,
        );
        vi.mocked(mockResponseCharacteristic.stopNotifications).mockResolvedValue(mockResponseCharacteristic);

        charValueListener = undefined;

        vi.mocked(mockResponseCharacteristic.removeEventListener).mockImplementation(
            (_: string, handler: EventListenerOrEventListenerObject): void => {
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
                vi.mocked(mockSendCharacteristic.writeValueWithoutResponse).mockClear();
                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.Ok));
                await performOtaPromise;

                const endMessageCount = 1;
                expect(mockSendCharacteristic.writeValueWithoutResponse).toHaveBeenCalledTimes(
                    Math.ceil(100 / expectedAttr) + endMessageCount,
                );

                const firstPayload = vi.mocked(mockSendCharacteristic.writeValueWithoutResponse).mock
                    .calls[0][0];
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
                vi.mocked(mockSendCharacteristic.writeValueWithoutResponse).mockClear();
                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.NotOk));

                await expect(performOtaPromise).rejects.toThrow();
                expect(mockSendCharacteristic.writeValueWithoutResponse).toHaveBeenCalledTimes(
                    expectedBuffer / expectedAttribute,
                );
            });

            it("should treat non-Ok or malformed Begin response as BeginError", async (): Promise<void> => {
                const testFile = createTestFile(100);

                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.NotOk));

                await expect(performOtaPromise).rejects.toEqual(
                    expect.objectContaining({ name: "BeginError" }),
                );
            });

            it("should return IncorrectFormat when Begin payload is not 4 bytes", async (): Promise<void> => {
                const testFile = createTestFile(100);

                const performOtaPromise = service.performOta(testFile);
                const malformedResponse = new DataView(
                    new Uint8Array([OtaResponseOpCodes.IncorrectFormat, 1, 2]).buffer,
                );
                await valueChangedListenerReady(malformedResponse);

                await expect(performOtaPromise).rejects.toThrowError(OtaError);
            });

            it("should return IncorrectFirmwareSize when firmware is too large", async (): Promise<void> => {
                const testFile = createTestFile(100);

                const performOtaPromise = service.performOta(testFile);
                await valueChangedListenerReady(
                    createSingleByteResponse(OtaResponseOpCodes.IncorrectFirmwareSize),
                );

                await expect(performOtaPromise).rejects.toThrowError(OtaError);
            });

            it("should handle rejection when ErgGenericDataService.getOtaCharacteristics() rejects", async (): Promise<void> => {
                vi.mocked(mockErgGenericDataService.getOtaCharacteristics).mockRejectedValue(
                    new Error("Connection failed"),
                );
                const testFile = createTestFile(100);

                await expect(service.performOta(testFile)).rejects.toThrowError(Error);
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
                vi.mocked(mockSendCharacteristic.writeValueWithoutResponse).mockClear();
                const responseSpy = await valueChangedListenerReady(
                    createSingleByteResponse(OtaResponseOpCodes.Ok),
                );
                await performOtaPromise;

                vi.mocked(mockSendCharacteristic.writeValueWithoutResponse)
                    .mock.calls.slice(0, -1)
                    .forEach((call: Array<unknown>): void => {
                        const payload = call[0];
                        expect((payload as Uint8Array).byteLength - 1).toBeLessThanOrEqual(expectedAttr);
                    });

                expect(
                    responseSpy.callCount,
                    "Should expect file size / expectedBuffer amount of response",
                ).toBe(testFile.size / expectedBuffer);
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

                await expect(performOtaPromise).rejects.toEqual(
                    expect.objectContaining({
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

                const endCall = vi.mocked(mockSendCharacteristic.writeValueWithoutResponse).mock
                    .lastCall?.[0] as Uint8Array;

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

                await expect(performOtaPromise).rejects.toEqual(
                    expect.objectContaining({
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

                await expect(performOtaPromise).rejects.toEqual(
                    expect.objectContaining({
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

            mockSendCharacteristic = undefined as unknown as BluetoothRemoteGATTCharacteristic;
            mockResponseCharacteristic = undefined as unknown as BluetoothRemoteGATTCharacteristic;
            mockResponseCharacteristic = undefined as unknown as BluetoothRemoteGATTCharacteristic;

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

            await expect(abortPromise).resolves.not.toThrow();
        });

        it("should throw AbortError when device returns non-Ok for abort", async (): Promise<void> => {
            const abortPromise = service.abortOta();

            await valueChangedListenerReady(createSingleByteResponse(OtaResponseOpCodes.NotOk));

            await expect(abortPromise).rejects.toEqual(
                expect.objectContaining({
                    name: "AbortError",
                }),
            );
        });
    });
});
