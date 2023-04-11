/// <reference lib="webworker" />

import { ActorSubclass } from '@dfinity/agent';
import { createActor, loadIdentity } from '@core/utils';
import { defer, EMPTY, from, iif, switchMap } from 'rxjs';
import { isUndefined } from 'lodash';
import { canisterId, idlFactory } from 'declarations/rabbithole';
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
