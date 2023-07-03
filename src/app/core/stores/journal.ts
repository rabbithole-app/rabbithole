import { InjectionToken, Provider } from '@angular/core';
import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { fromNullable } from '@dfinity/utils';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { isUndefined } from 'lodash';
import { EMPTY, catchError, defer, from, iif, map, mergeMap, of, switchMap, throwError, toArray } from 'rxjs';

import { AUTH_RX_STATE, AuthState } from 'app/core/stores/auth';
import { createActor } from 'app/core/utils/create-actor';
import { idlFactory as journalIdlFactory } from 'declarations/journal';
import { _SERVICE as JournalActor } from 'declarations/journal/journal.did';
import { idlFactory as storageIdlFactory } from 'declarations/storage';
import { _SERVICE as StorageActor } from 'declarations/storage/storage.did';

export type Bucket<T> = {
    actor: ActorSubclass<T>;
    canisterId: string;
};

export interface JournalState {
    actor: ActorSubclass<JournalActor> | null;
    canisterId: Principal | null;
    storages: Bucket<StorageActor>[];
    loading: boolean;
    log: string;
}

export const JOURNAL_RX_STATE = new InjectionToken<RxState<JournalState>>('JOURNAL_RX_STATE');

export const journalStateFactory = (authState: RxState<AuthState>) => {
    const state = new RxState<JournalState>();
    state.set({ loading: false, storages: [] });
    state.connect(
        authState.select(selectSlice(['actor', 'identity', 'isAuthenticated'])).pipe(
            switchMap(({ actor, identity, isAuthenticated }) =>
                iif(
                    () => isAuthenticated,
                    defer(() => {
                        state.set({ loading: true });
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
                                switchMap(actor =>
                                    from(actor.listStorages()).pipe(
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
                                                    actor,
                                                    canisterId,
                                                    storages,
                                                    loading: false
                                                } as unknown as Partial<JournalState>)
                                        )
                                    )
                                )
                            )
                        ),
                        catchError(err => throwError(() => err))
                    ),
                    of({ actor: null, canisterId: null, storages: [], loading: false })
                )
            )
        )
    );

    return state;
};

export const journalStateProvider: Provider = {
    provide: JOURNAL_RX_STATE,
    useFactory: journalStateFactory,
    deps: [AUTH_RX_STATE]
};
