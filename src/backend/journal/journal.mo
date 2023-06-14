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

module {
    type ID = Text;
    type Entry = Types.Entry;
    type File = Types.File;
    type FileCreate = Types.FileCreate;
    type FileCreateError = Types.FileCreateError;
    type CreatePath = Types.CreatePath;
    type Directory = Types.Directory;
    type DirectoryCreate = Types.DirectoryCreate;
    type DirectoryCreateError = Types.DirectoryCreateError;
    type DirectoryMoveError = Types.DirectoryMoveError;
    type DirectoryAction = Types.DirectoryAction;
    type DirectoryColor = Types.DirectoryColor;
    type DirectoryUpdatableFields = Types.DirectoryUpdatableFields;
    type FileMoveError = Types.FileMoveError;
    type DirectoryState = Types.DirectoryState;
    type DirectoryStateError = Types.DirectoryStateError;
    public type Journal = {
        putDirs : Iter.Iter<(Text, Directory)> -> ();
        // putDirs : [(Text, Directory)] -> ();
        putFiles : Iter.Iter<(Text, File)> -> ();
        // putFiles : [(Text, File)] -> ();
        listDirs : ?ID -> [Directory];
        listDirsExtend : ?ID -> [Directory];
        listFiles : ?ID -> [File];
        checkDirname : DirectoryCreate -> Result.Result<(), DirectoryCreateError>;
        getJournal : (?Text) -> Result.Result<DirectoryState, DirectoryStateError>;
        createDir : DirectoryCreate -> async Result.Result<Directory, DirectoryCreateError>;
        moveDir : (Text, ?Text) -> async* Result.Result<(), DirectoryMoveError>;
        mergeDir : (Text, Text) -> async* Result.Result<(), DirectoryMoveError>;
        moveFile : (Text, ?Text) -> async Result.Result<(), FileMoveError>;
        deleteDir : Text -> async Result.Result<(), { #notFound }>;
        deleteFile : Text -> async Result.Result<(), { #notFound }>;
        updateDir : (DirectoryAction, DirectoryUpdatableFields) -> Result.Result<Directory, { #notFound; #alreadyExists }>;
        showDirectoriesTree : ?ID -> Text;
        createPaths : ([Text], [ID], ?ID) -> async [(Text, ID)];
        putFile : FileCreate -> async Result.Result<File, FileCreateError>;
        preupgrade : () -> ([(Text, Directory)], [(Text, File)]);
        // postupgrade : (([(Text, Directory)], [(Text, File)])) -> ();
    };

    public class New() : Journal {
        let { thash } = Map;
        var directories : Map.Map<Text, Directory> = Map.new<Text, Directory>(thash);
        var files : Map.Map<Text, File> = Map.new<Text, File>(thash);

        public func putDirs(iter : Iter.Iter<(Text, Directory)>) : () {
            directories := Map.fromIter<Text, Directory>(iter, thash);
        };

        public func putFiles(iter : Iter.Iter<(Text, File)>) : () {
            files := Map.fromIter<Text, File>(iter, thash);
        };

        // список директорий по id родителя
        public func listDirs(id : ?ID) : [Directory] {
            let filtered = Map.filter<Text, Directory>(directories, thash, func(k, v) = v.parentId == id);
            Iter.toArray(Map.vals(filtered));
        };

        public func listDirsExtend(id : ?ID) : [Directory] {
            let filtered = Map.filter<Text, Directory>(directories, thash, func(k, v) = v.parentId == id);
            let buffer : Buffer.Buffer<Directory> = Buffer.Buffer(Map.size(filtered));
            for ((path, dir) in Map.entries(filtered)) {
                let children = (listDirs(?dir.id), listFiles(?dir.id));
                buffer.add({ dir with path = ?path; children = ?children });
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

        func validateName(name : Text) : Bool {
            for (c : Char in name.chars()) {
                let isNonPrintableChar : Bool = Char.fromNat32(0x00) <= c and c <= Char.fromNat32(0x1f);
                if (isNonPrintableChar or Text.contains("<>:/|\\?*\"", #char c)) {
                    return false;
                };
            };
            true;
        };

        public func checkDirname({ name; parentId } : DirectoryCreate) : Result.Result<(), DirectoryCreateError> {
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
                    case (?v) buffer.add({ v with path = parentPath });
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
            #ok({ id; dirs = listDirs(id); files = listFiles(id); breadcrumbs });
        };

        public func createDir({ name; parentId } : DirectoryCreate) : async Result.Result<Directory, DirectoryCreateError> {
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
                    let directory : Directory = { id; name; parentId; createdAt = now; updatedAt = now; color = ? #blue; children = null; path = null };
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
                    let directory : Directory = { sourceDir with updatedAt = Time.now(); parentId = id };
                    let path : Text = Option.getMapped<Text, Text>(targetPath, func v = v # "/" # directory.name, directory.name);
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
            let file : File = { sourceFile with updatedAt = Time.now(); parentId = id };
            let path : Text = Option.getMapped<Text, Text>(targetPath, func v = v # "/" # file.name, file.name);

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
            #ok();
        };

        public func updateDir(action : DirectoryAction, fields : DirectoryUpdatableFields) : Result.Result<Directory, { #notFound; #alreadyExists }> {
            switch (action) {
                case (#rename id) {
                    let ?(path, dir) = findDirEntry(id) else return #err(#notFound);
                    let newName : Text = Option.get(fields.name, dir.name);
                    let siblingDirs : [Directory] = listDirs(dir.parentId);
                    let found : ?Directory = Array.find<Directory>(
                        siblingDirs,
                        func v = Text.equal(v.name, newName) and Text.notEqual(v.id, dir.id)
                    );
                    switch (found) {
                        case null {
                            let directory : Directory = { dir with updatedAt = Time.now(); name = newName };
                            ignore Map.put(directories, thash, path, directory);
                            #ok(directory);
                        };
                        case (?v) #err(#alreadyExists);
                    };
                };
                case (#changeColor id) {
                    let ?(path, dir) = findDirEntry(id) else return #err(#notFound);
                    let color : ?DirectoryColor = ?Option.get(fields.color, Option.get(dir.color, #blue));
                    let directory : Directory = { dir with updatedAt = Time.now(); color };
                    ignore Map.put(directories, thash, path, directory);
                    #ok(directory);
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
                                        let directory : Directory = {
                                            id;
                                            name;
                                            parentId;
                                            createdAt = now;
                                            updatedAt = now;
                                            color = ? #blue;
                                            children = null;
                                            path = null;
                                        };
                                        currentPath := joinPath(parentPath, name);
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
                    let ?path = findPath(v) else return #err(#parentNotFound);
                    path # "/" # file.name;
                };
            };
            let now = Time.now();
            let value : File = { file and { createdAt = now; updatedAt = now } };
            let ?replaced = Map.put(files, thash, path, value) else return #ok(value);
            let storageBucket : actor { delete : shared (id : ID) -> async () } = actor (Principal.toText(replaced.bucketId));
            ignore storageBucket.delete(replaced.id);
            #ok(value);
        };

        public func preupgrade() : ([(Text, Directory)], [(Text, File)]) {
            (Iter.toArray(Map.entries(directories)), Iter.toArray(Map.entries(files)));
        };
    };

    public func fromIter(dirsIter : Iter.Iter<(Text, Directory)>, filesIter : Iter.Iter<(Text, File)>) : Journal {
        let j = New();
        j.putDirs(dirsIter);
        j.putFiles(filesIter);
        j;
    };
};
