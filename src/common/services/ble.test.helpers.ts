import { IBaseMetrics, IExtendedMetrics } from "../common.interfaces";

export interface ListenerTrigger<T> {
    triggerChanged: (value?: T) => void;
}

export interface IHeartRateFeaturesOptions {
    is16Bit?: boolean;
    hasContactSensor?: boolean;
    isContactDetected?: boolean;
    hasEnergyExpended?: boolean;
    hasRRIntervals?: boolean;
}

export interface IHeartRateMockData extends IHeartRateFeaturesOptions {
    energyExpended: number;
    rrIntervals: Array<number>;
}

export const createDeltaTimesDataView = (deltaValues: Array<number>): DataView => {
    const buffer = new ArrayBuffer(deltaValues.length * 4);
    const dataView = new DataView(buffer);

    deltaValues.forEach((value: number, index: number): void => {
        dataView.setUint32(index * 4, value, true);
    });

    return dataView;
};

export const createExtendedMetricsDataView = (
    avgStrokePower: number = 150,
    driveDuration: number = 4096,
    recoveryDuration: number = 8192,
    dragFactor: number = 100,
): DataView => {
    const buffer = new ArrayBuffer(7);
    const dataView = new DataView(buffer);

    dataView.setUint16(0, avgStrokePower, true);
    dataView.setUint16(2, driveDuration, true);
    dataView.setUint16(4, recoveryDuration, true);
    dataView.setUint8(6, dragFactor);

    return dataView;
};

export const createHandleForcesDataView = (byte0: number, byte1: number, forces: Array<number>): DataView => {
    const buffer = new ArrayBuffer(2 + forces.length * 4);
    const dataView = new DataView(buffer);

    dataView.setUint8(0, byte0);
    dataView.setUint8(1, byte1);
    forces.forEach((force: number, index: number): void => {
        dataView.setFloat32(2 + index * 4, force, true);
    });

    return dataView;
};

export const createMeasurementDataView = (mockData: Uint8Array): DataView => {
    return new DataView(mockData.buffer);
};

export const createMockExtendedMetrics = (): IExtendedMetrics => ({
    avgStrokePower: 150,
    driveDuration: 250,
    recoveryDuration: 2000000,
    dragFactor: 100,
});

export const createBaseMetrics = (
    metrics: IBaseMetrics = {
        strokeTime: 11_000_000,
        revTime: 10_300_000,
        distance: 4_300,
        strokeCount: 10,
    },
): IBaseMetrics => {
    return {
        strokeTime: metrics.strokeTime,
        revTime: metrics.revTime,
        distance: metrics.distance,
        strokeCount: metrics.strokeCount,
    };
};

/**
 * Creates an array of DataViews from an array of delta metrics using aggregation
 * @param deltaMetrics Array of delta metric values to be aggregated
 * @param createDataView Function to create DataView (FTMS, CPS, or CSC)
 * @returns Object containing both the aggregated metrics array and DataViews array
 */
export const createMeasurementDataViews = (
    deltaMetrics: Array<IBaseMetrics>,
    createDataView: (currentMetrics: IBaseMetrics, previousMetrics?: IBaseMetrics) => DataView,
): { expectedMetrics: Array<IBaseMetrics>; metricsDataViews: Array<DataView> } => {
    const metricsDataViews: Array<DataView> = [];
    const expectedMetrics: Array<IBaseMetrics> = [];
    let aggregatedMetrics: IBaseMetrics = {
        distance: 0,
        revTime: 0,
        strokeCount: 0,
        strokeTime: 0,
    };

    deltaMetrics.forEach((metrics: IBaseMetrics, index: number): void => {
        // accumulate delta values into aggregated metrics
        const currentAggregatedMetrics: IBaseMetrics = {
            distance: aggregatedMetrics.distance + metrics.distance,
            revTime: aggregatedMetrics.revTime + metrics.revTime,
            strokeCount: aggregatedMetrics.strokeCount + metrics.strokeCount,
            strokeTime: aggregatedMetrics.strokeTime + metrics.strokeTime,
        };

        // add current aggregated metrics to the expected metrics array
        expectedMetrics.push(currentAggregatedMetrics);

        // create DataView with current aggregated metrics and previous aggregated metrics (if not first)
        const dataView = createDataView(currentAggregatedMetrics, index > 0 ? aggregatedMetrics : undefined);
        metricsDataViews.push(dataView);

        // update aggregated metrics for next iteration
        aggregatedMetrics = currentAggregatedMetrics;
    });

    return { expectedMetrics, metricsDataViews: metricsDataViews };
};

