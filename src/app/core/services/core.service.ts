import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { CryptoService } from './crypto.service';

@Injectable({
    providedIn: 'root'
})
export class CoreService {
    readonly #cryptoService = inject(CryptoService);
    worker: WritableSignal<Worker | null> = signal(null);
    #workerMessage: Subject<MessageEvent> = new Subject();
    workerMessage$: Observable<MessageEvent> = this.#workerMessage.asObservable();
    readonly workerEnabled = true;

    constructor() {
        if (typeof Worker !== 'undefined' && this.workerEnabled) {
            const worker = new Worker(new URL('../workers/core.worker', import.meta.url), { type: 'module' });
            this.worker.set(worker);
            worker.onmessage = event => this.#workerMessage.next(event);
        } else {
            this.#cryptoService.init();
        }
    }
}
