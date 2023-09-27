import { InjectionToken } from '@angular/core';
import { ActorSubclass, AnonymousIdentity, Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { from, merge } from 'rxjs';
import { distinctUntilChanged, filter, first, map, switchMap } from 'rxjs/operators';

import { createActor, createAuthClient } from '@core/utils';
import { canisterId, idlFactory } from 'declarations/rabbithole';
import { _SERVICE as RabbitholeActor } from 'declarations/rabbithole/rabbithole.did';

export enum AuthStatus {
    Anonymous,
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
        .pipe(
            map(identity => identity.getPrincipal().toText()),
            distinctUntilChanged()
        )
        .subscribe(principalId => console.info(`Principal ID: ${principalId}`));
    const init$ = state.select(selectSlice(['client', 'isAuthenticated'])).pipe(
        map(({ client, isAuthenticated }) => ({
            client,
            status: isAuthenticated ? AuthStatus.Initialized : AuthStatus.Anonymous,
            identity: client.getIdentity()
        }))
    );
    const anonymous$ = state.select('status').pipe(
        filter(status => status === AuthStatus.Anonymous),
        switchMap(() =>
            state.select('client').pipe(
                first(),
                switchMap(client => from(client.logout()).pipe(switchMap(() => createAuthClient())))
            )
        ),
        switchMap(client => {
            const identity = new AnonymousIdentity();
            return createActor<RabbitholeActor>({
                identity,
                canisterId: canisterId as string,
                idlFactory
            }).pipe(
                map(actor => ({
                    client,
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
