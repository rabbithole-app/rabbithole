import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type AccountIdentifier = Uint8Array | number[];
export type BlockIndex = bigint;
export type BlockIndex__1 = bigint;
export type BucketId = Principal;
export type BucketId__1 = Principal;
export interface Canister {
    status: [] | [canister_status_response];
    owner: Principal;
    error: [] | [string];
    monitoring: { stopped: null } | { running: null };
    lastChecked: Time;
    timerId: [] | [bigint];
    canisterId: BucketId;
}
export interface Directory {
    id: ID;
    name: string;
    createdAt: Time;
    path: [] | [string];
    color: [] | [DirectoryColor];
    children: [] | [[Array<Directory__1>, Array<File>]];
    updatedAt: Time;
    parentId: [] | [ID];
}
export type DirectoryAction = { rename: ID } | { changeColor: ID };
export type DirectoryColor = { blue: null } | { gray: null } | { orange: null } | { pink: null } | { purple: null } | { green: null } | { yellow: null };
export interface DirectoryCreate {
    name: string;
    parentId: [] | [ID];
}
export type DirectoryCreateError = { illegalCharacters: null } | { alreadyExists: Directory__1 } | { parentNotFound: null };
export type DirectoryMoveError = { sourceNotFound: null } | { notFound: null } | { targetNotFound: null } | { invalidParams: null };
export interface DirectoryState {
    id: [] | [ID];
    files: Array<File>;
    dirs: Array<Directory__1>;
    breadcrumbs: Array<Directory__1>;
}
export type DirectoryStateError = { notFound: null };
export interface DirectoryUpdatableFields {
    name: [] | [string];
    color: [] | [DirectoryColor];
    parentId: [] | [ID];
}
export interface Directory__1 {
    id: ID;
    name: string;
    createdAt: Time;
    path: [] | [string];
    color: [] | [DirectoryColor];
    children: [] | [[Array<Directory__1>, Array<File>]];
    updatedAt: Time;
    parentId: [] | [ID];
}
export interface File {
    id: ID;
    name: string;
    createdAt: Time;
    bucketId: BucketId;
    fileSize: bigint;
    updatedAt: Time;
    parentId: [] | [ID];
}
export interface FileCreate {
    id: ID;
    name: string;
    bucketId: BucketId;
    fileSize: bigint;
    parentId: [] | [ID];
}
export type FileCreateError = { illegalCharacters: null } | { alreadyExists: File } | { parentNotFound: null };
export type FileMoveError = { sourceNotFound: null } | { notFound: null } | { targetNotFound: null } | { invalidParams: null };
export interface File__1 {
    id: ID;
    name: string;
    createdAt: Time;
    bucketId: BucketId;
    fileSize: bigint;
    updatedAt: Time;
    parentId: [] | [ID];
}
export type ID = string;
export type ID__1 = string;
export interface JournalBucket {
    accountIdentifier: ActorMethod<[], AccountIdentifier>;
    addFile: ActorMethod<[FileCreate], Result_8>;
    canisterStatus: ActorMethod<
        [Principal],
        {
            id: Principal;
            status: canister_status_response;
            freezingThresholdInCycles: bigint;
        }
    >;
    checkDirname: ActorMethod<[DirectoryCreate], Result_7>;
    createDirectory: ActorMethod<[DirectoryCreate], Result_6>;
    createInvite: ActorMethod<[Time], Result_5>;
    createPaths: ActorMethod<[Array<string>, Array<ID__1>, [] | [ID__1]], Array<[string, ID__1]>>;
    deleteDirectory: ActorMethod<[string], Result_4>;
    deleteFile: ActorMethod<[string], Result_4>;
    deleteStorage: ActorMethod<[BucketId__1], undefined>;
    getCanisters: ActorMethod<[], Array<Canister>>;
    getChildrenDirs: ActorMethod<[[] | [ID__1]], Array<Directory>>;
    getJournal: ActorMethod<[[] | [string]], Result_3>;
    getStorage: ActorMethod<[bigint], [] | [BucketId__1]>;
    listStorages: ActorMethod<[], Array<BucketId__1>>;
    moveDirectory: ActorMethod<[string, [] | [string]], Result_2>;
    moveFile: ActorMethod<[string, [] | [string]], Result_1>;
    showDirectoriesTree: ActorMethod<[[] | [ID__1]], string>;
    startBucketMonitor: ActorMethod<[BucketId__1], undefined>;
    stopBucketMonitor: ActorMethod<[BucketId__1], undefined>;
    storageLoadWasm: ActorMethod<[Uint8Array | number[]], { total: bigint; chunks: bigint }>;
    storageResetWasm: ActorMethod<[], undefined>;
    updateDirectory: ActorMethod<[DirectoryAction, DirectoryUpdatableFields], Result>;
    upgradeStorages: ActorMethod<[], undefined>;
    withdraw: ActorMethod<[{ to: [] | [AccountIdentifier]; amount: Tokens }], TransferResult>;
}
export type NotifyError =
    | {
          Refunded: { block_index: [] | [BlockIndex__1]; reason: string };
      }
    | { InvalidTransaction: string }
    | { Other: { error_message: string; error_code: bigint } }
    | { Processing: null }
    | { TransactionTooOld: BlockIndex__1 };
export type Result = { ok: Directory } | { err: { alreadyExists: null } | { notFound: null } };
export type Result_1 = { ok: null } | { err: FileMoveError };
export type Result_2 = { ok: null } | { err: DirectoryMoveError };
export type Result_3 = { ok: DirectoryState } | { err: DirectoryStateError };
export type Result_4 = { ok: null } | { err: { notFound: null } };
export type Result_5 =
    | { ok: null }
    | {
          err: { notify: NotifyError } | { insufficientFunds: { balance: Tokens__1 } } | { transfer: TransferError };
      };
export type Result_6 = { ok: Directory } | { err: DirectoryCreateError };
export type Result_7 = { ok: null } | { err: DirectoryCreateError };
export type Result_8 = { ok: File__1 } | { err: FileCreateError };
export type Time = bigint;
export interface Tokens {
    e8s: bigint;
}
export interface Tokens__1 {
    e8s: bigint;
}
export type TransferError =
    | {
          TxTooOld: { allowed_window_nanos: bigint };
      }
    | { BadFee: { expected_fee: Tokens } }
    | { TxDuplicate: { duplicate_of: BlockIndex } }
    | { TxCreatedInFuture: null }
    | { InsufficientFunds: { balance: Tokens } };
export type TransferResult = { Ok: BlockIndex } | { Err: TransferError };
export interface canister_status_response {
    status: { stopped: null } | { stopping: null } | { running: null };
    memory_size: bigint;
    cycles: bigint;
    settings: definite_canister_settings;
    idle_cycles_burned_per_day: bigint;
    module_hash: [] | [Uint8Array | number[]];
}
export interface definite_canister_settings {
    freezing_threshold: bigint;
    controllers: Array<Principal>;
    memory_allocation: bigint;
    compute_allocation: bigint;
}
export interface _SERVICE extends JournalBucket {}
