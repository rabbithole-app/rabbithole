import { Bucket } from '@core/stores';
import { _SERVICE as StorageActor } from 'declarations/storage/storage.did';

export type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
    [Property in Key]-?: Type[Property];
};

export enum UPLOAD_STATUS {
    Queue = 'queue',
    Request = 'request',
    Init = 'init',
    Processing = 'processing',
    Paused = 'paused',
    Finalize = 'finalize',
    Done = 'done',
    Failed = 'failed',
    Cancelled = 'cancelled'
}

export type FileUpload = {
    id: string;
    parentId?: string;
    file: File;
};

export type BatchInfo = {
    id: bigint;
    expiredAt: Date;
};

export type ChunkUpload = Pick<FileUpload, 'id' | 'file'> & {
    startByte: number;
    endByte: number;
};

export type FileUploadState = {
    id: string;
    name: string;
    storage?: Bucket<StorageActor>;
    loaded: number;
    total: number;
    batch?: BatchInfo;
    progress: number;
    status: UPLOAD_STATUS;
    chunkIds: Array<bigint | null>;
    errorMessage?: string | null;

    // используется для обновления дерева после успешной загрузки
    parentId?: string;
};

export type UploadFileOptions = {
    concurrentChunksCount: number;
    chunkSize: number;
};
