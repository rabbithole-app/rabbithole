import { ActorSubclass } from '@dfinity/agent';

export type Bucket<T> = {
    actor: ActorSubclass<T>;
    canisterId: string;
};

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
    data: ArrayBuffer;
    name: string;
    fileSize: number;
    contentType: string;
    sha256?: Uint8Array;
};

export type BatchInfo = {
    id: bigint;
    expiredAt: Date;
};

export type ChunkUpload = Pick<FileUpload, 'id' | 'data'> & {
    startByte: number;
    endByte: number;
};

export type FileUploadState = {
    id: string;
    name: string;
    canisterId?: string;
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

export type Summary = {
    loaded: number;
    total: number;
    files: number;
    completed: number;
    failed: number;
    progress: number;
    status: UPLOAD_STATUS;
};
