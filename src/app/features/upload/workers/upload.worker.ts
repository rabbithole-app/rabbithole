/// <reference lib="webworker" />

import { RxState } from '@rx-angular/state';
import { ActorSubclass, Identity } from '@dfinity/agent';
import { fromNullable } from '@dfinity/utils';
import { Principal } from '@dfinity/principal';
import { Observable, Subject, concat, connect, filter, first, from, map, merge, mergeMap, of, switchMap, takeUntil, tap, toArray, withLatestFrom } from 'rxjs';
import { isNull, isUndefined } from 'lodash';

import { createActor, loadIdentity } from '@core/utils';
import { canisterId as rabbitholeCanisterId, idlFactory as rabbitholeIdlFactory } from 'declarations/rabbithole';
import { _SERVICE as RabbitholeActor } from '@declarations/rabbithole/rabbithole.did';
import { idlFactory as journalIdlFactory } from 'declarations/journal';
import { _SERVICE as JournalActor } from 'declarations/journal/journal.did';
import { idlFactory as storageIdlFactory } from 'declarations/storage';
import { _SERVICE as StorageActor } from 'declarations/storage/storage.did';
import { Bucket, FileUpload, FileUploadState, Summary, UPLOAD_STATUS } from '../models';
import { CHUNK_SIZE, CONCURRENT_CHUNKS_COUNT, CONCURRENT_FILES_COUNT } from '../constants';
import { getStorage, uploadFile } from '../operators';

interface State {
    identity: Identity;
    actor: ActorSubclass<RabbitholeActor>;
    journal: ActorSubclass<JournalActor>;
    storages: Bucket<StorageActor>[];
}

const state = new RxState<State>();
const files: Subject<{ item: FileUpload; uploadState: FileUploadState }> = new Subject();

addEventListener('message', ({ data }) => {
    const { action, item, uploadState } = data;
    switch (action) {
        case 'add':
            files.next({ item, uploadState });
            break;
        default:
            break;
    }
});

function createRabbitholeActor(): Observable<ActorSubclass<RabbitholeActor>> {
    return state.select('identity').pipe(
        switchMap(identity =>
            createActor<RabbitholeActor>({
                identity,
                canisterId: rabbitholeCanisterId,
                idlFactory: rabbitholeIdlFactory,
                host: location.origin
            })
        )
    );
}

function createJournalActor(canisterId: Principal): Observable<ActorSubclass<JournalActor>> {
    return state.select('identity').pipe(
        first(),
        switchMap(identity =>
            createActor<JournalActor>({
                identity,
                canisterId,
                idlFactory: journalIdlFactory,
                host: location.origin
            })
        )
    );
}

function createStorageActor(canisterId: Principal): Observable<Bucket<StorageActor>> {
    return state.select('identity').pipe(
        first(),
        switchMap(identity =>
            createActor<StorageActor>({
                canisterId,
                idlFactory: storageIdlFactory,
                identity,
                host: location.origin
            })
        ),
        map(actor => ({ actor, canisterId: canisterId.toText() }))
    );
}

function loadJournal(): (source$: Observable<ActorSubclass<RabbitholeActor>>) => Observable<Principal> {
    return source$ =>
        source$.pipe(
            switchMap(actor =>
                from(actor.getJournalBucket()).pipe(
                    map(optCanister => fromNullable(optCanister)),
                    filter(canisterId => !isUndefined(canisterId)),
                    map(canisterId => canisterId as NonNullable<typeof canisterId>)
                )
            )
        );
}

function initStorages(): (source$: Observable<ActorSubclass<JournalActor>>) => Observable<Bucket<StorageActor>[]> {
    return source$ =>
        source$.pipe(
            switchMap(journalActor =>
                from(journalActor.listStorages()).pipe(
                    switchMap(buckets => from(buckets)),
                    mergeMap(bucketId => createStorageActor(bucketId)),
                    toArray()
                )
            )
        );
}

function initStorage(fileSize: bigint): Observable<Bucket<StorageActor>> {
    return state.select('journal').pipe(
        first(),
        filter(actor => !isNull(actor)),
        map(actor => actor as NonNullable<typeof actor>),
        switchMap(actor => getStorage(actor, fileSize)),
        withLatestFrom(state.select('storages')),
        switchMap(([bucketId, storages]) => {
            const canisterId = bucketId.toText();
            const found: Bucket<StorageActor> | undefined = storages.find(value => canisterId === value.canisterId);
            if (found) {
                return of(found);
            } else {
                return createStorageActor(bucketId).pipe(tap(value => state.set('storages', ({ storages }) => [...storages, value])));
            }
        })
    );
}

const identity$ = from(loadIdentity()).pipe(
    filter(identity => !isUndefined(identity)),
    map(identity => identity as NonNullable<typeof identity>)
);
state.connect('identity', identity$);

state.connect(
    createRabbitholeActor().pipe(
        connect(shared =>
            merge(
                shared.pipe(map(actor => ({ actor }))),
                shared.pipe(
                    loadJournal(),
                    switchMap(canisterId => createJournalActor(canisterId)),
                    connect(sharedJournal =>
                        merge(
                            sharedJournal.pipe(map(journal => ({ journal }))),
                            sharedJournal.pipe(
                                initStorages(),
                                map(storages => ({ storages }))
                            )
                        )
                    )
                )
            )
        )
    )
);

const chunks$ = files.asObservable().pipe(
    mergeMap(({ item, uploadState }) => {
        return concat(
            of({ status: UPLOAD_STATUS.Request, errorMessage: null }),
            initStorage(BigInt(item.fileSize)).pipe(
                switchMap(storage =>
                    uploadFile({
                        storage,
                        item,
                        options: {
                            concurrentChunksCount: CONCURRENT_CHUNKS_COUNT,
                            chunkSize: CHUNK_SIZE
                        },
                        state: uploadState
                    })
                )
            )
        ).pipe(
            tap(progress => {
                postMessage({ action: 'progress', id: item.id, progress });
            })
            // takeUntil(merge(paused$, cancelled$))
        );
    }, CONCURRENT_FILES_COUNT)
);

state.hold(chunks$);
