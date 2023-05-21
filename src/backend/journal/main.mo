import Array "mo:base/Array";
import AssocList "mo:base/AssocList";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Char "mo:base/Char";
import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";
import Deque "mo:base/Deque";
import Error "mo:base/Error";
import Float "mo:base/Float";
import Hash "mo:base/Hash";
import HashMap "mo:base/HashMap";
import Int "mo:base/Int";
import Int64 "mo:base/Int64";
import Iter "mo:base/Iter";
import List "mo:base/List";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Option "mo:base/Option";
import Prelude "mo:base/Prelude";
import Prim "mo:prim";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Trie "mo:base/Trie";
import TrieSet "mo:base/TrieSet";
import { recurringTimer; cancelTimer } "mo:base/Timer";

import BiHashMap "mo:bimap/BiHashMap";
import BiMap "mo:bimap/BiMap";

import A "../utils/Account";
import IC "../types/ic";
import CMCTypes "../types/cmc";
import LedgerTypes "../types/ledger";
import JournalTypes "types";
// import Ledger "canister:ledger";
import Logger "../utils/logger";
import StorageBucket "../storage/main";
import StorageTypes "../storage/types";
import Types "../types/types";
import Utils "../utils/utils";
import { LEDGER_CANISTER_ID; CYCLE_MINTING_CANISTER_ID } = "../env";
import Wallet "../utils/wallet";
import TrieMap "mo:base/TrieMap";

