import { Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subject } from 'rxjs';
import { filter, map, mergeWith } from 'rxjs/operators';
import { isNull } from 'lodash';

import { AUTH_RX_STATE } from '@core/stores';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class CoreService {
    #authState = inject(AUTH_RX_STATE);
    #authService = inject(AuthService);
    worker: WritableSignal<Worker | null> = signal(null);
    #workerMessage: Subject<MessageEvent> = new Subject();
    workerMessage$: Observable<MessageEvent> = this.#workerMessage.asObservable();
    readonly workerEnabled = true;
    workerInited: Signal<boolean> = toSignal(
        this.workerMessage$.pipe(
            filter(({ data }) => data.action === 'init'),
            map(() => true),
            mergeWith(
                toObservable(this.worker).pipe(
                    filter(worker => isNull(worker)),
                    map(() => false)
                )
            )
        ),
        { initialValue: false }
    );

    constructor() {
        this.#authState.select('isAuthenticated').subscribe(isAuthenticated => {
            if (isAuthenticated) this.#initWorker();
            else this.#terminate();
        });
        this.workerMessage$.pipe(filter(({ data }) => data.action === 'rabbitholeSignOutAuthTimer')).subscribe(async () => {
            await this.#authService.signedOutByWorker();
        });
    }

    #initWorker() {
        if (typeof Worker !== 'undefined' && this.workerEnabled) {
            const worker = new Worker(new URL('../workers/core.worker', import.meta.url), { type: 'module' });
            worker.onmessage = event => this.#workerMessage.next(event);
            this.worker.set(worker);
        }
    }

    #terminate() {
        const worker = this.worker();
        if (worker) {
            worker.terminate();
            this.worker.set(null);
        }
    }
}
