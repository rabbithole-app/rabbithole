import Prim "mo:prim";
import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Char "mo:base/Char";
import Iter "mo:base/Iter";
import Nat8 "mo:base/Nat8";
import Nat32 "mo:base/Nat32";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Trie "mo:base/Trie";
import AsyncSource "mo:uuid/async/SourceV4";
import UUID "mo:uuid/UUID";
import Base64 "mo:encoding/Base64";

import Types "../types/types";
import Env "../env";

module {
    type ID = Types.ID;

    public func isAdmin(caller : Principal) : Bool {
        hasPrivilege(caller, Env.admin);
    };

    public func isManager(caller : Principal) : Bool {
        hasPrivilege(caller, Env.manager);
    };

    private func hasPrivilege(caller : Principal, privileges : [Text]) : Bool {
        func toPrincipal(entry : Text) : Principal {
            Principal.fromText(entry);
        };

        let principals : [Principal] = Array.map(privileges, toPrincipal);

        func filterAdmin(admin : Principal) : Bool {
            admin == caller;
        };

        let admin : ?Principal = Array.find(principals, filterAdmin);

        switch (admin) {
            case (null) false;
            case (?_) true;
        };
    };

    public func keyPrincipal(x : Principal) : Trie.Key<Principal> {
        { key = x; hash = Principal.hash x };
    };

    public func keyText(t : Text) : Trie.Key<Text> {
        { key = t; hash = Text.hash t };
    };

    public func generateId() : async ID {
		let ae = AsyncSource.Source();
		let id = await ae.new();
		Text.map(UUID.toText(id), Prim.charToLower);
	};

    public func base64(b : Blob) : Text {
        let bytes = Blob.toArray(b);
        arrayToText(Base64.StdEncoding.encode(bytes));
    };

    func arrayToText(arr : [Nat8]) : Text {
        Text.fromIter(Iter.fromArray(
            Array.map<Nat8, Char>(
                arr,
                func (n : Nat8) : Char = Char.fromNat32(Nat32.fromNat(Nat8.toNat(n)))
            ),
        ));
    };
};
