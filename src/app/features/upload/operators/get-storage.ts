import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { fromNullable } from '@dfinity/utils';
import { Observable, filter, from, map, repeat, share } from 'rxjs';
import { isUndefined } from 'lodash';
import { _SERVICE as JournalActor } from '@declarations/journal/journal.did';

export function getStorage(actor: ActorSubclass<JournalActor>, fileSize: bigint): Observable<Principal> {
    const storage$ = from(actor.getStorage(fileSize)).pipe(
        map(result => fromNullable<Principal>(result)),
        share()
    );
    return storage$.pipe(
        repeat({
            delay: () => storage$.pipe(filter(bucketId => isUndefined(bucketId)))
        }),
        map(bucketId => bucketId as Principal)
    );
}
