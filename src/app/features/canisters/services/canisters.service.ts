import { inject, Injectable } from '@angular/core';
import { Principal } from '@dfinity/principal';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { isNil } from 'lodash';
import { concat, defer, EMPTY, from, merge, of, throwError } from 'rxjs';
import { catchError, filter, map, mergeMap, repeat, retry, switchMap, takeUntil, toArray } from 'rxjs/operators';

import { BucketsService, NotificationService } from '@core/services';
import { AUTH_RX_STATE, AuthStatus } from '@core/stores';
import { CanisterDetailsRaw } from '../models';
import { canisterDetails } from '../operators';

interface State {
    journal: CanisterDetailsRaw;
    storages: CanisterDetailsRaw[];
    journalLoading: boolean;
    storagesLoading: boolean;
    storageVersion: bigint;
}

@Injectable()
export class CanistersService extends RxState<State> {
    authState = inject(AUTH_RX_STATE);
    bucketsService = inject(BucketsService);
    private notificationService = inject(NotificationService);
    readonly updateInterval = 10000;
    anonymous$ = this.authState.select('status').pipe(filter(status => status === AuthStatus.Anonymous));
    initialized$ = this.authState.select('status').pipe(filter(status => status === AuthStatus.Initialized));

    constructor() {
        super();
        const journalBucket$ = this.bucketsService.select(selectSlice(['journal', 'canisterId'])).pipe(
            filter(({ journal, canisterId }) => !isNil(journal) && !isNil(canisterId)),
            map(value => value as { journal: NonNullable<typeof value.journal>; canisterId: NonNullable<typeof value.canisterId> }),
            switchMap(({ journal, canisterId }) =>
                concat(
                    of({ journalLoading: true }),
                    defer(() => journal.canisterStatus(canisterId)).pipe(
                        canisterDetails(),
                        map(journal => ({ journal, journalLoading: false }))
                    )
                ).pipe(
                    catchError(err =>
                        concat(
                            of({ journalLoading: false }),
                            throwError(() => err)
                        )
                    ),
                    repeat({ delay: this.updateInterval }),
                    retry({ count: 3, delay: 1000 }),
                    catchError(err => {
                        this.notificationService.error(err.message);
                        return throwError(() => err);
                    })
                )
            )
        );
        const storageBucket$ = this.bucketsService.select(selectSlice(['journal', 'storages'])).pipe(
            filter(({ journal }) => !isNil(journal)),
            switchMap(({ journal, storages }) =>
                concat(
                    of({ storagesLoading: true }),
                    from(storages).pipe(
                        mergeMap(({ canisterId }) => (journal as NonNullable<typeof journal>).canisterStatus(Principal.fromText(canisterId as string))),
                        canisterDetails(),
                        toArray(),
                        map(storages => ({ storages, storagesLoading: false }))
                    )
                ).pipe(
                    catchError(err =>
                        concat(
                            of({ storagesLoading: false }),
                            throwError(() => err)
                        )
                    ),
                    repeat({ delay: this.updateInterval }),
                    retry({ count: 3, delay: 1000 }),
                    catchError(err => {
                        this.notificationService.error(err.message);
                        return throwError(() => err);
                    })
                )
            )
        );
        this.connect(
            this.bucketsService.select('storages').pipe(
                filter(storages => storages.length > 0),
                map(storages => storages[0]),
                switchMap(({ actor }) => actor.version()),
                catchError(err => {
                    console.error(err);
                    return EMPTY;
                }),
                map(storageVersion => ({ storageVersion }))
            )
        );

        this.connect(merge(journalBucket$, storageBucket$).pipe(takeUntil(this.anonymous$), repeat({ delay: () => this.initialized$ })));
    }
}
