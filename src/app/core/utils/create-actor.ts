import { Actor, ActorSubclass, Identity } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';
import { createAgent } from '@dfinity/utils';
import { environment } from 'environments/environment';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

export function createActor<T>({
    identity,
    canisterId,
    idlFactory,
    host
}: {
    identity: Identity;
    canisterId: string | Principal;
    idlFactory: IDL.InterfaceFactory;
    host?: string;
}): Observable<ActorSubclass<T>> {
    return from(createAgent({ identity, fetchRootKey: !environment.production, host })).pipe(
        map(agent =>
            Actor.createActor<T>(idlFactory, {
                agent,
                canisterId
            })
        )
    );
}
