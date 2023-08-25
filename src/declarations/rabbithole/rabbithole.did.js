export const idlFactory = ({ IDL }) => {
    const Tokens = IDL.Record({ e8s: IDL.Nat64 });
    const AccountIdentifier = IDL.Vec(IDL.Nat8);
    const ID = IDL.Text;
    const InviteError = IDL.Variant({
        alreadyUsed: IDL.Null,
        expired: IDL.Null,
        notFound: IDL.Null
    });
    const Result = IDL.Variant({ ok: IDL.Null, err: InviteError });
    const UsernameError__1 = IDL.Variant({
        illegalCharacters: IDL.Null,
        alreadyExists: IDL.Null,
        maxLength: IDL.Null,
        minLength: IDL.Null
    });
    const Result_5 = IDL.Variant({ ok: IDL.Null, err: UsernameError__1 });
    const Time = IDL.Int;
    const InviteCreate = IDL.Record({
        expiredAt: Time,
        owner: IDL.Principal,
        cycles: IDL.Nat
    });
    const ID__2 = IDL.Text;
    const BlockIndex = IDL.Nat64;
    const NotifyCreateCanisterArg = IDL.Record({
        controller: IDL.Principal,
        block_index: BlockIndex,
        subnet_type: IDL.Opt(IDL.Text)
    });
    const InvoiceStage = IDL.Variant({
        active: IDL.Null,
        paid: IDL.Null,
        notifyCanister: NotifyCreateCanisterArg,
        transferUnusedFunds: IDL.Principal,
        complete: IDL.Principal,
        installJournal: IDL.Principal,
        createCanister: Tokens
    });
    const Invoice = IDL.Record({
        id: ID__2,
        expiredAt: Time,
        owner: IDL.Principal,
        createdAt: Time,
        stage: InvoiceStage,
        amount: Tokens,
        timerId: IDL.Opt(IDL.Nat)
    });
    const NotifyError = IDL.Variant({
        Refunded: IDL.Record({
            block_index: IDL.Opt(BlockIndex),
            reason: IDL.Text
        }),
        InvalidTransaction: IDL.Text,
        Other: IDL.Record({
            error_message: IDL.Text,
            error_code: IDL.Nat64
        }),
        Processing: IDL.Null,
        TransactionTooOld: BlockIndex
    });
    const BlockIndex__1 = IDL.Nat64;
    const TransferError = IDL.Variant({
        TxTooOld: IDL.Record({ allowed_window_nanos: IDL.Nat64 }),
        BadFee: IDL.Record({ expected_fee: Tokens }),
        TxDuplicate: IDL.Record({ duplicate_of: BlockIndex__1 }),
        TxCreatedInFuture: IDL.Null,
        InsufficientFunds: IDL.Record({ balance: Tokens })
    });
    const Result_4 = IDL.Variant({
        ok: IDL.Null,
        err: IDL.Variant({
            notify: NotifyError,
            wrongStage: IDL.Null,
            notFound: IDL.Null,
            transfer: TransferError
        })
    });
    const ProfileCreateV2 = IDL.Record({
        username: IDL.Text,
        displayName: IDL.Text,
        avatarUrl: IDL.Opt(IDL.Text)
    });
    const UsernameError = IDL.Variant({
        illegalCharacters: IDL.Null,
        alreadyExists: IDL.Null,
        maxLength: IDL.Null,
        minLength: IDL.Null
    });
    const ProfileCreateError = IDL.Variant({
        username: UsernameError,
        alreadyExists: IDL.Null,
        journalNotFound: IDL.Null
    });
    const Result_3 = IDL.Variant({ ok: IDL.Null, err: ProfileCreateError });
    const InviteDeleteError = IDL.Variant({
        alreadyUsed: IDL.Principal,
        expired: IDL.Null,
        notFound: IDL.Null,
        notPermission: IDL.Null
    });
    const Result_2 = IDL.Variant({ ok: IDL.Null, err: InviteDeleteError });
    const Result_1 = IDL.Variant({
        ok: IDL.Null,
        err: IDL.Variant({ notFound: IDL.Null })
    });
    const Invite = IDL.Record({
        id: ID__2,
        status: IDL.Variant({
            active: IDL.Null,
            expired: IDL.Null,
            used: IDL.Principal
        }),
        expiredAt: Time,
        owner: IDL.Principal,
        createdAt: Time,
        cycles: IDL.Nat,
        canisterId: IDL.Principal
    });
    const BucketId__1 = IDL.Principal;
    const ProfileInfoV2 = IDL.Record({
        id: IDL.Principal,
        username: IDL.Text,
        displayName: IDL.Text,
        inviter: IDL.Opt(IDL.Principal),
        createdAt: Time,
        updatedAt: Time,
        avatarUrl: IDL.Opt(IDL.Text)
    });
    const RegistrationMode = IDL.Variant({
        prepaid: IDL.Null,
        invite: IDL.Null
    });
    const ID__1 = IDL.Text;
    const BucketId = IDL.Principal;
    const SharedFileExtended = IDL.Record({
        id: ID__1,
        thumbnail: IDL.Opt(ID__1),
        owner: IDL.Principal,
        name: IDL.Text,
        createdAt: Time,
        journalId: BucketId,
        limitDownloads: IDL.Opt(IDL.Nat),
        fileSize: IDL.Nat,
        storageId: BucketId,
        encrypted: IDL.Bool,
        sharedWith: IDL.Variant({
            everyone: IDL.Null,
            users: IDL.Vec(IDL.Principal)
        }),
        updatedAt: Time,
        downloads: IDL.Nat,
        timelock: IDL.Opt(Time)
    });
    const Profile__1 = IDL.Record({
        principal: IDL.Principal,
        username: IDL.Text,
        displayName: IDL.Text,
        avatarUrl: IDL.Opt(IDL.Text)
    });
    const ProfileUpdateV2 = IDL.Record({
        displayName: IDL.Text,
        avatarUrl: IDL.Opt(IDL.Text)
    });
    const SharedFile = IDL.Record({
        id: ID__1,
        owner: IDL.Principal,
        createdAt: Time,
        journalId: BucketId,
        limitDownloads: IDL.Opt(IDL.Nat),
        storageId: BucketId,
        sharedWith: IDL.Variant({
            everyone: IDL.Null,
            users: IDL.Vec(IDL.Principal)
        }),
        updatedAt: Time,
        downloads: IDL.Nat,
        timelock: IDL.Opt(Time)
    });
    const Profile = IDL.Record({
        principal: IDL.Principal,
        username: IDL.Text,
        displayName: IDL.Text,
        avatarUrl: IDL.Opt(IDL.Text)
    });
    const UserShare = IDL.Record({
        bucketId: IDL.Principal,
        profile: Profile
    });
    return IDL.Service({
        accountBalance: IDL.Func([], [Tokens], []),
        accountIdentifier: IDL.Func([], [AccountIdentifier], ['query']),
        canInvite: IDL.Func([], [IDL.Bool], ['query']),
        checkInvite: IDL.Func([ID], [Result], ['query']),
        checkUsername: IDL.Func([IDL.Text], [Result_5], ['query']),
        checkUsernameAvailability: IDL.Func([IDL.Text], [IDL.Bool], ['query']),
        createAdminInvite: IDL.Func([], [IDL.Text], []),
        createInvite: IDL.Func([InviteCreate], [], []),
        createInvoice: IDL.Func([], [Invoice], []),
        createJournal: IDL.Func([ID], [Result_4], []),
        createProfile: IDL.Func([ProfileCreateV2], [Result_3], []),
        deleteInvite: IDL.Func([ID], [Result_2], []),
        deleteInvoice: IDL.Func([], [], []),
        deleteProfile: IDL.Func([], [Result_1], []),
        getInvites: IDL.Func([], [IDL.Vec(Invite)], ['query']),
        getInvoice: IDL.Func([], [IDL.Opt(Invoice)], ['query']),
        getJournalBucket: IDL.Func([], [IDL.Opt(BucketId__1)], []),
        getProfile: IDL.Func([], [IDL.Opt(ProfileInfoV2)], ['query']),
        getRegistrationMode: IDL.Func([], [RegistrationMode], ['query']),
        getSharedFile: IDL.Func([ID], [IDL.Opt(SharedFileExtended)], ['composite_query']),
        installCode: IDL.Func(
            [
                IDL.Record({
                    arg: IDL.Vec(IDL.Nat8),
                    wasm_module: IDL.Vec(IDL.Nat8),
                    mode: IDL.Variant({
                        reinstall: IDL.Null,
                        upgrade: IDL.Null,
                        install: IDL.Null
                    }),
                    canister_id: IDL.Principal
                })
            ],
            [],
            []
        ),
        listBuckets: IDL.Func([IDL.Text], [IDL.Vec(IDL.Tuple(IDL.Principal, BucketId__1))], []),
        listProfiles: IDL.Func([], [IDL.Vec(Profile__1)], ['query']),
        putProfile: IDL.Func([ProfileUpdateV2], [Result_1], []),
        redeemInvite: IDL.Func([ID], [Result], []),
        setRegistrationMode: IDL.Func([RegistrationMode], [], []),
        shareFile: IDL.Func([ID, SharedFile], [], []),
        sharedWithMe: IDL.Func([], [IDL.Vec(UserShare)], ['query']),
        unshareFile: IDL.Func([ID], [], []),
        upgradeJournalBuckets: IDL.Func([], [], [])
    });
};
export const init = ({ IDL }) => {
    return [];
};
