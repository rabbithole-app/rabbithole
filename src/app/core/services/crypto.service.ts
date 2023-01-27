import { inject, Injectable } from '@angular/core';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { defer, from, iif, of, switchMap, map } from 'rxjs';
import { arrayBufferToUint8Array } from '@dfinity/utils';
import { AUTH_RX_STATE } from '../stores';

interface State {
    // Private key associated with logged in device. Used to encrypt the symmetric secretKey
    // for each device associated with the current principal, to be stored by the dapp in encrypted form
    publicKey: CryptoKey | null;
    // Symmetric AES key, used to encrypt and decrypt the notes stored in the dapp
    secretKey: CryptoKey | null;

    secret: string | null;
}

@Injectable()
export class CryptoService extends RxState<State> {
    private authState = inject(AUTH_RX_STATE);

    constructor() {
        super();
        this.connect(from(this.generate()));
        const encryptedKey$ = this.authState.select(selectSlice(['actor', 'isAuthenticated'])).pipe(
            switchMap(({ actor, isAuthenticated }) =>
                iif(
                    () => isAuthenticated,
                    defer(() =>
                        this.select('publicKey').pipe(
                            map(tpk => tpk as CryptoKey),
                            switchMap(tpk =>
                                from(window.crypto.subtle.exportKey('spki', tpk)).pipe(
                                    map(buffer => CryptoService.ab2str(buffer)),
                                    switchMap(publicKey => actor.getKey(publicKey))
                                )
                            )
                        )
                    ),
                    of(null)
                )
            )
        );
        this.connect(encryptedKey$.pipe(map(secret => ({ secret }))));
    }

    private generate(): Promise<CryptoKeyPair> {
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
