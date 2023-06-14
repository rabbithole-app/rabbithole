import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Principal "mo:base/Principal";
import BiMap "mo:bimap/BiMap";
import BiTrieMap "mo:bimap/BiTrieMap";

module {
    public type Role = Text;

    public type StableUsers = [(Principal, [Role])];

    // User has ALL roles, even custom defined roles.
    public let ALL = "auth:all";
    // User can add other users and roles.
    public let USERS_ADD = "auth:users/add";
    // User can remove other users and roles.
    public let USERS_REMOVE = "auth:users/remove";
    // User can get all roles.
    public let USERS_GET = "auth:users/get";

    public func toStable(owner : Principal, a : Users) : StableUsers {
        Iter.toArray(a.entries(owner));
    };

    public type Interface = {
        // @auth : add
        addUser : (caller : Principal, user : Principal) -> ();
        addUserWithRoles : (caller : Principal, user : Principal, roles : [Role]) -> ();
        addRoles : (caller : Principal, user : Principal, roles : [Role]) -> ();

        // @auth : get
        entries : (caller : Principal) -> Iter.Iter<(Principal, [Role])>;
        getRoles : (caller : Principal, user : Principal) -> [Role];

        // @auth : remove
        removeUser : (caller : Principal, user : Principal) -> ();
        removeRoles : (caller : Principal, user : Principal, roles : [Role]) -> ();

        hasRole : (user : Principal, role : Role) -> Bool;
        hasOneOfRoles : (user : Principal, roles : [Role]) -> Bool;
    };

    public class Users(state : StableUsers) : Interface {
        private let users = HashMap.fromIter<Principal, [Role]>(
            state.vals(),
            0,
            Principal.equal,
            Principal.hash
        );

        public func addUser(caller : Principal, user : Principal) = addUserWithRoles(caller, user, []);

        public func addUserWithRoles(caller : Principal, user : Principal, roles : [Role]) {
            if (not _canAdd(caller)) return;
            users.put(user, roles);
        };

        public func addRoles(caller : Principal, user : Principal, roles : [Role]) {
            if (not _canAdd(caller)) return;
            let aRoles = switch (users.get(user)) {
                case null [];
                case (?rs) rs;
            };
            users.put(user, Array.append<Role>(aRoles, roles));
        };

        public func entries(caller : Principal) : Iter.Iter<(Principal, [Role])> {
            if (not _canGet(caller)) {
                return object {
                    public func next() : ?(Principal, [Role]) = null;
                };
            };
            users.entries();
        };

        public func getRoles(caller : Principal, user : Principal) : [Role] {
            if (caller != user and not _canGet(caller)) return [];
            switch (users.get(user)) {
                case null [];
                case (?rs) rs;
            };
        };

        public func removeUser(caller : Principal, user : Principal) {
            if (not _canRemove(caller)) return;
            users.delete(user);
        };

        public func removeRoles(caller : Principal, user : Principal, roles : [Role]) {
            if (not _canRemove(caller)) return;
            switch (users.get(user)) {
                case (null) {};
                case (?aRoles) {
                    users.put(
                        user,
                        Array.filter<Role>(
                            aRoles,
                            func(r : Role) : Bool {
                                not _containsRole(aRoles, r);
                            }
                        )
                    );
                };
            };
        };

        public func hasRole(user : Principal, role : Role) : Bool {
            hasOneOfRoles(user, [ALL, role]);
        };

        public func hasOneOfRoles(user : Principal, roles : [Role]) : Bool {
            switch (users.get(user)) {
                case (null) { false };
                case (?aRoles) {
                    if (_containsRole(aRoles, ALL)) return true;

                    for (r in roles.vals()) {
                        if (_containsRole(aRoles, r)) return true;
                    };
                    false;
                };
            };
        };

        private func _canAdd(user : Principal) : Bool = hasOneOfRoles(user, [ALL, USERS_ADD]);
        private func _canGet(user : Principal) : Bool = hasOneOfRoles(user, [ALL, USERS_GET]);
        private func _canRemove(user : Principal) : Bool = hasOneOfRoles(user, [ALL, USERS_REMOVE]);

        private func _containsRole(roles : [Role], role : Role) : Bool {
            for (r in roles.vals()) {
                if (r == role) return true;
            };
            false;
        };
    };
};