// bLE spec-compliant measurement DataView creators
export const createFTMSMeasurementDataView = (
    baseMetrics: IBaseMetrics,
    previousBaseMetrics?: IBaseMetrics,
): DataView => {
    // fTMS Rower Data (0x2AD1) - based on actual server flags
    // Flags: TotalDistancePresent | InstantaneousPacePresent | InstantaneousPowerPresent | ResistanceLevelPresent
    const buffer = new ArrayBuffer(16);
    const dataView = new DataView(buffer);

    // flags (2 bytes) - matching server implementation
    const flags = 0x0001 | 0x0004 | 0x0040 | 0x0200; // distance, pace, power, resistance
    dataView.setUint16(0, flags, true);

    // stroke Rate (1 byte) - strokes per minute with a resolution of 2 (i.e. max 254 / 2)
    // Basically FTMS does not have a stroke time, but the delta stroke time can be calculated from stroke rate. Here we need to reverse that, i.e. calculate stroke rate.
    const deltaStrokeCount = baseMetrics.strokeCount - (previousBaseMetrics?.strokeCount ?? 0);
    const deltaStrokeTime = baseMetrics.strokeTime - (previousBaseMetrics?.strokeTime ?? 0);
    const strokeRate = Math.round((deltaStrokeCount / (deltaStrokeTime / 1e6)) * 60 * 2);
    dataView.setUint8(2, strokeRate); // clamp to valid range

    // stroke Count (2 bytes)
    dataView.setUint16(3, baseMetrics.strokeCount, true);

    // total Distance in meters (3 bytes) - stored as centimeters, parser divides by 100
    const distanceMeters = Math.round(baseMetrics.distance / 100);
    dataView.setUint8(5, distanceMeters & 0xff);
    dataView.setUint8(6, (distanceMeters >> 8) & 0xff);
    dataView.setUint8(7, (distanceMeters >> 16) & 0xff);

    // instantaneous Pace (2 bytes) - time per 500m in seconds - N/A for BaseMetrics
    dataView.setUint16(8, 120, true);

    // instantaneous Pace (2 bytes) - time per 500m in seconds - N/A for BaseMetrics
    const deltaRevTime = baseMetrics.revTime - (previousBaseMetrics?.revTime ?? 0);
    const deltaDistance = baseMetrics.distance - (previousBaseMetrics?.distance ?? 0);
    const pace = Math.round((deltaRevTime / 1e6) * (500 / (deltaDistance / 100)));
    dataView.setUint16(8, pace, true);

    // resistance Level (1 byte) - dimensionless resistance - N/A for base metrics
    dataView.setUint8(12, 5); // default resistance level

    return dataView;
};

export const createCPSMeasurementDataView = (baseMetrics: IBaseMetrics): DataView => {
    // cycling Power Measurement (0x2A63)
    // Based on server flags: WheelRevolutionDataSupported | CrankRevolutionDataSupported
    const buffer = new ArrayBuffer(14);
    const dataView = new DataView(buffer);

    // flags (2 bytes) - wheel and crank revolution data present
    const flags = 0x0010 | 0x0020; // wheel revolution data + crank revolution data
    dataView.setUint16(0, flags, true);

    // instantaneous Power (2 bytes) - in watts
    dataView.setUint16(2, 200, true);

    // cumulative Wheel Revolutions (4 bytes) - use distance as wheel revolutions
    dataView.setUint32(4, Math.round(baseMetrics.distance), true);

    // last Wheel Event Time (2 bytes) - time of last wheel revolution event in 1/2048s resolution
    // Convert from microseconds to 1/2048s units, constrained to UINT16
    const wheelEventTime = Math.round((baseMetrics.revTime * 2048) / 1e6) % 65536;
    dataView.setUint16(8, wheelEventTime, true);

    // cumulative Crank Revolutions (2 bytes) - use strokeCount
    dataView.setUint16(10, baseMetrics.strokeCount, true);

    // last Crank Event Time (2 bytes) - time of last crank revolution event in 1/1024s resolution
    // Convert from microseconds to 1/1024s units, constrained to UINT16
    const crankEventTime = Math.round((baseMetrics.strokeTime * 1024) / 1e6) % 65536;
    dataView.setUint16(12, crankEventTime, true);

    return dataView;
};

