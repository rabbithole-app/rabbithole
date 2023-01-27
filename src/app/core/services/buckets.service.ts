import { inject, Injectable } from '@angular/core';
import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { catchError, combineLatestWith, defer, EMPTY, from, iif, map, mergeMap, of, startWith, Subject, switchMap, throwError, toArray } from 'rxjs';
import { fromNullable } from '@dfinity/utils';
import { isUndefined } from 'lodash';

import { idlFactory as journalIdlFactory } from 'declarations/journal';
import { _SERVICE as JournalActor } from 'declarations/journal/journal.did';
import { idlFactory as storageIdlFactory } from 'declarations/storage';
import { _SERVICE as StorageActor } from 'declarations/storage/storage.did';
import { AUTH_RX_STATE } from 'app/core/stores/auth';
import { createActor } from 'app/core/utils/create-actor';

type Bucket<T> = {
    actor: ActorSubclass<T>;
    canisterId: string;
};

interface State {
    journal: ActorSubclass<JournalActor> | null;
    canisterId: Principal | null;
    storages: Bucket<StorageActor>[];
    loading: boolean;
}

@Injectable()
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
                        defer(() => {
                            this.set({ loading: true });
                            return actor.getJournalBucket();
                        }).pipe(
                            map(optCanister => fromNullable(optCanister)),
                            switchMap(canisterId => iif(() => isUndefined(canisterId), EMPTY, of(canisterId as Principal))),
                            switchMap(canisterId =>
                                createActor<JournalActor>({
                                    canisterId,
                                    idlFactory: journalIdlFactory,
                                    identity
                                }).pipe(
                                    switchMap(journalActor =>
                                        from(journalActor.listStorages()).pipe(
                                            switchMap(buckets => from(buckets)),
                                            mergeMap(bucketId =>
                                                createActor<StorageActor>({
                                                    canisterId: bucketId,
                                                    idlFactory: storageIdlFactory,
                                                    identity
                                                }).pipe(map(storageActor => ({ actor: storageActor, canisterId: bucketId.toText() } as Bucket<StorageActor>)))
                                            ),
                                            toArray(),
                                            map(
                                                storages =>
                                                    ({
                                                        journal: journalActor,
                                                        canisterId,
                                                        storages,
                                                        loading: false
                                                    } as unknown as Partial<State>)
                                            )
                                        )
                                    )
                                )
                            ),
                            catchError(err => throwError(() => err))
                        ),
                        of({ journal: null, canisterId: null, storages: [], loading: false })
                    )
                )
            )
        );
    }

    update() {
        this.updateJournal.next();
    }
}
