export enum DownloadStatus {
    RetrieveKey,
    Progress,
    Failed,
    Complete
}

export type DownloadProgress = { status: DownloadStatus.Progress; total: number; loaded: number };
export type DownloadComplete = { status: DownloadStatus.Complete; file: File };
export type DownloadFailed = { status: DownloadStatus.Failed };
export type DownloadRetrieveKey = { status: DownloadStatus.RetrieveKey };