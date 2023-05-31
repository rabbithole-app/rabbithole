import Result "mo:base/Result";
import Time "mo:base/Time";
import Types = "../types/types";
import IC = "../types/ic";

module {
    type BucketId = Types.BucketId;
    type ID = Types.ID;

    // public type Type = "folder" or "file";

    private type CommonAttributes = {
        id : ID;
        name : Text;
        // path : Text;
        createdAt : Time.Time;
        updatedAt : Time.Time;
        parentId : ?ID;
    };

    public type DirectoryAction = {
        #rename : ID;
        /*#create;  #delete; #move;*/
        #changeColor : ID;
    };
    public type DirectoryColor = { #blue; #yellow; #orange; #purple; #pink; #gray; #green };
    public type Directory = CommonAttributes and {
        // itemType : "folder";
        color : ?DirectoryColor;
        children : ?[JournalEntry];
        // добавляется для хлебных крошек
        path : ?Text;
    };
    public type File = CommonAttributes and {
        // fullPath : Text;
        // item : "file";
        fileSize : Nat;
        bucketId : BucketId;
    };
    public type JournalEntry = Directory or File;

    // public type DirectoryAction = { #rename : ID; /*#create;  #delete; #move;*/ #changeColor : ID; };

    public type DirectoryCreate = {
        // id : ID;
        name : Text;
        parentId : ?ID;
    };
    public type DirectoryUpdatableFields = {
        name : ?Text;
        color : ?DirectoryColor;
        parentId : ?ID;
    };
    // public type Directory = DirectoryCreate and {
    //     color : DirectoryColor;
    //     children : [Directory];
    //     createdAt : Timestamp;
    //     updatedAt : Timestamp;
    // };

    public type DirectoryError = {
        #notFound;
        #alreadyExists : Directory;
        #illegalCharacters;
        #notAuthorized;
    };
    // public type DirectoryUpdateError = {
    //     #notFound;
    //     #wrongAction;
    //     #alreadyExists : Directory;
    //     #notAuthorized;
    // };
    public type DirectoryMoveError = { #invalidParams; #notFound; #sourceNotFound; #targetNotFound };
    public type FileMoveError = { #invalidParams; #notFound; #sourceNotFound; #targetNotFound };
    type EntryCreateError<T> = { #illegalCharacters; #alreadyExists : T };
    public type DirectoryCreateError = EntryCreateError<Directory>;
    public type FileCreateError = EntryCreateError<File>;

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

    public type Self = actor {
        addFile : shared (file : FileCreate) -> async Result.Result<File, FileCreateError>;
        // topupCanister : shared (value : Topup) -> async ();
    };

    public type Journal = {
        id : ?ID;
        dirs : [Directory];
        files : [File];
        breadcrumbs : [Directory]
    };
    public type JournalError = { #notFound };

    public type CreatePath = {
        path : Text;
        parentId : ?ID;
        base : ?Text;
    };
};
