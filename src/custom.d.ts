declare module 'native-file-system-adapter';

declare module 'native-file-system-adapter/src/adapters/downloader' {
    export * from 'native-file-system-adapter/types/src/adapters/downloader';
}

declare module 'vetkd_user_lib/ic_vetkd.js' {
    export class EncryptedKey {
        constructor(bytes: Uint8Array);
        free(): void;
        decrypt_and_verify(tsk: TransportSecretKey, derived_public_key_bytes: Uint8Array, derivation_id: Uint8Array): DecryptedKey;
    }
    export class DecryptedKey {
        free(): void;
        to_aes_256_gcm_key(): Uint8Array;
    }
    export class TransportPublicKey {
        free(): void;
        to_bytes(): Uint8Array;
    }
    export class TransportSecretKey {
        constructor(seed: Uint8Array);
        free(): void;
        public_key(): TransportPublicKey;
    }
}
