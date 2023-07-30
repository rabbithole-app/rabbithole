import { Injectable, WritableSignal, signal } from '@angular/core';
import { AuthClient } from '@dfinity/auth-client';
import { Observable, Subject } from 'rxjs';

import { createAuthClient } from '@core/utils';

@Injectable({
    providedIn: 'root'
})
export class CoreService {
    worker: WritableSignal<Worker | null> = signal(null);
    #workerMessage: Subject<MessageEvent> = new Subject();
    workerMessage$: Observable<MessageEvent> = this.#workerMessage.asObservable();
    readonly workerEnabled = true;
    client: WritableSignal<AuthClient | null> = signal(null);
    isAuthenticated: WritableSignal<boolean> = signal(false);

    constructor() {
        if (typeof Worker !== 'undefined' && this.workerEnabled) {
            const worker = new Worker(new URL('../workers/core.worker', import.meta.url), { type: 'module' });
            this.worker.set(worker);
            worker.onmessage = event => this.#workerMessage.next(event);
        }
    }

    async createAuthClient() {
        const client = await createAuthClient();
        this.client.set(client);
        const isAuthenticated = await client.isAuthenticated();
        this.isAuthenticated.set(isAuthenticated);
    }
}
