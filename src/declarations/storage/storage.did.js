export const idlFactory = ({ IDL }) => {
    const RawTree = IDL.Rec();
    const HeaderField = IDL.Tuple(IDL.Text, IDL.Text);
    const CommitBatch = IDL.Record({
        headers: IDL.Vec(HeaderField),
        chunkIds: IDL.Vec(IDL.Nat32),
        batchId: IDL.Nat
    });
    const ID__2 = IDL.Text;
    const Time = IDL.Int;
    const BucketId = IDL.Principal;
    const File = IDL.Record({
        id: ID__2,
        thumbnail: IDL.Opt(ID__2),
        name: IDL.Text,
        createdAt: Time,
        path: IDL.Text,
        bucketId: BucketId,
        fileSize: IDL.Nat,
        encrypted: IDL.Bool,
        updatedAt: Time,
        parentId: IDL.Opt(ID__2)
    });
    const FileCreateError = IDL.Variant({
        illegalCharacters: IDL.Null,
        alreadyExists: File,
        parentNotFound: IDL.Null
    });
    const CommitUploadError = IDL.Variant({
        chunkWrongBatch: IDL.Nat32,
        empty: IDL.Null,
        batchNotFound: IDL.Null,
        addFile: FileCreateError,
        chunkNotFound: IDL.Nat32,
        batchExpired: IDL.Null
    });
    const Result_1 = IDL.Variant({ ok: IDL.Null, err: CommitUploadError });
    const ID = IDL.Text;
    const Key = IDL.Vec(IDL.Nat8);
    RawTree.fill(
        IDL.Variant({
            subtree: IDL.Vec(IDL.Tuple(Key, RawTree)),
            value: IDL.Vec(IDL.Nat8)
        })
    );
    const AssetEncoding__1 = IDL.Record({
        modified: Time,
        totalLength: IDL.Nat,
        chunkIds: IDL.Vec(IDL.Nat32)
    });
    const Result = IDL.Variant({
        ok: AssetEncoding__1,
        err: IDL.Variant({ notFound: IDL.Null })
    });
    const HttpRequest = IDL.Record({
        url: IDL.Text,
        method: IDL.Text,
        body: IDL.Vec(IDL.Nat8),
        headers: IDL.Vec(HeaderField)
    });
    const ID__3 = IDL.Text;
    const StreamingCallbackToken__1 = IDL.Record({
        id: ID__3,
        sha256: IDL.Opt(IDL.Vec(IDL.Nat8)),
        headers: IDL.Vec(HeaderField),
        index: IDL.Nat
    });
    const StreamingCallbackHttpResponse__1 = IDL.Record({
        token: IDL.Opt(StreamingCallbackToken__1),
        body: IDL.Vec(IDL.Nat8)
    });
    const StreamingStrategy = IDL.Variant({
        Callback: IDL.Record({
            token: StreamingCallbackToken__1,
            callback: IDL.Func([StreamingCallbackToken__1], [StreamingCallbackHttpResponse__1], ['query'])
        })
    });
    const HttpResponse = IDL.Record({
        body: IDL.Vec(IDL.Nat8),
        headers: IDL.Vec(HeaderField),
        streaming_strategy: IDL.Opt(StreamingStrategy),
        status_code: IDL.Nat16
    });
    const StreamingCallbackToken = IDL.Record({
        id: ID__3,
        sha256: IDL.Opt(IDL.Vec(IDL.Nat8)),
        headers: IDL.Vec(HeaderField),
        index: IDL.Nat
    });
    const StreamingCallbackHttpResponse = IDL.Record({
        token: IDL.Opt(StreamingCallbackToken__1),
        body: IDL.Vec(IDL.Nat8)
    });
    const ID__1 = IDL.Text;
    const AssetKey__1 = IDL.Record({
        id: ID__1,
        sha256: IDL.Opt(IDL.Vec(IDL.Nat8)),
        thumbnail: IDL.Opt(ID__2),
        name: IDL.Text,
        fileSize: IDL.Nat,
        encrypted: IDL.Bool,
        parentId: IDL.Opt(ID__1)
    });
    const InitUpload = IDL.Record({ batchId: IDL.Nat });
    const AssetKey = IDL.Record({
        id: ID__1,
        sha256: IDL.Opt(IDL.Vec(IDL.Nat8)),
        thumbnail: IDL.Opt(ID__2),
        name: IDL.Text,
        fileSize: IDL.Nat,
        encrypted: IDL.Bool,
        parentId: IDL.Opt(ID__1)
    });
    const AssetEncoding = IDL.Record({
        modified: Time,
        totalLength: IDL.Nat,
        chunkIds: IDL.Vec(IDL.Nat32)
    });
    const Asset = IDL.Record({
        id: ID__1,
        key: AssetKey,
        encoding: AssetEncoding,
        headers: IDL.Vec(HeaderField)
    });
    const Chunk = IDL.Record({
        content: IDL.Vec(IDL.Nat8),
        encrypted: IDL.Bool,
        batchId: IDL.Nat
    });
    const UploadChunk = IDL.Record({ chunkId: IDL.Nat32 });
    const Storage = IDL.Service({
        batchAlive: IDL.Func([IDL.Nat], [], []),
        commitUpload: IDL.Func([CommitBatch, IDL.Bool], [Result_1], []),
        delete: IDL.Func([ID], [], []),
        getAssetsTotalSize: IDL.Func([], [IDL.Nat], ['query']),
        getCertTree: IDL.Func([], [RawTree], ['query']),
        getChunks: IDL.Func([ID], [Result], ['query']),
        getHeapSize: IDL.Func([], [IDL.Nat], ['query']),
        getMaxLiveSize: IDL.Func([], [IDL.Nat], ['query']),
        getMemorySize: IDL.Func([], [IDL.Nat], ['query']),
        getStableMemorySize: IDL.Func([], [IDL.Nat], []),
        getUsedMemorySize: IDL.Func([], [IDL.Nat], []),
        http_request: IDL.Func([HttpRequest], [HttpResponse], ['query']),
        http_request_streaming_callback: IDL.Func([StreamingCallbackToken], [StreamingCallbackHttpResponse], ['query']),
        initUpload: IDL.Func([AssetKey__1], [InitUpload], []),
        list: IDL.Func([], [IDL.Vec(IDL.Tuple(ID, Asset))], ['query']),
        listChunks: IDL.Func([], [IDL.Vec(IDL.Nat32)], ['query']),
        uploadChunk: IDL.Func([Chunk], [UploadChunk], []),
        version: IDL.Func([], [IDL.Nat], ['query'])
    });
    return Storage;
};
export const init = ({ IDL }) => {
    return [IDL.Principal];
};
