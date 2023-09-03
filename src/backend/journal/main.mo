import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Int64 "mo:base/Int64";
import Iter "mo:base/Iter";
import List "mo:base/List";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Option "mo:base/Option";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Trie "mo:base/Trie";
import TrieSet "mo:base/TrieSet";
import { recurringTimer; cancelTimer } "mo:base/Timer";

import A "../utils/Account";
import CMCTypes "../types/cmc";
import IC "../types/ic";
import Journal "journal";
import JournalTypes "types";
import LedgerTypes "../types/ledger";
import StorageBucket "../storage/main";
import Types "../types/types";
import Utils "../utils/utils";
import Wallet "../utils/wallet";
import { LEDGER_CANISTER_ID; CYCLE_MINTING_CANISTER_ID } = "../env";

shared ({ caller = installer }) actor class JournalBucket(owner : Principal) = this {
    type ID = Types.ID;
    type BucketId = Types.BucketId;

    let ic : IC.Self = actor "aaaaa-aa";

    /* -------------------------------------------------------------------------- */
    /*                                   JOURNAL                                  */
    /* -------------------------------------------------------------------------- */

    type Directory = JournalTypes.Directory;
    type DirectoryCreateError = JournalTypes.DirectoryCreateError;
    type DirectoryMoveError = JournalTypes.DirectoryMoveError;
    type DirectoryState = JournalTypes.DirectoryState;
    type DirectoryStateError = JournalTypes.DirectoryStateError;
    type DirectoryAction = JournalTypes.DirectoryAction;
    type DirectoryUpdatableFields = JournalTypes.DirectoryUpdatableFields;
    type Entry = JournalTypes.Entry;
    type EntryCreate = JournalTypes.EntryCreate;
    type File = JournalTypes.File;
    type FileExtended = JournalTypes.FileExtended;
    type FileCreate = JournalTypes.FileCreate;
    type FileCreateError = JournalTypes.FileCreateError;
    type FileMoveError = JournalTypes.FileMoveError;
    type NotFoundError = JournalTypes.NotFoundError;
    type AlreadyExistsError<T> = JournalTypes.AlreadyExistsError<T>;
    type SharedFile = JournalTypes.SharedFile;

    var journal = Journal.New({ owner; installer });

    public shared ({ caller }) func createDirectory(directory : EntryCreate) : async Result.Result<Directory, DirectoryCreateError> {
        assert validateCaller(caller);
        await journal.createDir(directory);
    };

    public query ({ caller }) func checkDirname(entry : EntryCreate) : async Result.Result<(), DirectoryCreateError> {
        assert validateCaller(caller);
        journal.checkDirname(entry);
    };

    public query ({ caller }) func checkFilename(entry : EntryCreate) : async Result.Result<(), FileCreateError> {
        assert validateCaller(caller);
        journal.checkFilename(entry);
    };

    public shared ({ caller }) func renameFile(id : Text, name : Text) : async Result.Result<File, NotFoundError or { #illegalCharacters } or AlreadyExistsError<File>> {
        assert validateCaller(caller);
        journal.renameFile(id, name);
    };

    public shared ({ caller }) func updateDirectory(action : DirectoryAction, fields : DirectoryUpdatableFields) : async Result.Result<Directory, NotFoundError or AlreadyExistsError<Directory>> {
        assert validateCaller(caller);
        await* journal.updateDir(action, fields);
    };

    public shared ({ caller }) func moveDirectory(sourcePath : Text, targetPath : ?Text) : async Result.Result<(), DirectoryMoveError> {
        assert validateCaller(caller);
        let preparedSourcePath : Text = Text.trim(sourcePath, #char '/');
        let preparedTargetPath : ?Text = Option.map<Text, Text>(targetPath, func t = Text.trim(t, #char '/'));
        await* journal.moveDir(preparedSourcePath, preparedTargetPath);
    };

    // Удаление директории со всеми дочерними поддиректориями и файлами
    public shared ({ caller }) func deleteDirectory(sourcePath : Text) : async Result.Result<(), NotFoundError> {
        assert validateCaller(caller);
        let preparedPath : Text = Text.trim(sourcePath, #char '/');
        await journal.deleteDir(preparedPath);
    };

    // Создание дерева директорий
    public shared ({ caller }) func createPaths(paths : [Text], ids : [ID], parentId : ?ID) : async [(Text, ID)] {
        assert validateCaller(caller);
        await journal.createPaths(paths, ids, parentId);
    };

    public query ({ caller }) func getJournal(path : ?Text) : async Result.Result<DirectoryState, DirectoryStateError> {
        assert validateCaller(caller);
        journal.getJournal(path);
    };

    public query ({ caller }) func showDirectoriesTree(id : ?ID) : async Text {
        assert validateCaller(caller);
        journal.showDirectoriesTree(id);
    };

    public shared ({ caller }) func addFile(file : FileCreate) : async Result.Result<File, FileCreateError> {
        assert not Principal.isAnonymous(caller);
        assert isStorage(caller);
        await journal.putFile(file);
    };

    public shared ({ caller }) func deleteFile(sourcePath : Text) : async Result.Result<(), NotFoundError> {
        assert validateCaller(caller);
        let preparedPath : Text = Text.trimStart(sourcePath, #text "/");
        await journal.deleteFile(preparedPath);
    };

    public shared ({ caller }) func moveFile(sourceFullPath : Text, targetPath : ?Text) : async Result.Result<(), FileMoveError> {
        assert validateCaller(caller);
        let preparedSourceFullPath : Text = Text.trimStart(sourceFullPath, #text "/");
        let preparedTargetPath : ?Text = Option.map<Text, Text>(targetPath, func(text : Text) { Text.trim(text, #text "/") });
        await journal.moveFile(preparedSourceFullPath, preparedTargetPath);
    };

    public query ({ caller }) func getChildrenDirs(id : ?ID) : async [Directory] {
        assert validateCaller(caller);
        journal.listDirsExtend(id);
    };

    public query ({ caller }) func listFiles(id : ?ID) : async [FileExtended] {
        assert validateCaller(caller);
        journal.listFilesExtend(id);
    };

    /* -------------------------------------------------------------------------- */
    /*                                   STORAGE                                  */
    /* -------------------------------------------------------------------------- */

    let STORAGE_BUCKET_CAPACITY = 2040109465; // 1.9gb => 2040109465
    let CYCLE_SHARE = 500_000_000_000;
    stable var storageBuckets : TrieSet.Set<BucketId> = TrieSet.empty<BucketId>();
    var lockedStorageCreating : Bool = false;

    public shared ({ caller }) func getStorage(fileSize : Nat) : async ?BucketId {
        assert validateCaller(caller);
        await getBucketWithAvailableCapacity(caller, fileSize);
    };

    // Инициализация storage-канистры, если у caller еще нет канистры или все канистры заполнены, то создаем канистру
    func getBucketWithAvailableCapacity(caller : Principal, fileSize : Nat) : async ?BucketId {
        if lockedStorageCreating return null;
        var bucketId_ : ?BucketId = null;
        label bucketsLoop for (bucketId in Iter.fromArray(TrieSet.toArray(storageBuckets))) {
            let storageBucket : actor { getUsedMemorySize : shared () -> async Nat } = actor (Principal.toText(bucketId));
            let usedMemory = await storageBucket.getUsedMemorySize();
            if ((usedMemory + fileSize) <= STORAGE_BUCKET_CAPACITY) {
                bucketId_ := ?bucketId;
                break bucketsLoop;
            };
        };
        if (Option.isSome(bucketId_)) return bucketId_;
        lockedStorageCreating := true;
        try {
            let newBucket : BucketId = await createStorageBucket(caller);
            lockedStorageCreating := false;
            ?newBucket;
        } catch err {
            lockedStorageCreating := false;
            throw err;
        };
    };

    // Создание канистры с хранилищем
    func createStorageBucket(caller : Principal) : async BucketId {
        let self : Principal = Principal.fromActor(this);
        let settings = {
            controllers = ?[self];
            freezing_threshold = null;
            memory_allocation = null;
            compute_allocation = null;
        };
        Cycles.add(CYCLE_SHARE);
        let { canister_id } = await ic.create_canister({ settings = ?settings });
        ignore await (system StorageBucket.Storage)(#install canister_id)(caller);
        storageBuckets := TrieSet.put<BucketId>(storageBuckets, canister_id, Principal.hash(canister_id), Principal.equal);
        startBucketMonitor(canister_id);
        canister_id;
    };

    // Удаление канистры пользователя
    public shared ({ caller }) func deleteStorage(bucketId : BucketId) : async () {
        assert validateCaller(caller);
        switch (isStorage(bucketId)) {
            case false throw Error.reject("Bucket " # Principal.toText(bucketId) # " not found. " # Principal.toText(caller));
            case true {
                await ic.uninstall_code({ canister_id = bucketId });
                ignore await (system Wallet.Wallet)(#install bucketId)();
                let wallet : actor { transferCycles : shared (canisterId : Principal) -> async () } = actor (Principal.toText(bucketId));
                await wallet.transferCycles(Principal.fromActor(this));
                await ic.stop_canister({ canister_id = bucketId });
                await ic.delete_canister({ canister_id = bucketId });
                storageBuckets := TrieSet.delete<BucketId>(storageBuckets, bucketId, Principal.hash(bucketId), Principal.equal);
                await journal.deleteStorageFiles(bucketId);
            };
        };
    };

    public query ({ caller }) func listStorages() : async [BucketId] {
        assert Principal.equal(caller, owner) or Principal.equal(caller, installer) or Utils.isAdmin(caller);
        TrieSet.toArray<BucketId>(storageBuckets);
    };

    stable var storageWasm : [Nat8] = [];
    // stable var storageQueue : List.List<BucketId> = List.nil();
    // var upgradeStorageTimerId : ?Nat = null;

    // Source:
    // https://github.com/ORIGYN-SA/large_canister_deployer_internal
    // https://forum.dfinity.org/t/read-local-file-at-build-time-with-motoko/15945/2

    public shared ({ caller }) func storageResetWasm() : async () {
        if (not Utils.isAdmin(caller)) {
            throw Error.reject("Unauthorized access. Caller is not an admin. " # Principal.toText(caller));
        };

        storageWasm := [];
    };

    public shared ({ caller }) func storageLoadWasm(blob : [Nat8]) : async ({ total : Nat; chunks : Nat }) {
        if (not Utils.isAdmin(caller)) {
            throw Error.reject("Unauthorized access. Caller is not an admin. " # Principal.toText(caller));
        };

        let buffer : Buffer.Buffer<Nat8> = Buffer.fromArray<Nat8>(storageWasm);
        let chunks : Buffer.Buffer<Nat8> = Buffer.fromArray<Nat8>(blob);
        buffer.append(chunks);
        storageWasm := Buffer.toArray(buffer);

        // return total wasm sizes
        return {
            total = storageWasm.size();
            chunks = blob.size();
        };
    };

    public shared ({ caller }) func upgradeStorages() : async () {
        if (not Utils.isAdmin(caller)) {
            throw Error.reject("Unauthorized access. Caller is not an admin. " # Principal.toText(caller));
        };

        for (bucketId in Iter.fromArray(TrieSet.toArray<BucketId>(storageBuckets))) {
            await ic.install_code({
                arg = to_candid (owner);
                wasm_module = Blob.fromArray(storageWasm);
                mode = #upgrade;
                canister_id = bucketId;
            });
        };
    };

    /* -------------------------------------------------------------------------- */
    /*                                   INVITES                                  */
    /* -------------------------------------------------------------------------- */

    type InviteCreate = Types.InviteCreate;
    let INVITE_CYCLE_SHARE = 2_000_000_000_000;

    public shared ({ caller }) func createInvite(expiredAt : Time.Time) : async Result.Result<(), { #transfer : LedgerTypes.TransferError; #notify : CMCTypes.NotifyError; #insufficientFunds : { balance : Tokens } }> {
        assert validateCaller(caller);
        let self = Principal.fromActor(this);
        let freezingThresholdInCycles = await getFreezingThresholdInCycles(self);
        let balance = Cycles.balance();
        var cyclesShare : Nat = INVITE_CYCLE_SHARE;
        let burnICP = Int64.less(
            Int64.sub(
                Int64.fromNat64(Nat64.fromNat(Nat.sub(balance, freezingThresholdInCycles))),
                Int64.fromNat64(Nat64.fromNat(INVITE_CYCLE_SHARE))
            ),
            Int64.fromNat64(Nat64.fromNat(MANAGER_CYCLE_THRESHOLD))
        );
        Debug.print("[invite] before create " # debug_show ({ canisterId = self; balance; freezingThresholdInCycles }));
        if (burnICP) {
            cyclesShare := switch (await cyclesToE8s(INVITE_CYCLE_SHARE)) {
                case (#ok amount) {
                    let result = await depositCycles(amount);
                    switch (result) {
                        case (#ok { cycles }) cycles;
                        case (#err err) return #err err;
                    };
                };
                case (#err balance) {
                    return #err(#insufficientFunds({ balance }));
                };
            };
        };

        Debug.print("[invite] create " # debug_show ({ canisterId = self; cycles = cyclesShare }));
        let manager : actor { createInvite : shared (value : InviteCreate) -> async () } = actor (Principal.toText(installer));
        Cycles.add(cyclesShare);
        await manager.createInvite({
            owner = caller;
            expiredAt;
            cycles = cyclesShare;
        });
        #ok();
    };

    func getFreezingThresholdInCycles(canisterId : Principal) : async Nat {
        let status = await ic.canister_status({ canister_id = canisterId });
        Float.mul(
            Float.fromInt(status.idle_cycles_burned_per_day) |> Float.div(_, Float.fromInt(86400)),
            Int.abs(status.settings.freezing_threshold) |> Float.fromInt _
        ) |> Float.toInt _ |> Int.abs _;
    };

    /* -------------------------------------------------------------------------- */
    /*                                   ACCOUNT                                  */
    /* -------------------------------------------------------------------------- */
    
    type Tokens = LedgerTypes.Tokens;
    type TransferResult = LedgerTypes.TransferResult;
    let Ledger : LedgerTypes.Self = actor (LEDGER_CANISTER_ID);
    let FEE : Nat64 = 10_000;

    // вывод средств из пользовательского аккаунта
    public shared ({ caller }) func withdraw({ amount : Tokens; to : ?A.AccountIdentifier }) : async TransferResult {
        assert validateCaller(caller);
        let fromSubaccount : A.Subaccount = A.principalToSubaccount(owner);
        let defaultSubaccount : A.Subaccount = A.defaultSubaccount();
        let account : A.AccountIdentifier = A.accountIdentifier(caller, defaultSubaccount);
        await Ledger.transfer({
            to = Option.get(to, account);
            fee = { e8s = FEE };
            memo = 0;
            from_subaccount = ?fromSubaccount;
            amount;
            created_at_time = ?{ timestamp_nanos = Nat64.fromNat(Int.abs(Time.now())) };
        });
    };

    // внутренний аккаунт пользователя
    public query ({ caller }) func accountIdentifier() : async A.AccountIdentifier {
        assert validateCaller(caller);
        accountIdentifier_();
    };

    func accountIdentifier_() : A.AccountIdentifier {
        let subaccount : A.Subaccount = A.principalToSubaccount(owner);
        A.accountIdentifier(Principal.fromActor(this), subaccount);
    };

    //TODO - disabled
    /* -------------------------------------------------------------------------- */
    /*                              TOP-UP CANISTERS                              */
    /* -------------------------------------------------------------------------- */

    type Topup = JournalTypes.Topup;
    type MonitorCanister = JournalTypes.MonitorCanister;
    type TransferError = LedgerTypes.TransferError;
    type NotifyError = CMCTypes.NotifyError;
    let MEMO_CREATE_CANISTER : LedgerTypes.Memo = 0x41455243; // == 'CREA'
    let MEMO_TOP_UP_CANISTER : LedgerTypes.Memo = 0x50555054; // == 'TPUP'
    let CHECK_INTERVAL_SECONDS : Nat = 20;
    let MANAGER_CYCLE_THRESHOLD = 1_000_000_000_000;
    let STORAGE_CYCLE_THRESHOLD = 250_000_000_000;
    let MIN_CYCLE_DEPOSIT = 1_000_000_000_000;
    var topupQueue : List.List<Topup> = List.nil();
    stable var depositQueue : List.List<BucketId> = List.nil();
    var toppingUp : ?BucketId = null;
    var depositing : Bool = false;
    stable var canisters : Trie.Trie<BucketId, MonitorCanister> = Trie.empty<BucketId, MonitorCanister>();
    let CMC : CMCTypes.Self = actor (CYCLE_MINTING_CANISTER_ID);

    // запуск мониторинга состояния баланса канистры
    public shared ({ caller }) func startMonitor(canisterId : BucketId) : async () {
        assert Principal.equal(caller, owner) or Utils.isAdmin(caller);
        startBucketMonitor(canisterId);
    };

    public shared ({ caller }) func stopMonitor(canisterId : BucketId) : async () {
        assert Principal.equal(caller, owner) or Utils.isAdmin(caller);
        stopBucketMonitor(canisterId);
    };

    public query ({ caller }) func listMonitors() : async [MonitorCanister] {
        assert Principal.equal(caller, owner) or Utils.isAdmin(caller);
        Trie.fold<BucketId, MonitorCanister, Buffer.Buffer<MonitorCanister>>(
            canisters,
            func(_, canister, buffer) {
                buffer.add(canister);
                buffer;
            },
            Buffer.Buffer<MonitorCanister>(Trie.size(canisters))
        ) |> Buffer.toArray _;
    };

    func startBucketMonitor(canisterId : BucketId) : () {
        let found : ?MonitorCanister = Trie.get<BucketId, MonitorCanister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal);
        let defaults = switch (found) {
            case null {
                { canisterId; owner; lastChecked = Time.now(); status = null };
            };
            case (?canister) {
                switch (canister.timerId) {
                    case null {};
                    case (?timerId) cancelTimer(timerId);
                };
                { canister with monitoring = #stopped; timerId = null };
            };
        };
        let timerId = recurringTimer(
            #seconds CHECK_INTERVAL_SECONDS,
            func() : async () {
                ignore monitorCycles(canisterId);
            }
        );
        let value : MonitorCanister = { defaults with timerId = ?timerId; monitoring = #running; error = null };
        canisters := Trie.put<BucketId, MonitorCanister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal, value).0;
    };

    func stopBucketMonitor(canisterId : BucketId) : () {
        switch (Trie.get<BucketId, MonitorCanister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal)) {
            case null {};
            case (?canister) {
                switch (canister.timerId) {
                    case null {};
                    case (?timerId) cancelTimer(timerId);
                };

                let value : MonitorCanister = { canister with timerId = null; monitoring = #stopped };
                canisters := Trie.put<BucketId, MonitorCanister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal, value).0;
            };
        };
    };

    func checkCycles() : async () {
        try {
            let self = Principal.fromActor(this);
            let status = await ic.canister_status({ canister_id = self });
            let freezingThresholdInCycles = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
            let availableCycles = Nat.sub(status.cycles, freezingThresholdInCycles);
            let amount : Nat = Nat.max(MANAGER_CYCLE_THRESHOLD, status.idle_cycles_burned_per_day * 10);
            Debug.print("[manager] afterCheck " # debug_show ({ cycles = status.cycles; availableCycles }));
            if (availableCycles <= amount) {
                Debug.print("[manager] deposit " # debug_show ({ canisterId = self }));
                let amount : Tokens = switch (await cyclesToE8s(MIN_CYCLE_DEPOSIT)) {
                    case (#ok amount) amount;
                    case (#err balance) {
                        { e8s = Nat64.max(Nat64.fromNat(0), Nat64.sub(balance.e8s, FEE)) };
                    };
                };
                ignore await depositCycles(amount);
            };
        } catch (err) {
            Debug.print("[manager] afterCheck " # Error.message(err));
        };
    };

    // проверка состояния баланса канистры, добавление в очередь на пополнение при необходимости
    func monitorCycles(canisterId : BucketId) : async () {
        let found : ?MonitorCanister = Trie.get<BucketId, MonitorCanister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal);
        switch (found) {
            case null {};
            case (?canister) {
                let now = Time.now();
                let updatedCanister = try {
                    let status = await ic.canister_status({ canister_id = canister.canisterId });
                    let value : MonitorCanister = { canister with status = ?status; lastChecked = now };
                    let freezingThresholdInCycles = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
                    let availableCycles = Nat.sub(status.cycles, freezingThresholdInCycles);
                    let amount : Nat = Nat.max(STORAGE_CYCLE_THRESHOLD, status.idle_cycles_burned_per_day * 10);
                    let isInTopupQueue = List.some<Topup>(topupQueue, func ({ canisterId = id }) = Principal.equal(id, value.canisterId));
                    Debug.print("[storage] afterCheck " # debug_show ({ cycles = status.cycles; availableCycles }));
                    if (availableCycles <= amount and not isInTopupQueue) {
                        Debug.print("[storage] enqueueTopUp " # debug_show ({ canisterId }));
                        topupQueue := List.push<Topup>({ canisterId = value.canisterId; amount }, topupQueue);
                    };
                    value;
                } catch (err) {
                    Debug.print("[storage] afterCheck " # Error.message(err));
                    { canister with error = ?Error.message(err); lastChecked = now };
                };
                canisters := Trie.put<BucketId, MonitorCanister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal, updatedCanister).0;
            };
        };
    };

    func topup() : async () {
        assert Option.isNull(toppingUp);
        switch (List.pop<Topup>(topupQueue)) {
            case (null, _) {};
            case (?{ canisterId; amount }, newTopupQueue) {
                Debug.print("[manager] beforeDeposit" # debug_show ({ canister_id = canisterId; amount }));
                toppingUp := ?canisterId;
                try {
                    Cycles.add(amount);
                    await ic.deposit_cycles({ canister_id = canisterId });
                    Debug.print("[manager] afterDeposit" # debug_show ({ canister_id = canisterId }));
                } catch (err) {
                    Debug.print("[manager] afterDeposit " # Error.message(err));
                };
                toppingUp := null;
                topupQueue := newTopupQueue;
            };
        };
    };

    // пополнение канистры циклами из Cycles Minting Canister путем сжигания ICP на внутреннем балансе пользователя
    func depositCycles(amount : Tokens) : async Result.Result<{ cycles : Nat }, { #transfer : TransferError; #notify : NotifyError }> {
        let self = Principal.fromActor(this);
        let fromSubaccount : A.Subaccount = A.principalToSubaccount(owner);
        let account : A.AccountIdentifier = do {
            let selfSubaccount : A.Subaccount = A.canisterToSubaccount(self);
            let cmc = Principal.fromText(CYCLE_MINTING_CANISTER_ID);
            A.accountIdentifier(cmc, selfSubaccount);
        };
        Debug.print("[manager] beforeTransfer " # debug_show ({ canisterId = self }));
        let result = await Ledger.transfer({
            to = account;
            fee = { e8s = FEE };
            memo = MEMO_TOP_UP_CANISTER;
            from_subaccount = ?fromSubaccount;
            amount;
            created_at_time = ?{ timestamp_nanos = Nat64.fromNat(Int.abs(Time.now())) };
        });
        switch (result) {
            case (#Ok height) {
                let notifyResult = await CMC.notify_top_up({ block_index = height; canister_id = self });
                switch (notifyResult) {
                    case (#Ok cycles) {
                        Debug.print("[manager] afterNotify " # debug_show ({ canisterId = self; cycles }));
                        ignore Cycles.accept(cycles);
                        #ok({ cycles });
                    };
                    case (#Err err) {
                        Debug.print("[manager] afterNotify " # debug_show ({ canisterId = self; err }));
                        #err(#notify err);
                    };
                };
            };
            case (#Err err) {
                Debug.print("[manager] afterTransfer " # debug_show ({ canisterId = self; err }));
                #err(#transfer err);
            };
        };
    };

    // конвертация циклов в ICP
    func cyclesToE8s(cyclesAmount : Nat) : async Result.Result<Tokens, Tokens> {
        let { data } = await CMC.get_icp_xdr_conversion_rate();
        let account : A.AccountIdentifier = accountIdentifier_();
        let balance : Tokens = await Ledger.account_balance({ account });
        let e8s : Nat64 = Int64.fromNat64(data.xdr_permyriad_per_icp) |> Float.div(Float.fromInt(Int.abs(cyclesAmount)), Float.fromInt64 _ * 100_000_000) * 100_000_000 |> Float.toInt64 _ |> Int64.toNat64 _;
        if (Nat64.greaterOrEqual(balance.e8s, Nat64.add(e8s, FEE))) {
            #ok({ e8s });
        } else {
            #err balance;
        };
    };

    /* -------------------------------------------------------------------------- */
    /*                                 ENCRYPTION                                 */
    /* -------------------------------------------------------------------------- */

    public shared ({ caller }) func fileVetkdPublicKey(id : ID, derivationPath : [Blob]) : async Text {
        await journal.fileVetkdPublicKey(id, derivationPath);
    };

    public shared ({ caller }) func setFileEncryptedSymmetricKey(id : ID, tpk : Blob) : async Text {
        assert validateCaller(caller);
        await journal.setFileEncryptedSymmetricKey(id, tpk);
    };

    public shared ({ caller }) func getFileEncryptedSymmetricKey(id : ID, tpk : Blob) : async Text {
        await journal.getFileEncryptedSymmetricKey(caller, id, tpk);
    };

    //TODO - implement notification canister with web-sockets
    /* -------------------------------------------------------------------------- */
    /*                                   SHARING                                  */
    /* -------------------------------------------------------------------------- */

    type SharedFileParams = JournalTypes.SharedFileParams;
    type SharedFileExtended = JournalTypes.SharedFileExtended;
    public shared ({ caller }) func shareFile(id : ID, fields : SharedFileParams) : async Result.Result<FileExtended, { #notFound }> {
        assert validateCaller(caller);
        let self = Principal.fromActor(this);
        await journal.shareFile(id, fields, self);
    };

    public shared ({ caller }) func unshareFile(id : ID) : async Result.Result<FileExtended, { #notFound }> {
        assert validateCaller(caller);
        await journal.unshareFile(id);
    };

    public query ({ caller }) func sharedWithMe() : async [SharedFileExtended] {
        assert not Principal.isAnonymous(caller);
        journal.sharedWithMe(caller);
    };

    public query func getSharedFile(caller : Principal, id : ID) : async Result.Result<SharedFileExtended, { #notFound; #noPermission }> {
        journal.getSharedFile(caller, id);
    };

    /* -------------------------------------------------------------------------- */
    /*                                   TIMERS                                   */
    /* -------------------------------------------------------------------------- */

    let CHECK_INTERVAL_NANOS : Nat = 60_000_000_000; // 1 minute

    // system func timer(set : Nat64 -> ()) : async () {
    //     set(Nat64.fromIntWrap(Time.now() + CHECK_INTERVAL_NANOS));
    //     ignore checkBalance();
    // };

    func restartTimers() : () {
        for ((_, { canisterId }) in Trie.iter(canisters)) {
            startBucketMonitor(canisterId);
        };
    };

    /* -------------------------------------------------------------------------- */
    /*                                SYSTEM HOOKS                                */
    /* -------------------------------------------------------------------------- */

    stable var stableJournal : ([(Text, Directory)], [(Text, File)], [(ID, SharedFile)]) = ([], [], []);

    system func preupgrade() {
        stableJournal := journal.preupgrade();
    };

    system func postupgrade() {
        let dirsIter = stableJournal.0.vals();
        let filesIter = stableJournal.1.vals();
        let sharedFilesIter = stableJournal.2.vals();
        journal := Journal.fromIter({ owner; installer }, dirsIter, filesIter, sharedFilesIter);
        // restartTimers();
    };

    /* -------------------------------------------------------------------------- */
    /*                                  UTILITES                                  */
    /* -------------------------------------------------------------------------- */

    func validateCaller(caller : Principal) : Bool {
        not Principal.isAnonymous(caller) and Principal.equal(caller, owner);
    };

    func isStorage(bucketId : BucketId) : Bool {
        TrieSet.mem<BucketId>(storageBuckets, bucketId, Principal.hash(bucketId), Principal.equal);
    };

    //NOTE - DEPRECATED!
    public shared ({ caller }) func canisterStatus(canisterId : Principal) : async {
        id : Principal;
        status : IC.canister_status_response;
        freezingThresholdInCycles : Nat;
    } {
        assert Principal.equal(caller, owner) or Utils.isAdmin(caller);
        let status = await ic.canister_status({ canister_id = canisterId });
        let freezingThresholdInCycles = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
        { id = canisterId; status; freezingThresholdInCycles };
    };
};