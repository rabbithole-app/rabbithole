import Time "mo:base/Time";
import IC "ic";
import LedgerTypes "ledger";
import CMCTypes "cmc";

module {
    public type ID = Text;

    public type ProfileUpdate = {
        displayName : Text;
    };

    public type ProfileUpdateV2 = {
        avatarUrl : ?Text;
        displayName : Text;
    };

    public type ProfileCreate = ProfileUpdate and {
        username : Text;
    };
    public type ProfileCreateV2 = ProfileUpdateV2 and {
        username : Text;
    };

    type ProfileCommon = {
        id : Principal;
        createdAt : Time.Time;
        updatedAt : Time.Time;
        inviter : ?Principal;
        username : Text;
    };

    public type ProfileInfo = ProfileUpdate and ProfileCommon;
    public type ProfileInfoV2 = ProfileUpdateV2 and ProfileCommon;

    public type ProfileCreateError = {
        #journalNotFound;
        #username : UsernameError;
        #alreadyExists;
    };

    public type ProfileError = { #notFound; #notAuthorized };
    
    public type Profile = ProfileCreateV2 and {
        principal : Principal;
    };

    public type UsernameError = {
        #minLength;
        #maxLength;
        #illegalCharacters;
        #alreadyExists;
    };

    public type BucketId = IC.canister_id;

    public type Bucket = {
        bucketId : BucketId;
        // used stable memory
        usedMemory : Nat;
        reservedMemory : Nat;
    };

    public type Role = {
        #admin;
        #editor;
        #viewer;
    };

    // public type Privilege = {
    //     #invite;
    // };
    // public type Role = Text;

    public type InviteCreate = {
        owner : Principal;
        expiredAt : Time.Time;
        cycles : Nat;
    };

    public type InviteDeleteError = {
        #notFound;
        #alreadyUsed : Principal;
        #expired;
        #notPermission;
    };

    public type Invite = InviteCreate and {
        id : ID;
        canisterId : Principal;
        status : { #active; #used : Principal; #expired };
        // timerId : ?Nat;
        createdAt : Time.Time;
        // roles : [Role];
        // canAssign : [Role];
    };

    public type RegistrationMode = {
        // #free;
        #invite;
        #prepaid;
    };

    public type TransferNotifyError = {
        #transfer : LedgerTypes.TransferError;
        #notify : CMCTypes.NotifyError;
    };

    public type InviteError = { #notFound; #expired; #alreadyUsed };
    public type InvoiceStage = {
        #active; // создан инвойс, канистра его мониторит
        // #expired; // время инвойса вышло, пользователь не пополнил аккаунт
        #paid; // пользователь пополнил аккаунт
        #createCanister : LedgerTypes.Tokens; // создание пустой канистры
        #notifyCanister : CMCTypes.NotifyCreateCanisterArg; // нотификация CMC
        #setControllers : Principal;
        #installJournal : Principal; // установка журнала
        #transferUnusedFunds : Principal; // перевод остатка ICP в defaultSubaccount канистры-журнала
        #complete : Principal; // журнал создан
    };

    public type Invoice = {
        id : ID;
        owner : Principal;
        amount : LedgerTypes.Tokens;
        createdAt : Time.Time;
        expiredAt : Time.Time;
        stage : InvoiceStage;
        timerId : ?Nat;
    };

    public type UserShare = {
        profile : Profile;
        bucketId : Principal;
    };
};
