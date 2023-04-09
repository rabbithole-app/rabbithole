export const idlFactory = ({ IDL }) => {
    const HeaderField = IDL.Tuple(IDL.Text, IDL.Text);
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
                    headers: IDL.Vec(HeaderField),
                    chunkIds: IDL.Vec(IDL.Nat),
                    batchId: IDL.Nat
                })
            ],
            [],
            []
        ),
        getUsedMemorySize: IDL.Func([], [IDL.Nat], []),
        getVersion: IDL.Func([], [IDL.Text], ['query']),
        initUpload: IDL.Func([AssetKey], [IDL.Record({ batchId: IDL.Nat })], []),
        uploadChunk: IDL.Func([Chunk], [IDL.Record({ chunkId: IDL.Nat })], [])
    });
    return StorageBucket;
};
export const init = ({ IDL }) => {
    return [IDL.Principal];
};
