import Time "mo:base/Time";
import Buffer "mo:base/Buffer";
import Types "../types/types";
import IC = "../types/ic";
import Result "mo:base/Result";

module {
    type BucketId = Types.BucketId;
    type ID = Types.ID;
    
    public type CommonAttributes = {
        id : ID;
        name : Text;
        createdAt : Time.Time;
        updatedAt : Time.Time;
        parentId : ?ID;
    };
    public type DirectoryColor = { #blue; #yellow; #orange; #purple; #pink; #gray; #green };
    public type Directory = CommonAttributes and {
        color : ?DirectoryColor;
        children : ?([Directory], [File]);
        // добавляется для хлебных крошек
        path : ?Text;
    };
    public type DirectoryError = {
        #notFound;
        #alreadyExists : Directory;
        #illegalCharacters;
        #notAuthorized;
    };
    public type File = CommonAttributes and {
        fileSize : Nat;
        bucketId : BucketId;
    };
    public type Entry = Directory or File;
    public type DirectoryCreate = {
        name : Text;
        parentId : ?ID;
    };
    type EntryCreateError<T> = { #illegalCharacters; #alreadyExists : T; #parentNotFound };
    public type DirectoryCreateError = EntryCreateError<Directory>;
    public type FileCreateError = EntryCreateError<File>;
    public type DirectoryMoveError = { #invalidParams; #notFound; #sourceNotFound; #targetNotFound };
    public type FileMoveError = { #invalidParams; #notFound; #sourceNotFound; #targetNotFound };
    public type DirectoryState = {
        id : ?ID;
        dirs : [Directory];
        files : [File];
        breadcrumbs : [Directory]
    };
    public type DirectoryStateError = { #notFound };
    public type DirectoryAction = {
        #rename : ID;
        /*#create;  #delete; #move;*/
        #changeColor : ID;
    };
    public type DirectoryUpdatableFields = {
        name : ?Text;
        color : ?DirectoryColor;
        parentId : ?ID;
    };
    public type FileCreate = {
        id : ID;
        name : Text;
        parentId : ?ID;
        // token : ?Text;
        fileSize : Nat;
        bucketId : BucketId;
    };
    public type Canister = {
        canisterId : BucketId;
        owner : Principal;
        // firstChecked : Time.Time;
        lastChecked : Time.Time;
        // lastDonated : Time.Time;
        status : ?IC.canister_status_response;
        // freezingThresholdInCycles : Nat;
        error : ?Text;
        monitoring : { #running; #stopped };
        timerId : ?Nat;
    };
    public type Topup = {
        canisterId : BucketId;
        amount : Nat;
    };
    public type CreatePath = {
        path : Text;
        parentId : ?ID;
        base : ?Text;
        ids : Buffer.Buffer<ID>;
    };

    public type Self = actor {
        addFile : shared (file : FileCreate) -> async Result.Result<File, FileCreateError>;
        // topupCanister : shared (value : Topup) -> async ();
    };
}