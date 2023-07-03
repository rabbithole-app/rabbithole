module {
    type CanisterId = Principal;

    public type VetKDCurve = {
        #bls12_381;
    };

    public type VetKDKeyId = {
        curve : VetKDCurve;
        name : Text;
    };

    public type VetKDPublicKeyRequest = {
        canister_id : ?CanisterId;
        derivation_path : [Blob];
        key_id : VetKDKeyId;
    };

    public type VetKDPublicKeyReply = {
        public_key : Blob;
    };

    public type VetKDEncryptedKeyRequest = {
        derivation_id : Blob;
        encryption_public_key : Blob;
        key_id : VetKDKeyId;
        public_key_derivation_path : [Blob];
    };

    public type VetKDEncryptedKeyReply = {
        encrypted_key : Blob;
    };
};