export const createCSCMeasurementDataView = (baseMetrics: IBaseMetrics): DataView => {
    // cycling Speed and Cadence Measurement (0x2A5B)
    // Based on server flags: WheelRevolutionDataSupported | CrankRevolutionDataSupported
    const buffer = new ArrayBuffer(11);
    const dataView = new DataView(buffer);

    // flags (1 byte) - wheel and crank revolution data present
    const flags = 0x01 | 0x02; // wheel revolution data + crank revolution data
    dataView.setUint8(0, flags);

    // cumulative Wheel Revolutions (4 bytes) - use distance as wheel revolutions
    dataView.setUint32(1, Math.round(baseMetrics.distance), true);

    // last Wheel Event Time (2 bytes) - time of last wheel revolution event in 1/1024s resolution
    // Convert from microseconds to 1/1024s units, constrained to UINT16
    const wheelEventTime = Math.round((baseMetrics.revTime * 1024) / 1e6) % 65536;
    dataView.setUint16(5, wheelEventTime, true);

    // cumulative Crank Revolutions (2 bytes) - use strokeCount
    dataView.setUint16(7, baseMetrics.strokeCount, true);

    // last Crank Event Time (2 bytes) - time of last crank revolution event in 1/1024s resolution
    // Convert from microseconds to 1/1024s units, constrained to UINT16
    const crankEventTime = Math.round((baseMetrics.strokeTime * 1024) / 1e6) % 65536;
    dataView.setUint16(9, crankEventTime, true);

    return dataView;
};

export const createMockBluetooth = (
    bluetoothDevice: jasmine.SpyObj<BluetoothDevice>,
): jasmine.Spy<(this: Navigator) => Bluetooth> =>
    spyOnProperty(globalThis.navigator, "bluetooth", "get").and.returnValue({
        requestDevice: (): Promise<BluetoothDevice> => Promise.resolve(bluetoothDevice),
        getDevices: (): Promise<Array<BluetoothDevice>> => Promise.resolve([bluetoothDevice]),
    } as Bluetooth);

// mock helper to create fake Bluetooth devices
export const createMockBluetoothDevice = (
    id: string = "test-device-id",
    name: string = "TestHeartRateMonitor",
    isConnected: boolean = false,
): jasmine.SpyObj<BluetoothDevice> => {
    const mockGATT = jasmine.createSpyObj<BluetoothRemoteGATTServer>(
        "BluetoothRemoteGATTServer",
        ["connect", "disconnect", "getPrimaryService"],
        ["connected"],
    );
    (Object.getOwnPropertyDescriptor(mockGATT, "connected")?.get as jasmine.Spy).and.returnValue(isConnected);

    const mockDevice = jasmine.createSpyObj<BluetoothDevice>(
        "BluetoothDevice",
        ["addEventListener", "removeEventListener", "watchAdvertisements"],
        ["id", "name", "gatt"],
    );

    (Object.getOwnPropertyDescriptor(mockDevice, "id")?.get as jasmine.Spy).and.returnValue(id);
    (Object.getOwnPropertyDescriptor(mockDevice, "name")?.get as jasmine.Spy).and.returnValue(name);
    (Object.getOwnPropertyDescriptor(mockDevice, "gatt")?.get as jasmine.Spy).and.returnValue(mockGATT);

    return mockDevice;
};

// mock helper to create fake GATT characteristics
export const createMockCharacteristic = (
    device: jasmine.SpyObj<BluetoothDevice>,
): jasmine.SpyObj<BluetoothRemoteGATTCharacteristic> => {
    const mockService = jasmine.createSpyObj<BluetoothRemoteGATTService>(
        "BluetoothRemoteGATTService",
        ["getCharacteristic"],
        ["device"],
    );
    (Object.getOwnPropertyDescriptor(mockService, "device")?.get as jasmine.Spy).and.returnValue(device);

    const mockCharacteristic = jasmine.createSpyObj<BluetoothRemoteGATTCharacteristic>(
        "BluetoothRemoteGATTCharacteristic",
        ["readValue", "startNotifications", "stopNotifications", "addEventListener", "removeEventListener"],
        ["service", "uuid"],
    );
    (Object.getOwnPropertyDescriptor(mockCharacteristic, "service")?.get as jasmine.Spy).and.returnValue(
        mockService,
    );

    return mockCharacteristic;
};

// helper function to create heart rate flags
export const createHeartRateFlags = (options: IHeartRateFeaturesOptions): number => {
    const {
        is16Bit = false,
        hasContactSensor = true,
        isContactDetected = true,
        hasEnergyExpended = false,
        hasRRIntervals = false,
    }: IHeartRateFeaturesOptions = options;

    let flags = 0;
    if (is16Bit) flags |= 0x1;
    if (isContactDetected && hasContactSensor) flags |= 0x2;
    if (hasContactSensor) flags |= 0x4;
    if (hasEnergyExpended) flags |= 0x8;
    if (hasRRIntervals) flags |= 0x10;

    return flags;
};

