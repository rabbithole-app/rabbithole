/// <reference lib="webworker" />

import { createActor, loadIdentity } from '@core/utils';
import { _SERVICE as RabbitholeActor } from '@declarations/rabbithole/rabbithole.did';
import { ActorSubclass } from '@dfinity/agent';
import { RxState } from '@rx-angular/state';
import { canisterId, idlFactory } from 'declarations/rabbithole';
import { environment } from 'environments/environment';
import { isUndefined } from 'lodash';
import { EMPTY, defer, from, iif } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface State {
    actor: ActorSubclass<RabbitholeActor>;
}
const state = new RxState<State>();

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
                    createActor<RabbitholeActor>({
                        identity: identity as NonNullable<typeof identity>,
                        canisterId,
                        idlFactory,
                        host: environment.httpAgentHost
                    })
                ),
                EMPTY
            )
        )
    )
);
