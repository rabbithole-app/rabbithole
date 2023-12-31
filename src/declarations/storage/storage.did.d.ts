import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface AssetInfo {
    contentType: [] | [string];
    totalLength: bigint;
    chunkIds: Uint32Array | number[];
}
export interface AssetKey {
    id: ID;
    sha256: [] | [Uint8Array | number[]];
    thumbnail: [] | [ID__1];
    name: string;
    fileSize: bigint;
    encrypted: boolean;
    parentId: [] | [ID];
}
export type BucketId = Principal;
export interface Chunk {
    content: Uint8Array | number[];
    encrypted: boolean;
    batchId: bigint;
}
export interface CommitBatch {
    headers: Array<HeaderField>;
    chunkIds: Uint32Array | number[];
    batchId: bigint;
}
export type CommitUploadError =
    | { chunkWrongBatch: number }
    | { empty: null }
    | { batchNotFound: null }
    | { addFile: FileCreateError }
    | { chunkNotFound: number }
    | { batchExpired: null };
export interface File {
    id: ID__1;
    thumbnail: [] | [ID__1];
    name: string;
    createdAt: Time;
    path: string;
    bucketId: BucketId;
    fileSize: bigint;
    encrypted: boolean;
    updatedAt: Time;
    parentId: [] | [ID__1];
}
export type FileCreateError = { illegalCharacters: null } | { alreadyExists: File } | { parentNotFound: null };
export type HeaderField = [string, string];
export interface HttpRequest {
    url: string;
    method: string;
    body: Uint8Array | number[];
    headers: Array<HeaderField>;
}
export interface HttpResponse {
    body: Uint8Array | number[];
    headers: Array<HeaderField>;
    streaming_strategy: [] | [StreamingStrategy];
    status_code: number;
}
export type ID = string;
export type ID__1 = string;
export type ID__2 = string;
export type ID__3 = string;
export interface InitUpload {
    batchId: bigint;
}
export type Key = Uint8Array | number[];
export type RawTree = { subtree: Array<[Key, RawTree]> } | { value: Uint8Array | number[] };
export type Result = { ok: AssetInfo } | { err: { notFound: null } };
export type Result_1 = { ok: null } | { err: CommitUploadError };
export interface Storage {
    batchAlive: ActorMethod<[bigint], undefined>;
    commitUpload: ActorMethod<[CommitBatch, boolean], Result_1>;
    delete: ActorMethod<[ID__3], undefined>;
    getAssetsTotalSize: ActorMethod<[], bigint>;
    getCertTree: ActorMethod<[], RawTree>;
    getChunk: ActorMethod<[number], Uint8Array | number[]>;
    getChunks: ActorMethod<[ID__3], Result>;
    getHeapSize: ActorMethod<[], bigint>;
    getMaxLiveSize: ActorMethod<[], bigint>;
    getMemorySize: ActorMethod<[], bigint>;
    getStableMemorySize: ActorMethod<[], bigint>;
    getUsedMemorySize: ActorMethod<[], bigint>;
    http_request: ActorMethod<[HttpRequest], HttpResponse>;
    http_request_streaming_callback: ActorMethod<[StreamingCallbackToken], StreamingCallbackHttpResponse>;
    initUpload: ActorMethod<[AssetKey], InitUpload>;
    uploadChunk: ActorMethod<[Chunk], UploadChunk>;
    version: ActorMethod<[], bigint>;
}
export interface StreamingCallbackHttpResponse {
    token: [] | [StreamingCallbackToken__1];
    body: Uint8Array | number[];
}
export interface StreamingCallbackHttpResponse__1 {
    token: [] | [StreamingCallbackToken__1];
    body: Uint8Array | number[];
}
export interface StreamingCallbackToken {
    id: ID__2;
    sha256: [] | [Uint8Array | number[]];
    headers: Array<HeaderField>;
    index: bigint;
}
export interface StreamingCallbackToken__1 {
    id: ID__2;
    sha256: [] | [Uint8Array | number[]];
    headers: Array<HeaderField>;
    index: bigint;
}
export type StreamingStrategy = {
    Callback: {
        token: StreamingCallbackToken__1;
        callback: [Principal, string];
    };
};
export type Time = bigint;
export interface UploadChunk {
    chunkId: number;
}
export interface _SERVICE extends Storage {}
