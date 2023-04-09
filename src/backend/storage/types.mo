import Types "../types/types";

module {
    type ID = Types.ID;

    public type Chunk = {
        batchId : Nat;
        content : Blob;
    };

    public type AssetEncoding = {
        modified : Int;
        contentChunks : [Blob];
        totalLength : Nat;
    };

    public type AssetKey = {
        id : ID;
        fileSize : Nat;
        name : Text;
        parentId : ?ID;
    };

    public type Asset = {
        key : AssetKey;
        headers : [(Text, Text)];
        encoding : AssetEncoding;
    };

    public type Batch = {
        key : AssetKey;
        expiresAt : Int;
    };

    public type CommitUploadError = {
        #batchExpired;
        #batchNotFound;
        #noChunk;
        #chunkNotExist;
    };
};
