export const idlFactory = ({ IDL }) => {
    const Directory__1 = IDL.Rec();
    const AccountIdentifier = IDL.Vec(IDL.Nat8);
    const ID = IDL.Text;
    const BucketId = IDL.Principal;
    const FileCreate = IDL.Record({
        id: ID,
        thumbnail: IDL.Opt(ID),
        name: IDL.Text,
        bucketId: BucketId,
        fileSize: IDL.Nat,
        encrypted: IDL.Bool,
        parentId: IDL.Opt(ID)
    });
    const Time = IDL.Int;
    const File__1 = IDL.Record({
        id: ID,
        thumbnail: IDL.Opt(ID),
        name: IDL.Text,
        createdAt: Time,
        path: IDL.Text,
        bucketId: BucketId,
        fileSize: IDL.Nat,
        encrypted: IDL.Bool,
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const File = IDL.Record({
        id: ID,
        thumbnail: IDL.Opt(ID),
        name: IDL.Text,
        createdAt: Time,
        path: IDL.Text,
        bucketId: BucketId,
        fileSize: IDL.Nat,
        encrypted: IDL.Bool,
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const FileCreateError = IDL.Variant({
        illegalCharacters: IDL.Null,
        alreadyExists: File,
        parentNotFound: IDL.Null
    });
    const Result_12 = IDL.Variant({ ok: File__1, err: FileCreateError });
    const EntryCreate = IDL.Record({
        name: IDL.Text,
        parentId: IDL.Opt(ID)
    });
    const DirectoryColor = IDL.Variant({
        blue: IDL.Null,
        gray: IDL.Null,
        orange: IDL.Null,
        pink: IDL.Null,
        purple: IDL.Null,
        green: IDL.Null,
        yellow: IDL.Null
    });
    Directory__1.fill(
        IDL.Record({
            id: ID,
            name: IDL.Text,
            createdAt: Time,
            path: IDL.Text,
            color: IDL.Opt(DirectoryColor),
            size: IDL.Opt(IDL.Nat),
            children: IDL.Opt(IDL.Tuple(IDL.Vec(Directory__1), IDL.Vec(File))),
            updatedAt: Time,
            parentId: IDL.Opt(ID)
        })
    );
    const DirectoryCreateError = IDL.Variant({
        illegalCharacters: IDL.Null,
        alreadyExists: Directory__1,
        parentNotFound: IDL.Null
    });
    const Result_11 = IDL.Variant({
        ok: IDL.Null,
        err: DirectoryCreateError
    });
    const Result_10 = IDL.Variant({ ok: IDL.Null, err: FileCreateError });
    const Directory = IDL.Record({
        id: ID,
        name: IDL.Text,
        createdAt: Time,
        path: IDL.Text,
        color: IDL.Opt(DirectoryColor),
        size: IDL.Opt(IDL.Nat),
        children: IDL.Opt(IDL.Tuple(IDL.Vec(Directory__1), IDL.Vec(File))),
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const Result_9 = IDL.Variant({
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
    const Tokens = IDL.Record({ e8s: IDL.Nat64 });
    const Tokens__1 = IDL.Record({ e8s: IDL.Nat64 });
    const BlockIndex = IDL.Nat64;
    const TransferError = IDL.Variant({
        TxTooOld: IDL.Record({ allowed_window_nanos: IDL.Nat64 }),
        BadFee: IDL.Record({ expected_fee: Tokens__1 }),
        TxDuplicate: IDL.Record({ duplicate_of: BlockIndex }),
        TxCreatedInFuture: IDL.Null,
        InsufficientFunds: IDL.Record({ balance: Tokens__1 })
    });
    const Result_8 = IDL.Variant({
        ok: IDL.Null,
        err: IDL.Variant({
            notify: NotifyError,
            insufficientFunds: IDL.Record({ balance: Tokens }),
            transfer: TransferError
        })
    });
    const ID__1 = IDL.Text;
    const TransferCyclesError = IDL.Variant({
        too_few_cycles_requested: IDL.Null,
        canister_quota_reached: IDL.Null,
        other: IDL.Text,
        insufficient_cycles_available: IDL.Null,
        aggregate_quota_reached: IDL.Null
    });
    const TransferCyclesResult = IDL.Variant({
        ok: IDL.Nat,
        err: TransferCyclesError
    });
    const NotFoundError = IDL.Variant({ notFound: IDL.Null });
    const Result_7 = IDL.Variant({ ok: IDL.Null, err: NotFoundError });
    const BucketId__1 = IDL.Principal;
    const FileShare = IDL.Record({
        journalId: BucketId,
        limitDownloads: IDL.Opt(IDL.Nat),
        sharedWith: IDL.Variant({
            everyone: IDL.Null,
            users: IDL.Vec(IDL.Principal)
        }),
        timelock: IDL.Opt(Time)
    });
    const FileExtended__1 = IDL.Record({
        id: ID,
        thumbnail: IDL.Opt(ID),
        name: IDL.Text,
        createdAt: Time,
        path: IDL.Text,
        bucketId: BucketId,
        fileSize: IDL.Nat,
        encrypted: IDL.Bool,
        share: IDL.Opt(FileShare),
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const DirectoryState = IDL.Record({
        id: IDL.Opt(ID),
        files: IDL.Vec(FileExtended__1),
        dirs: IDL.Vec(Directory__1),
        breadcrumbs: IDL.Vec(Directory__1)
    });
    const DirectoryStateError = IDL.Variant({ notFound: IDL.Null });
    const Result_6 = IDL.Variant({
        ok: DirectoryState,
        err: DirectoryStateError
    });
    const SharedFileExtended = IDL.Record({
        id: ID,
        thumbnail: IDL.Opt(ID),
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
    const Result_5 = IDL.Variant({
        ok: SharedFileExtended,
        err: IDL.Variant({ noPermission: IDL.Null, notFound: IDL.Null })
    });
    const FileExtended = IDL.Record({
        id: ID,
        thumbnail: IDL.Opt(ID),
        name: IDL.Text,
        createdAt: Time,
        path: IDL.Text,
        bucketId: BucketId,
        fileSize: IDL.Nat,
        encrypted: IDL.Bool,
        share: IDL.Opt(FileShare),
        updatedAt: Time,
        parentId: IDL.Opt(ID)
    });
    const DirectoryMoveError = IDL.Variant({
        sourceNotFound: IDL.Null,
        notFound: IDL.Null,
        targetNotFound: IDL.Null,
        invalidParams: IDL.Null
    });
    const Result_4 = IDL.Variant({ ok: IDL.Null, err: DirectoryMoveError });
    const FileMoveError = IDL.Variant({
        sourceNotFound: IDL.Null,
        notFound: IDL.Null,
        targetNotFound: IDL.Null,
        invalidParams: IDL.Null
    });
    const Result_3 = IDL.Variant({ ok: IDL.Null, err: FileMoveError });
    const Result_2 = IDL.Variant({
        ok: File__1,
        err: IDL.Variant({
            illegalCharacters: IDL.Null,
            alreadyExists: File__1,
            notFound: IDL.Null
        })
    });
    const SharedFileParams = IDL.Record({
        limitDownloads: IDL.Opt(IDL.Nat),
        sharedWith: IDL.Variant({
            everyone: IDL.Null,
            users: IDL.Vec(IDL.Principal)
        }),
        timelock: IDL.Opt(Time)
    });
    const Result_1 = IDL.Variant({
        ok: FileExtended,
        err: IDL.Variant({ notFound: IDL.Null })
    });
    const DirectoryAction = IDL.Variant({ rename: ID, changeColor: ID });
    const DirectoryUpdatableFields = IDL.Record({
        name: IDL.Opt(IDL.Text),
        color: IDL.Opt(DirectoryColor),
        parentId: IDL.Opt(ID)
    });
    const Result = IDL.Variant({
        ok: Directory,
        err: IDL.Variant({ alreadyExists: Directory, notFound: IDL.Null })
    });
    const TransferResult = IDL.Variant({
        Ok: BlockIndex,
        Err: TransferError
    });
    const JournalBucket = IDL.Service({
        accountIdentifier: IDL.Func([], [AccountIdentifier], ['query']),
        addFile: IDL.Func([FileCreate], [Result_12], []),
        checkDirname: IDL.Func([EntryCreate], [Result_11], ['query']),
        checkFilename: IDL.Func([EntryCreate], [Result_10], ['query']),
        createDirectory: IDL.Func([EntryCreate], [Result_9], []),
        createInvite: IDL.Func([Time], [Result_8], []),
        createPaths: IDL.Func([IDL.Vec(IDL.Text), IDL.Vec(ID__1), IDL.Opt(ID__1)], [IDL.Vec(IDL.Tuple(IDL.Text, ID__1))], []),
        cycles_manager_transferCycles: IDL.Func([IDL.Nat], [TransferCyclesResult], []),
        deleteDirectory: IDL.Func([IDL.Text], [Result_7], []),
        deleteFile: IDL.Func([IDL.Text], [Result_7], []),
        deleteStorage: IDL.Func([BucketId__1], [], []),
        fileVetkdPublicKey: IDL.Func([ID__1, IDL.Vec(IDL.Vec(IDL.Nat8))], [IDL.Text], []),
        fixStorageControllers: IDL.Func([], [], []),
        getChildrenDirs: IDL.Func([IDL.Opt(ID__1)], [IDL.Vec(Directory)], ['query']),
        getFileEncryptedSymmetricKey: IDL.Func([ID__1, IDL.Vec(IDL.Nat8)], [IDL.Text], []),
        getJournal: IDL.Func([IDL.Opt(IDL.Text)], [Result_6], ['query']),
        getSharedFile: IDL.Func([IDL.Principal, ID__1], [Result_5], ['query']),
        getStorage: IDL.Func([IDL.Nat], [IDL.Opt(BucketId__1)], []),
        listFiles: IDL.Func([IDL.Opt(ID__1)], [IDL.Vec(FileExtended)], ['query']),
        listStorages: IDL.Func([], [IDL.Vec(BucketId__1)], ['query']),
        moveDirectory: IDL.Func([IDL.Text, IDL.Opt(IDL.Text)], [Result_4], []),
        moveFile: IDL.Func([IDL.Text, IDL.Opt(IDL.Text)], [Result_3], []),
        renameFile: IDL.Func([IDL.Text, IDL.Text], [Result_2], []),
        setFileEncryptedSymmetricKey: IDL.Func([ID__1, IDL.Vec(IDL.Nat8)], [IDL.Text], []),
        shareFile: IDL.Func([ID__1, SharedFileParams], [Result_1], []),
        sharedWithMe: IDL.Func([], [IDL.Vec(SharedFileExtended)], ['query']),
        showDirectoriesTree: IDL.Func([IDL.Opt(ID__1)], [IDL.Text], ['query']),
        startMonitor: IDL.Func([BucketId__1], [], []),
        stopMonitor: IDL.Func([BucketId__1], [], []),
        storageLoadWasm: IDL.Func([IDL.Vec(IDL.Nat8)], [IDL.Record({ total: IDL.Nat, chunks: IDL.Nat })], []),
        storageResetWasm: IDL.Func([], [], []),
        unshareFile: IDL.Func([ID__1], [Result_1], []),
        updateDirectory: IDL.Func([DirectoryAction, DirectoryUpdatableFields], [Result], []),
        upgradeStorages: IDL.Func([], [], []),
        withdraw: IDL.Func([IDL.Record({ to: IDL.Opt(AccountIdentifier), amount: Tokens })], [TransferResult], [])
    });
    return JournalBucket;
};
export const init = ({ IDL }) => {
    return [IDL.Principal];
};
