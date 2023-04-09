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
export type ID = string;
export interface StorageBucket {
    commitUpload: ActorMethod<
        [
            {
                headers: Array<HeaderField>;
                chunkIds: Array<bigint>;
                batchId: bigint;
            }
        ],
        undefined
    >;
    getUsedMemorySize: ActorMethod<[], bigint>;
    getVersion: ActorMethod<[], string>;
    initUpload: ActorMethod<[AssetKey], { batchId: bigint }>;
    uploadChunk: ActorMethod<[Chunk], { chunkId: bigint }>;
}
export interface _SERVICE extends StorageBucket {}
