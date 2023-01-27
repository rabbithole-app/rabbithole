// This is a generated Motoko binding.
// Please use `import service "ic:canister_id"` instead to call canisters on the IC if possible.

module {
    public type AddressEntry = {
        id : Principal;
        kind : Kind;
        name : ?Text;
        role : Role;
    };
    public type CanisterSettings = {
        controller : ?Principal;
        freezing_threshold : ?Nat;
        controllers : ?[Principal];
        memory_allocation : ?Nat;
        compute_allocation : ?Nat;
    };
    public type CreateCanisterArgs = {
        cycles : Nat64;
        settings : CanisterSettings;
    };
    public type CreateCanisterArgs128 = {
        cycles : Nat;
        settings : CanisterSettings;
    };
    public type Event = { id : Nat32; kind : EventKind; timestamp : Nat64 };
    public type Event128 = { id : Nat32; kind : EventKind128; timestamp : Nat64 };
    public type EventKind = {
        #CyclesReceived : { from : Principal; memo : ?Text; amount : Nat64 };
        #CanisterCreated : { cycles : Nat64; canister : Principal };
        #CanisterCalled : {
            cycles : Nat64;
            method_name : Text;
            canister : Principal;
        };
        #CyclesSent : { to : Principal; amount : Nat64; refund : Nat64 };
        #AddressRemoved : { id : Principal };
        #WalletDeployed : { canister : Principal };
        #AddressAdded : { id : Principal; name : ?Text; role : Role };
    };
    public type EventKind128 = {
        #CyclesReceived : { from : Principal; memo : ?Text; amount : Nat };
        #CanisterCreated : { cycles : Nat; canister : Principal };
        #CanisterCalled : {
            cycles : Nat;
            method_name : Text;
            canister : Principal;
        };
        #CyclesSent : { to : Principal; amount : Nat; refund : Nat };
        #AddressRemoved : { id : Principal };
        #WalletDeployed : { canister : Principal };
        #AddressAdded : { id : Principal; name : ?Text; role : Role };
    };
    public type HeaderField = (Text, Text);
    public type HttpRequest = {
        url : Text;
        method : Text;
        body : [Nat8];
        headers : [HeaderField];
    };
    public type HttpResponse = {
        body : [Nat8];
        headers : [HeaderField];
        streaming_strategy : ?StreamingStrategy;
        status_code : Nat16;
    };
    public type Kind = { #User; #Canister; #Unknown };
    public type ManagedCanisterEvent = {
        id : Nat32;
        kind : ManagedCanisterEventKind;
        timestamp : Nat64;
    };
    public type ManagedCanisterEvent128 = {
        id : Nat32;
        kind : ManagedCanisterEventKind128;
        timestamp : Nat64;
    };
    public type ManagedCanisterEventKind = {
        #CyclesSent : { amount : Nat64; refund : Nat64 };
        #Created : { cycles : Nat64 };
        #Called : { cycles : Nat64; method_name : Text };
    };
    public type ManagedCanisterEventKind128 = {
        #CyclesSent : { amount : Nat; refund : Nat };
        #Created : { cycles : Nat };
        #Called : { cycles : Nat; method_name : Text };
    };
    public type ManagedCanisterInfo = {
        id : Principal;
        name : ?Text;
        created_at : Nat64;
    };
    public type ReceiveOptions = { memo : ?Text };
    public type Role = { #Custodian; #Contact; #Controller };
    public type StreamingCallbackHttpResponse = { token : ?Token; body : [Nat8] };
    public type StreamingStrategy = {
        #Callback : {
            token : Token;
            callback : shared query Token -> async StreamingCallbackHttpResponse;
        };
    };
    public type Token = {};
    public type WalletResult = { #Ok; #Err : Text };
    public type WalletResultCall = { #Ok : { return_ : [Nat8] }; #Err : Text };
    public type WalletResultCreate = {
        #Ok : { canister_id : Principal };
        #Err : Text;
    };
    public type Self = actor {
        add_address : shared AddressEntry -> async ();
        add_controller : shared Principal -> async ();
        authorize : shared Principal -> async ();
        deauthorize : shared Principal -> async WalletResult;
        get_chart : shared query ?{ count : ?Nat32; precision : ?Nat64 } -> async [(Nat64, Nat64)];
        get_controllers : shared query () -> async [Principal];
        get_custodians : shared query () -> async [Principal];
        get_events : shared query ?{ to : ?Nat32; from : ?Nat32 } -> async [Event];
        get_events128 : shared query ?{ to : ?Nat32; from : ?Nat32 } -> async [
            Event128
        ];
        get_managed_canister_events : shared query {
            to : ?Nat32;
            from : ?Nat32;
            canister : Principal;
        } -> async ?[ManagedCanisterEvent];
        get_managed_canister_events128 : shared query {
            to : ?Nat32;
            from : ?Nat32;
            canister : Principal;
        } -> async ?[ManagedCanisterEvent128];
        http_request : shared query HttpRequest -> async HttpResponse;
        list_addresses : shared query () -> async [AddressEntry];
        list_managed_canisters : shared query {
            to : ?Nat32;
            from : ?Nat32;
        } -> async ([ManagedCanisterInfo], Nat32);
        name : shared query () -> async ?Text;
        remove_address : shared Principal -> async WalletResult;
        remove_controller : shared Principal -> async WalletResult;
        set_name : shared Text -> async ();
        set_short_name : shared (Principal, ?Text) -> async ?ManagedCanisterInfo;
        wallet_api_version : shared query () -> async Text;
        wallet_balance : shared query () -> async { amount : Nat64 };
        wallet_balance128 : shared query () -> async { amount : Nat };
        wallet_call : shared {
            args : [Nat8];
            cycles : Nat64;
            method_name : Text;
            canister : Principal;
        } -> async WalletResultCall;
        wallet_call128 : shared {
            args : [Nat8];
            cycles : Nat;
            method_name : Text;
            canister : Principal;
        } -> async WalletResultCall;
        wallet_create_canister : shared CreateCanisterArgs -> async WalletResultCreate;
        wallet_create_canister128 : shared CreateCanisterArgs128 -> async WalletResultCreate;
        wallet_create_wallet : shared CreateCanisterArgs -> async WalletResultCreate;
        wallet_create_wallet128 : shared CreateCanisterArgs128 -> async WalletResultCreate;
        wallet_receive : shared ?ReceiveOptions -> async ();
        wallet_send : shared {
            canister : Principal;
            amount : Nat64;
        } -> async WalletResult;
        wallet_send128 : shared {
            canister : Principal;
            amount : Nat;
        } -> async WalletResult;
        wallet_store_wallet_wasm : shared { wasm_module : [Nat8] } -> async ();
    };
};
