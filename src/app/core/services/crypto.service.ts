import { computed, effect, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { decrypt, encrypt } from '@core/utils';

@Injectable({ providedIn: 'root' })
export class CryptoService {
    vetAesGcmKey: WritableSignal<CryptoKey | null> = signal(null);
    isInitialized: Signal<boolean> = computed(() => this.vetAesGcmKey() !== null);

    constructor() {
        effect(() => console.log({ vetAesGcmKey: this.vetAesGcmKey() }));
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
