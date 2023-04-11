import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { fromNullable } from '@dfinity/utils';
import { Observable, filter, from, map, repeat, share, switchMap } from 'rxjs';
import { isUndefined } from 'lodash';
import { _SERVICE as JournalActor } from '@declarations/journal/journal.did';

export function getStorage(fileSize: bigint): (source$: Observable<ActorSubclass<JournalActor>>) => Observable<Principal> {
    return source$ =>
        source$.pipe(
            switchMap(actor => {
                const storage$ = from((actor as NonNullable<typeof actor>).getStorage(fileSize)).pipe(
                    map(result => fromNullable<Principal>(result)),
                    share()
                );
                return storage$.pipe(
                    repeat({
                        delay: () => storage$.pipe(filter(bucketId => isUndefined(bucketId)))
                    }),
                    map(bucketId => bucketId as Principal)
                );
            })
        );
}
