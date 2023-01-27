/// <reference lib="webworker" />

import { createStore, getMany, set } from 'idb-keyval';
import { Actor, ActorSubclass, HttpAgent, Identity } from '@dfinity/agent';
import { KEY_STORAGE_DELEGATION, KEY_STORAGE_KEY } from '@dfinity/auth-client';
import { DelegationChain, isDelegationValid } from '@dfinity/identity';
import { createActor, initIdentity } from '@core/utils';
import { defer, EMPTY, from, iif, map, of, switchMap } from 'rxjs';
import { isUndefined } from 'lodash';
import { canisterId, idlFactory } from 'declarations/rabbithole';
import { environment } from 'environments/environment';
import { _SERVICE as RabbitholeActor } from '@declarations/rabbithole/rabbithole.did';
import { RxState } from '@rx-angular/state';

interface State {
    actor: ActorSubclass<RabbitholeActor>;
}
const state = new RxState<State>();
state.select().subscribe(console.log);

addEventListener('message', ({ data }: MessageEvent) => {
    console.log('register worker:', data);
});

const loadIdentity = async (): Promise<Identity | undefined> => {
    const customStore = createStore('auth-client-db', 'ic-keyval');

    const [identityKey, delegationChain] = await getMany([KEY_STORAGE_KEY, KEY_STORAGE_DELEGATION], customStore);

    // No identity key or delegation key for the worker to fetch the cycles
    if (!identityKey || !delegationChain) {
        return undefined;
    }

    // If delegation is invalid, it will be catch by the idle timer
    if (!isDelegationValid(DelegationChain.fromJSON(delegationChain))) {
        return undefined;
    }

    return initIdentity({ identityKey, delegationChain });
};

state.connect(
    'actor',
    from(loadIdentity()).pipe(
        switchMap(identity =>
            iif(
                () => !isUndefined(identity),
                defer(() =>
                    createActor<RabbitholeActor>({ identity: identity as NonNullable<typeof identity>, canisterId, idlFactory, host: location.origin })
                ),
                EMPTY
            )
        )
    )
);
