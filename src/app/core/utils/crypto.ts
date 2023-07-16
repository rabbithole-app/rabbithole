import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { arrayBufferToUint8Array, hexStringToUint8Array, uint8ArrayToArrayOfNumber } from '@dfinity/utils';

// See also https://github.com/rollup/plugins/tree/master/packages/wasm#using-with-wasm-bindgen-and-wasm-pack
import { _SERVICE as JournalActor } from 'declarations/journal/journal.did';
import { TransportSecretKey, default as vetkd } from 'vetkd_user_lib/ic_vetkd_utils';

/**
 * Fetch the authenticated user's vetKD key and derive an AES-GCM key from it
 */
export async function initVetAesGcmKey(caller: Principal, actor: ActorSubclass<JournalActor>): Promise<CryptoKey | null> {
    try {
        await vetkd('vetkd_user_lib/ic_vetkd_utils_bg.wasm');
        // Showcase that the integration of the vetkd user library works
        const seed = crypto.getRandomValues(new Uint8Array(32));
        const tsk = new TransportSecretKey(seed);

        const ek_bytes_hex = await actor.encrypted_symmetric_key(tsk.public_key());
        const pk_bytes_hex = await actor.app_vetkd_public_key([new TextEncoder().encode('symmetric_key')]);
        console.log('Successfully used vetKD user library via WASM to create new transport secret key');
        const aes_256_gcm_key_raw = tsk.decrypt_and_hash(
            hexStringToUint8Array(ek_bytes_hex),
            hexStringToUint8Array(pk_bytes_hex),
            caller.toUint8Array(),
            32,
            new TextEncoder().encode('aes-256-gcm')
        );
        const aes_key = await crypto.subtle.importKey('raw', aes_256_gcm_key_raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
        console.log({ ek_bytes_hex, pk_bytes_hex, aes_key });
        return aes_key;
    } catch (err) {
        console.error(err);
        return null;
    }
}

// The function encrypts data with the shared secretKey.
export async function encrypt(vetAesGcmKey: CryptoKey | null, data: string) {
    if (vetAesGcmKey === null) {
        throw new Error('null shared secret!');
    }
    const textEncoder = new TextEncoder();
    const u8array = new Uint8Array(data.length * 3);
    const { written } = textEncoder.encodeInto(data, u8array);
    const dataEncoded = u8array.buffer.slice(0, written);
    // The iv must never be reused with a given key.
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv
        },
        vetAesGcmKey,
        dataEncoded
    );

    const ivDecoded = String.fromCharCode(...new Uint8Array(iv));
    const cipherDecoded = String.fromCharCode(...new Uint8Array(ciphertext));
    return ivDecoded + cipherDecoded;
}

export async function encryptArrayBuffer(vetAesGcmKey: CryptoKey | null, data: ArrayBuffer): Promise<ArrayBuffer> {
    if (vetAesGcmKey === null) {
        throw new Error('null shared secret!');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vetAesGcmKey, data);
    const result = new Uint8Array(12 + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(arrayBufferToUint8Array(ciphertext), 12);
    return result.buffer;
}

// The function decrypts the given input data.
export async function decrypt(vetAesGcmKey: CryptoKey | null, data: string) {
    if (vetAesGcmKey === null) {
        throw new Error('null shared secret!');
    }
    if (data.length < 13) {
        throw new Error('wrong encoding, too short to contain iv');
    }

    const ivDecoded = data.slice(0, 12);
    const cipherDecoded = data.slice(12);
    const ivEncoded = Uint8Array.from([...ivDecoded].map(ch => ch.charCodeAt(0))).buffer;
    const ciphertextEncoded = Uint8Array.from([...cipherDecoded].map(ch => ch.charCodeAt(0))).buffer;

    const decryptedDataEncoded = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: ivEncoded
        },
        vetAesGcmKey,
        ciphertextEncoded
    );
    const textDecoder = new TextDecoder();
    return textDecoder.decode(arrayBufferToUint8Array(decryptedDataEncoded));
}

export async function decryptArrayBuffer(vetAesGcmKey: CryptoKey | null, data: ArrayBuffer): Promise<ArrayBuffer> {
    if (vetAesGcmKey === null) {
        throw new Error('null shared secret!');
    }
    if (data.byteLength < 13) {
        throw new Error('wrong encoding, too short to contain iv');
    }
    const iv = data.slice(0, 12);
    const cipherDecoded = data.slice(12);
    const decryptedDataEncoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, vetAesGcmKey, cipherDecoded);
    return decryptedDataEncoded;
}
