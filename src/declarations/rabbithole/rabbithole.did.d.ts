import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type AccountIdentifier = Uint8Array | number[];
export type BlockIndex = bigint;
export type BlockIndex__1 = bigint;
export type BucketId = Principal;
export type BucketId__1 = Principal;
export type ID = string;
export type ID__1 = string;
export type ID__2 = string;
export interface Invite {
    id: ID__2;
    status: { active: null } | { expired: null } | { used: Principal };
    expiredAt: Time;
    owner: Principal;
    createdAt: Time;
    cycles: bigint;
    canisterId: Principal;
}
export interface InviteCreate {
    expiredAt: Time;
    owner: Principal;
    cycles: bigint;
}
export type InviteDeleteError = { alreadyUsed: Principal } | { expired: null } | { notFound: null } | { notPermission: null };
export type InviteError = { alreadyUsed: null } | { expired: null } | { notFound: null };
export interface Invoice {
    id: ID__2;
    expiredAt: Time;
    owner: Principal;
    createdAt: Time;
    stage: InvoiceStage;
    amount: Tokens;
    timerId: [] | [bigint];
}
export type InvoiceStage =
    | { active: null }
    | { paid: null }
    | { notifyCanister: NotifyCreateCanisterArg }
    | { transferUnusedFunds: Principal }
    | { complete: Principal }
    | { setControllers: Principal }
    | { installJournal: Principal }
    | { createCanister: Tokens };
export interface NotifyCreateCanisterArg {
    controller: Principal;
    block_index: BlockIndex;
    subnet_type: [] | [string];
}
export type NotifyError =
    | {
          Refunded: { block_index: [] | [BlockIndex]; reason: string };
      }
    | { InvalidTransaction: string }
    | { Other: { error_message: string; error_code: bigint } }
    | { Processing: null }
    | { TransactionTooOld: BlockIndex };
export interface Profile {
    principal: Principal;
    username: string;
    displayName: string;
    avatarUrl: [] | [string];
}
export type ProfileCreateError = { username: UsernameError } | { alreadyExists: null } | { journalNotFound: null };
export interface ProfileCreateV2 {
    username: string;
    displayName: string;
    avatarUrl: [] | [string];
}
export interface ProfileInfoV2 {
    id: Principal;
    username: string;
    displayName: string;
    inviter: [] | [Principal];
    createdAt: Time;
    updatedAt: Time;
    avatarUrl: [] | [string];
}
export interface ProfileUpdateV2 {
    displayName: string;
    avatarUrl: [] | [string];
}
export interface Profile__1 {
    principal: Principal;
    username: string;
    displayName: string;
    avatarUrl: [] | [string];
}
export type RegistrationMode = { prepaid: null } | { invite: null };
export type Result = { ok: null } | { err: InviteError };
export type Result_1 = { ok: null } | { err: { notFound: null } };
export type Result_2 = { ok: null } | { err: InviteDeleteError };
export type Result_3 = { ok: null } | { err: ProfileCreateError };
export type Result_4 =
    | { ok: null }
    | {
          err: { notify: NotifyError } | { wrongStage: null } | { notFound: null } | { transfer: TransferError };
      };
export type Result_5 = { ok: null } | { err: UsernameError__1 };
export interface SharedFile {
    id: ID__1;
    owner: Principal;
    createdAt: Time;
    journalId: BucketId__1;
    limitDownloads: [] | [bigint];
    storageId: BucketId__1;
    sharedWith: { everyone: null } | { users: Array<Principal> };
    updatedAt: Time;
    downloads: bigint;
    timelock: [] | [Time];
}
export interface SharedFileExtended {
    id: ID__1;
    thumbnail: [] | [ID__1];
    owner: Principal;
    name: string;
    createdAt: Time;
    journalId: BucketId__1;
    limitDownloads: [] | [bigint];
    fileSize: bigint;
    storageId: BucketId__1;
    encrypted: boolean;
    sharedWith: { everyone: null } | { users: Array<Principal> };
    updatedAt: Time;
    downloads: bigint;
    timelock: [] | [Time];
}
export type Time = bigint;
export interface Tokens {
    e8s: bigint;
}
export type TransferError =
    | {
          TxTooOld: { allowed_window_nanos: bigint };
      }
    | { BadFee: { expected_fee: Tokens } }
    | { TxDuplicate: { duplicate_of: BlockIndex__1 } }
    | { TxCreatedInFuture: null }
    | { InsufficientFunds: { balance: Tokens } };
export interface UserShare {
    bucketId: Principal;
    profile: Profile;
}
export type UsernameError = { illegalCharacters: null } | { alreadyExists: null } | { maxLength: null } | { minLength: null };
export type UsernameError__1 = { illegalCharacters: null } | { alreadyExists: null } | { maxLength: null } | { minLength: null };
export interface _SERVICE {
    accountBalance: ActorMethod<[], Tokens>;
    accountIdentifier: ActorMethod<[], AccountIdentifier>;
    canInvite: ActorMethod<[], boolean>;
    checkInvite: ActorMethod<[ID], Result>;
    checkUsername: ActorMethod<[string], Result_5>;
    checkUsernameAvailability: ActorMethod<[string], boolean>;
    createAdminInvite: ActorMethod<[], string>;
    createInvite: ActorMethod<[InviteCreate], undefined>;
    createInvoice: ActorMethod<[], Invoice>;
    createJournal: ActorMethod<[ID], Result_4>;
    createProfile: ActorMethod<[ProfileCreateV2], Result_3>;
    deleteInvite: ActorMethod<[ID], Result_2>;
    deleteInvoice: ActorMethod<[], undefined>;
    deleteProfile: ActorMethod<[], Result_1>;
    fixJournalControllers: ActorMethod<[], undefined>;
    getInvites: ActorMethod<[], Array<Invite>>;
    getInvoice: ActorMethod<[], [] | [Invoice]>;
    getJournalBucket: ActorMethod<[], [] | [BucketId]>;
    getProfile: ActorMethod<[], [] | [ProfileInfoV2]>;
    getRegistrationMode: ActorMethod<[], RegistrationMode>;
    getSharedFile: ActorMethod<[ID], [] | [SharedFileExtended]>;
    installCode: ActorMethod<
        [
            {
                arg: Uint8Array | number[];
                wasm_module: Uint8Array | number[];
                mode: { reinstall: null } | { upgrade: null } | { install: null };
                canister_id: Principal;
            }
        ],
        undefined
    >;
    listBuckets: ActorMethod<[string], Array<[Principal, BucketId]>>;
    listProfiles: ActorMethod<[], Array<Profile__1>>;
    putProfile: ActorMethod<[ProfileUpdateV2], Result_1>;
    redeemInvite: ActorMethod<[ID], Result>;
    setRegistrationMode: ActorMethod<[RegistrationMode], undefined>;
    shareFile: ActorMethod<[ID, SharedFile], undefined>;
    sharedWithMe: ActorMethod<[], Array<UserShare>>;
    unshareFile: ActorMethod<[ID], undefined>;
    unshareStorageFiles: ActorMethod<[BucketId], undefined>;
    upgradeJournalBuckets: ActorMethod<[], undefined>;
}
