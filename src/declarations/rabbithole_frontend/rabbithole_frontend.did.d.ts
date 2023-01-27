import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type BatchId = bigint;
export type BatchOperationKind =
    | { CreateAsset: CreateAssetArguments }
    | { UnsetAssetContent: UnsetAssetContentArguments }
    | { DeleteAsset: DeleteAssetArguments }
    | { SetAssetContent: SetAssetContentArguments }
    | { Clear: ClearArguments };
export type ChunkId = bigint;
export type ClearArguments = {};
export interface CreateAssetArguments {
    key: Key;
    content_type: string;
    headers: [] | [Array<HeaderField>];
    allow_raw_access: [] | [boolean];
    max_age: [] | [bigint];
    enable_aliasing: [] | [boolean];
}
export interface DeleteAssetArguments {
    key: Key;
}
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
export type Key = string;
export interface SetAssetContentArguments {
    key: Key;
    sha256: [] | [Uint8Array | number[]];
    chunk_ids: Array<ChunkId>;
    content_encoding: string;
}
export interface SetAssetPropertiesArguments {
    key: Key;
    headers: [] | [[] | [Array<HeaderField>]];
    allow_raw_access: [] | [[] | [boolean]];
    max_age: [] | [[] | [bigint]];
}
export interface StreamingCallbackHttpResponse {
    token: [] | [StreamingCallbackToken];
    body: Uint8Array | number[];
}
export interface StreamingCallbackToken {
    key: Key;
    sha256: [] | [Uint8Array | number[]];
    index: bigint;
    content_encoding: string;
}
export type StreamingStrategy = {
    Callback: {
        token: StreamingCallbackToken;
        callback: [Principal, string];
    };
};
export type Time = bigint;
export interface UnsetAssetContentArguments {
    key: Key;
    content_encoding: string;
}
export interface _SERVICE {
    authorize: ActorMethod<[Principal], undefined>;
    certified_tree: ActorMethod<[{}], { certificate: Uint8Array | number[]; tree: Uint8Array | number[] }>;
    clear: ActorMethod<[ClearArguments], undefined>;
    commit_batch: ActorMethod<[{ batch_id: BatchId; operations: Array<BatchOperationKind> }], undefined>;
    create_asset: ActorMethod<[CreateAssetArguments], undefined>;
    create_batch: ActorMethod<[{}], { batch_id: BatchId }>;
    create_chunk: ActorMethod<[{ content: Uint8Array | number[]; batch_id: BatchId }], { chunk_id: ChunkId }>;
    deauthorize: ActorMethod<[Principal], undefined>;
    delete_asset: ActorMethod<[DeleteAssetArguments], undefined>;
    get: ActorMethod<
        [{ key: Key; accept_encodings: Array<string> }],
        {
            content: Uint8Array | number[];
            sha256: [] | [Uint8Array | number[]];
            content_type: string;
            content_encoding: string;
            total_length: bigint;
        }
    >;
    get_asset_properties: ActorMethod<
        [Key],
        {
            headers: [] | [Array<HeaderField>];
            allow_raw_access: [] | [boolean];
            max_age: [] | [bigint];
        }
    >;
    get_chunk: ActorMethod<
        [
            {
                key: Key;
                sha256: [] | [Uint8Array | number[]];
                index: bigint;
                content_encoding: string;
            }
        ],
        { content: Uint8Array | number[] }
    >;
    http_request: ActorMethod<[HttpRequest], HttpResponse>;
    http_request_streaming_callback: ActorMethod<[StreamingCallbackToken], [] | [StreamingCallbackHttpResponse]>;
    list: ActorMethod<
        [{}],
        Array<{
            key: Key;
            encodings: Array<{
                modified: Time;
                sha256: [] | [Uint8Array | number[]];
                length: bigint;
                content_encoding: string;
            }>;
            content_type: string;
        }>
    >;
    list_authorized: ActorMethod<[], Array<Principal>>;
    set_asset_content: ActorMethod<[SetAssetContentArguments], undefined>;
    set_asset_properties: ActorMethod<[SetAssetPropertiesArguments], undefined>;
    store: ActorMethod<
        [
            {
                key: Key;
                content: Uint8Array | number[];
                sha256: [] | [Uint8Array | number[]];
                content_type: string;
                content_encoding: string;
            }
        ],
        undefined
    >;
    unset_asset_content: ActorMethod<[UnsetAssetContentArguments], undefined>;
}