// helper function to add heart rate value to data array
export const addHeartRateValue = (data: Array<number>, heartRate: number, is16Bit: boolean): void => {
    if (is16Bit) {
        data.push(heartRate & 0xff, (heartRate >> 8) & 0xff);
    } else {
        data.push(heartRate);
    }
};

// helper function to add energy expended to data array
export const addEnergyExpended = (data: Array<number>, energyExpended: number): void => {
    data.push(energyExpended & 0xff, (energyExpended >> 8) & 0xff);
};

// helper function to add RR intervals to data array
export const addRRIntervals = (data: Array<number>, rrIntervals: Array<number>): void => {
    for (const interval of rrIntervals) {
        data.push(interval & 0xff, (interval >> 8) & 0xff);
    }
};

// mock helper to create heart rate DataView with various configurations
export const createHeartRateDataView = (heartRate: number = 120, options?: IHeartRateMockData): DataView => {
    const {
        is16Bit = false,
        hasContactSensor = true,
        isContactDetected = true,
        hasEnergyExpended = false,
        hasRRIntervals = false,
        energyExpended = 0,
        rrIntervals = [],
    }: IHeartRateMockData = options || ({} as IHeartRateMockData);

    const flags = createHeartRateFlags({
        is16Bit,
        hasContactSensor,
        isContactDetected,
        hasEnergyExpended,
        hasRRIntervals,
    });
    const data: Array<number> = [flags];

    addHeartRateValue(data, heartRate, is16Bit);

    if (hasEnergyExpended) {
        addEnergyExpended(data, energyExpended);
    }

    if (hasRRIntervals && rrIntervals) {
        addRRIntervals(data, rrIntervals);
    }

    return new DataView(new Uint8Array(data).buffer);
};

// mock helper to create battery level DataView
export const createBatteryDataView = (batteryLevel: number = 85): DataView => {
    return new DataView(new Uint8Array([batteryLevel]).buffer);
};

export const visibilityChangeListenerReady = async (
    initialState: DocumentVisibilityState = "visible",
): Promise<ListenerTrigger<DocumentVisibilityState>> => {
    return new Promise<ListenerTrigger<DocumentVisibilityState>>(
        (resolve: (value: ListenerTrigger<DocumentVisibilityState>) => void): void => {
            spyOn(document, "addEventListener")
                .withArgs("visibilitychange", jasmine.any(Function), undefined)
                .and.callFake((_: string, handler: (event: Event) => void): void => {
                    resolve({
                        triggerChanged: (newState?: DocumentVisibilityState): void => {
                            Object.defineProperty(document, "visibilityState", {
                                configurable: true,
                                writable: true,
                                value: newState || initialState,
                            });

                            handler(new Event("visibilitychange"));
                        },
                    });
                });
        },
    );
};

// helper function to set up battery characteristic value change event listener
export const changedListenerReadyFactory = <
    T extends jasmine.SpyObj<{
        addEventListener?: (type: string, listener: EventListener, options?: AddEventListenerOptions) => void;
        on?: (type: string, listener: (...args: Array<unknown>) => void) => void;
    }>,
    K,
>(
    eventEmitter: T,
    type: string,
    listenerMethod: "addEventListener" | "on" = "addEventListener",
    wrapInTarget: boolean = true,
): ((broadcastValue?: K) => Promise<ListenerTrigger<K>>) => {
    return (broadcastValue?: K): Promise<ListenerTrigger<K>> =>
        new Promise<ListenerTrigger<K>>((resolve: (value: ListenerTrigger<K>) => void): void => {
            const handlers: Array<(event: Event) => void> = [];
            (eventEmitter[listenerMethod] as jasmine.Spy)
                .withArgs(
                    type,
                    jasmine.any(Function),
                    ...(listenerMethod === "addEventListener" ? [undefined] : []),
                )
                .and.callFake((_: string, handler: (event: Event) => void): void => {
                    handlers.push(handler);
                    resolve({
                        triggerChanged: (value?: K): void => {
                            handlers.forEach((handler: (event: Event) => void): void => {
                                handler(
                                    listenerMethod === "addEventListener" && wrapInTarget
                                        ? ({
                                              target: {
                                                  value: value ?? broadcastValue,
                                              },
                                          } as unknown as Event)
                                        : ((value ?? broadcastValue) as unknown as Event),
                                );
                            });
                        },
                    });
                });
        });
};
