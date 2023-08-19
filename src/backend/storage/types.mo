import Time "mo:base/Time";
// import TrieSet "mo:base/TrieSet";
import Vector "mo:vector";
import Types "../types/types";
import HTTPTypes "../types/http";
import JournalTypes "../journal/types";

module {
    type ID = Types.ID;
    type Thumbnail = JournalTypes.Thumbnail;

    public type Chunk = {
        batchId : Nat;
        content : Blob;
        encrypted : Bool;
    };

    public type AssetInfo = {
        chunkIds : [Nat32];
        totalLength : Nat;
        contentType : ?Text;
    };

    public type AssetEncoding = {
        modified : Time.Time;
        chunkIds : [Nat32];
        totalLength : Nat;
    };

    public type AssetKey = {
        id : ID;
        name : Text;
        fileSize : Nat;
        parentId : ?ID;
        encrypted : Bool;
        // A sha256 representation of the raw content calculated on the frontend side.
        // used for duplicate detection and certification
        sha256 : ?Blob;
    } and Thumbnail;

    public type Asset = {
        id : ID;
        key : AssetKey;
        headers : [HTTPTypes.HeaderField];
        encoding : AssetEncoding;
    };

    public type Batch = {
        key : AssetKey;
        chunkIds : [Nat32];
        expiresAt : Int;
    };

    public type CommitBatch = {
        batchId : Nat;
        headers : [HTTPTypes.HeaderField];
        chunkIds : [Nat32];
    };

    public type CommitUploadError = {
        #batchNotFound;
        #batchExpired;
        #chunkWrongBatch : Nat32;
        #chunkNotFound : Nat32;
        #empty;
        #addFile : JournalTypes.FileCreateError;
    };

    public type InitUpload = {
        batchId : Nat;
    };

    public type UploadChunk = {
        chunkId : Nat32;
    };
};
