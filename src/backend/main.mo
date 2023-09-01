import Buffer "mo:base/Buffer";
import Cycles "mo:base/ExperimentalCycles";
import Deque "mo:base/Deque";
import Error "mo:base/Error";
import Iter "mo:base/Iter";
import Prim "mo:prim";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Trie "mo:base/Trie";
import TrieMap "mo:base/TrieMap";

import IC "types/ic";
import Types "types/types";
import JournalBucket "journal/main";
import JournalTypes "journal/types";
import Utils "utils/utils";
import Roles "utils/Roles";
import LedgerTypes "types/ledger";
import CMCTypes "types/cmc";
import { LEDGER_CANISTER_ID; CYCLE_MINTING_CANISTER_ID } = "env";
import List "mo:base/List";
import Option "mo:base/Option";
import Debug "mo:base/Debug";
import Nat64 "mo:base/Nat64";
import A "./utils/Account";
import Timer "mo:base/Timer";
import Int64 "mo:base/Int64";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Prelude "mo:base/Prelude";
import Order "mo:base/Order";
import Nat "mo:base/Nat";
import TrieSet "mo:base/TrieSet";
import Vector "mo:vector";
import Map "mo:hashmap_v8/Map";

actor Rabbithole {
    type ID = Types.ID;
    type ProfileInfo = Types.ProfileInfo;
    type ProfileInfoV2 = Types.ProfileInfoV2;
    type ProfileCreate = Types.ProfileCreate;
    type ProfileCreateV2 = Types.ProfileCreateV2;
    type ProfileUpdate = Types.ProfileUpdate;
    type ProfileUpdateV2 = Types.ProfileUpdateV2;
    type ProfileCreateError = Types.ProfileCreateError;
    type Profile = Types.Profile;
    type UserShare = Types.UserShare;
    type UsernameError = Types.UsernameError;
    type Invite = Types.Invite;
    type InviteCreate = Types.InviteCreate;
    type InviteError = Types.InviteError;
    type InviteDeleteError = Types.InviteDeleteError;
    type RegistrationMode = Types.RegistrationMode;
    type Bucket = Types.Bucket;
    type BucketId = Types.BucketId;
    type Invoice = Types.Invoice;
    type TransferNotifyError = Types.TransferNotifyError;
    // type CreateJournalStage = Types.CreateJournalStage;
    type InvoiceStage = Types.InvoiceStage;
    // type Deposit = Types.Deposit;
    type PublicKey = Text;
    type EncryptedKey = Text;
    type Role = Roles.Role;
    type StableUsers = Roles.StableUsers;
    type Topup = JournalTypes.Topup;
    type TimerId = Timer.TimerId;

    let CYCLE_SHARE = 1_000_000_000_000;

    let Ledger : LedgerTypes.Self = actor (LEDGER_CANISTER_ID);
    let CMC : CMCTypes.Self = actor (CYCLE_MINTING_CANISTER_ID);
    let MEMO_CREATE_CANISTER : LedgerTypes.Memo = 0x41455243; // == 'CREA'
    let FEE : Nat64 = 10_000;
    // let self = Principal.fromText("q4eej-kyaaa-aaaaa-aaaha-cai");
    // var users = Roles.Users([(self, [Roles.ALL])]);

    stable var journals : Trie.Trie<Principal, BucketId> = Trie.empty();
    let ic : IC.Self = actor "aaaaa-aa";
    stable var storages : Trie.Trie<Principal, BucketId> = Trie.empty();

    //SECTION - User profiles
    /* -------------------------------------------------------------------------- */
    /*                                USER PROFILES                               */
    /* -------------------------------------------------------------------------- */

    var profiles = TrieMap.TrieMap<Principal, ProfileInfo>(Principal.equal, Principal.hash);
    let { phash; thash } = Map;
    stable var profilesV2 : Map.Map<Principal, ProfileInfoV2> = Map.new(phash);
    let usernameAllowedSymbols : Text = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_";

    public shared ({ caller }) func createProfile({ displayName; username; avatarUrl } : ProfileCreateV2) : async Result.Result<(), ProfileCreateError> {
        assert not Principal.isAnonymous(caller);

        let hasJournal = Option.isSome(Trie.find<Principal, BucketId>(journals, Utils.keyPrincipal(caller), Principal.equal));
        if (not hasJournal) {
            return #err(#journalNotFound);
        };

        let inviter = label exit : ?Principal {
            for (invite in invites.vals()) {
                switch (invite) {
                    case ({ status = #used(user) }) {
                        if (Principal.equal(caller, user)) break exit(?invite.owner);
                    };
                    case _ {};
                };
            };
            null;
        };

        switch (checkUsername_(username)) {
            case (#err e) return #err(#username e);
            case (#ok) {
                if (Map.has(profilesV2, phash, caller)) {
                    return #err(#alreadyExists);
                };
                let now : Time.Time = Time.now();
                let userProfile : ProfileInfoV2 = { username; displayName; id = caller; createdAt = now; updatedAt = now; inviter; avatarUrl };
                Map.set(profilesV2, phash, caller, userProfile);
                #ok();
            };
        };
    };

    public shared ({ caller }) func putProfile({ avatarUrl; displayName } : ProfileUpdateV2) : async Result.Result<(), { #notFound }> {
        assert not Principal.isAnonymous(caller);
        let ?profile = Map.get(profilesV2, phash, caller) else return #err(#notFound);
        let userProfile : ProfileInfoV2 = { profile with avatarUrl; displayName; updatedAt = Time.now() };
        Map.set(profilesV2, phash, caller, userProfile);
        #ok();
    };

    //TODO - delete profile with journal and storages
    public shared ({ caller }) func deleteProfile() : async Result.Result<(), { #notFound }> {
        assert not Principal.isAnonymous(caller);
        if (not Map.has(profilesV2, phash, caller)) {
            return #err(#notFound);
        };

        Map.delete(profilesV2, phash, caller);
        let (newJournals, bucketId) = Trie.remove<Principal, BucketId>(journals, Utils.keyPrincipal(caller), Principal.equal);
        journals := newJournals;
        // await canisterUtils.deleteCanister(bucketId);
        #ok();
    };

    public query func listProfiles() : async [Profile] {
        Map.mapFilter<Principal, ProfileInfoV2, Profile>(
            profilesV2,
            phash,
            func (principal, { username; displayName; avatarUrl }) = ?{ username; displayName; principal; avatarUrl }
        ) |> Map.vals _ |> Iter.toArray _;
    };

    public query ({ caller }) func getProfile() : async ?ProfileInfoV2 {
        assert not Principal.isAnonymous(caller);
        Map.get(profilesV2, phash, caller);
    };

    public query func checkUsername(username : Text) : async Result.Result<(), UsernameError> {
        checkUsername_(username);
    };

    func checkUsername_(username : Text) : Result.Result<(), UsernameError> {
        let length = Text.size(username);
        let isIllegalUsername = do {
            var illegal : Bool = false;
            label letters for (c in username.chars()) {
                if (not Text.contains(usernameAllowedSymbols, #char c)) {
                    illegal := true;
                    break letters;
                };
            };
            illegal;
        };

        if (length < 2) return #err(#minLength) else if (length > 20) return #err(#maxLength) else if (isIllegalUsername) return #err(#illegalCharacters);
        #ok();
    };

    public query func checkUsernameAvailability(username : Text) : async Bool {
        var available = true;
        label usernames for (p in Map.vals(profilesV2)) {
            if (Text.equal(p.username, username)) {
                available := false;
                break usernames;
            };
        };
        available;
    };

    //SECTION - Journal managment
    /* -------------------------------------------------------------------------- */
    /*                             JOURNAL MANAGMENT                             */
    /* -------------------------------------------------------------------------- */

    public shared ({ caller }) func getJournalBucket() : async ?BucketId {
        assert not Principal.isAnonymous(caller);
        Trie.get<Principal, BucketId>(journals, Utils.keyPrincipal(caller), Principal.equal);
        // switch (Trie.get<Principal, BucketId>(journals, Utils.keyPrincipal(caller), Principal.equal)) {
        //     case null {
        //         Cycles.add(CYCLE_SHARE);
        //         await createJournalBucket(caller);
        //     };
        //     case (?bucketId) bucketId;
        // };
    };

    func createJournalBucket(caller : Principal, cyclesShare : Nat) : async BucketId {
        let self : Principal = Principal.fromActor(Rabbithole);
        let settings = {
            controllers = ?[self];
            freezing_threshold = null;
            memory_allocation = null;
            compute_allocation = null;
        };
        Cycles.add(cyclesShare);
        let { canister_id } = await ic.create_canister({ settings = ?settings });
        ignore await (system JournalBucket.JournalBucket)(#install canister_id)(caller);
        journals := Trie.put<Principal, BucketId>(journals, Utils.keyPrincipal(caller), Principal.equal, canister_id).0;
        canister_id;
    };

    public shared ({ caller }) func upgradeJournalBuckets() : async () {
        if (not Utils.isAdmin(caller)) {
            throw Error.reject("Unauthorized access. Caller is not an admin. " # Principal.toText(caller));
        };

        let journalBuckets = Trie.iter<Principal, BucketId>(journals);
        for ((owner : Principal, bucketId : BucketId) in journalBuckets) {
            let bucket : JournalBucket.JournalBucket = actor (Principal.toText(bucketId));
            ignore await (system JournalBucket.JournalBucket)(#upgrade bucket)(owner);
        };
    };

    public shared ({ caller }) func installCode(arg : { canister_id : Principal; arg : Blob; wasm_module : Blob; mode : { #reinstall; #upgrade; #install } }) : async () {
        if (not Utils.isAdmin(caller)) {
            throw Error.reject("Unauthorized access. Caller is not an admin.");
        };

        await ic.install_code(arg);
    };

    public shared ({ caller }) func listBuckets(bucketType : Text) : async [(Principal, BucketId)] {
        if (not Utils.isAdmin(caller)) {
            throw Error.reject("Unauthorized access. Caller is not an admin. " # Principal.toText(caller));
        };

        switch (bucketType) {
            case "journal" {
                Iter.toArray<(Principal, BucketId)>(Trie.iter<Principal, BucketId>(journals));
            };
            case "storage" {
                let buffer = Buffer.Buffer<(Principal, BucketId)>(0);
                for ((owner, bucketId) in Trie.iter<Principal, BucketId>(journals)) {
                    let journalBucket : actor { listStorages : query () -> async [BucketId] } = actor (Principal.toText(bucketId));
                    let storageList = await journalBucket.listStorages();
                    let sBuffer = Buffer.fromArray<BucketId>(storageList);
                    for (bId in sBuffer.vals()) {
                        buffer.add((owner, bId));
                    };
                };
                Buffer.toArray(buffer);
            };
            case (_) throw Error.reject("Incorrect bucket type");
        };
    };

    //SECTION - Invoices
    /* -------------------------------------------------------------------------- */
    /*                                  INVOICES                                  */
    /* -------------------------------------------------------------------------- */

    let INVOICE_CHECK_INTERVAL_SECONDS = 10;
    let INVOICE_EXPIRY_NANOS = 1200 * 1_000_000_000; // 20 minutes
    let MAX_COUNT_OF_INVOICES = 1000;
    var invoicesTimerId : ?TimerId = null;
    var invoicesTimersInited : Bool = false;
    var invoices : TrieMap.TrieMap<Principal, Invoice> = TrieMap.TrieMap(Principal.equal, Principal.hash);
    var lockedInvoices : TrieSet.Set<ID> = TrieSet.empty<ID>();
    // stable var invoceDeque : Deque.Deque<Invoice> = Deque.empty<Invoice>();
    // var invoiceChecking : ?ID = null;
    // stable var invoiceQueue : List.List<Invoice> = List.nil<Invoice>();
    // stable var invoiceQueue : List.List<Invoice> = List.nil<Invoice>();
    stable var invoiceDeque : Deque.Deque<Invoice> = Deque.empty<Invoice>();
    // stable var depositDeque : Deque.Deque<Deposit> = Deque.empty<Deposit>();
    // var depositing : ?Deposit = null;
    // stable var depositQueue : List.List<Deposit> = List.nil<Deposit>();

    public shared ({ caller }) func createInvoice() : async Invoice {
        assert not Principal.isAnonymous(caller);
        if (Nat.greaterOrEqual(invoices.size(), MAX_COUNT_OF_INVOICES)) {
            return throw Error.reject("Active invoice limit reached");
        };
        switch (invoices.get(caller)) {
            case (?v) v;
            case null {
                let account : A.AccountIdentifier = accountIdentifier_(caller);
                let balance = await Ledger.account_balance({ account });
                let amount : LedgerTypes.Tokens = await cyclesToICPE8s(CYCLE_SHARE);
                let stage : InvoiceStage = if (Nat64.greaterOrEqual(balance.e8s, amount.e8s)) #paid else #active;
                let id : ID = await Utils.generateId();
                let now : Time.Time = Time.now();
                let timerId : Nat = Timer.recurringTimer(
                    #seconds INVOICE_CHECK_INTERVAL_SECONDS,
                    func job() : async () { await checkInvoice(caller) }
                );
                let newInvoice : Invoice = {
                    id;
                    owner = caller;
                    amount;
                    stage;
                    createdAt = now;
                    expiredAt = now + INVOICE_EXPIRY_NANOS;
                    timerId = ?timerId;
                    errorMessage = null;
                };
                invoices.put(caller, newInvoice);
                newInvoice;
            };
        };
    };

    public query ({ caller }) func getInvoice() : async ?Invoice {
        assert not Principal.isAnonymous(caller);
        invoices.get(caller);
    };

    public shared ({ caller }) func deleteInvoice() : async () {
        assert not Principal.isAnonymous(caller);
        invoices.delete(caller);

        // let account : A.AccountIdentifier = accountIdentifier_(caller);
        // let balance = await Ledger.account_balance({ account });
        // if (Nat64.greater(balance.e8s, FEE)) {
        //     let self = Principal.fromActor(Rabbithole);
        //     let subaccount : A.Subaccount = A.principalToSubaccount(caller);
        //     let account : A.AccountIdentifier = do {
        //         let defaultSubaccount : A.Subaccount = A.defaultSubaccount();
        //         A.accountIdentifier(self, defaultSubaccount);
        //     };
        //     let result = await Ledger.transfer({
        //         to = account;
        //         fee = { e8s = FEE };
        //         memo = 0;
        //         from_subaccount = ?subaccount;
        //         amount = { e8s = Nat64.sub(balance.e8s, FEE) };
        //         created_at_time = ?{ timestamp_nanos = Nat64.fromNat(Int.abs(Time.now())) };
        //     });
        //     let #Ok(height) = result else throw Error.reject("Transfer error");
        // };
    };

    func startMonitorInvoices() : () {
        if (invoicesTimersInited) return;
        invoices := TrieMap.mapFilter<Principal, Invoice, Invoice>(
            invoices,
            Principal.equal,
            Principal.hash,
            func(owner, invoice) {
                let timerId : Nat = Timer.recurringTimer(
                    #seconds INVOICE_CHECK_INTERVAL_SECONDS,
                    func job() : async () { await checkInvoice(owner) }
                );
                let now = Time.now();
                if (invoice.stage == #active and now < invoice.expiredAt) ?{ invoice with timerId = ?timerId } else null;
            }
        );
        invoicesTimersInited := true;
    };

    func stopMonitorInvoices() : () {
        invoices := TrieMap.map<Principal, Invoice, Invoice>(
            invoices,
            Principal.equal,
            Principal.hash,
            func(owner, invoice) {
                switch (invoice.timerId) {
                    case null {};
                    case (?timerId) Timer.cancelTimer(timerId);
                };
                { invoice with timerId = null };
            }
        );
    };

    func checkInvoice(owner : Principal) : async () {
        Debug.print("[main] beforeCheckInvoice " # debug_show ({ owner }));
        switch (invoices.get(owner)) {
            case null {};
            case (?invoice) {
                let now : Time.Time = Time.now();
                switch (invoice.stage, invoice.timerId) {
                    case (#paid, ?timerId) {
                        Timer.cancelTimer(timerId);
                        let updated : Invoice = { invoice with timerId = null };
                        invoices.put(owner, updated);
                        // ignore await createJournal_(updated);
                    };
                    case (#active, ?timerId) {
                        let account : A.AccountIdentifier = accountIdentifier_(owner);
                        let balance = await Ledger.account_balance({ account });
                        if (Nat64.greaterOrEqual(balance.e8s, invoice.amount.e8s)) {
                            invoices.put(owner, { invoice with stage = #paid });
                        } else if (now > invoice.expiredAt) {
                            Timer.cancelTimer(timerId);
                            invoices.delete(invoice.owner);
                        };
                    };
                    case (_, _) {};
                };
            };
        };
    };

    public shared ({ caller }) func createJournal(invoiceId : ID) : async Result.Result<(), TransferNotifyError or { #notFound; #wrongStage }> {
        assert not Principal.isAnonymous(caller);
        switch (invoices.get(caller)) {
            case null #err(#notFound);
            case (?invoice) await createJournal_(invoice);
        };
    };

    //NOTE - создание предоплаченного журнала
    func createJournal_(invoice : Invoice) : async Result.Result<(), TransferNotifyError or { #wrongStage }> {
        switch (invoice.stage) {
            case (#paid) {
                // также проверяем наличие журнала у пользователя
                let updated : Invoice = switch (Trie.get<Principal, BucketId>(journals, Utils.keyPrincipal(invoice.owner), Principal.equal)) {
                    case null { { invoice with stage = #createCanister(invoice.amount) } };
                    // если журнал уже есть, то переходим к шагу возвращения неиспользованных средств в журнал пользователя
                    case (?bucketId) { { invoice with stage = #transferUnusedFunds(bucketId) } };
                };
                invoices.put(invoice.owner, updated);
                await createJournal_(updated);
            };
            case (#createCanister(amount)) {
                let self = Principal.fromActor(Rabbithole);
                let fromSubaccount : A.Subaccount = A.principalToSubaccount(invoice.owner);
                let account : A.AccountIdentifier = do {
                    let selfSubaccount : A.Subaccount = A.canisterToSubaccount(self);
                    let cmc = Principal.fromText(CYCLE_MINTING_CANISTER_ID);
                    A.accountIdentifier(cmc, selfSubaccount);
                };
                let result = await Ledger.transfer({
                    to = account;
                    fee = { e8s = FEE };
                    memo = MEMO_CREATE_CANISTER;
                    from_subaccount = ?fromSubaccount;
                    amount;
                    created_at_time = ?{ timestamp_nanos = Nat64.fromNat(Int.abs(Time.now())) };
                });
                switch (result) {
                    case (#Ok height) {
                        let updated : Invoice = { invoice with stage = #notifyCanister({ block_index = height; controller = self; subnet_type = null }) };
                        invoices.put(invoice.owner, updated);
                        await createJournal_(updated);
                    };
                    case (#Err err) #err(#transfer err);
                };
            };
            case (#notifyCanister(args)) {
                let notifyResult = await CMC.notify_create_canister(args);
                switch (notifyResult) {
                    case (#Ok canisterId) {
                        let updated : Invoice = { invoice with stage = #installJournal(canisterId) };
                        ignore invoices.replace(invoice.owner, updated);
                        await createJournal_(updated);
                    };
                    case (#Err err) #err(#notify err);
                };
            };
            case (#installJournal(canisterId)) {
                ignore await (system JournalBucket.JournalBucket)(#install canisterId)(invoice.owner);
                journals := Trie.put<Principal, BucketId>(journals, Utils.keyPrincipal(invoice.owner), Principal.equal, canisterId).0;
                let updated : Invoice = { invoice with stage = #transferUnusedFunds(canisterId) };
                ignore invoices.replace(invoice.owner, updated);
                await createJournal_(updated);
            };
            case (#transferUnusedFunds(canisterId)) {
                let account : A.AccountIdentifier = accountIdentifier_(invoice.owner);
                let balance = await Ledger.account_balance({ account });
                if (Nat64.greater(balance.e8s, FEE)) {
                    let subaccount : A.Subaccount = A.principalToSubaccount(invoice.owner);
                    let account : A.AccountIdentifier = A.accountIdentifier(canisterId, subaccount);
                    let result = await Ledger.transfer({
                        to = account;
                        fee = { e8s = FEE };
                        memo = 0;
                        from_subaccount = ?subaccount;
                        amount = { e8s = Nat64.sub(balance.e8s, FEE) };
                        created_at_time = ?{ timestamp_nanos = Nat64.fromNat(Int.abs(Time.now())) };
                    });
                    switch (result) {
                        case (#Ok height) {};
                        case (#Err err) return #err(#transfer err);
                    };
                };
                let updated : Invoice = { invoice with stage = #complete(canisterId) };
                ignore invoices.replace(invoice.owner, updated);
                #ok();
            };
            case _ #err(#wrongStage);
        };
    };

    // создание журнала канистры с помощью Cycles Minting Canister путем сжигания ICP на внутреннем балансе пользователя
    func depositCycles(caller : Principal, amount : LedgerTypes.Tokens) : async Result.Result<{ canisterId : Principal }, { #transfer : LedgerTypes.TransferError; #notify : CMCTypes.NotifyError }> {
        let self = Principal.fromActor(Rabbithole);
        let fromSubaccount : A.Subaccount = A.principalToSubaccount(caller);
        let account : A.AccountIdentifier = do {
            let selfSubaccount : A.Subaccount = A.canisterToSubaccount(self);
            let cmc = Principal.fromText(CYCLE_MINTING_CANISTER_ID);
            A.accountIdentifier(cmc, selfSubaccount);
        };
        Debug.print("[main] beforeTransfer " # debug_show ({ canisterId = self }));
        let result = await Ledger.transfer({
            to = account;
            fee = { e8s = FEE };
            memo = MEMO_CREATE_CANISTER;
            from_subaccount = ?fromSubaccount;
            amount;
            created_at_time = ?{ timestamp_nanos = Nat64.fromNat(Int.abs(Time.now())) };
        });
        switch (result) {
            case (#Ok height) {
                let notifyResult = await CMC.notify_create_canister({ block_index = height; controller = self; subnet_type = null });
                switch (notifyResult) {
                    case (#Ok canisterId) {
                        Debug.print("[main] afterNotify " # debug_show ({ canisterId = self; journalCanisterId = canisterId }));
                        ignore await (system JournalBucket.JournalBucket)(#install canisterId)(caller);
                        journals := Trie.put<Principal, BucketId>(journals, Utils.keyPrincipal(caller), Principal.equal, canisterId).0;
                        #ok({ canisterId });
                    };
                    case (#Err err) {
                        Debug.print("[main] afterNotify " # debug_show ({ canisterId = self; err }));
                        #err(#notify err);
                    };
                };
            };
            case (#Err err) {
                Debug.print("[main] afterTransfer " # debug_show ({ canisterId = self; err }));
                #err(#transfer err);
            };
        };
    };

    public shared ({ caller }) func accountBalance() : async LedgerTypes.Tokens {
        assert not Principal.isAnonymous(caller);
        let account : A.AccountIdentifier = accountIdentifier_(caller);
        await Ledger.account_balance({ account });
    };

    //SECTION - Invites
    /* -------------------------------------------------------------------------- */
    /*                                   INVITES                                  */
    /* -------------------------------------------------------------------------- */

    let INVITE_CHECK_INTERVAL_SECONDS = 3600; // 1 hour
    let INVITE_REFUND_INTERVAL_SECONDS = 600; // 10 minutes
    let INVITE_REFUND_INTERVAL_NANOS = 60 * 1000_000_000; // 1 minute
    var invitesTimerId : ?TimerId = null;
    var invites : TrieMap.TrieMap<Text, Invite> = TrieMap.TrieMap(Text.equal, Text.hash);
    stable var topupQueue : List.List<Topup> = List.nil();
    var toppingUp : ?BucketId = null;

    func topup() : async () {
        assert Option.isNull(toppingUp);

        switch (List.pop<Topup>(topupQueue)) {
            case (null, _) stopTopup();
            case (?{ canisterId; amount }, newTopupQueue) {
                Debug.print("[main] beforeDeposit" # debug_show ({ canister_id = canisterId; amount }));
                toppingUp := ?canisterId;
                try {
                    Cycles.add(amount);
                    await ic.deposit_cycles({ canister_id = canisterId });
                    topupQueue := newTopupQueue;
                    Debug.print("[main] afterDeposit" # debug_show ({ canister_id = canisterId }));
                } catch (err) {
                    Debug.print("[main] afterDeposit " # Error.message(err));
                };
                toppingUp := null;
            };
        };
    };

    func startMonitorInvites() : () {
        if (Option.isSome(invitesTimerId)) return;
        invitesTimerId := ?Timer.recurringTimer(
            #seconds INVITE_CHECK_INTERVAL_SECONDS,
            func job() : async () {
                let now = Time.now();
                invites := TrieMap.map<Text, Invite, Invite>(
                    invites,
                    Text.equal,
                    Text.hash,
                    func(id, invite) {
                        if (invite.status == #active and now > invite.expiredAt) {
                            topupQueue := List.push<Topup>({ canisterId = invite.canisterId; amount = invite.cycles }, topupQueue);
                            return { invite with status = #expired };
                        };
                        invite;
                    }
                );
            }
        );
    };

    func stopMonitorInvites() : () {
        switch (invitesTimerId) {
            case null {};
            case (?timerId) {
                Timer.cancelTimer(timerId);
                invitesTimerId := null;
            };
        };
    };

    var topupTimerId : ?TimerId = null;

    func startTopup() : () {
        if (Option.isSome(topupTimerId)) return;
        topupTimerId := ?Timer.recurringTimer(#seconds INVITE_REFUND_INTERVAL_SECONDS, topup);
    };

    func stopTopup() : () {
        switch (topupTimerId) {
            case null {};
            case (?timerId) {
                Timer.cancelTimer(timerId);
                topupTimerId := null;
            };
        };
    };

    func setTimers() : () {
        startTopup();
        startMonitorInvites();
        startMonitorInvoices();
    };

    // создание приглашения, запускается только из дочерней канистры-журнала
    public shared ({ caller }) func createInvite(value : InviteCreate) : async () {
        assert not Principal.isAnonymous(caller) and isJournal(caller);
        let cycles = Cycles.accept(value.cycles);
        let id : ID = await Utils.generateId();
        let invite : Invite = { { value with cycles } and { id; canisterId = caller; createdAt = Time.now(); status = #active } };
        invites.put(id, invite);
        if (Option.isNull(invitesTimerId)) {
            startMonitorInvites();
        };
    };

    public shared ({ caller }) func createAdminInvite() : async Text {
        assert not Principal.isAnonymous(caller) and Utils.isAdmin(caller);
        let id : ID = await Utils.generateId();
        let now = Time.now();
        let expiredAt = now + 604_800_000_000_000; // 1 week
        let invite : Invite = { id; canisterId = caller; createdAt = now; expiredAt; owner = caller; status = #active; cycles = 2_000_000_000_000 };
        invites.put(id, invite);
        if (Option.isNull(invitesTimerId)) {
            startMonitorInvites();
        };
        id;
    };

    public shared ({ caller }) func redeemInvite(id : ID) : async Result.Result<(), InviteError> {
        assert not Principal.isAnonymous(caller);
        switch (invites.get(id)) {
            case null #err(#notFound);
            case (?{ status = #used(user) }) #err(#alreadyUsed);
            case (?{ status = #expired }) #err(#expired);
            case (?invite) {
                ignore await createJournalBucket(caller, invite.cycles);
                let now : Time.Time = Time.now();
                let updatedInvite = { invite with status = #used(caller) };
                invites.put(id, updatedInvite);
                #ok();
            };
        };
    };

    public query ({ caller }) func checkInvite(id : ID) : async Result.Result<(), InviteError> {
        switch (invites.get(id)) {
            case null #err(#notFound);
            case (?{ status }) {
                switch (status) {
                    case (#expired) #err(#expired);
                    case (#used(user)) #err(#alreadyUsed);
                    case (#active) #ok();
                };
            };
        };
    };

    public shared ({ caller }) func deleteInvite(id : ID) : async Result.Result<(), InviteDeleteError> {
        assert not Principal.isAnonymous(caller);
        switch (invites.get(id)) {
            case null #err(#notFound);
            case (?invite) {
                if (Principal.notEqual(invite.owner, caller)) return #err(#notPermission);
                switch (invite) {
                    case ({ status = #used(user) }) #err(#alreadyUsed user);
                    case ({ status = #expired }) #err(#expired);
                    case _ {
                        let now = Time.now();
                        if (invite.status == #active and now > invite.expiredAt) {
                            return #err(#expired);
                        };
                        topupQueue := List.push<Topup>({ canisterId = invite.canisterId; amount = invite.cycles }, topupQueue);
                        if (Option.isNull(topupTimerId)) startTopup();
                        ignore invites.remove(id);
                        #ok();
                    };
                };
            };
        };
    };

    public query ({ caller }) func getInvites() : async [Invite] {
        assert not Principal.isAnonymous(caller);
        let buffer : Buffer.Buffer<Invite> = Buffer.Buffer<Invite>(0);
        for (invite in invites.vals()) {
            if (Principal.equal(invite.owner, caller)) {
                buffer.add(invite);
            };
        };
        Buffer.toArray(buffer);
    };

    public query ({ caller }) func canInvite() : async Bool {
        Utils.isAdmin(caller);
    };

    //SECTION - Utilites
    /* -------------------------------------------------------------------------- */
    /*                                  UTILITES                                  */
    /* -------------------------------------------------------------------------- */

    func isJournal(caller : Principal) : Bool {
        Trie.some<Principal, BucketId>(journals, func(owner, bucketId) = Principal.equal(caller, bucketId));
    };

    stable var registrationMode : RegistrationMode = #prepaid;
    public shared ({ caller }) func setRegistrationMode(mode : RegistrationMode) : async () {
        assert not Principal.isAnonymous(caller) and Utils.isAdmin(caller);
        registrationMode := mode;
    };
    public query ({ caller }) func getRegistrationMode() : async RegistrationMode {
        assert not Principal.isAnonymous(caller);
        registrationMode;
    };
    public query ({ caller }) func accountIdentifier() : async A.AccountIdentifier {
        assert not Principal.isAnonymous(caller);
        accountIdentifier_(caller);
    };

    func accountIdentifier_(caller : Principal) : A.AccountIdentifier {
        let subaccount : A.Subaccount = A.principalToSubaccount(caller);
        A.accountIdentifier(Principal.fromActor(Rabbithole), subaccount);
    };

    func cyclesToICPE8s(cyclesAmount : Nat) : async LedgerTypes.Tokens {
        let { data } = await CMC.get_icp_xdr_conversion_rate();
        let e8s : Nat64 = Int64.toNat64(Float.toInt64(Float.div(Float.fromInt(Int.abs(cyclesAmount)), Float.fromInt64(Int64.fromNat64(data.xdr_permyriad_per_icp)) * 100_000_000) * 100_000_000));
        { e8s };
    };

    //SECTION - System lifecycle
    /* -------------------------------------------------------------------------- */
    /*                              SYSTEM LIFECYCLE                              */
    /* -------------------------------------------------------------------------- */

    stable var stableInvites : [(Text, Invite)] = [];
    stable var stableProfiles : [(Principal, ProfileInfo)] = [];

    // system func timer(set : Nat64 -> ()) : async () {
    //     set(Nat64.fromIntWrap(Time.now() + INVITE_REFUND_INTERVAL_NANOS));
    //     ignore topup();
    // };

    system func preupgrade() {
        stableInvites := Iter.toArray(invites.entries());
        stableProfiles := Iter.toArray(profiles.entries());
    };

    system func postupgrade() {
        invites := TrieMap.fromEntries<Text, Invite>(stableInvites.vals(), Text.equal, Text.hash);
        stableInvites := [];
        setTimers();
        profiles := TrieMap.fromEntries<Principal, ProfileInfo>(stableProfiles.vals(), Principal.equal, Principal.hash);
        // profilesV2 := Map.fromIterMap<Principal, ProfileInfoV2, (Principal, ProfileInfo)>(stableProfiles.vals(), phash, func ((key, value)) {
        //     ?(key, { value and { avatarUrl = null } });
        // });
        stableProfiles := [];
    };

    /* -------------------------------------------------------------------------- */
    /*                                File sharing                                */
    /* -------------------------------------------------------------------------- */

    // <user, fileId, [user]>
    type SharedFile = JournalTypes.SharedFile;
    type SharedFileExtended = JournalTypes.SharedFileExtended;
    stable var sharedFiles : Trie.Trie2D<Principal, ID, SharedFile> = Trie.empty();

    public shared ({ caller }) func shareFile(fileId : ID, sharedFile : SharedFile) : async () {
        assert not Principal.isAnonymous(caller) and isJournal(caller);
        let ?owner = findJournalOwner(caller) else Prelude.unreachable();
        sharedFiles := Trie.put2D<Principal, ID, SharedFile>(
            sharedFiles,
            Utils.keyPrincipal(owner),
            Principal.equal,
            Utils.keyText(fileId),
            Text.equal,
            sharedFile
        );
    };

    public shared ({ caller }) func unshareFile(fileId : ID) : async () {
        assert not Principal.isAnonymous(caller) and isJournal(caller);
        let ?owner = findJournalOwner(caller) else Prelude.unreachable();
        sharedFiles := Trie.remove2D<Principal, ID, SharedFile>(
            sharedFiles,
            Utils.keyPrincipal(owner),
            Principal.equal,
            Utils.keyText(fileId),
            Text.equal
        ).0;
    };

    public shared ({ caller }) func unshareStorageFiles(storageId : BucketId) : async () {
        assert isJournal(caller);
        sharedFiles := Trie.mapFilter<Principal, Trie.Trie<ID, SharedFile>, Trie.Trie<ID, SharedFile>>(
            sharedFiles,
            func (user, trie) {
                let newTrie = Trie.filter<ID, SharedFile>(
                    trie,
                    func (id, file) = Principal.notEqual(file.storageId, storageId)
                );
                if (Trie.size(newTrie) == 0) null else ?newTrie;
            }
        );
    };

    public composite query ({ caller }) func getSharedFile(id : ID) : async ?SharedFileExtended {
        let bucketId = label exit : ?Principal {
            label forLoop for ((owner, trie) in Trie.iter(sharedFiles)) {
                switch (Trie.get<ID, SharedFile>(trie, Utils.keyText id, Text.equal)) {
                    case null {};
                    case _ {
                        let ?journalBucketId : ?Principal = Trie.get<Principal, BucketId>(journals, Utils.keyPrincipal(owner), Principal.equal) else continue forLoop;
                        break exit(?journalBucketId);
                    };
                };
            };
            null;
        };
        switch (bucketId) {
            case (?v) {
                let journalActor : actor { getSharedFile : query (Principal, ID) -> async Result.Result<SharedFileExtended, { #notFound; #noPermission }> } = actor (Principal.toText v);
                let result = await journalActor.getSharedFile(caller, id);
                switch (result) {
                    case (#ok file) ?file;
                    case (#err _) null;
                };
            };
            case null null;
        };
    };

    public query ({ caller }) func sharedWithMe() : async [UserShare] {
        assert not Principal.isAnonymous(caller);
        let buffer : Buffer.Buffer<UserShare> = Buffer.Buffer(0);
        for ((owner, trie) in Trie.iter(sharedFiles)) {
            let sharedMe = Trie.some<ID, SharedFile>(
                trie,
                func(fileId, { sharedWith }) = switch (sharedWith) {
                    case (#users(users)) Buffer.contains(Buffer.fromArray<Principal>(users), caller, Principal.equal);
                    case _ false;
                }
            );
            let journalBucketId : ?Principal = Trie.get<Principal, BucketId>(journals, Utils.keyPrincipal(owner), Principal.equal);
            let profile : ?ProfileInfoV2 = Map.get(profilesV2, phash, owner);
            switch (sharedMe, journalBucketId, profile) {
                case (true, ?bucketId, ?{ id; username; displayName; avatarUrl }) {
                    let value = { profile = { principal = id; username; displayName; avatarUrl }; bucketId };
                    if (not Buffer.contains<UserShare>(buffer, value, func(a, b) = Principal.equal(a.bucketId, b.bucketId))) {
                        buffer.add(value);
                    };
                };
                case _ {};
            };
        };
        Buffer.toArray(buffer);
    };

    func findJournalOwner(canisterId : Principal) : ?Principal {
        label exit : ?Principal {
            for ((owner, bucketId) in Trie.iter<Principal, BucketId>(journals)) {
                if (Principal.equal(canisterId, bucketId)) break exit(?owner);
            };
            null;
        };
    };
};
