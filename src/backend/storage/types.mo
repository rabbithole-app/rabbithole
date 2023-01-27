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
        // myimage.jpg
        name : Text;
        // images
        folder : Text;
        parentId : ?ID;
        // /images/myimage.jpg
        fullPath : Text;
        // ?token=1223-3345-5564-3333
        token : ?Text;
        fileSize : Nat;
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
