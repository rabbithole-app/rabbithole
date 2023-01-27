export const idlFactory = ({ IDL }) => {
    const HeaderField = IDL.Tuple(IDL.Text, IDL.Text);
    const ID = IDL.Text;
    const AssetKey = IDL.Record({
        token: IDL.Opt(IDL.Text),
        name: IDL.Text,
        fullPath: IDL.Text,
        fileSize: IDL.Nat,
        parentId: IDL.Opt(ID),
        folder: IDL.Text
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
        sendCyclesToInstaller: IDL.Func([], [], ['oneway']),
        uploadChunk: IDL.Func([Chunk], [IDL.Record({ chunkId: IDL.Nat })], [])
    });
    return StorageBucket;
};
export const init = ({ IDL }) => {
    return [IDL.Principal];
};