shared ({ caller = installer }) actor class JournalBucket(owner : Principal) = this {
    type ID = Types.ID;
    type JournalEntry = JournalTypes.JournalEntry;
    type File = JournalTypes.File;
    type Directory = JournalTypes.Directory;
    type DirectoryError = JournalTypes.DirectoryError;
    type DirectoryMoveError = JournalTypes.DirectoryMoveError;
    type DirectoryCreateError = JournalTypes.DirectoryCreateError;
    type DirectoryAction = JournalTypes.DirectoryAction;
    type DirectoryUpdatableFields = JournalTypes.DirectoryUpdatableFields;
    type DirectoryColor = JournalTypes.DirectoryColor;
    type BucketId = Types.BucketId;
    type FileCreate = JournalTypes.FileCreate;
    type FileCreateError = JournalTypes.FileCreateError;
    type FileMoveError = JournalTypes.FileMoveError;
    type Canister = JournalTypes.Canister;
    type Topup = JournalTypes.Topup;
    type Journal = JournalTypes.Journal;
    type JournalError = JournalTypes.JournalError;
    type Tokens = LedgerTypes.Tokens;
    type InviteCreate = Types.InviteCreate;

    let STORAGE_BUCKET_CAPACITY = 2040109465; // 1.9gb => 2040109465
    let CYCLE_SHARE = 500_000_000_000;
    let CHECK_INTERVAL_NANOS : Nat = 60_000_000_000; // 1 minute
    // let UPGRADE_STORAGE_INTERVAL_NANOS = 60_000_000_000; // 60 seconds
    let MIN_CYCLE_SHARE = 250_000_000_000;
    let MANAGER_CYCLE_THRESHOLD = 1_000_000_000_000;
    let INVITE_CYCLE_SHARE = 2_000_000_000_000;
    let STORAGE_CYCLE_THRESHOLD = 250_000_000_000;
    let MIN_CYCLE_DEPOSIT = 1_000_000_000_000;
    let logger = Logger.new(10);
    let Ledger : LedgerTypes.Self = actor (LEDGER_CANISTER_ID);
    let CMC : CMCTypes.Self = actor (CYCLE_MINTING_CANISTER_ID);
    // var files : HashMap.HashMap<ID, [File]> = HashMap.HashMap<ID, [File]>(10, Text.equal, Text.hash);
    func equal(a : JournalEntry, b : JournalEntry) : Bool { Text.equal(a.id, b.id) };
    func hash({ id } : JournalEntry) : Hash.Hash { Text.hash(id) };
    var directories : BiMap.BiMap<Directory, Text> = BiMap.New(
        BiHashMap.empty<Directory, Text>(0, equal, hash),
        BiHashMap.empty<Text, Directory>(0, Text.equal, Text.hash),
        Text.equal
    );
    var files : BiMap.BiMap<File, Text> = BiMap.New(
        BiHashMap.empty<File, Text>(0, equal, hash),
        BiHashMap.empty<Text, File>(0, Text.equal, Text.hash),
        Text.equal
    );

    public shared ({ caller }) func createDirectory(directory : { id : ID; name : Text; parentId : ?ID }) : async Result.Result<Directory, DirectoryCreateError> {
        assert validateCaller(caller);
        await createDirectory_(caller, directory);
    };

    // поиск папки по id
    func getDirectoryByID(id : ?ID) : ?Directory {
        var found : ?Directory = null;
        label dirloop for (dir in directories.keys()) {
            if (?dir.id == id) {
                found := ?dir;
                break dirloop;
            };
        };
        found;
    };

    // возвращает пару (l, r) по id директории
    func getPairByID(id : ?ID) : ?(Directory, Text) {
        switch (getDirectoryByID(id)) {
            case null null;
            case (?l) {
                switch (directories.getByLeft(l)) {
                    case null null;
                    case (?r) ?(l, r);
                };
            };
        };
    };

    // // возвращает пару (l, r) по id файла
    // func getPairByFileID (id : ?ID) : ?(File, Text) {
    //     switch (getDirectoryByID(id)) {
    //         case null null;
    //         case (?l) {
    //             switch (directories.getByLeft(l)) {
    //                 case null null;
    //                 case (?r) ?(l, r);
    //             };
    //         };
    //     };
    // };

    // список директорий и файлов по id родителя
    func getChildrenByID(id : ?ID) : ([Directory], [File]) {
        let dirs : [Directory] = do {
            let buffer : Buffer.Buffer<Directory> = Buffer.Buffer<Directory>(0);
            for (dir in directories.keys()) {
                if (dir.parentId == id) {
                    buffer.add(dir);
                };
            };
            Buffer.toArray(buffer);
        };
        let files_ : [File] = do {
            let buffer : Buffer.Buffer<File> = Buffer.Buffer<File>(0);
            for (file in files.keys()) {
                if (file.parentId == id) {
                    buffer.add(file);
                };
            };
            Buffer.toArray(buffer);
        };
        (dirs, files_);
    };

    func createDirectory_(caller : Principal, directory_ : { id : ID; name : Text; parentId : ?ID }) : async Result.Result<Directory, DirectoryCreateError> {
        if (not validateName(directory_.name)) {
            return #err(#illegalCharacters);
        };
        let pair : ?(Directory, Text) = getPairByID(directory_.parentId);
        let path = switch (pair) {
            case null directory_.name;
            case (?(l, r)) r # "/" # directory_.name;
        };
        let now = Time.now();
        let directory : Directory = { directory_ and { createdAt = now; updatedAt = now; color = ?#blue; children = null; path = null } };
        switch (directories.insert(directory, path)) {
            case (#err((l, r))) {
                let found : Directory = Option.get(directories.getByRight(r), l);
                #err(#alreadyExists(found));
            };
            case (#ok) #ok(directory);
        };
    };

    public shared ({ caller }) func updateDirectory(action : DirectoryAction, fields : DirectoryUpdatableFields) : async Result.Result<Directory, { #notFound; #alreadyExists }> {
        assert validateCaller(caller);

        switch (action) {
            case (#rename id) {
                switch (getPairByID(?id)) {
                    case null #err(#notFound);
                    case (?(l, r)) {
                        let newName : Text = Option.get(fields.name, l.name);
                        let (siblingDirs : [Directory], _) = getChildrenByID(l.parentId);
                        let found : ?Directory = Array.find<Directory>(
                            siblingDirs,
                            func(dir : Directory) : Bool {
                                Text.equal(dir.name, newName) and Text.notEqual(dir.id, l.id);
                            }
                        );
                        switch (found) {
                            case null {
                                let directory : Directory = { l with updatedAt = Time.now(); name = newName };
                                ignore directories.replace(directory, r);
                                #ok(directory);
                            };
                            case (?v) #err(#alreadyExists);
                        };
                    };
                };
            };
            case (#changeColor id) {
                switch (getPairByID(?id)) {
                    case null #err(#notFound);
                    case (?(l, r)) {
                        let color : ?DirectoryColor = ?Option.get(fields.color, Option.get(l.color, #blue));
                        let directory : Directory = { l with updatedAt = Time.now(); color };
                        ignore directories.replace(directory, r);
                        #ok(directory);
                    };
                };
            };
            // case _ throw Error.reject("Wrong action");
        };
    };

    public shared ({ caller }) func moveDirectory(sourcePath : Text, targetPath : ?Text) : async Result.Result<(), DirectoryMoveError> {
        assert validateCaller(caller);
        let preparedSourcePath : Text = Text.trim(sourcePath, #text "/");
        let preparedTargetPath : ?Text = Option.map<Text, Text>(targetPath, func(text : Text) { Text.trim(text, #text "/") });
        // Text.trim(targetPath_, #text "/");
        await* moveDirectory_(preparedSourcePath, preparedTargetPath);
    };

    // Перемещение директории из одной в другу
    //-------------------------------------
    // crypto/             crypto/
    // ├─ layer1/          ├─ layer1/
    // │  ├─ ethereum      │  ├─ ethereum
    // layer1/             │  ├─ ic
    // ├─ ic               layer1
    //-------------------------------------
    // sourcePath = "layer1/ic"
    // targetPath = "crypto/layer1"
    func moveDirectory_(sourcePath : Text, targetPath : ?Text) : async* Result.Result<(), DirectoryMoveError> {
        switch (directories.getByRight(sourcePath)) {
            case null return #err(#sourceNotFound);
            case (?sourceDir) {
                let targetDir : ?Directory = switch (targetPath) {
                    case null null;
                    case (?v) directories.getByRight(v);
                };

                switch (targetPath, targetDir) {
                    case (?v, null) return #err(#targetNotFound);
                    case (?v, _) {
                        if (isTargetParentOfSource(sourcePath, v)) {
                            return #err(#invalidParams);
                        };
                    };
                    case (null, _) {};
                };

                // список директорий в папке-получателе
                let id : ?ID = switch (targetDir) {
                    case null null;
                    case (?v) ?v.id;
                };
                let targetDirs : [Directory] = getChildrenByID(id).0;
                switch (Array.find<Directory>(targetDirs, func({ name } : Directory) : Bool { Text.equal(name, sourceDir.name) })) {
                    case null {
                        let directory : Directory = { sourceDir with updatedAt = Time.now(); parentId = id };
                        let path : Text = Option.getMapped<Text, Text>(targetPath, func(v : Text) : Text { v # "/" # directory.name }, directory.name);
                        ignore directories.replace(directory, path);
                        let (sourceDirs : [Directory], sourceFiles : [File]) = getChildrenByID(?sourceDir.id);
                        await* updateSubdirPaths(directory.id, path);

                        for (file in Iter.fromArray<File>(sourceFiles)) {
                            ignore await moveFile_(sourcePath # "/" # file.name, Option.make(path));
                        };

                        #ok();
                    };
                    case (?found) {
                        let path : Text = Option.getMapped<Text, Text>(targetPath, func(v : Text) : Text { v # "/" # found.name }, found.name);
                        await* mergeDirectory_(sourcePath, path);
                    };
                };
            };
        };
    };

    func updateSubdirPaths(id : Text, path : Text) : async* () {
        let (dirs : [Directory], files_ : [File]) = getChildrenByID(?id);
                        
        for (dir in Iter.fromArray<Directory>(dirs)) {
            let newPath : Text = path # "/" # dir.name;
            ignore directories.replace(dir, newPath);
            await* updateSubdirPaths(dir.id, newPath);
        };
    };

    func isTargetParentOfSource(sourcePath : Text, targetPath : Text) : Bool {
        switch (directories.getByRight(sourcePath)) {
            case null false;
            case (?v) {
                let parents : [Directory] = getBreadcrumbs(targetPath);
                for ({ id } in Iter.fromArray<Directory>(parents)) {
                    if (Text.equal(v.id, id)) {
                        return true;
                    };
                };
                false;
            };
        };
        // let ?sourceDir : ?Directory = directories.getByRight(sourcePath) else { return false };
    };

    // Слияние двух директорий
    //-------------------------------------
    // crypto/             crypto/
    // ├─ layer1/          ├─ layer1/
    // │  ├─ ethereum      │  ├─ ethereum
    // layer1/             │  ├─ ic
    // ├─ ic
    //-------------------------------------
    // sourcePath = "layer1"
    // targetPath = "crypto/layer1"
    func mergeDirectory_(sourcePath : Text, targetPath : Text) : async* Result.Result<(), DirectoryMoveError> {
        if (Text.equal(sourcePath, targetPath)) {
            return #err(#invalidParams);
        };

        switch (directories.getByRight(sourcePath), directories.getByRight(targetPath)) {
            case (null, null) return #err(#notFound);
            case (null, _) return #err(#sourceNotFound);
            case (_, null) return #err(#targetNotFound);
            case (?sourceDir, ?targetDir) {
                // список директорий в папке-источнике
                let (sourceDirs : [Directory], _) = getChildrenByID(?sourceDir.id);
                // список директорий в папке-получателе
                let (targetDirs : [Directory], _) = getChildrenByID(?targetDir.id);

                let directory : Directory = { targetDir with updatedAt = Time.now() };
                ignore directories.replace(directory, targetPath);
                ignore directories.removeByLeft(sourceDir);

                for (sourceChildDir in sourceDirs.vals()) {
                    // если существует директория с таким же именем в папке-получателе, рекурсивно вызываем mergeDirectory
                    let found = Array.find(targetDirs, func(dir : Directory) : Bool { Text.equal(dir.name, sourceChildDir.name) });
                    switch (found) {
                        case (?v) { ignore await* mergeDirectory_(sourcePath # "/" # v.name, targetPath # "/" # v.name) };
                        case null { ignore await* moveDirectory_(sourcePath # "/" # sourceChildDir.name, ?targetPath) };
                    };
                };

                #ok();
            };
        };
    };

    // Удаление директории со всеми дочерними поддиректориями и файлами
    public shared ({ caller }) func deleteDirectory(sourcePath : Text) : async Result.Result<(), { #notFound }> {
        assert validateCaller(caller);
        let preparedPath : Text = Text.trim(sourcePath, #text "/");
        await deleteDirectory_(preparedPath);
    };

    func deleteDirectory_(sourcePath : Text) : async Result.Result<(), { #notFound }> {
        let found : ?Directory = directories.getByRight(sourcePath);
        switch found {
            case null #err(#notFound);
            case (?v) {
                let (dirs : [Directory], files : [File]) = getChildrenByID(?v.id);

                for ({ name } in Iter.fromArray<Directory>(dirs)) {
                    ignore await deleteDirectory_(sourcePath # "/" # name);
                };

                for ({ name } in Iter.fromArray<File>(files)) {
                    ignore await deleteFile_(sourcePath # "/" # name);
                };

                ignore directories.removeByRight(sourcePath);
                #ok();
            };
        };
    };

    // Создание дерева директорий
    public shared ({ caller }) func createPath(path : Text) : async () {
        assert validateCaller(caller);

        var parentId : ?ID = null;
        let preparedPath : Text = Text.trim(path, #text "/");
        let dirnames : Iter.Iter<Text> = Text.split(preparedPath, #text "/");
        for (dirname in dirnames) {
            let name = Text.trim(dirname, #text " ");
            if (Text.notEqual(name, "")) {
                let id = await Utils.generateId();
                let directory = { id; name; parentId };

                switch (await createDirectory_(caller, directory)) {
                    case (#ok(res)) parentId := ?res.id;
                    case (#err(#alreadyExists v)) parentId := ?v.id;
                    case (#err(#illegalCharacters)) throw Error.reject("Illegal characters: " # dirname);
                    // case (#err msg) throw Error.reject(msg);
                };
            };
        };
    };

    public query ({ caller }) func getJournal(path : ?Text) : async Result.Result<Journal, JournalError> {
        assert validateCaller(caller);

        let preparedPath : Text = switch (path) {
            case null "";
            case (?v) Text.trim(v, #text "/");
        };
        let id : ?ID = switch (directories.getByRight(preparedPath)) {
            case null null;
            case (?v) ?v.id;
        };

        if (Option.isSome(path) and Option.isNull(id)) {
            return #err(#notFound);
        };

        let (dirs : [Directory], files : [File]) = getChildrenByID(id);
        let breadcrumbs : [Directory] = getBreadcrumbs(preparedPath);
        #ok({ id; dirs; files; breadcrumbs });
    };

    func getBreadcrumbs(path : Text) : [Directory] {
        let dirnames : Iter.Iter<Text> = Text.split(path, #text "/");
        let buffer : Buffer.Buffer<Directory> = Buffer.Buffer<Directory>(0);
        var parentPath : ?Text = null;
        var separator = "";
        for (dirname in dirnames) {
            if (Text.notEqual(dirname, "")) {
                // Option.get(pa)
                // let currentPath : ?Text = Option.map<Text, Text>(parentPath, func (v : Text) {
                //     v # separator # dirname;
                // });
                let currentPath : Text = Option.get(parentPath, "") # separator # dirname;
                separator := "/";
                switch (directories.getByRight(currentPath)) {
                    case null {};
                    case (?v) buffer.add({ v with path = parentPath });
                };
                parentPath := ?currentPath;
            };
        };
        Buffer.toArray(buffer);
    };

    // Проверка имени директории на недопустимы символы
    public query func isDirnameValid(name : Text) : async Bool {
        validateName(name);
    };

    func validateName(name : Text) : Bool {
        for (c : Char in name.chars()) {
            let isNonPrintableChar : Bool = Char.fromNat32(0x00) <= c and c <= Char.fromNat32(0x1f);
            if (isNonPrintableChar or Text.contains("<>:/|\\?*\"", #char c)) {
                return false;
            };
        };
        true;
    };

    func repeatText(text : Text, n : Int) : Text {
        var output : Text = "";
        for (i in Iter.range(1, n)) {
            output #= text;
        };
        output;
    };

    func showSubdirsTree(id : ?ID, depth : Nat, prefix_ : ?Text, isParentLast_ : ?Bool) : Text {
        var output : Text = "";
        var i : Nat = 0;
        var isParentLast = Option.get(isParentLast_, true);
        var prefix : Text = Option.get(prefix_, "");
        if (depth > 0) { prefix #= if isParentLast "░░" else "│░" };
        let (dirs : [Directory], files : [File]) = getChildrenByID(id);
        let items : Buffer.Buffer<JournalEntry> = do {
            let buffer : Buffer.Buffer<JournalEntry> = Buffer.fromArray<JournalEntry>(dirs);
            let fBuffer : Buffer.Buffer<JournalEntry> = Buffer.fromArray<JournalEntry>(files);
            buffer.append(fBuffer);
            buffer;
        };
        let count = items.size();
        let prefixLength = prefix.size();

        for ({ id; name } in items.vals()) {
            let isLast : Bool = Nat.equal(i, count - 1);
            let node = if isLast "└─" else "├─";
            output #= "\n" # prefix # repeatText("░", depth * 2 - prefixLength) # node # name # " [" # id # "]";
            output #= showSubdirsTree(?id, depth + 1, ?prefix, ?isLast);
            i += 1;
        };
        output;
    };

    // Визуализация дерева каталогов в консоли
    /* например,
    .
    ├─crypto [uuid]
    │ └─nfts
    │   └─punks
    └─images
      └─icons
    */
    public query ({ caller }) func showDirectoriesTree(id : ?ID) : async Text {
        assert validateCaller(caller);

        let result : Text = showSubdirsTree(id, 0, null, null);
        let root = switch (id) {
            case null ".";
            case (?v) {
                switch (getDirectoryByID(?v)) {
                    case null ".";
                    case (?{ id; name }) name # " [" # id # "]";
                };
            };
        };
        "\n" # root # result # "\n";
    };

    public shared ({ caller }) func addFile(file_ : FileCreate) : async Result.Result<File, FileCreateError> {
        assert not Principal.isAnonymous(caller);
        // assert Principal.equal(caller, owner);
        assert isStorage(caller);

        if (not validateName(file_.name)) {
            return #err(#illegalCharacters);
        };
        let pair : ?(Directory, Text) = getPairByID(file_.parentId);
        let path = switch (pair) {
            case null file_.name;
            case (?(l, r)) r # "/" # file_.name;
        };
        let now = Time.now();
        let file : File = { file_ and { createdAt = now; updatedAt = now } };
        // TODO: замена и удаление файлов из хранилища
        ignore files.replace(file, path);
        #ok(file);
        // switch (files.insert(file, path)) {
        //     case (#err((l, r))) {
        //         let found : File = Option.get(files.getByRight(r), l);
        //         #err(#alreadyExists(found));
        //     };
        //     case (#ok) #ok(file);
        // };
    };

    public shared ({ caller }) func deleteFile(sourcePath : Text) : async Result.Result<(), { #notFound }> {
        assert validateCaller(caller);
        let preparedPath : Text = Text.trimStart(sourcePath, #text "/");
        await deleteFile_(preparedPath);
    };

    func deleteFile_(sourcePath : Text) : async Result.Result<(), { #notFound }> {
        switch (files.removeByRight(sourcePath)) {
            case null #err(#notFound);
            case (?(file, _)) {
                let storageBucket : actor { delete : shared (id : ID) -> async () } = actor (Principal.toText(file.bucketId));
                ignore storageBucket.delete(file.id);
                #ok();
            };
        };
    };

    public shared ({ caller }) func moveFile(sourceFullPath : Text, targetPath : ?Text) : async Result.Result<(), FileMoveError> {
        assert validateCaller(caller);
        let preparedSourceFullPath : Text = Text.trimStart(sourceFullPath, #text "/");
        let preparedTargetPath : ?Text = Option.map<Text, Text>(targetPath, func(text : Text) { Text.trim(text, #text "/") });
        await moveFile_(preparedSourceFullPath, preparedTargetPath);
    };

    func moveFile_(sourceFullPath : Text, targetPath : ?Text) : async Result.Result<(), FileMoveError> {
        switch (files.getByRight(sourceFullPath)) {
            case null return #err(#sourceNotFound);
            case (?sourceFile) {
                let targetDir : ?Directory = switch (targetPath) {
                    case null null;
                    case (?v) directories.getByRight(v);
                };

                if (Option.isSome(targetPath) and Option.isNull(targetDir)) {
                    return #err(#targetNotFound);
                };

                // список файлов в папке-получателе
                let id : ?ID = switch (targetDir) {
                    case null null;
                    case (?v) ?v.id;
                };
                let targetFiles : [File] = getChildrenByID(id).1;
                let found : ?File = Array.find<File>(targetFiles, func({ name } : File) : Bool { Text.equal(name, sourceFile.name) });
                let file : File = { sourceFile with updatedAt = Time.now(); parentId = id };
                let path : Text = Option.getMapped<Text, Text>(targetPath, func(v : Text) : Text { v # "/" # file.name }, file.name);

                if (Option.isSome(found)) {
                    ignore await deleteFile_(path);
                };

                ignore files.replace(file, path);
                #ok();
            };
        };

        // if (Text.equal(sourceFullPath, targetPath)) {
        //     return #err(#invalidParams);
        // };

        // switch (files.getByRight(sourceFullPath), directories.getByRight(targetPath)) {
        //     case (null, null) return #err(#notFound);
        //     case (null, _) return #err(#sourceNotFound);
        //     case (_, null) return #err(#targetNotFound);
        //     case (?sourceFile, ?targetDir) {
        //         let (_, targetFiles : [File]) = getChildrenByID(?targetDir.id);
        //         let found : ?File = Array.find<File>(targetFiles, func({ name } : File) : Bool { Text.equal(name, sourceFile.name) });
        //         let file : File = { sourceFile with updatedAt = Time.now(); parentId = ?targetDir.id };
        //         let path : Text = targetPath # "/" # file.name;

        //         if (Option.isSome(found)) {
        //             ignore await deleteFile_(path);
        //         };

        //         ignore files.replace(file, path);
        //         #ok();
        //     };
        // };
    };

    stable var stableDirectories : [(Directory, Text)] = [];
    stable var stableFiles : [(File, Text)] = [];
    // stable var stableCanisters : [Canister] = [];

    system func preupgrade() {
        stableDirectories := Iter.toArray(directories.entries());
        stableFiles := Iter.toArray(files.entries());
        // stableCanisters := Iter.toArray(topup.preupgrade());
    };

    system func postupgrade() {
        directories := BiMap.fromIter<Directory, Text>(
            stableDirectories.vals(),
            BiHashMap.empty<Directory, Text>(0, equal, hash),
            BiHashMap.empty<Text, Directory>(0, Text.equal, Text.hash),
            Text.equal
        );
        stableDirectories := [];
        files := BiMap.fromIter<File, Text>(
            stableFiles.vals(),
            BiHashMap.empty<File, Text>(0, equal, hash),
            BiHashMap.empty<Text, File>(0, Text.equal, Text.hash),
            Text.equal
        );
        stableFiles := [];

        restartTimers();
        // topup.postupgrade(stableCanisters);
        // stableCanisters := [];
    };

    func restartTimers() : () {
        for ((_, { canisterId }) in Trie.iter(canisters)) {
            // startBucketMonitor_(canisterId);
        };
    };

    stable var storageBuckets : TrieSet.Set<BucketId> = TrieSet.empty<BucketId>();

    let ic : IC.Self = actor "aaaaa-aa";
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
        ignore startBucketMonitor_(canister_id);
        canister_id;
    };

    // Удаление канистры пользователя
    func deleteStorageBucket(caller : Principal, bucketId : BucketId) : async Result.Result<(), Text> {
        switch (isStorage(bucketId)) {
            case false #err("Bucket " # Principal.toText(bucketId) # " not found. " # Principal.toText(caller));
            case true {
                try {
                    await ic.uninstall_code({ canister_id = bucketId });
                    ignore await (system Wallet.Wallet)(#install bucketId)();
                    let wallet : actor { transferCycles : shared (canisterId : Principal) -> async () } = actor (Principal.toText(bucketId));
                    await wallet.transferCycles(Principal.fromActor(this));
                    await ic.stop_canister({ canister_id = bucketId });
                    await ic.delete_canister({ canister_id = bucketId });
                    storageBuckets := TrieSet.delete<BucketId>(storageBuckets, bucketId, Principal.hash(bucketId), Principal.equal);
                    #ok();
                } catch err {
                    #err(Error.message(err));
                };
            };
        };
    };

    // TODO: удаление всех файлов в журнале из канистры-хранилища
    public shared ({ caller }) func deleteStorage(bucketId : BucketId) : async () {
        assert validateCaller(caller);
        // assert not Principal.isAnonymous(caller) or Principal.equal(caller, owner) or Principal.equal(caller, installer) or Utils.isAdmin(caller);
        ignore deleteStorageBucket(caller, bucketId);
    };

    public query ({ caller }) func listStorages() : async [BucketId] {
        assert not Principal.isAnonymous(caller);
        assert Principal.equal(caller, owner) or Principal.equal(caller, installer) or Utils.isAdmin(caller);

        TrieSet.toArray<BucketId>(storageBuckets);
    };

    func isStorage(bucketId : BucketId) : Bool {
        TrieSet.mem<BucketId>(storageBuckets, bucketId, Principal.hash(bucketId), Principal.equal);
    };

    public shared ({ caller }) func canisterStatus(canisterId : Principal) : async {
        id : Principal;
        status : IC.canister_status_response;
        freezingThresholdInCycles : Nat;
    } {
        assert not Principal.isAnonymous(caller) and (Principal.equal(caller, owner) or Utils.isAdmin(caller));
        let status = await ic.canister_status({ canister_id = canisterId });
        // let memorySize = Float.fromInt(Nat.)
        // let float: Float = Float.div(status.memory_size, 1024 * 1024 * 1024);
        let freezingThresholdInCycles = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
        { id = canisterId; status; freezingThresholdInCycles };
    };

    // Логика по обновлению storage-канистр
    // - администратор загружает в пользовательскую канистру журнала wasm-модуль storage-канистры
    // - вызывает upgradeStorages, которая создает очередь из storage-канистр, запускает рекурсивный таймер (интервал)
    // - раз в минуту происходит обновление одной канистры, обновленная канистра удаляется из очереди
    // - когда очередь заканчивается, таймер отменяется

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
            // let storageBucket : StorageBucket.Storage = actor (Principal.toText(bucketId));
            // ignore await (system StorageBucket.Storage)(#upgrade storageBucket)(owner);

            await ic.install_code({
                arg = to_candid (owner);
                wasm_module = Blob.fromArray(storageWasm);
                mode = #upgrade;
                canister_id = bucketId;
            });
        };

        // storageQueue := List.fromArray<BucketId>(TrieSet.toArray<BucketId>(storageBuckets));
        // let timerId = recurringTimer(#seconds 60, func job() : async () {
        //     switch (List.pop<BucketId>(storageQueue)) {
        //         case (null, _) {};
        //         case (?canisterId, newStorageQueue) {
        //             ignore upgradeStorage(canisterId);
        //             storageQueue := newStorageQueue;
        //         };
        //     };
        // });
    };

    let MEMO_CREATE_CANISTER : LedgerTypes.Memo = 0x41455243; // == 'CREA'
    let MEMO_TOP_UP_CANISTER : LedgerTypes.Memo = 0x50555054; // == 'TPUP'
    let FEE : Nat64 = 10_000;
    let CHECK_INTERVAL_SECONDS : Nat = 20;
    // stable var canisters : List.List<Canister> = List.nil<Canister>();
    stable var canisters : Trie.Trie<BucketId, Canister> = Trie.empty<BucketId, Canister>();
    // stable var topupQueue : List.List<Canister> = List.nil<Canister>();
    var topupQueue : List.List<Topup> = List.nil();
    stable var depositQueue : List.List<BucketId> = List.nil();
    var toppingUp : ?BucketId = null;
    var depositing : Bool = false;

    // public shared ({ caller }) func topupCanister(value : Topup) : async () {
    //     assert not Principal.isAnonymous(caller);
    //     assert isStorage(caller) or Utils.isAdmin(caller);

    //     let isInTopupQueue = List.some<Topup>(topupQueue, func({ canisterId }) { Principal.equal(value.canisterId, canisterId) });
    //     if (not isInTopupQueue) {
    //         topupQueue := List.push<Topup>(value, topupQueue);
    //     };
    // };

    // запуск мониторинга состояния баланса канистры
    public shared ({ caller }) func startBucketMonitor(canisterId : BucketId) : async () {
        assert not Principal.isAnonymous(caller) and (Principal.equal(caller, owner) or Utils.isAdmin(caller));
        await startBucketMonitor_(canisterId);
    };

    func startBucketMonitor_(canisterId : BucketId) : async () {
        let found : ?Canister = Trie.get<BucketId, Canister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal);
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
        let value : Canister = { defaults with timerId = ?timerId; monitoring = #running; error = null };
        canisters := Trie.put<BucketId, Canister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal, value).0;
    };

    // остановка мониторинга
    public shared ({ caller }) func stopBucketMonitor(canisterId : BucketId) : async () {
        assert not Principal.isAnonymous(caller) and (Principal.equal(caller, owner) or Utils.isAdmin(caller));
        await stopBucketMonitor_(canisterId);
    };

    func stopBucketMonitor_(canisterId : BucketId) : async () {
        switch (Trie.get<BucketId, Canister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal)) {
            case null {};
            case (?canister) {
                switch (canister.timerId) {
                    case null {};
                    case (?timerId) cancelTimer(timerId);
                };

                let value : Canister = { canister with timerId = null; monitoring = #stopped };
                canisters := Trie.put<BucketId, Canister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal, value).0;
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

    // func cyclesToE8s(cycles : Nat) : async Tokens {
    //     let { data } = await CMC.get_icp_xdr_conversion_rate();
    //     let account : A.AccountIdentifier = accountIdentifier_();
    //     let balance = await Ledger.account_balance({ account });
    //     let e8s : Nat64 = Int64.toNat64(Float.toInt64(Float.div(Float.fromInt(Int.abs(cycles)), Float.fromInt64(Int64.fromNat64(data.xdr_permyriad_per_icp)) * 100_000_000) * 100_000_000));
    //     { e8s = Nat64.max(Nat64.fromNat(0), Nat64.sub(Nat64.min(e8s, balance.e8s), FEE)) };
    // };

    // пополнение текущей канистры
    // func depositCycles() : async Result.Result<{ cycles : Nat }, { #transfer : LedgerTypes.TransferError; #notify : CMCTypes.NotifyError }> {
    //     let amount : Tokens = switch(await cyclesToE8s(MIN_CYCLE_DEPOSIT)) {
    //         case (#ok amount) amount;
    //         case (#err balance) {
    //             { e8s = Nat64.max(Nat64.fromNat(0), Nat64.sub(balance.e8s, FEE)) };
    //         };
    //     };
    //     await depositCycles_(Principal.fromActor(this), amount);
    // };

    // пополнение канистры циклами из Cycles Minting Canister путем сжигания ICP на внутреннем балансе пользователя
    func depositCycles(amount : Tokens) : async Result.Result<{ cycles : Nat }, { #transfer : LedgerTypes.TransferError; #notify : CMCTypes.NotifyError }> {
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

    // stable var ongoingTransactions : TrieSet.Set<Principal> = TrieSet.empty<Principal>();

    // вывод средств из пользовательского аккаунта
    public shared ({ caller }) func withdraw({ amount : LedgerTypes.Tokens; to : ?A.AccountIdentifier }) : async LedgerTypes.TransferResult {
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

    // public shared ({ caller }) func depositInfo() : async {
    //     account : A.AccountIdentifier;
    //     subaccount : A.Subaccount;
    //     balance : { e8s : Nat64 };
    // } {
    //     assert Utils.isAdmin(caller);
    //     let subaccount : A.Subaccount = A.principalToSubaccount(owner);
    //     let defaultSubaccount : A.Subaccount = A.defaultSubaccount();
    //     // let account : A.AccountIdentifier = A.accountIdentifier(Principal.fromText(LEDGER_CANISTER_ID), subaccount);
    //     let account : A.AccountIdentifier = A.accountIdentifier(owner, defaultSubaccount);
    //     // let account : A.AccountIdentifier = A.accountIdentifier(Principal.fromActor(this), subaccount);
    //     let balance = await Ledger.account_balance({ account });
    //     { account; subaccount; balance };
    // };

    // public shared ({ caller }) func deposit() : async () {
    //     ignore depositCycles();
    // };

    // system func heartbeat() : async () {
    //     ignore topup();
    // };

    // system func timer(set : Nat64 -> ()) : async () {
    //     set(Nat64.fromIntWrap(Time.now() + CHECK_INTERVAL_NANOS));
    //     ignore checkBalance();
    // };

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
                let amount : Tokens = switch(await cyclesToE8s(MIN_CYCLE_DEPOSIT)) {
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
        let found : ?Canister = Trie.get<BucketId, Canister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal);
        switch (found) {
            case null {};
            case (?canister) {
                let now = Time.now();
                let updatedCanister = try {
                    let status = await ic.canister_status({ canister_id = canister.canisterId });
                    let value : Canister = { canister with status = ?status; lastChecked = now };
                    let freezingThresholdInCycles = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
                    let availableCycles = Nat.sub(status.cycles, freezingThresholdInCycles);
                    let amount : Nat = Nat.max(STORAGE_CYCLE_THRESHOLD, status.idle_cycles_burned_per_day * 10);
                    let isInTopupQueue = List.some<Topup>(topupQueue, func({ canisterId = id }) { Principal.equal(id, value.canisterId) });
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
                canisters := Trie.put<BucketId, Canister>(canisters, Utils.keyPrincipal(canisterId), Principal.equal, updatedCanister).0;
            };
        };
    };

    public query func getCanisters() : async [Canister] {
        Buffer.toArray(
            Trie.fold<BucketId, Canister, Buffer.Buffer<Canister>>(
                canisters,
                func(_, canister, buffer) {
                    buffer.add(canister);
                    buffer;
                },
                Buffer.Buffer<Canister>(Trie.size(canisters))
            )
        );
    };

    // конвертация циклов в ICP
    func cyclesToE8s(cyclesAmount : Nat) : async Result.Result<Tokens, Tokens> {
        let { data } = await CMC.get_icp_xdr_conversion_rate();
        let account : A.AccountIdentifier = accountIdentifier_();
        let balance : Tokens = await Ledger.account_balance({ account });
        let e8s : Nat64 = Int64.toNat64(Float.toInt64(Float.div(Float.fromInt(Int.abs(cyclesAmount)), Float.fromInt64(Int64.fromNat64(data.xdr_permyriad_per_icp)) * 100_000_000) * 100_000_000));
        if (Nat64.greaterOrEqual(balance.e8s, Nat64.add(e8s, FEE))) {
            #ok({ e8s });
        } else {
            #err balance;
        }
    };

    public shared ({ caller }) func createInvite(expiredAt : Time.Time) : async Result.Result<(), {
        #transfer : LedgerTypes.TransferError;
        #notify : CMCTypes.NotifyError;
        #insufficientFunds : { balance : Tokens }
    }> {
        assert validateCaller(caller);
        let self = Principal.fromActor(this);
        // let amount : Tokens = switch(await cyclesToE8s(INVITE_CYCLE_SHARE)) {
        //     case (#ok amount) amount;
        //     case (#err balance) balance;
        // };
        // let result = await depositCycles(installer, amount);
        // switch (result) {
        //     case (#ok cycles) {

        //         #ok();
        //     };
        //     case (#err err) #err err;
        // };
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
        Debug.print("[invite] before create " # debug_show({ canisterId = self; balance; freezingThresholdInCycles }));
        if (burnICP) {
            cyclesShare := switch(await cyclesToE8s(INVITE_CYCLE_SHARE)) {
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

        Debug.print("[invite] create " # debug_show({ canisterId = self; cycles = cyclesShare; }));
        let manager : actor { createInvite : shared (value : InviteCreate) -> async () } = actor (Principal.toText(installer));
        Cycles.add(cyclesShare);
        await manager.createInvite({
            owner = caller;
            expiredAt;
            cycles = cyclesShare;
        });
        #ok();
        // let freezingThresholdInCycles2 = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
        // Debug.print("[main] createInvite " # debug_show({ status; freezingThresholdInCycles; freezingThresholdInCycles2 }));

        // switch(await cyclesToE8s(INVITE_CYCLE_SHARE)) {
        //     case (#ok amount) {
        //         let result = await depositCycles(self, amount);
        //         switch (result) {
        //             case (#ok { cycles }) {
        //                 ignore Cycles.accept(cycles);
        //                 Debug.print("[invite] create " # debug_show({ canisterId = self; cycles; }));
        //                 let manager : actor { createInvite : shared (value : InviteCreate) -> async () } = actor (Principal.toText(installer));
        //                 Cycles.add(cycles);
        //                 await manager.createInvite({
        //                     owner = caller;
        //                     expiredAt;
        //                     cycles;
        //                 });
        //                 #ok();
        //             };
        //             case (#err err) #err err;
        //         };
        //     };
        //     case (#err balance) {
        //         #err(#insufficientFunds({ balance }));
        //     };
        // };
    };

    func getFreezingThresholdInCycles(canisterId : Principal) : async Nat {
        let status = await ic.canister_status({ canister_id = canisterId });
        Int.abs(Float.toInt(Float.mul(Float.div(Float.fromInt(status.idle_cycles_burned_per_day), Float.fromInt(86400)), Float.fromInt(Int.abs(status.settings.freezing_threshold)))));
    };

    func validateCaller(caller : Principal) : Bool {
        not Principal.isAnonymous(caller) and Principal.equal(caller, owner);
    };
};
