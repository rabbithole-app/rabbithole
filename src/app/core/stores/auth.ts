import { InjectionToken } from '@angular/core';
import { RxState } from '@rx-angular/state';
import { filter, from, merge, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthClient } from '@dfinity/auth-client';
import { ActorSubclass, AnonymousIdentity, Identity } from '@dfinity/agent';

import { createActor, createAuthClient } from '@core/utils';
import { _SERVICE as RabbitholeActor } from 'declarations/rabbithole/rabbithole.did';
import { canisterId, idlFactory } from 'declarations/rabbithole';

export enum AuthStatus {
    Anonymous,
    // InitializingCrypto,
    Initialized
}

export interface AuthState {
    status: AuthStatus;
    client: AuthClient;
    actor: ActorSubclass<RabbitholeActor>;
    identity: Identity;
    isAuthenticated: boolean;
    worker: Worker;
}

export const authStateFactory = () => {
    const state = new RxState<AuthState>();
    state
        .select('identity')
        .pipe(map(identity => identity.getPrincipal().toText()))
        .subscribe(principalId => console.info(`Principal ID: ${principalId}`));
    const init$ = from(createAuthClient()).pipe(
        switchMap(client =>
            from(client.isAuthenticated()).pipe(
                map(isAuthenticated => ({
                    client,
                    status: isAuthenticated ? AuthStatus.Initialized : AuthStatus.Anonymous,
                    identity: client.getIdentity()
                }))
            )
        )
    );
    const anonymous$ = state.select('status').pipe(
        filter(status => status === AuthStatus.Anonymous),
        switchMap(() => {
            const identity = new AnonymousIdentity();
            return createActor<RabbitholeActor>({
                identity,
                canisterId: canisterId as string,
                idlFactory
            }).pipe(
                map(actor => ({
                    identity,
                    actor,
                    isAuthenticated: false
                }))
            );
        })
    );
    const authenticated$ = state.select('status').pipe(
        filter(status => status === AuthStatus.Initialized),
        switchMap(() => {
            const identity = state.get('client').getIdentity();
            return createActor<RabbitholeActor>({ identity, canisterId: canisterId as string, idlFactory }).pipe(
                map(actor => ({
                    identity,
                    actor,
                    isAuthenticated: true
                }))
            );
        })
    );
    state.connect(merge(init$, anonymous$, authenticated$));

    if (typeof Worker !== 'undefined') {
        const worker = new Worker(new URL('../workers/auth.worker', import.meta.url));
        state.set({ worker });
    }

    return state;
};

export const AUTH_RX_STATE = new InjectionToken<RxState<AuthState>>('AUTH_RX_STATE', {
    providedIn: 'root',
    factory: authStateFactory
});
