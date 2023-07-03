export const idlFactory = ({ IDL }) => {
    const RawTree = IDL.Rec();
    const HeaderField = IDL.Tuple(IDL.Text, IDL.Text);
    const CommitBatch = IDL.Record({
        headers: IDL.Vec(HeaderField),
        chunkIds: IDL.Vec(IDL.Nat),
        batchId: IDL.Nat
    });
    const ID__3 = IDL.Text;
    const Time = IDL.Int;
    const BucketId = IDL.Principal;
    const File = IDL.Record({
        id: ID__3,
        thumbnail: IDL.Opt(IDL.Text),
        name: IDL.Text,
        createdAt: Time,
        path: IDL.Text,
        bucketId: BucketId,
        fileSize: IDL.Nat,
        updatedAt: Time,
        parentId: IDL.Opt(ID__3)
    });
    const FileCreateError = IDL.Variant({
        illegalCharacters: IDL.Null,
        alreadyExists: File,
        parentNotFound: IDL.Null
    });
    const CommitUploadError = IDL.Variant({
        chunkWrongBatch: IDL.Nat,
        empty: IDL.Null,
        batchNotFound: IDL.Null,
        addFile: FileCreateError,
        chunkNotFound: IDL.Nat,
        batchExpired: IDL.Null
    });
    const Result = IDL.Variant({ ok: IDL.Null, err: CommitUploadError });
    const ID__2 = IDL.Text;
    const Key = IDL.Vec(IDL.Nat8);
    RawTree.fill(
        IDL.Variant({
            subtree: IDL.Vec(IDL.Tuple(Key, RawTree)),
            value: IDL.Vec(IDL.Nat8)
        })
    );
    const HttpRequest = IDL.Record({
        url: IDL.Text,
        method: IDL.Text,
        body: IDL.Vec(IDL.Nat8),
        headers: IDL.Vec(HeaderField)
    });
    const ID__1 = IDL.Text;
    const StreamingCallbackToken__1 = IDL.Record({
        id: ID__1,
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
        id: ID__1,
        sha256: IDL.Opt(IDL.Vec(IDL.Nat8)),
        headers: IDL.Vec(HeaderField),
        index: IDL.Nat
    });
    const StreamingCallbackHttpResponse = IDL.Record({
        token: IDL.Opt(StreamingCallbackToken__1),
        body: IDL.Vec(IDL.Nat8)
    });
    const ID = IDL.Text;
    const AssetKey = IDL.Record({
        sha256: IDL.Opt(IDL.Vec(IDL.Nat8)),
        thumbnail: IDL.Opt(IDL.Text),
        name: IDL.Text,
        fileSize: IDL.Nat,
        parentId: IDL.Opt(ID)
    });
    const InitUpload = IDL.Record({ batchId: IDL.Nat });
    const Chunk = IDL.Record({
        content: IDL.Vec(IDL.Nat8),
        batchId: IDL.Nat
    });
    const UploadChunk = IDL.Record({ chunkId: IDL.Nat });
    const Storage = IDL.Service({
        batchAlive: IDL.Func([IDL.Nat], [], []),
        commitUpload: IDL.Func([CommitBatch, IDL.Bool], [Result], []),
        delete: IDL.Func([ID__2], [], []),
        getAssetsTotalSize: IDL.Func([], [IDL.Nat], ['query']),
        getCertTree: IDL.Func([], [RawTree], ['query']),
        getHeapSize: IDL.Func([], [IDL.Nat], ['query']),
        getMaxLiveSize: IDL.Func([], [IDL.Nat], ['query']),
        getMemorySize: IDL.Func([], [IDL.Nat], ['query']),
        getStableMemorySize: IDL.Func([], [IDL.Nat], []),
        getUsedMemorySize: IDL.Func([], [IDL.Nat], []),
        http_request: IDL.Func([HttpRequest], [HttpResponse], ['query']),
        http_request_streaming_callback: IDL.Func([StreamingCallbackToken], [StreamingCallbackHttpResponse], ['query']),
        initUpload: IDL.Func([AssetKey], [InitUpload], []),
        uploadChunk: IDL.Func([Chunk], [UploadChunk], []),
        version: IDL.Func([], [IDL.Nat], ['query'])
    });
    return Storage;
};
export const init = ({ IDL }) => {
    return [IDL.Principal];
};
