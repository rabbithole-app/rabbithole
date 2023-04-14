import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface AssetKey {
    id: ID;
    name: string;
    fileSize: bigint;
    parentId: [] | [ID];
}
export interface Chunk {
    content: Uint8Array | number[];
    batchId: bigint;
}
export type HeaderField = [string, string];
export type HeaderField__1 = [string, string];
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
export interface StorageBucket {
    commitUpload: ActorMethod<
        [
            {
                headers: Array<HeaderField__1>;
                chunkIds: Array<bigint>;
                batchId: bigint;
            }
        ],
        undefined
    >;
    delete: ActorMethod<[ID__2], undefined>;
    getUsedMemorySize: ActorMethod<[], bigint>;
    getVersion: ActorMethod<[], string>;
    http_request: ActorMethod<[HttpRequest], HttpResponse>;
    http_request_streaming_callback: ActorMethod<[StreamingCallbackToken], StreamingCallbackHttpResponse>;
    initUpload: ActorMethod<[AssetKey], { batchId: bigint }>;
    uploadChunk: ActorMethod<[Chunk], { chunkId: bigint }>;
}
export interface StreamingCallbackHttpResponse {
    token: [] | [StreamingCallbackToken__1];
    body: Uint8Array | number[];
}
export interface StreamingCallbackToken {
    id: ID__1;
    sha256: [] | [Uint8Array | number[]];
    headers: Array<HeaderField>;
    index: bigint;
}
export interface StreamingCallbackToken__1 {
    id: ID__1;
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
export interface _SERVICE extends StorageBucket {}
