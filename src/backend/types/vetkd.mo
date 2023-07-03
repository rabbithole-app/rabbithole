// This is a generated Motoko binding.
// Please use `import service "ic:canister_id"` instead to call canisters on the IC if possible.

module {
    public type canister_id = Principal;
    public type vetkd_curve = { #bls12_381 };
    public type Self = actor {
        vetkd_encrypted_key : shared {
            key_id : { name : Text; curve : vetkd_curve };
            derivation_id : [Nat8];
            encryption_public_key : [Nat8];
            public_key_derivation_path : [[Nat8]];
        } -> async { encrypted_key : [Nat8] };
        vetkd_public_key : shared {
            key_id : { name : Text; curve : vetkd_curve };
            canister_id : ?canister_id;
            derivation_path : [[Nat8]];
        } -> async { public_key : [Nat8] };
    };
};
