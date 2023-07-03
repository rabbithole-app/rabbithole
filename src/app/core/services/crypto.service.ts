import { computed, DestroyRef, effect, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { selectSlice } from '@rx-angular/state/selections';
import { from, of } from 'rxjs';
import { combineLatestWith, switchMap } from 'rxjs/operators';

import { decrypt, encrypt, initVetAesGcmKey } from '@core/utils';
import { AUTH_RX_STATE } from '../stores';
import { BucketsService } from './buckets.service';

@Injectable({ providedIn: 'root' })
export class CryptoService {
    #authState = inject(AUTH_RX_STATE);
    readonly #bucketsService = inject(BucketsService);
    vetAesGcmKey: WritableSignal<CryptoKey | null> = signal(null);
    isInitialized: Signal<boolean> = computed(() => this.vetAesGcmKey() !== null);
    #destroyed = inject(DestroyRef);

    constructor() {
        effect(() => console.log({ vetAesGcmKey: this.vetAesGcmKey() }));
    }

    init() {
        this.#authState
            .select(selectSlice(['isAuthenticated', 'identity']))
            .pipe(
                combineLatestWith(this.#bucketsService.select('journal')),
                switchMap(([{ isAuthenticated, identity }, actor]) => {
                    if (!isAuthenticated || !actor) {
                        return of(null);
                    }

                    return from(initVetAesGcmKey(identity.getPrincipal(), actor));
                }),
                takeUntilDestroyed(this.#destroyed)
            )
            .subscribe(encryptedKey => this.vetAesGcmKey.set(encryptedKey));
    }

    async encrypt(data: string) {
        const vetAesGcmKey = this.vetAesGcmKey();
        return encrypt(vetAesGcmKey, data);
    }

    async decrypt(data: string) {
        const vetAesGcmKey = this.vetAesGcmKey();
        return decrypt(vetAesGcmKey, data);
    }
}
