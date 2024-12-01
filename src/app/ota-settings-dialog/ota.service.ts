import { Injectable, signal, WritableSignal } from "@angular/core";
import { md5 } from "js-md5";
import { firstValueFrom, fromEvent, Observable, of, take, takeUntil, throwError, timeout } from "rxjs";

import {
    IOtaBeginResponse,
    IOtaCharacteristics,
    OtaError,
    OtaRequestOpCodes,
    OtaResponseOpCodes,
} from "../../common/ble.interfaces";
import { ErgMetricsService } from "../../common/services/erg-metric-data.service";
import { observeValue$ } from "../../common/utils/utility.functions";

@Injectable()
export class OtaService {
    readonly progress: WritableSignal<number> = signal(0);

    private cancellationToken: AbortController = new AbortController();
    private responseCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
    private sendCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;

    constructor(private ergService: ErgMetricsService) {}

    async abortOta(): Promise<void> {
        if (this.sendCharacteristic === undefined || this.responseCharacteristic === undefined) {
            this.progress.set(0);
            this.cancellationToken.abort();

            return;
        }

        await this.responseCharacteristic.startNotifications();

        const tx = observeValue$(this.responseCharacteristic).pipe(
            timeout({
                each: 5000,
                with: (): Observable<DataView> =>
                    of(new DataView(new Uint8Array([OtaResponseOpCodes.TimeOut]).buffer)),
            }),
        );

        const abortResponseTask = firstValueFrom(tx);

        this.sendCharacteristic.writeValueWithoutResponse(new Uint8Array([OtaRequestOpCodes.Abort]));

        this.progress.set(0);
        this.cancellationToken.abort();

        const abortResponse = (await abortResponseTask).getUint8(0);

        await this.responseCharacteristic.stopNotifications();

        if (abortResponse !== OtaResponseOpCodes.Ok) {
            throw new OtaError("AbortError", OtaResponseOpCodes[abortResponse]);
        }
    }

    async performOta(file: File): Promise<void> {
        const { responseCharacteristic, sendCharacteristic }: IOtaCharacteristics =
            await this.ergService.getOtaCharacteristics();

        this.responseCharacteristic = responseCharacteristic;
        this.sendCharacteristic = sendCharacteristic;
        this.cancellationToken = new AbortController();

        const dataArray = new Uint8Array(await file.arrayBuffer());
        await this.responseCharacteristic.startNotifications();

        const tx = observeValue$(this.responseCharacteristic).pipe(
            timeout({
                each: 6000,
                with: (): Observable<never> =>
                    throwError(
                        (): OtaError =>
                            new OtaError("UpdateError", OtaResponseOpCodes[OtaResponseOpCodes.TimeOut]),
                    ),
            }),
            takeUntil(fromEvent(this.cancellationToken.signal, "abort").pipe(take(1))),
        );

        const { attr, buffer }: IOtaBeginResponse = await this.beginUpdate(sendCharacteristic, tx, dataArray);

        await this.sendPackages(sendCharacteristic, tx, dataArray, attr, buffer);
        if (this.cancellationToken.signal.aborted) {
            return;
        }

        this.progress.set(dataArray.length);

        await this.installFirmware(sendCharacteristic, tx, dataArray);

        await this.responseCharacteristic.stopNotifications();
    }

    private async beginUpdate(
        sendCharacteristic: BluetoothRemoteGATTCharacteristic,
        tx: Observable<DataView>,
        dataArray: Uint8Array,
    ): Promise<IOtaBeginResponse> {
        const beginResponseTask = firstValueFrom(tx, {
            defaultValue: new DataView(new Uint8Array([OtaResponseOpCodes.NotOk]).buffer),
        });

        sendCharacteristic.writeValueWithoutResponse(
            new Uint8Array([
                OtaRequestOpCodes.Begin,
                dataArray.length & 0xff,
                (dataArray.length >> 8) & 0xff,
                (dataArray.length >> 16) & 0xff,
                (dataArray.length >> 24) & 0xff,
            ]),
        );

        const beginResponse = await beginResponseTask;

        if (beginResponse.getUint8(0) !== OtaResponseOpCodes.Ok || beginResponse.byteLength !== 9) {
            this.cancellationToken.abort();
            throw new OtaError("BeginError", OtaResponseOpCodes[beginResponse.getUint8(0)]);
        }

        return { attr: beginResponse.getUint32(1, true), buffer: beginResponse.getUint32(1 + 4, true) };
    }

    private async installFirmware(
        sendCharacteristic: BluetoothRemoteGATTCharacteristic,
        tx: Observable<DataView>,
        dataArray: Uint8Array,
    ): Promise<void> {
        const md5responseTask = firstValueFrom(tx, {
            defaultValue: new DataView(new Uint8Array([OtaResponseOpCodes.NotOk]).buffer),
        });
        await sendCharacteristic.writeValueWithoutResponse(
            new Uint8Array([OtaRequestOpCodes.End, ...md5.array([...dataArray])]),
        );

        const responseOpCode = (await md5responseTask).getUint8(0);

        if (responseOpCode !== OtaResponseOpCodes.Ok) {
            this.cancellationToken.abort();
            throw new OtaError("InstallError", OtaResponseOpCodes[responseOpCode]);
        }
    }

    private async sendPackages(
        sendCharacteristic: BluetoothRemoteGATTCharacteristic,
        tx: Observable<DataView>,
        dataArray: Uint8Array,
        attr: number,
        buffer: number,
    ): Promise<void> {
        let chunkIndex = 0;
        const chunks = dataArray.reduce(
            (prev: Array<Array<number>>, current: number): Array<Array<number>> => {
                if (prev[chunkIndex].length < attr) {
                    prev[chunkIndex].push(current);
                }
                if (prev[chunkIndex].length === attr) {
                    prev.push([]);
                    chunkIndex++;
                }

                return prev;
            },
            [[]] as Array<Array<number>>,
        );

        while (chunks.length > 0) {
            const responseTask = firstValueFrom(tx, {
                defaultValue: new DataView(new Uint8Array([OtaResponseOpCodes.NotOk]).buffer),
            });

            for (const currentChunk of chunks.splice(0, Math.min(buffer / attr, chunks.length))) {
                if (this.cancellationToken.signal.aborted) {
                    return;
                }
                await sendCharacteristic.writeValueWithoutResponse(
                    new Uint8Array([OtaRequestOpCodes.Package, ...currentChunk]),
                );
            }

            if (chunks.length > 0) {
                const responseOpCode = (await responseTask).getUint8(0);
                if (this.cancellationToken.signal.aborted) {
                    return;
                }

                if (responseOpCode !== OtaResponseOpCodes.Ok) {
                    this.cancellationToken.abort();
                    throw new OtaError("PackageError", OtaResponseOpCodes[responseOpCode]);
                }
            }

            this.progress.set(dataArray.length - chunks.length * attr);
        }
    }
}
