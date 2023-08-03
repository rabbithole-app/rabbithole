import Map "mo:hashmap/Map";
import Types "types";
import Buffer "mo:base/Buffer";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import Char "mo:base/Char";
import Text "mo:base/Text";
import Option "mo:base/Option";
import Time "mo:base/Time";
import Utils "../utils/utils";
import Array "mo:base/Array";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Error "mo:base/Error";
import Prelude "mo:base/Prelude";
import Debug "mo:base/Debug";
import IC "mo:base/ExperimentalInternetComputer";
import Hex "mo:encoding/Hex";
import VETKD_SYSTEM_API "canister:vetkd_system_api";
import VetKDTypes "../types/vetkd_types";
import Blob "mo:base/Blob";

module {
    type ID = Text;
    type Entry = Types.Entry;
    type File = Types.File;
    type FileCreate = Types.FileCreate;
    type FileExtended = Types.FileExtended;
    type FileCreateError = Types.FileCreateError;
    type CreatePath = Types.CreatePath;
    type Directory = Types.Directory;
    type EntryCreate = Types.EntryCreate;
    type DirectoryCreateError = Types.DirectoryCreateError;
    type DirectoryMoveError = Types.DirectoryMoveError;
    type DirectoryAction = Types.DirectoryAction;
    type DirectoryColor = Types.DirectoryColor;
    type DirectoryUpdatableFields = Types.DirectoryUpdatableFields;
    type FileMoveError = Types.FileMoveError;
    type DirectoryState = Types.DirectoryState;
    type DirectoryStateError = Types.DirectoryStateError;
    type NotFoundError = Types.NotFoundError;
    type AlreadyExistsError<T> = Types.AlreadyExistsError<T>;
    type SharedFile = Types.SharedFile;
    type SharedFileParams = Types.SharedFileParams;
    type SharedFileExtended = Types.SharedFileExtended;
    type VetKDKeyId = VetKDTypes.VetKDKeyId;
    type VetKDPublicKeyRequest = VetKDTypes.VetKDPublicKeyRequest;
    type VetKDPublicKeyReply = VetKDTypes.VetKDPublicKeyReply;
    type VetKDEncryptedKeyRequest = VetKDTypes.VetKDEncryptedKeyRequest;
    type VetKDEncryptedKeyReply = VetKDTypes.VetKDEncryptedKeyReply;
    type JournalArgs = { owner : Principal; installer : Principal };

    public type Journal = {
        putDirs : Iter.Iter<(Text, Directory)> -> ();
        // putDirs : [(Text, Directory)] -> ();
        putFiles : Iter.Iter<(Text, File)> -> ();
        putSharedFiles : Iter.Iter<(ID, SharedFile)> -> ();
        // putFiles : [(Text, File)] -> ();
        listDirs : ?ID -> [Directory];
        listDirsExtend : ?ID -> [Directory];
        listFiles : ?ID -> [File];
        listFilesExtend : ?ID -> [FileExtended];
        checkDirname : EntryCreate -> Result.Result<(), DirectoryCreateError>;
        checkFilename : EntryCreate -> Result.Result<(), FileCreateError>;
        getJournal : (?Text) -> Result.Result<DirectoryState, DirectoryStateError>;
        createDir : EntryCreate -> async Result.Result<Directory, DirectoryCreateError>;
        moveDir : (Text, ?Text) -> async* Result.Result<(), DirectoryMoveError>;
        mergeDir : (Text, Text) -> async* Result.Result<(), DirectoryMoveError>;
        moveFile : (Text, ?Text) -> async Result.Result<(), FileMoveError>;
        deleteDir : Text -> async Result.Result<(), { #notFound }>;
        deleteFile : Text -> async Result.Result<(), { #notFound }>;
        renameFile : (Text, Text) -> Result.Result<File, NotFoundError or { #illegalCharacters } or AlreadyExistsError<File>>;
        updateDir : (DirectoryAction, DirectoryUpdatableFields) -> async* Result.Result<Directory, NotFoundError or AlreadyExistsError<Directory>>;
        showDirectoriesTree : ?ID -> Text;
        createPaths : ([Text], [ID], ?ID) -> async [(Text, ID)];
        putFile : FileCreate -> async Result.Result<File, FileCreateError>;
        shareFile : (ID, SharedFileParams, Principal) -> async Result.Result<FileExtended, { #notFound }>;
        unshareFile : ID -> async Result.Result<FileExtended, { #notFound }>;
        sharedWithMe : Principal -> [SharedFileExtended];
        setFileEncryptedSymmetricKey : (ID, Blob) -> async Text;
        getFileEncryptedSymmetricKey : (Principal, ID, Blob) -> async Text;
        fileVetkdPublicKey : (ID, [Blob]) -> async Text;
        preupgrade : () -> ([(Text, Directory)], [(Text, File)], [(ID, SharedFile)]);
        // postupgrade : (([(Text, Directory)], [(Text, File)])) -> ();
    };

    public class New({ owner; installer } : JournalArgs) : Journal {
        let { thash } = Map;
        var directories : Map.Map<Text, Directory> = Map.new<Text, Directory>(thash);
        var files : Map.Map<Text, File> = Map.new<Text, File>(thash);
        var sharedFiles : Map.Map<ID, SharedFile> = Map.new<ID, SharedFile>(thash);

        public func putDirs(iter : Iter.Iter<(Text, Directory)>) : () {
            directories := Map.fromIter<Text, Directory>(iter, thash);
        };

        public func putFiles(iter : Iter.Iter<(Text, File)>) : () {
            files := Map.fromIter<Text, File>(iter, thash);
        };

        public func putSharedFiles(iter : Iter.Iter<(ID, SharedFile)>) : () {
            sharedFiles := Map.fromIter<ID, SharedFile>(iter, thash);
        };

        // список директорий по id родителя
        public func listDirs(id : ?ID) : [Directory] {
            let filtered = Map.filter<Text, Directory>(directories, thash, func(k, v) = v.parentId == id);
            Iter.toArray(Map.vals(filtered));
        };

        func getDirSize(path : Text) : Nat {
            var size = 0;
            for ((fpath, file) in Map.entries(files)) {
                if (Text.startsWith(fpath, #text(path # "/"))) {
                    size += file.fileSize;
                };
            };
            size;
        };

        public func listDirsExtend(id : ?ID) : [Directory] {
            let filtered = Map.filter<Text, Directory>(directories, thash, func(k, v) = v.parentId == id);
            let buffer : Buffer.Buffer<Directory> = Buffer.Buffer(Map.size(filtered));
            for ((path, dir) in Map.entries(filtered)) {
                let children = (listDirs(?dir.id), listFiles(?dir.id));
                buffer.add({ dir with path; children = ?children; size = ?getDirSize(path) });
            };
            Buffer.toArray(buffer);
        };

        func listDirEntries(id : ?ID) : [(Text, Directory)] {
            let filtered = Map.filter<Text, Directory>(directories, thash, func(k, v) = v.parentId == id);
            Iter.toArray(Map.entries(filtered));
        };

        func listFileEntries(id : ?ID) : [(Text, File)] {
            let filtered = Map.filter<Text, File>(files, thash, func(k, v) = v.parentId == id);
            Iter.toArray(Map.entries(filtered));
        };

        // список файлов по id родителя
        public func listFiles(id : ?ID) : [File] {
            let filtered = Map.filter<Text, File>(files, thash, func(k, v) = v.parentId == id);
            Iter.toArray(Map.vals(filtered));
        };

        public func listFilesExtend(id : ?ID) : [FileExtended] {
            let filtered = Map.filter<Text, File>(files, thash, func(k, v) = v.parentId == id);
            let extendedMap = Map.map<Text, File, FileExtended>(
                filtered,
                thash,
                func(path, file) = switch (Map.get(sharedFiles, thash, file.id)) {
                    case (?{ journalId; sharedWith; timelock; limitDownloads }) {
                        { file and { share = ?{ journalId; sharedWith; timelock; limitDownloads } } };
                    };
                    case null {
                        { file and { share = null } };
                    };
                }
            );
            Iter.toArray(Map.vals(extendedMap));
        };

        func findDir(id : ID) : ?Directory {
            let ?(path, dir) = findDirEntry(id) else return null;
            ?dir;
        };

        func findPath(id : ID) : ?Text {
            let ?(path, dir) = findDirEntry(id) else return null;
            ?path;
        };

        func findDirEntry(id : ID) : ?(Text, Directory) {
            Map.find<Text, Directory>(directories, func(k, v) = v.id == id);
        };

        func findFileEntry(id : ID) : ?(Text, File) {
            Map.find<Text, File>(files, func(k, v) = v.id == id);
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

        public func checkDirname(dir : EntryCreate) : Result.Result<(), DirectoryCreateError> {
            if (not validateName(dir.name)) return #err(#illegalCharacters);
            let path : Text = switch (dir.parentId) {
                case null dir.name;
                case (?v) {
                    let ?path = findPath(v) else return #err(#parentNotFound);
                    path # "/" # dir.name;
                };
            };
            switch (Map.get(directories, thash, path)) {
                case (?v) #err(#alreadyExists(v));
                case null #ok();
            };
        };

        public func checkFilename(file : EntryCreate) : Result.Result<(), FileCreateError> {
            if (not validateName(file.name)) return #err(#illegalCharacters);
            let path : Text = switch (file.parentId) {
                case null file.name;
                case (?v) {
                    let ?path = findPath(v) else return #err(#parentNotFound);
                    path # "/" # file.name;
                };
            };
            switch (Map.get(files, thash, path)) {
                case (?v) #err(#alreadyExists(v));
                case null #ok();
            };
        };

        func getBreadcrumbs(path : Text) : [Directory] {
            let dirnames : Iter.Iter<Text> = Text.split(path, #char '/');
            let buffer : Buffer.Buffer<Directory> = Buffer.Buffer<Directory>(0);
            var parentPath : ?Text = null;
            label dirLoop for (dirname in dirnames) {
                if (Text.equal(dirname, "")) continue dirLoop;
                let currentPath : Text = switch (parentPath) {
                    case null dirname;
                    case (?v) v # "/" # dirname;
                };
                switch (Map.get<Text, Directory>(directories, thash, currentPath)) {
                    case null {};
                    case (?v) buffer.add({ v with path = currentPath });
                };
                parentPath := ?currentPath;
            };
            let arr = Buffer.toArray(buffer);
            // buffer.clear();
            arr;
        };

        public func getJournal(path : ?Text) : Result.Result<DirectoryState, DirectoryStateError> {
            let (id, breadcrumbs) : (?ID, [Directory]) = switch (path) {
                case null (null, []);
                case (?v) {
                    let path = Text.trim(v, #char '/');
                    let ?{ id } : ?Directory = Map.get<Text, Directory>(directories, thash, path) else return #err(#notFound);
                    (?id, getBreadcrumbs(path));
                };
            };
            #ok({ id; dirs = listDirsExtend(id); files = listFilesExtend(id); breadcrumbs });
        };

        public func createDir({ name; parentId } : EntryCreate) : async Result.Result<Directory, DirectoryCreateError> {
            if (not validateName(name)) return #err(#illegalCharacters);
            let path : Text = switch (parentId) {
                case null name;
                case (?v) {
                    let ?path = findPath(v) else return #err(#parentNotFound);
                    path # "/" # name;
                };
            };
            switch (Map.get<Text, Directory>(directories, thash, path)) {
                case (?v) #err(#alreadyExists(v));
                case null {
                    let now = Time.now();
                    let id = await Utils.generateId();
                    let directory : Directory = {
                        id;
                        name;
                        parentId;
                        createdAt = now;
                        updatedAt = now;
                        color = ? #blue;
                        children = null;
                        path;
                        size = null;
                        encrypted = false;
                    };
                    Map.set(directories, thash, path, directory);
                    #ok directory;
                };
            };
        };

        // func createDirSync({ id; name; parentId } : DirectoryCreate and { id : ID }) : Result.Result<Directory, DirectoryCreateError> {
        //     if (not validateName(name)) return #err(#illegalCharacters);
        //     let path : Text = switch (parentId) {
        //         case null name;
        //         case (?v) {
        //             let ?path = findPath(v) else return #err(#parentNotFound);
        //             path # "/" # name;
        //         };
        //     };
        //     let ?found : ?Directory = Map.get<Text, Directory>(directories, thash, path) else {
        //         let now = Time.now();
        //         let directory : Directory = { id; name; parentId; createdAt = now; updatedAt = now; color = ?#blue; children = null; path = null };
        //         ignore Map.put(directories, thash, path, directory);
        //         return #ok directory;
        //     };
        //     #err(#alreadyExists(found));
        // };

        func isTargetParentOfSource(sourcePath : Text, targetPath : Text) : Bool {
            switch (Map.get<Text, Directory>(directories, thash, sourcePath)) {
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
        };

        func updateSubdirPaths(id : Text, path : Text) : async* () {
            let dirEntries : [(Text, Directory)] = listDirEntries(?id);
            let fileEntries : [(Text, File)] = listFileEntries(?id);

            for ((key, value) in Iter.fromArray<(Text, File)>(fileEntries)) {
                ignore await moveFile(key, ?path);
            };

            for ((key, value) in Iter.fromArray<(Text, Directory)>(dirEntries)) {
                Map.delete(directories, thash, key);
                let newPath : Text = path # "/" # value.name;
                Map.set(directories, thash, newPath, value);
                await* updateSubdirPaths(value.id, newPath);
            };
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
        public func moveDir(sourcePath : Text, targetPath : ?Text) : async* Result.Result<(), DirectoryMoveError> {
            let ?sourceDir : ?Directory = Map.remove<Text, Directory>(directories, thash, sourcePath) else return #err(#sourceNotFound);
            let targetDir : ?Directory = switch (targetPath) {
                case null null;
                case (?v) Map.get<Text, Directory>(directories, thash, v);
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
            let targetDirs : [Directory] = listDirs(id);
            switch (Array.find<Directory>(targetDirs, func({ name } : Directory) : Bool { Text.equal(name, sourceDir.name) })) {
                case null {
                    let path : Text = Option.getMapped<Text, Text>(targetPath, func v = v # "/" # sourceDir.name, sourceDir.name);
                    let directory : Directory = { sourceDir with updatedAt = Time.now(); parentId = id; path };
                    ignore Map.put(directories, thash, path, directory);
                    let sourceDirs : [Directory] = listDirs(?sourceDir.id);
                    let sourceFiles : [File] = listFiles(?sourceDir.id);
                    await* updateSubdirPaths(directory.id, path);

                    for (file in Iter.fromArray<File>(sourceFiles)) {
                        ignore await moveFile(sourcePath # "/" # file.name, ?path);
                    };

                    #ok();
                };
                case (?found) {
                    let path : Text = Option.getMapped<Text, Text>(targetPath, func v = v # "/" # found.name, found.name);
                    await* mergeDir(sourcePath, path);
                };
            };
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
        public func mergeDir(sourcePath : Text, targetPath : Text) : async* Result.Result<(), DirectoryMoveError> {
            if (Text.equal(sourcePath, targetPath)) return #err(#invalidParams);

            switch (Map.get<Text, Directory>(directories, thash, sourcePath), Map.get<Text, Directory>(directories, thash, targetPath)) {
                case (null, null) return #err(#notFound);
                case (null, _) return #err(#sourceNotFound);
                case (_, null) return #err(#targetNotFound);
                case (?sourceDir, ?targetDir) {
                    // список директорий в папке-источнике
                    let sourceDirs : [Directory] = listDirs(?sourceDir.id);
                    // список директорий в папке-получателе
                    let targetDirs : [Directory] = listDirs(?targetDir.id);

                    let directory : Directory = { targetDir with updatedAt = Time.now() };
                    ignore Map.put(directories, thash, targetPath, directory);
                    Map.delete(directories, thash, sourcePath);

                    for (sourceChildDir in sourceDirs.vals()) {
                        // если существует директория с таким же именем в папке-получателе, рекурсивно вызываем mergeDirectory
                        let found = Array.find(targetDirs, func(dir : Directory) : Bool { Text.equal(dir.name, sourceChildDir.name) });
                        switch (found) {
                            case (?v) { ignore await* mergeDir(sourcePath # "/" # v.name, targetPath # "/" # v.name) };
                            case null { ignore await* moveDir(sourcePath # "/" # sourceChildDir.name, ?targetPath) };
                        };
                    };

                    #ok();
                };
            };
        };

        public func moveFile(sourceFullPath : Text, targetPath : ?Text) : async Result.Result<(), FileMoveError> {
            let ?sourceFile = Map.remove<Text, File>(files, thash, sourceFullPath) else return #err(#sourceNotFound);
            let id : ?ID = switch (targetPath) {
                case null null;
                case (?v) {
                    let ?{ id } : ?Directory = Map.get<Text, Directory>(directories, thash, v) else return #err(#targetNotFound);
                    ?id;
                };
            };

            // список файлов в папке-получателе
            let targetFiles : [File] = listFiles(id);
            let found : ?File = Array.find<File>(targetFiles, func({ name } : File) = Text.equal(name, sourceFile.name));
            let path : Text = Option.getMapped<Text, Text>(targetPath, func v = v # "/" # sourceFile.name, sourceFile.name);
            let file : File = { sourceFile with updatedAt = Time.now(); parentId = id; path };

            if (Option.isSome(found)) {
                ignore await deleteFile(path);
            };

            Map.set(files, thash, path, file);
            #ok();
        };

        public func deleteDir(sourcePath : Text) : async Result.Result<(), { #notFound }> {
            let ?dir : ?Directory = Map.remove<Text, Directory>(directories, thash, sourcePath) else return #err(#notFound);
            let dirs : [Directory] = listDirs(?dir.id);
            let files : [File] = listFiles(?dir.id);

            for ({ name } in Iter.fromArray<Directory>(dirs)) {
                ignore await deleteDir(sourcePath # "/" # name);
            };

            for ({ name } in Iter.fromArray<File>(files)) {
                ignore await deleteFile(sourcePath # "/" # name);
            };

            #ok();
        };

        public func deleteFile(sourcePath : Text) : async Result.Result<(), { #notFound }> {
            let ?file : ?File = Map.remove(files, thash, sourcePath) else return #err(#notFound);
            let storageBucket : actor { delete : shared (id : ID) -> async () } = actor (Principal.toText(file.bucketId));
            ignore storageBucket.delete(file.id);
            switch (file.thumbnail) {
                case null {};
                case (?id) ignore storageBucket.delete(id);
            };
            if (Map.has(sharedFiles, thash, file.id)) {
                let rabbithole : actor { unshareFile : shared ID -> async () } = actor (Principal.toText(installer));
                ignore rabbithole.unshareFile(file.id);
                Map.delete(sharedFiles, thash, file.id);
            };
            #ok();
        };

        func updateSubPaths(id : Text, path : Text) : async* () {
            let dirEntries : [(Text, Directory)] = listDirEntries(?id);
            let fileEntries : [(Text, File)] = listFileEntries(?id);

            for ((key, value) in Iter.fromArray(fileEntries)) {
                Map.delete(files, thash, key);
                let newPath : Text = path # "/" # value.name;
                Map.set(files, thash, newPath, { value with path = newPath });
            };

            for ((key, value) in Iter.fromArray<(Text, Directory)>(dirEntries)) {
                Map.delete(directories, thash, key);
                let newPath : Text = path # "/" # value.name;
                Map.set(directories, thash, newPath, { value with path = newPath });
                await* updateSubPaths(value.id, newPath);
            };
        };

        public func renameFile(id : Text, name : Text) : Result.Result<File, NotFoundError or { #illegalCharacters } or AlreadyExistsError<File>> {
            let ?(path, file) = findFileEntry(id) else return #err(#notFound);
            if (not validateName(file.name)) return #err(#illegalCharacters);
            let segments : [var Text] = Iter.toArrayMut(Text.split(path, #char '/'));
            segments[segments.size() - 1] := name;
            let newPath : Text = Text.join("/", Iter.fromArrayMut(segments));
            switch (Map.get(files, thash, newPath)) {
                case (?v) #err(#alreadyExists v);
                case null {
                    Map.delete(files, thash, path);
                    let value : File = { file with updatedAt = Time.now(); name; path = newPath };
                    Map.set(files, thash, newPath, value);
                    #ok(value);
                };
            };

        };

        public func updateDir(action : DirectoryAction, fields : DirectoryUpdatableFields) : async* Result.Result<Directory, NotFoundError or AlreadyExistsError<Directory>> {
            switch (action) {
                case (#rename id) {
                    let ?(path, dir) = findDirEntry(id) else return #err(#notFound);
                    let newName : Text = Option.get(fields.name, dir.name);
                    let segments : [var Text] = Iter.toArrayMut(Text.split(path, #char '/'));
                    segments[segments.size() - 1] := newName;
                    let newPath : Text = Text.join("/", Iter.fromArrayMut(segments));
                    switch (Map.get(directories, thash, newPath)) {
                        case (?v) #err(#alreadyExists v);
                        case null {
                            let _files : [(Text, File)] = listFileEntries(?dir.id);
                            Map.delete(directories, thash, path);
                            let directory : Directory = { dir with updatedAt = Time.now(); name = newName; path = newPath };
                            Map.set(directories, thash, newPath, directory);
                            await* updateSubPaths(directory.id, newPath);
                            #ok directory;
                        };
                    };
                };
                case (#changeColor id) {
                    let ?(path, dir) = findDirEntry(id) else return #err(#notFound);
                    let color : ?DirectoryColor = ?Option.get(fields.color, Option.get(dir.color, #blue));
                    let directory : Directory = { dir with updatedAt = Time.now(); color };
                    ignore Map.put(directories, thash, path, directory);
                    #ok directory;
                };
                // case _ throw Error.reject("Wrong action");
            };
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
            let dirs : [Directory] = listDirs(id);
            let files : [File] = listFiles(id);
            let items : Buffer.Buffer<Entry> = do {
                let buffer : Buffer.Buffer<Entry> = Buffer.fromArray<Entry>(dirs);
                let fBuffer : Buffer.Buffer<Entry> = Buffer.fromArray<Entry>(files);
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
            items.clear();
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
        public func showDirectoriesTree(id : ?ID) : Text {
            let result : Text = showSubdirsTree(id, 0, null, null);
            let root = switch (id) {
                case null ".";
                case (?v) {
                    switch (findDir(v)) {
                        case null ".";
                        case (?{ id; name }) name # " [" # id # "]";
                    };
                };
            };
            "\n" # root # result # "\n";
        };

        func joinPath(t1 : Text, t2 : Text) : Text = if (Text.equal(t1, "")) t2 else t1 # "/" # t2;

        // создание дерева директорий
        // так как создание каждого ID асинхронный вызов, то для того, чтобы создавать пути любой вложенности за один асинхронный вызов,
        // фронтенд должен прислать массив ID, равный количеству директорий
        public func createPaths(paths : [Text], ids : [ID], _parentId : ?ID) : async [(Text, ID)] {
            let buffer = Buffer.Buffer<(Text, ID)>(0);
            let idsBuffer = Buffer.fromArray<ID>(ids);
            var idIndex : Nat = 0;
            let parent : (Text, ?ID) = switch (_parentId) {
                case null ("", null);
                case (?v) {
                    let ?(path, dir) = findDirEntry(v) else return throw Error.reject("Parent not found");
                    (path, ?dir.id);
                };
            };
            for (p in Iter.fromArray(paths)) {
                let path = Text.trim(p, #char '/');
                var parentPath : Text = parent.0;
                var parentId : ?ID = parent.1;
                var fullPath : Text = joinPath(parentPath, path);
                var currentPath : Text = "";
                let dirnames : Iter.Iter<Text> = Text.split(path, #char '/');
                label dirsLoop for (dirname in dirnames) {
                    let name = Text.trim(dirname, #char ' ');
                    if (Text.equal(name, "")) continue dirsLoop;
                    currentPath := joinPath(parentPath, dirname);
                    switch (Map.get<Text, Directory>(directories, thash, currentPath)) {
                        case (?{ id }) {
                            parentId := ?id;
                            parentPath := currentPath;
                            buffer.add((currentPath, id));
                        };
                        case null {
                            switch (Text.stripStart(fullPath, #text parentPath)) {
                                case null {};
                                case (?v) {
                                    let path = Text.trim(v, #char '/');
                                    label newPathLoop for (dirname in Text.split(path, #char '/')) {
                                        let name = Text.trim(dirname, #char ' ');
                                        if (Text.equal(name, "")) continue newPathLoop;
                                        let id = ids.get(idIndex);
                                        let now = Time.now();
                                        currentPath := joinPath(parentPath, name);
                                        let directory : Directory = {
                                            id;
                                            name;
                                            parentId;
                                            createdAt = now;
                                            updatedAt = now;
                                            color = ? #blue;
                                            children = null;
                                            path = currentPath;
                                            size = null;
                                            encrypted = false;
                                        };
                                        Map.set(directories, thash, currentPath, directory);
                                        buffer.add((currentPath, id));

                                        parentId := ?id;
                                        parentPath := currentPath;
                                        idIndex += 1;
                                    };
                                };
                            };
                            break dirsLoop;
                        };
                    };
                };
            };
            Buffer.toArray(buffer);
        };

        public func putFile(file : FileCreate) : async Result.Result<File, FileCreateError> {
            if (not validateName(file.name)) return #err(#illegalCharacters);
            let path : Text = switch (file.parentId) {
                case null file.name;
                case (?v) {
                    if (Text.equal(v, ".rabbithole")) {
                        v # "/" # file.name;
                    } else {
                        let ?path = findPath(v) else return #err(#parentNotFound);
                        path # "/" # file.name;
                    };
                };
            };
            let now = Time.now();
            let value : File = { file and { createdAt = now; updatedAt = now; path } };
            let ?replaced = Map.put(files, thash, path, value) else return #ok(value);
            let storageBucket : actor { delete : shared (id : ID) -> async () } = actor (Principal.toText(replaced.bucketId));
            ignore storageBucket.delete(replaced.id);
            #ok(value);
        };

        public func shareFile(id : ID, fields : SharedFileParams, journalCanisterId : Principal) : async Result.Result<FileExtended, { #notFound }> {
            let ?(path, file) = findFileEntry(id) else return #err(#notFound);
            let value = label exit : SharedFile {
                let now = Time.now();
                let ?(_, v) = Map.find<ID, SharedFile>(sharedFiles, func(k, v) = v.id == id) else {
                    let value : SharedFile = {
                        {
                            id;
                            journalId = journalCanisterId;
                            storageId = file.bucketId;
                            owner;
                            downloads = 0;
                            createdAt = now;
                            updatedAt = now;
                        } and fields
                    };
                    break exit value;
                };
                { { v with fields } with updatedAt = now };
            };
            let rabbithole : actor { shareFile : shared (ID, SharedFile) -> async () } = actor (Principal.toText(installer));
            await rabbithole.shareFile(id, value);
            Map.set(sharedFiles, thash, id, value);
            let share = { journalId = value.journalId; sharedWith = value.sharedWith; timelock = value.timelock; limitDownloads = value.limitDownloads };
            #ok({ file and { share = ?share } });
        };

        public func unshareFile(id : ID) : async Result.Result<FileExtended, { #notFound }> {
            let ?(path, file) = findFileEntry(id) else return #err(#notFound);
            let rabbithole : actor { unshareFile : shared ID -> async () } = actor (Principal.toText(installer));
            await rabbithole.unshareFile(id);
            Map.delete(sharedFiles, thash, file.id);
            #ok({ file and { share = null } });
        };

        public func sharedWithMe(caller : Principal) : [SharedFileExtended] {
            let filtered = Map.filter<ID, SharedFile>(
                sharedFiles,
                thash,
                func(k, v) = switch (v.sharedWith) {
                    case (#users(users)) Buffer.contains(Buffer.fromArray<Principal>(users), caller, Principal.equal);
                    case _ false;
                }
            );
            let extendedMap = Map.mapFilter<ID, SharedFile, SharedFileExtended>(
                filtered,
                thash,
                func(id, file) = switch (findFileEntry(id)) {
                    case (?(id, { name; fileSize; thumbnail; encrypted })) {
                        ?{ file and { name; fileSize; thumbnail; encrypted } };
                    };
                    case null null;
                }
            );
            Iter.toArray(Map.vals(extendedMap));
        };

        public func setFileEncryptedSymmetricKey(id : ID, tpk : Blob) : async Text {
            await vetkdEncryptedKey(tpk, [Text.encodeUtf8("symmetric_key" # id)]);
        };

        public func getFileEncryptedSymmetricKey(caller : Principal, id : ID, tpk : Blob) : async Text {
            let ?(path, file) = findFileEntry(id) else throw Error.reject("File ID not found");
            switch (Map.get(sharedFiles, thash, id)) {
                case (?v) {
                    switch (v.sharedWith) {
                        case (#everyone) {};
                        case (#users(users)) assert Buffer.contains(Buffer.fromArray<Principal>(users), caller, Principal.equal);
                    };
                };
                case null assert Principal.equal(caller, owner);
            };
            await vetkdEncryptedKey(tpk, [Text.encodeUtf8("symmetric_key" # id)]);
        };

        func vetkdEncryptedKey(tpk : Blob, derivationPath : [Blob]) : async Text {
            let request : VetKDEncryptedKeyRequest = {
                encryption_public_key = tpk;
                key_id = bls12_381_test_key_1();
                derivation_id = Principal.toBlob(owner);
                public_key_derivation_path = derivationPath;
            };
            let response : VetKDEncryptedKeyReply = await VETKD_SYSTEM_API.vetkd_encrypted_key(request) else throw Error.reject("Call to vetkd_encrypted_key failed");
            Hex.encode(Blob.toArray(response.encrypted_key));
        };

        public func fileVetkdPublicKey(id : ID, derivationPath : [Blob]) : async Text {
            let request : VetKDPublicKeyRequest = {
                canister_id = null;
                derivation_path = derivationPath;
                key_id = bls12_381_test_key_1();
            };

            let response : VetKDPublicKeyReply = await VETKD_SYSTEM_API.vetkd_public_key(request) else throw Error.reject("Call to vetkd_public_key failed");
            Hex.encode(Blob.toArray(response.public_key));
        };

        func bls12_381_test_key_1() : VetKDKeyId {
            {
                curve = #bls12_381;
                name = "test_key_1";
            };
        };

        public func preupgrade() : ([(Text, Directory)], [(Text, File)], [(ID, SharedFile)]) {
            (
                Iter.toArray(Map.entries(directories)),
                Iter.toArray(Map.entries(files)),
                Iter.toArray(Map.entries(sharedFiles))
            );
        };
    };

    public func fromIter(args : JournalArgs, dirsIter : Iter.Iter<(Text, Directory)>, filesIter : Iter.Iter<(Text, File)>, sharedFilesIter : Iter.Iter<(ID, SharedFile)>) : Journal {
        let j = New(args);
        j.putDirs(dirsIter);
        j.putFiles(filesIter);
        j.putSharedFiles(sharedFilesIter);
        j;
    };
};
