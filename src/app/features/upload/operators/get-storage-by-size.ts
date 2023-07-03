import { _SERVICE as JournalActor } from '@declarations/journal/journal.did';
import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { fromNullable } from '@dfinity/utils';
import { isUndefined } from 'lodash';
import { Observable, defer, first, map, repeat } from 'rxjs';

export const getStorageBySize = (actor: ActorSubclass<JournalActor>, fileSize: bigint): Observable<Principal> =>
    defer(() => actor.getStorage(fileSize)).pipe(
        map(result => fromNullable<Principal>(result)),
        repeat({ delay: 500 }),
        first(bucketId => !isUndefined(bucketId)),
        map(bucketId => bucketId as Principal)
    );
