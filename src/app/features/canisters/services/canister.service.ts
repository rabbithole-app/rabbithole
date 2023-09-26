import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { throwError } from 'rxjs';
import { catchError, combineLatestWith, distinctUntilChanged, filter, finalize, first, map, scan, startWith } from 'rxjs/operators';
import { findIndex, isEqual } from 'lodash';
import { TranslocoService } from '@ngneat/transloco';

import { CoreService, NotificationService } from '@core/services';
import { CanisterStatusResult } from '../models';

@Injectable({
    providedIn: 'root'
})
export class CanisterService {
    readonly #coreService = inject(CoreService);
    readonly #notificationService = inject(NotificationService);
    #translocoService = inject(TranslocoService);
    loading: WritableSignal<Record<string, boolean>> = signal({});
    canisters: WritableSignal<CanisterStatusResult[]> = signal([]);

    constructor() {
        this.#coreService.workerMessage$
            .pipe(
                filter(({ data }) => ['canisterStatusLoading', 'canisterStatusDone', 'canisterStatusFailed'].includes(data.action)),
                map(({ data }) => data.payload),
                scan((acc, value) => {
                    const index = findIndex(acc, ['canisterId', value.canisterId]);
                    if (index > -1) {
                        acc[index] = { ...acc[index], ...value };
                        return [...acc];
                    }

                    return [...acc, value];
                }, [] as CanisterStatusResult[]),
                combineLatestWith(
                    this.#coreService.workerMessage$.pipe(
                        filter(({ data }) => data.action === 'deleteStorageDone'),
                        map(({ data }) => data.payload.canisterId),
                        startWith(null)
                    )
                ),
                map(([data, canisterId]) => (canisterId ? data.filter(item => item.canisterId !== canisterId) : data)),
                distinctUntilChanged(isEqual),
                takeUntilDestroyed()
            )
            .subscribe(data => this.canisters.set(data));
    }

    delete(canisterId: string) {
        const worker = this.#coreService.worker();
        if (worker) {
            this.loading.update(value => {
                value[canisterId] = true;
                return value;
            });
            worker.postMessage({ action: 'deleteStorage', canisterId });
            this.#coreService.workerMessage$
                .pipe(
                    first(({ data }) => ['deleteStorageDone', 'deleteStorageFailed'].includes(data.action) && data.payload.canisterId === canisterId),
                    map(({ data }) => {
                        if (data.action === 'deleteStorageFailed') {
                            throw Error(data.errorMessage);
                        }
                        return data.canisterId;
                    }),
                    finalize(() =>
                        this.loading.update(value => {
                            value[canisterId] = false;
                            return value;
                        })
                    ),
                    catchError(err => {
                        this.#notificationService.error(err.message);
                        return throwError(() => err);
                    })
                )
                .subscribe(() => {
                    this.#notificationService.success(this.#translocoService.translate('canisters.messages.deleteOk', { id: canisterId }));
                });
        }
    }
}
