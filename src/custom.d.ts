declare module 'native-file-system-adapter';

declare module 'native-file-system-adapter/src/adapters/downloader' {
    export * from 'native-file-system-adapter/types/src/adapters/downloader';
}

declare module 'vetkd_user_lib/ic_vetkd_utils.js' {
    export class TransportSecretKey {
        constructor(seed: Uint8Array);
        free(): void;
        public_key(): Uint8Array;
        decrypt_and_hash(
            encrypted_key_bytes: Uint8Array,
            derived_public_key_bytes: Uint8Array,
            derivation_id: Uint8Array,
            symmetric_key_bytes: number,
            symmetric_key_associated_data: Uint8Array
        ): Uint8Array;
    }
}
