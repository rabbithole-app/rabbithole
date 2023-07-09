import type { ActorMethod } from '@dfinity/agent';
import type { Principal } from '@dfinity/principal';

export type AccountIdentifier = Uint8Array | number[];
export type BlockIndex = bigint;
export type BlockIndex__1 = bigint;
export type BucketId = Principal;
export type EncryptedKey = string;
export type ID = string;
export type ID__1 = string;
export interface Invite {
    id: ID__1;
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
    id: ID__1;
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
    avatarUrl: [] | [string];
}
export interface ProfileCreate {
    username: string;
    displayName: string;
    avatarUrl: [] | [string];
}
export type ProfileCreateError = { username: UsernameError } | { alreadyExists: null } | { journalNotFound: null };
export interface ProfileInfo {
    id: Principal;
    username: string;
    displayName: string;
    inviter: [] | [Principal];
    createdAt: Time;
    updatedAt: Time;
    avatarUrl: [] | [string];
}
export interface ProfileUpdate {
    displayName: string;
    avatarUrl: [] | [string];
}
export type PublicKey = string;
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
    createProfile: ActorMethod<[ProfileCreate], Result_3>;
    deleteInvite: ActorMethod<[ID], Result_2>;
    deleteInvoice: ActorMethod<[], undefined>;
    deleteProfile: ActorMethod<[], Result_1>;
    getInvites: ActorMethod<[], Array<Invite>>;
    getInvoice: ActorMethod<[], [] | [Invoice]>;
    getJournalBucket: ActorMethod<[], [] | [BucketId]>;
    getKey: ActorMethod<[PublicKey], EncryptedKey>;
    getProfile: ActorMethod<[], [] | [ProfileInfo]>;
    getRegistrationMode: ActorMethod<[], RegistrationMode>;
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
    listProfiles: ActorMethod<[], Array<Profile>>;
    putProfile: ActorMethod<[ProfileUpdate], Result_1>;
    redeemInvite: ActorMethod<[ID], Result>;
    setRegistrationMode: ActorMethod<[RegistrationMode], undefined>;
    upgradeJournalBuckets: ActorMethod<[], undefined>;
}
