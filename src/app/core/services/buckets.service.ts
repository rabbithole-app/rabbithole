import { inject, Injectable } from '@angular/core';
import { ActorSubclass, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { fromNullable } from '@dfinity/utils';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { isNull, isUndefined } from 'lodash';
import { combineLatest, concat, defer, from, iif, merge, Observable, of, Subject, throwError } from 'rxjs';
import { catchError, combineLatestWith, connect, first, map, mergeMap, startWith, switchMap, tap, toArray } from 'rxjs/operators';

import { getStorageBySize } from '@features/upload/operators';
import { AUTH_RX_STATE } from 'app/core/stores/auth';
import { createActor } from 'app/core/utils/create-actor';
import { idlFactory as journalIdlFactory } from 'declarations/journal';
import { _SERVICE as JournalActor } from 'declarations/journal/journal.did';
import { idlFactory as storageIdlFactory } from 'declarations/storage';
import { _SERVICE as StorageActor } from 'declarations/storage/storage.did';

type Bucket<T> = {
    actor: ActorSubclass<T>;
    canisterId: string;
};

interface State {
    journal: ActorSubclass<JournalActor> | null;
    canisterId: Principal | null;
    storages: Bucket<StorageActor>[];
    loading: boolean;
    loaded: boolean;
}

@Injectable({ providedIn: 'root' })
export class BucketsService extends RxState<State> {
    private authState = inject(AUTH_RX_STATE);
    private updateJournal: Subject<void> = new Subject<void>();

    constructor() {
        super();
        this.set({ loading: false, storages: [] });
        this.connect(
            this.authState.select(selectSlice(['actor', 'identity', 'isAuthenticated'])).pipe(
                combineLatestWith(this.updateJournal.asObservable().pipe(startWith(null))),
                switchMap(([{ actor, identity, isAuthenticated }]) =>
                    iif(
                        () => isAuthenticated,
                        defer(() =>
                            concat(
                                of({ loading: true }),
                                from(actor.getJournalBucket()).pipe(
                                    map(optCanister => fromNullable(optCanister)),
                                    switchMap(canisterId =>
                                        iif(
                                            () => isUndefined(canisterId),
                                            of({ journal: null, canisterId: null, loaded: true }),
                                            this.loadActors(canisterId as Principal, identity)
                                        )
                                    )
                                ),
                                of({ loading: false })
                            )
                        ),
                        of({ journal: null, canisterId: null, storages: [], loading: false, loaded: false })
                    )
                )
            )
        );
    }

    private loadActors(canisterId: Principal, identity: Identity): Observable<Partial<State>> {
        return createActor<JournalActor>({
            canisterId,
            idlFactory: journalIdlFactory,
            identity
        }).pipe(
            connect(shared =>
                merge(
                    shared.pipe(map(journal => ({ journal, canisterId, loaded: true }))),
                    shared.pipe(
                        switchMap(journalActor =>
                            from(journalActor.listStorages()).pipe(
                                switchMap(buckets => from(buckets)),
                                mergeMap(bucketId =>
                                    createActor<StorageActor>({
                                        canisterId: bucketId,
                                        idlFactory: storageIdlFactory,
                                        identity
                                    }).pipe(map(storageActor => ({ actor: storageActor, canisterId: bucketId.toText() })))
                                ),
                                toArray(),
                                map(storages => ({ storages }))
                            )
                        ),
                        catchError(err => throwError(() => err))
                    )
                )
            )
        );
    }

    update() {
        this.updateJournal.next();
    }

    getStorage(canisterId: string): Observable<Bucket<StorageActor>> {
        return combineLatest([this.select('storages'), this.authState.select('identity')]).pipe(
            switchMap(([storages, identity]) => {
                const found: Bucket<StorageActor> | undefined = storages.find(value => canisterId === value.canisterId);
                if (found) {
                    return of(found);
                } else {
                    return createActor<StorageActor>({ canisterId, idlFactory: storageIdlFactory, identity }).pipe(
                        map(actor => ({ actor, canisterId })),
                        tap(storage => this.set('storages', state => [...state.storages, storage]))
                    );
                }
            })
        );
    }

    getStorageBySize(fileSize: bigint): Observable<Bucket<StorageActor>> {
        return this.select('journal').pipe(
            first((actor): actor is NonNullable<typeof actor> => !isNull(actor)),
            switchMap(actor => getStorageBySize(actor, fileSize)),
            switchMap(bucketId => this.getStorage(bucketId.toText()))
        );
    }
}
