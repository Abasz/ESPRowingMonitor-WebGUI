export interface ITrainingCenterDatabase {
    "@": IRootHeader;
    Activities: IActivities;
    Author: IAuthor;
}

export interface IRootHeader {
    "xsi:schemaLocation": string;
    "xmlns:ns5": string;
    "xmlns:ns3": string;
    "xmlns:ns2": string;
    xmlns: string;
    "xmlns:xsi": string;
    "xmlns:ns4": string;
}

interface IActivity {
    "@": IActivityHeader;
    Id: string;
    Lap: Array<ILap>;
    Notes: string;
}

export interface IActivities {
    Activity: Array<IActivity>;
}

export interface IActivityHeader {
    Sport: string;
}

export interface ILap {
    "@": ILapHeader;
    TotalTimeSeconds: number;
    DistanceMeters: number;
    MaximumSpeed: number;
    AverageHeartRateBpm?: IAverageHeartRateBpm;
    MaximumHeartRateBpm?: IMaximumHeartRateBpm;
    Intensity: string;
    Cadence: number;
    TriggerMethod: string;
    Track: ITrack;
    Extensions: ILapExtensions;
}

export interface ILapHeader {
    StartTime: string;
}

export interface IAverageHeartRateBpm {
    Value: number;
}

export interface IMaximumHeartRateBpm {
    Value: number;
}

export interface ITrack {
    Trackpoint: Array<ITrackPoint>;
}

export interface ITrackPoint {
    Time: string;
    DistanceMeters: number;
    HeartRateBpm?: IHeartRateBpm;
    Cadence: number;
    Extensions: ITrackPointExtensions;
}

export interface IHeartRateBpm {
    Value: number;
}

export interface ITrackPointExtensions {
    "ns3:TPX": INs3Tpx;
}

export interface INs3Tpx {
    "ns3:Speed": number;
    "ns3:Watts": number;
}

export interface ILapExtensions {
    "ns3:LX": INs3Lx;
}

export interface INs3Lx {
    "ns3:Steps": number;
    "ns3:AvgSpeed": number;
    "ns3:AvgWatts": number;
    "ns3:MaxWatts": number;
}

export interface IAuthor {
    "@": IAuthorHeader;
    Name: string;
    Build: IBuild;
}

export interface IAuthorHeader {
    "xsi:type": string;
}

export interface IBuild {
    Version: IVersion;
    LangID: string;
    PartNumber: string;
}

export interface IVersion {
    VersionMajor: number;
    VersionMinor: number;
    BuildMajor: number;
    BuildMinor: number;
}
