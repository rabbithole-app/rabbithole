export const idlFactory = ({ IDL }) => {
    const AccountIdentifier = IDL.Vec(IDL.Nat8);
    const BucketId__1 = IDL.Principal;
    const ID = IDL.Text;
    const FileCreate = IDL.Record({
        name: IDL.Text,
        bucketId: BucketId__1,
        fileSize: IDL.Nat,
        parentId: IDL.Opt(ID)
    });
    const Time = IDL.Int;
    const File__1 = IDL.Record({
        id: ID,
        name: IDL.Text,
        createdAt: Time,
        bucketId: BucketId__1,
        fileSize: IDL.Nat,
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const File = IDL.Record({
        id: ID,
        name: IDL.Text,
        createdAt: Time,
        bucketId: BucketId__1,
        fileSize: IDL.Nat,
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const FileCreateError = IDL.Variant({
        illegalCharacters: IDL.Null,
        alreadyExists: File
    });
    const Result_7 = IDL.Variant({ ok: File__1, err: FileCreateError });
    const definite_canister_settings = IDL.Record({
        freezing_threshold: IDL.Nat,
        controllers: IDL.Vec(IDL.Principal),
        memory_allocation: IDL.Nat,
        compute_allocation: IDL.Nat
    });
    const canister_status_response = IDL.Record({
        status: IDL.Variant({
            stopped: IDL.Null,
            stopping: IDL.Null,
            running: IDL.Null
        }),
        memory_size: IDL.Nat,
        cycles: IDL.Nat,
        settings: definite_canister_settings,
        idle_cycles_burned_per_day: IDL.Nat,
        module_hash: IDL.Opt(IDL.Vec(IDL.Nat8))
    });
    const ID__1 = IDL.Text;
    const DirectoryColor = IDL.Variant({
        blue: IDL.Null,
        gray: IDL.Null,
        orange: IDL.Null,
        pink: IDL.Null,
        purple: IDL.Null,
        green: IDL.Null,
        yellow: IDL.Null
    });
    const JournalEntry = IDL.Record({
        id: ID,
        name: IDL.Text,
        createdAt: Time,
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const Directory = IDL.Record({
        id: ID,
        name: IDL.Text,
        createdAt: Time,
        path: IDL.Opt(IDL.Text),
        color: IDL.Opt(DirectoryColor),
        children: IDL.Opt(IDL.Vec(JournalEntry)),
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const Directory__1 = IDL.Record({
        id: ID,
        name: IDL.Text,
        createdAt: Time,
        path: IDL.Opt(IDL.Text),
        color: IDL.Opt(DirectoryColor),
        children: IDL.Opt(IDL.Vec(JournalEntry)),
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const DirectoryCreateError = IDL.Variant({
        illegalCharacters: IDL.Null,
        alreadyExists: Directory__1
    });
    const Result_6 = IDL.Variant({
        ok: Directory,
        err: DirectoryCreateError
    });
    const BlockIndex__1 = IDL.Nat64;
    const NotifyError = IDL.Variant({
        Refunded: IDL.Record({
            block_index: IDL.Opt(BlockIndex__1),
            reason: IDL.Text
        }),
        InvalidTransaction: IDL.Text,
        Other: IDL.Record({
            error_message: IDL.Text,
            error_code: IDL.Nat64
        }),
        Processing: IDL.Null,
        TransactionTooOld: BlockIndex__1
    });
    const Tokens__1 = IDL.Record({ e8s: IDL.Nat64 });
    const Tokens = IDL.Record({ e8s: IDL.Nat64 });
    const BlockIndex = IDL.Nat64;
    const TransferError = IDL.Variant({
        TxTooOld: IDL.Record({ allowed_window_nanos: IDL.Nat64 }),
        BadFee: IDL.Record({ expected_fee: Tokens }),
        TxDuplicate: IDL.Record({ duplicate_of: BlockIndex }),
        TxCreatedInFuture: IDL.Null,
        InsufficientFunds: IDL.Record({ balance: Tokens })
    });
    const Result_5 = IDL.Variant({
        ok: IDL.Null,
        err: IDL.Variant({
            notify: NotifyError,
            insufficientFunds: IDL.Record({ balance: Tokens__1 }),
            transfer: TransferError
        })
    });
    const Result_4 = IDL.Variant({
        ok: IDL.Null,
        err: IDL.Variant({ notFound: IDL.Null })
    });
    const BucketId = IDL.Principal;
    const Subaccount = IDL.Vec(IDL.Nat8);
    const Canister = IDL.Record({
        status: IDL.Opt(canister_status_response),
        owner: IDL.Principal,
        error: IDL.Opt(IDL.Text),
        monitoring: IDL.Variant({ stopped: IDL.Null, running: IDL.Null }),
        lastChecked: Time,
        timerId: IDL.Opt(IDL.Nat),
        canisterId: BucketId__1
    });
    const Journal = IDL.Record({
        id: IDL.Opt(ID),
        files: IDL.Vec(File),
        dirs: IDL.Vec(Directory__1),
        breadcrumbs: IDL.Vec(Directory__1)
    });
    const JournalError = IDL.Variant({ notFound: IDL.Null });
    const Result_3 = IDL.Variant({ ok: Journal, err: JournalError });
    const DirectoryMoveError = IDL.Variant({
        sourceNotFound: IDL.Null,
        notFound: IDL.Null,
        targetNotFound: IDL.Null,
        invalidParams: IDL.Null
    });
    const Result_2 = IDL.Variant({ ok: IDL.Null, err: DirectoryMoveError });
    const FileMoveError = IDL.Variant({
        sourceNotFound: IDL.Null,
        notFound: IDL.Null,
        targetNotFound: IDL.Null,
        invalidParams: IDL.Null
    });
    const Result_1 = IDL.Variant({ ok: IDL.Null, err: FileMoveError });
    const DirectoryAction = IDL.Variant({ rename: ID, changeColor: ID });
    const DirectoryUpdatableFields = IDL.Record({
        name: IDL.Opt(IDL.Text),
        color: IDL.Opt(DirectoryColor),
        parentId: IDL.Opt(ID)
    });
    const Result = IDL.Variant({
        ok: Directory,
        err: IDL.Variant({ alreadyExists: IDL.Null, notFound: IDL.Null })
    });
    const TransferResult = IDL.Variant({
        Ok: BlockIndex,
        Err: TransferError
    });
    const JournalBucket = IDL.Service({
        accountIdentifier: IDL.Func([], [AccountIdentifier], ['query']),
        addFile: IDL.Func([FileCreate], [Result_7], []),
        canisterStatus: IDL.Func(
            [IDL.Principal],
            [
                IDL.Record({
                    id: IDL.Principal,
                    status: canister_status_response,
                    freezingThresholdInCycles: IDL.Nat
                })
            ],
            []
        ),
        checkRoute: IDL.Func([IDL.Opt(IDL.Text)], [IDL.Bool], ['query']),
        createDirectory: IDL.Func(
            [
                IDL.Record({
                    id: ID__1,
                    name: IDL.Text,
                    parentId: IDL.Opt(ID__1)
                })
            ],
            [Result_6],
            []
        ),
        createInvite: IDL.Func([Time], [Result_5], []),
        createPath: IDL.Func([IDL.Text], [], []),
        deleteDirectory: IDL.Func([IDL.Text], [Result_4], []),
        deleteFile: IDL.Func([IDL.Text], [Result_4], []),
        deleteStorage: IDL.Func([BucketId], [], []),
        depositInfo: IDL.Func(
            [],
            [
                IDL.Record({
                    balance: IDL.Record({ e8s: IDL.Nat64 }),
                    subaccount: Subaccount,
                    account: AccountIdentifier
                })
            ],
            []
        ),
        getCanisters: IDL.Func([], [IDL.Vec(Canister)], ['query']),
        getJournal: IDL.Func([IDL.Opt(IDL.Text)], [Result_3], ['query']),
        getStorage: IDL.Func([IDL.Nat], [IDL.Opt(BucketId)], []),
        isDirnameValid: IDL.Func([IDL.Text], [IDL.Bool], ['query']),
        listStorages: IDL.Func([], [IDL.Vec(BucketId)], ['query']),
        moveDirectory: IDL.Func([IDL.Text, IDL.Opt(IDL.Text)], [Result_2], []),
        moveFile: IDL.Func([IDL.Text, IDL.Opt(IDL.Text)], [Result_1], []),
        showDirectoriesTree: IDL.Func([IDL.Opt(ID__1)], [IDL.Text], ['query']),
        showPaths: IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
        startBucketMonitor: IDL.Func([BucketId], [], []),
        stopBucketMonitor: IDL.Func([BucketId], [], []),
        storageLoadWasm: IDL.Func([IDL.Vec(IDL.Nat8)], [IDL.Record({ total: IDL.Nat, chunks: IDL.Nat })], []),
        storageResetWasm: IDL.Func([], [], []),
        updateDirectory: IDL.Func([DirectoryAction, DirectoryUpdatableFields], [Result], []),
        upgradeStorages: IDL.Func([], [], []),
        withdraw: IDL.Func([IDL.Record({ to: IDL.Opt(AccountIdentifier), amount: Tokens })], [TransferResult], [])
    });
    return JournalBucket;
};
export const init = ({ IDL }) => {
    return [IDL.Principal];
};
