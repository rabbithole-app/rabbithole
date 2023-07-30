import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { arrayBufferToUint8Array, hexStringToUint8Array } from '@dfinity/utils';
import { get, has } from 'lodash';

// See also https://github.com/rollup/plugins/tree/master/packages/wasm#using-with-wasm-bindgen-and-wasm-pack
import { _SERVICE as JournalActor, NotFoundError } from 'declarations/journal/journal.did';
import { TransportSecretKey, default as vetkd } from 'vetkd_user_lib/ic_vetkd_utils';

export async function loadWasm() {
    await vetkd('vetkd_user_lib/ic_vetkd_utils_bg.wasm');
}

function checkResponse<K extends keyof ActorSubclass<JournalActor>>(response: Awaited<ReturnType<ActorSubclass<JournalActor>[K]>>) {
    if (has(response, 'err')) {
        const err = Object.keys(get(response, 'err') as unknown as NotFoundError | { vetKDEncryptedKey: null } | { vetKDPublicKey: null })[0];
        switch (err) {
            case 'notFound':
                throw new Error('File ID not found');
            case 'vetKDEncryptedKey':
                throw new Error('Call to vetkd_encrypted_key failed');
            case 'vetKDPublicKey':
                throw new Error('Call to vetkd_public_key failed');
            default:
                throw new Error('Unknown error');
        }
    }
}

/**
 * Fetch the authenticated user's vetKD key and derive an AES-GCM key from it
 */
export async function initVetAesGcmKey(id: string, caller: Principal, actor: ActorSubclass<JournalActor>): Promise<CryptoKey | null> {
    try {
        // Showcase that the integration of the vetkd user library works
        const seed = crypto.getRandomValues(new Uint8Array(32));
        const tsk = new TransportSecretKey(seed);
        const tpk = tsk.public_key();
        const responseESK = await actor.fileEncryptedSymmetricKey(id, tpk);
        checkResponse<'fileEncryptedSymmetricKey'>(responseESK);
        const ek_bytes_hex = get(responseESK, 'ok') as unknown as string;
        const responsePK = await actor.fileVetkdPublicKey(id, [new TextEncoder().encode(`symmetric_key${id}`)]);
        checkResponse<'fileVetkdPublicKey'>(responsePK);
        const pk_bytes_hex = get(responsePK, 'ok') as unknown as string;
        const aes_256_gcm_key_raw = tsk.decrypt_and_hash(
            hexStringToUint8Array(ek_bytes_hex),
            hexStringToUint8Array(pk_bytes_hex),
            caller.toUint8Array(),
            32,
            new TextEncoder().encode('aes-256-gcm')
        );
        const aes_key = await crypto.subtle.importKey('raw', aes_256_gcm_key_raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
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
