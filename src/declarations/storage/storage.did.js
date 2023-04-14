export const idlFactory = ({ IDL }) => {
    const HeaderField__1 = IDL.Tuple(IDL.Text, IDL.Text);
    const ID__2 = IDL.Text;
    const HeaderField = IDL.Tuple(IDL.Text, IDL.Text);
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
    const StreamingStrategy = IDL.Variant({
        Callback: IDL.Record({
            token: StreamingCallbackToken__1,
            callback: IDL.Func([], [], [])
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
        id: ID,
        name: IDL.Text,
        fileSize: IDL.Nat,
        parentId: IDL.Opt(ID)
    });
    const Chunk = IDL.Record({
        content: IDL.Vec(IDL.Nat8),
        batchId: IDL.Nat
    });
    const StorageBucket = IDL.Service({
        commitUpload: IDL.Func(
            [
                IDL.Record({
                    headers: IDL.Vec(HeaderField__1),
                    chunkIds: IDL.Vec(IDL.Nat),
                    batchId: IDL.Nat
                })
            ],
            [],
            []
        ),
        delete: IDL.Func([ID__2], [], []),
        getUsedMemorySize: IDL.Func([], [IDL.Nat], []),
        getVersion: IDL.Func([], [IDL.Text], ['query']),
        http_request: IDL.Func([HttpRequest], [HttpResponse], ['query']),
        http_request_streaming_callback: IDL.Func([StreamingCallbackToken], [StreamingCallbackHttpResponse], ['query']),
        initUpload: IDL.Func([AssetKey], [IDL.Record({ batchId: IDL.Nat })], []),
        uploadChunk: IDL.Func([Chunk], [IDL.Record({ chunkId: IDL.Nat })], [])
    });
    return StorageBucket;
};
export const init = ({ IDL }) => {
    return [IDL.Principal];
};
