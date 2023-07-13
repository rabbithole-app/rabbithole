import Time "mo:base/Time";
import Buffer "mo:base/Buffer";
import Result "mo:base/Result";
import Types "../types/types";
import IC = "../types/ic";
import HTTPTypes "../types/http";

module {
    type BucketId = Types.BucketId;
    type ID = Types.ID;

    public type CommonAttributes = {
        id : ID;
        name : Text;
        createdAt : Time.Time;
        updatedAt : Time.Time;
        parentId : ?ID;
        path : Text;
        encrypted : Bool;
    };
    public type DirectoryColor = { #blue; #yellow; #orange; #purple; #pink; #gray; #green };
    public type Directory = CommonAttributes and {
        color : ?DirectoryColor;
        children : ?([Directory], [File]);
        // размер данных в папке
        size : ?Nat;
    };
    public type DirectoryError = {
        #notFound;
        #alreadyExists : Directory;
        #illegalCharacters;
        #notAuthorized;
    };
    public type Thumbnail = {
        thumbnail : ?ID;
    };
    public type File = CommonAttributes and Thumbnail and {
        fileSize : Nat;
        bucketId : BucketId;
    };
    public type Entry = Directory or File;
    public type EntryCreate = {
        name : Text;
        parentId : ?ID;
    };
    public type EntryCreateError<T> = { #illegalCharacters; #alreadyExists : T; #parentNotFound };
    public type DirectoryCreateError = EntryCreateError<Directory>;
    public type FileCreateError = EntryCreateError<File>;
    public type DirectoryMoveError = { #invalidParams; #notFound; #sourceNotFound; #targetNotFound };
    public type FileMoveError = { #invalidParams; #notFound; #sourceNotFound; #targetNotFound };
    public type NotFoundError = { #notFound };
    public type AlreadyExistsError<T> = { #alreadyExists : T };
    public type DirectoryState = {
        id : ?ID;
        dirs : [Directory];
        files : [File];
        breadcrumbs : [Directory];
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
        fileSize : Nat;
        bucketId : BucketId;
        encrypted : Bool;
    } and Thumbnail;
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
};
