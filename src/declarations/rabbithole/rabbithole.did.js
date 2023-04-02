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
    const ID__1 = IDL.Text;
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
        id: ID__1,
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
    const ProfileCreate = IDL.Record({
        username: IDL.Text,
        displayName: IDL.Text
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
        id: ID__1,
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
    const BucketId = IDL.Principal;
    const PublicKey = IDL.Text;
    const EncryptedKey = IDL.Text;
    const ProfileInfo = IDL.Record({
        id: IDL.Principal,
        username: IDL.Text,
        displayName: IDL.Text,
        inviter: IDL.Opt(IDL.Principal),
        createdAt: Time,
        updatedAt: Time
    });
    const RegistrationMode = IDL.Variant({
        prepaid: IDL.Null,
        invite: IDL.Null
    });
    const ProfileUpdate = IDL.Record({ displayName: IDL.Text });
    return IDL.Service({
        accountBalance: IDL.Func([], [Tokens], []),
        accountIdentifier: IDL.Func([], [AccountIdentifier], ['query']),
        checkInvite: IDL.Func([ID], [Result], ['query']),
        checkUsername: IDL.Func([IDL.Text], [Result_5], ['query']),
        checkUsernameAvailability: IDL.Func([IDL.Text], [IDL.Bool], ['query']),
        createInvite: IDL.Func([InviteCreate], [], []),
        createInvoice: IDL.Func([], [Invoice], []),
        createJournal: IDL.Func([ID], [Result_4], []),
        createProfile: IDL.Func([ProfileCreate], [Result_3], []),
        deleteInvite: IDL.Func([ID], [Result_2], []),
        deleteInvoice: IDL.Func([], [], []),
        deleteProfile: IDL.Func([], [Result_1], []),
        getInvites: IDL.Func([], [IDL.Vec(Invite)], ['query']),
        getInvoice: IDL.Func([], [IDL.Opt(Invoice)], ['query']),
        getJournalBucket: IDL.Func([], [IDL.Opt(BucketId)], []),
        getKey: IDL.Func([PublicKey], [EncryptedKey], ['query']),
        getProfile: IDL.Func([], [IDL.Opt(ProfileInfo)], ['query']),
        getRegistrationMode: IDL.Func([], [RegistrationMode], ['query']),
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
        listBuckets: IDL.Func([IDL.Text], [IDL.Vec(IDL.Tuple(IDL.Principal, BucketId))], []),
        putProfile: IDL.Func([ProfileUpdate], [Result_1], []),
        redeemInvite: IDL.Func([ID], [Result], []),
        setRegistrationMode: IDL.Func([RegistrationMode], [], []),
        upgradeJournalBuckets: IDL.Func([], [], [])
    });
};
export const init = ({ IDL }) => {
    return [];
};
