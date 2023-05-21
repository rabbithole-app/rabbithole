/// <reference lib="webworker" />

import { RxState } from '@rx-angular/state';
import { ActorSubclass, Identity } from '@dfinity/agent';
import { arrayBufferToUint8Array, fromNullable } from '@dfinity/utils';
import { Principal } from '@dfinity/principal';
import {
    Observable,
    Subject,
    concatWith,
    connect,
    exhaustMap,
    filter,
    first,
    forkJoin,
    from,
    map,
    merge,
    mergeMap,
    of,
    skip,
    switchMap,
    takeUntil,
    tap,
    timer,
    toArray,
    withLatestFrom
} from 'rxjs';
import { isNull, isUndefined } from 'lodash';
import { addSeconds, differenceInMilliseconds, isDate } from 'date-fns';

import { createActor, loadIdentity } from '@core/utils';
import { canisterId as rabbitholeCanisterId, idlFactory as rabbitholeIdlFactory } from 'declarations/rabbithole';
import { _SERVICE as RabbitholeActor } from '@declarations/rabbithole/rabbithole.did';
import { idlFactory as journalIdlFactory } from 'declarations/journal';
import { _SERVICE as JournalActor } from 'declarations/journal/journal.did';
import { idlFactory as storageIdlFactory } from 'declarations/storage';
import { _SERVICE as StorageActor } from 'declarations/storage/storage.did';
import { Bucket, FileUpload, FileUploadState, UPLOAD_STATUS } from '../models';
import { CHUNK_SIZE, CONCURRENT_CHUNKS_COUNT, CONCURRENT_FILES_COUNT } from '../constants';
import { getStorageBySize, uploadFile } from '../operators';

interface State {
    identity: Identity;
    actor: ActorSubclass<RabbitholeActor>;
    journal: ActorSubclass<JournalActor>;
    storages: Bucket<StorageActor>[];
    files: Record<string, FileUpload>;
    progress: Record<string, FileUploadState>;
}

const state = new RxState<State>();
state.set({ progress: {}, files: {} });
const files: Subject<{ item: FileUpload; uploadState: FileUploadState }> = new Subject();
const keepAlive: Subject<{ id: string; canisterId: string }> = new Subject();

addEventListener('message', ({ data }) => {
    const { action, item, id, uploadState } = data;
    switch (action) {
        case 'add': {
            state.set('files', state => ({ ...state.files, [item.id]: item }));
            files.next({ item, uploadState });
            break;
        }
        case 'pause': {
            updateProgress(id, { status: UPLOAD_STATUS.Paused });
            const canisterId = state.get('progress', id, 'canisterId');
            if (canisterId) {
                keepAlive.next({ id, canisterId });
            }
            break;
        }
        case 'resume':
        case 'retry': {
            const item = state.get('files', id);
            const previousState = state.get('progress', id);
            if (item) {
                updateProgress(id, { status: UPLOAD_STATUS.Queue });
                files.next({ item, uploadState: previousState });
            }
            break;
        }
        case 'cancel': {
            updateProgress(id, { status: UPLOAD_STATUS.Cancelled });
            break;
        }
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

function getStorage(fileSize: bigint): Observable<Bucket<StorageActor>> {
    return state.select('journal').pipe(
        first(),
        filter(actor => !isNull(actor)),
        map(actor => actor as NonNullable<typeof actor>),
        switchMap(actor => getStorageBySize(actor, fileSize)),
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

function updateProgress(id: string, value: Partial<FileUploadState> & { chunkSize?: number }) {
    state.set('progress', state => ({
        ...state.progress,
        [id]: { ...state.progress[id], ...value }
    }));
    postMessage({ action: 'progress', id, progress: value });
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

const keepAlive$ = keepAlive.asObservable().pipe(
    mergeMap(({ id, canisterId }) => {
        const off$ = state.select('progress', id, 'status').pipe(
            skip(1),
            filter(status => ![UPLOAD_STATUS.Failed, UPLOAD_STATUS.Cancelled].includes(status))
        );
        return state.select('progress', id, 'batch').pipe(
            first(),
            filter(batch => !isUndefined(batch) && isDate(batch.expiredAt)),
            map(batch => batch as NonNullable<typeof batch>),
            switchMap(batch =>
                timer(differenceInMilliseconds(batch.expiredAt, addSeconds(Date.now(), 5)), 60000).pipe(
                    switchMap(() => createStorageActor(Principal.fromText(canisterId))),
                    exhaustMap(({ actor }) => actor.batchAlive(batch.id)),
                    tap(() =>
                        updateProgress(id, {
                            batch: {
                                id: batch.id,
                                expiredAt: addSeconds(Date.now(), 25)
                            }
                        })
                    )
                )
            ),
            takeUntil(off$)
        );
    })
);

const fileUpload$ = files.asObservable().pipe(
    mergeMap(({ item, uploadState }) => {
        const cancelled$ = state.select('progress', item.id, 'status').pipe(filter(status => status === UPLOAD_STATUS.Cancelled));
        const paused$ = state.select('progress', item.id, 'status').pipe(filter(status => status === UPLOAD_STATUS.Paused));

        return of({ status: UPLOAD_STATUS.Request, errorMessage: null }).pipe(
            concatWith(
                forkJoin([
                    from(crypto.subtle.digest('SHA-256', arrayBufferToUint8Array(item.data))).pipe(map(arrayBufferToUint8Array)),
                    getStorage(BigInt(item.fileSize))
                ]).pipe(
                    switchMap(([sha256, storage]) =>
                        uploadFile({
                            storage,
                            item: { ...item, sha256 },
                            options: {
                                concurrentChunksCount: CONCURRENT_CHUNKS_COUNT,
                                chunkSize: CHUNK_SIZE
                            },
                            state: uploadState
                        }).pipe(
                            withLatestFrom(state.select('progress', item.id)),
                            map(([value, fileProgress]) => {
                                if (value.loaded) {
                                    let loaded = fileProgress.loaded ?? 0;
                                    let progress = fileProgress.progress ?? 0;
                                    loaded += value.loaded;
                                    progress = Math.ceil((loaded / item.fileSize) * 100);
                                    return { ...value, loaded, progress };
                                }

                                return value;
                            })
                        )
                    )
                )
            ),
            tap(progress => updateProgress(item.id, progress)),
            takeUntil(merge(cancelled$, paused$))
        );
    }, CONCURRENT_FILES_COUNT)
);

state.hold(keepAlive$);
state.hold(fileUpload$);
