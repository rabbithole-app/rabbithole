import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface AssetKey {
    token: [] | [string];
    name: string;
    fullPath: string;
    fileSize: bigint;
    parentId: [] | [ID];
    folder: string;
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
    sendCyclesToInstaller: ActorMethod<[], undefined>;
    uploadChunk: ActorMethod<[Chunk], { chunkId: bigint }>;
}
export interface _SERVICE extends StorageBucket {}
