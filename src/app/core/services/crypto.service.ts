import { effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { selectSlice } from '@rx-angular/state/selections';
import { from, of, switchMap, map, first } from 'rxjs';
import { arrayBufferToUint8Array } from '@dfinity/utils';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { isNull } from 'lodash';
import { AUTH_RX_STATE } from '../stores';

// Usage of the imported bindings only works if the respective .wasm was loaded, which is done in main.ts.
// See also https://github.com/rollup/plugins/tree/master/packages/wasm#using-with-wasm-bindgen-and-wasm-pack
import { default as vetkd, TransportSecretKey } from 'vetkd_user_lib/ic_vetkd';

@Injectable({ providedIn: 'root' })
export class CryptoService {
    #authState = inject(AUTH_RX_STATE);
    // Private key associated with logged in device. Used to encrypt the symmetric secretKey
    // for each device associated with the current principal, to be stored by the dapp in encrypted form
    // Symmetric AES key, used to encrypt and decrypt the notes stored in the dapp
    #keyPair: WritableSignal<CryptoKeyPair | null> = signal(null);
    #secret: WritableSignal<string | null> = signal(null);

    constructor() {
        effect(() => console.log({ keyPair: this.#keyPair(), secret: this.#secret() }));
        this.#init();
        this.#authState
            .select(selectSlice(['actor', 'isAuthenticated']))
            .pipe(
                switchMap(({ actor, isAuthenticated }) => {
                    if (!isAuthenticated) {
                        return of(null);
                    }

                    return toObservable(this.#keyPair).pipe(
                        first(pair => !isNull(pair)),
                        map(keyPair => (keyPair as NonNullable<typeof keyPair>).publicKey),
                        switchMap(tpk =>
                            from(window.crypto.subtle.exportKey('spki', tpk)).pipe(
                                map(buffer => CryptoService.ab2str(buffer)),
                                switchMap(publicKey => actor.getKey(publicKey))
                            )
                        )
                    );
                }),
                takeUntilDestroyed()
            )
            .subscribe(encryptedKey => this.#secret.set(encryptedKey));
    }

    async #init() {
        await vetkd('vetkd_user_lib/ic_vetkd_bg.wasm');
        // Showcase that the integration of the vetkd user library works
        const seed = window.crypto.getRandomValues(new Uint8Array(32));
        const tsk = new TransportSecretKey(seed);
        console.log('Successfully used vetKD user library via WASM to create new transport secret key');
        console.log(tsk);
        const tpk = tsk.public_key();
        console.log(tpk);
        const keyPair = await this.#generate();
        this.#keyPair.set(keyPair);
    }

    #generate(): Promise<CryptoKeyPair> {
        return crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                // Consider using a 4096-bit key for systems that require long-term security
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            false,
            ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
        );
    }

    private static ab2str(buf: ArrayBuffer): string {
        return String.fromCharCode.apply(null, Array.from(arrayBufferToUint8Array(buf)));
    }
}
