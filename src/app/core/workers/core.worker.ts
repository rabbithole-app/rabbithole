/// <reference lib="webworker" />

import { ActorSubclass, AnonymousIdentity, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { arrayBufferToUint8Array, arrayOfNumberToUint8Array, createAgent, fromNullable, toNullable } from '@dfinity/utils';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { PhotonImage, crop, resize } from '@silvia-odwyer/photon';
import { addSeconds, differenceInMilliseconds, isDate } from 'date-fns';
import { defaults, get, has, isNull, isUndefined, omit, partition, pick, sortBy } from 'lodash';
import { CropperPosition } from 'ngx-image-cropper';
import { EMPTY, MonoTypeOperatorFunction, Observable, Subject, concat, defer, forkJoin, from, iif, merge, of, onErrorResumeNextWith, pipe, timer } from 'rxjs';
import {
    catchError,
    combineLatestWith,
    concatWith,
    connect,
    exhaustMap,
    filter,
    first,
    ignoreElements,
    map,
    mergeMap,
    reduce,
    repeat,
    scan,
    skip,
    switchMap,
    takeUntil,
    tap,
    toArray,
    withLatestFrom
} from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { createActor, decryptArrayBuffer, initVetAesGcmKey, loadIdentity, loadWasm } from '@core/utils';
import { _SERVICE as RabbitholeActor } from '@declarations/rabbithole/rabbithole.did';
import { ICManagementCanister } from '@dfinity/ic-management';
import { DownloadComplete, DownloadFailed, DownloadProgress, DownloadRetrieveKey, DownloadStatus, FileInfoExtended } from '@features/file-list/models';
import { concatUint8Arrays, toDirectoryExtended, toFileExtended } from '@features/file-list/utils';
import { SharedFileExtended } from '@features/shared-with-me/models';
import { toSharedFileExtended } from '@features/shared-with-me/utils';
import { CHUNK_SIZE, CONCURRENT_CHUNKS_COUNT, CONCURRENT_FILES_COUNT } from '@features/upload/constants';
import { Bucket, FileUpload, FileUploadState, UPLOAD_STATUS } from '@features/upload/models';
import { getStorageBySize, simpleUploadFile, uploadFile } from '@features/upload/operators';
import { MAX_AVATAR_HEIGHT, MAX_AVATAR_WIDTH, MAX_THUMBNAIL_HEIGHT, MAX_THUMBNAIL_WIDTH } from 'app/constants';
import { idlFactory as journalIdlFactory } from 'declarations/journal';
import { DirectoryState, DirectoryStateError, _SERVICE as JournalActor } from 'declarations/journal/journal.did';
import { canisterId as rabbitholeCanisterId, idlFactory as rabbitholeIdlFactory } from 'declarations/rabbithole';
import { idlFactory as storageIdlFactory } from 'declarations/storage';
import { AssetInfo, _SERVICE as StorageActor } from 'declarations/storage/storage.did';
import { environment } from 'environments/environment';

interface State {
    identity: Identity;
    actor: ActorSubclass<RabbitholeActor>;
    journal: ActorSubclass<JournalActor>;
    journalId: Principal;
    storages: Bucket<StorageActor>[];
    files: Record<string, FileUpload>;
    progress: Record<string, FileUploadState>;
    wasmLoaded: boolean;
}

function isSharedFile(item: FileInfoExtended | SharedFileExtended): item is SharedFileExtended {
    return has(item, 'sharedWith');
}

const state = new RxState<State>();
const updateJournal: Subject<string | undefined> = new Subject();
const listFiles: Subject<string | undefined> = new Subject();
state.set({ progress: {}, files: {}, wasmLoaded: false });
const files: Subject<{
    item: FileUpload;
    uploadState: FileUploadState;
    options?: {
        silent?: boolean;
        encryption?: boolean;
        thumbnail?: boolean;
    };
}> = new Subject();
const keepAlive: Subject<{ id: string; canisterId: string }> = new Subject();
const cropImage: Subject<{
    id: string;
    image: File;
    cropper: { position: CropperPosition; maxSize: { width: number; height: number } };
    canvas: OffscreenCanvas;
    maxWidth?: number;
    maxHeight?: number;
}> = new Subject();
const sharedTimer: Subject<boolean> = new Subject();
const sharedTimerOn$ = sharedTimer.asObservable().pipe(filter(v => v));
const sharedTimerOff$ = sharedTimer.asObservable().pipe(filter(v => !v));
const SHARED_WITH_ME_INTERVAL = 10000;
const canistersTimer: Subject<boolean> = new Subject();
const canistersTimerOn$ = canistersTimer.asObservable().pipe(filter(v => v));
const canistersTimerOff$ = canistersTimer.asObservable().pipe(filter(v => !v));

addEventListener('message', ({ data }) => {
    switch (data.action) {
        case 'getJournal': {
            updateJournal.next(data.path);
            break;
        }
        case 'getFilesByParentId': {
            listFiles.next(data.parentId);
            break;
        }
        case 'addUpload': {
            state.set('files', state => ({ ...state.files, [data.item.id]: data.item }));
            files.next({
                item: data.item,
                uploadState: data.uploadState,
                options: defaults(data.options, {
                    silent: false,
                    thumbnail: true,
                    encryption: true
                })
            });
            break;
        }
        case 'pauseUpload': {
            updateProgress(data.id, { status: UPLOAD_STATUS.Paused });
            const canisterId = state.get('progress', data.id, 'canisterId');
            if (canisterId) {
                keepAlive.next({ id: data.id, canisterId });
            }
            break;
        }
        case 'resumeUpload':
        case 'retryUpload': {
            const item = state.get('files', data.id);
            const previousState = state.get('progress', data.id);
            if (item) {
                updateProgress(data.id, { status: UPLOAD_STATUS.Queue });
                files.next({ item, uploadState: previousState });
            }
            break;
        }
        case 'cancelUpload': {
            updateProgress(data.id, { status: UPLOAD_STATUS.Cancelled });
            break;
        }
        case 'download': {
            const [sharedFiles, userFiles] = partition<SharedFileExtended | FileInfoExtended, SharedFileExtended>(data.items, isSharedFile);
            const [encryptedItems, decryptedItems] = partition(userFiles, 'encrypted');
            const sharedEncrypted$ = sharedFiles.length
                ? from(sharedFiles).pipe(
                      mergeMap(({ id, name, owner, journalId, storageId }) =>
                          downloadEncryptedFile({
                              id,
                              owner: Principal.fromText(owner),
                              journalId: Principal.fromText(journalId),
                              name,
                              storageId: Principal.fromText(storageId)
                          }).pipe(onErrorResumeNextWith())
                      )
                  )
                : EMPTY;
            const encrypted$ = encryptedItems.length
                ? from(encryptedItems).pipe(
                      mergeMap(({ id, name, storageId }) =>
                          state.select(selectSlice(['journalId', 'identity'])).pipe(
                              first(),
                              switchMap(({ journalId, identity }) =>
                                  downloadEncryptedFile({
                                      id,
                                      name,
                                      owner: identity.getPrincipal(),
                                      journalId,
                                      storageId: Principal.fromText(storageId)
                                  })
                              ),
                              onErrorResumeNextWith()
                          )
                      )
                  )
                : EMPTY;
            const decrypted$ = decryptedItems.length
                ? from(decryptedItems).pipe(mergeMap(({ id, name, storageId }) => downloadFile({ id, name, storageId: Principal.fromText(storageId) })))
                : EMPTY;
            merge(sharedEncrypted$, encrypted$, decrypted$).subscribe();
            break;
        }
        case 'cropImage': {
            cropImage.next({ ...pick(data, ['id', 'image', 'cropper', 'canvas']), maxWidth: MAX_AVATAR_WIDTH, maxHeight: MAX_AVATAR_HEIGHT });
            break;
        }
        case 'startSharedTimer':
            sharedTimer.next(true);
            break;
        case 'stopSharedTimer':
            sharedTimer.next(false);
            break;
        case 'startCanistersTimer':
            canistersTimer.next(true);
            break;
        case 'stopCanistersTimer':
            canistersTimer.next(false);
            break;
        default:
            break;
    }
});
postMessage({ action: 'init' });

function createRabbitholeActor(): Observable<ActorSubclass<RabbitholeActor>> {
    return state.select('identity').pipe(
        switchMap(identity =>
            createActor<RabbitholeActor>({
                identity,
                canisterId: rabbitholeCanisterId,
                idlFactory: rabbitholeIdlFactory,
                host: environment.httpAgentHost ?? location.origin
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
                host: environment.httpAgentHost ?? location.origin
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
                host: environment.httpAgentHost ?? location.origin
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
        first((actor): actor is NonNullable<typeof actor> => !isNull(actor)),
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
    postMessage({ action: 'progressUpload', id, progress: value });
}

const identity$ = from(loadIdentity()).pipe(
    map(identity => {
        if (isUndefined(identity)) {
            return new AnonymousIdentity();
        }

        return identity;
    })
);
state.connect('identity', identity$);

// state.connect(
//     'vetAesGcmKey',
//     state.select(selectSlice(['journal', 'identity'])).pipe(switchMap(({ journal, identity }) => initVetAesGcmKey(identity.getPrincipal(), journal)))
// );

state.connect(
    createRabbitholeActor().pipe(
        connect(shared =>
            merge(
                shared.pipe(map(actor => ({ actor }))),
                shared.pipe(
                    loadJournal(),
                    switchMap(canisterId => createJournalActor(canisterId).pipe(map(journal => ({ journal, journalId: canisterId })))),
                    connect(sharedJournal =>
                        merge(
                            sharedJournal,
                            sharedJournal.pipe(
                                map(({ journal }) => journal),
                                initStorages(),
                                map(storages => ({ storages }))
                            )
                        )
                    )
                )
            )
        ),
        catchError(err => {
            if (err.message.includes('Failed to authenticate request') || err.message.includes('Internal Server Error')) {
                postMessage({ action: 'rabbitholeSignOutAuthTimer' });
            }

            return EMPTY;
        })
    )
);

updateJournal
    .asObservable()
    .pipe(
        combineLatestWith(state.select('journal')),
        switchMap(([path, actor]) =>
            from(actor.getJournal(toNullable(path || undefined))).pipe(
                map(response => {
                    if (has(response, 'err')) {
                        const err = Object.keys(get(response, 'err') as unknown as DirectoryStateError)[0];
                        const message = `fileList.directory.get.errors.${err}`;
                        throw new Error(message);
                    }

                    const journal = get(response, 'ok') as unknown as DirectoryState;
                    const dirs = journal.dirs.map(toDirectoryExtended);
                    const files = journal.files.map(toFileExtended);
                    const breadcrumbs = journal.breadcrumbs.map(toDirectoryExtended);
                    const parentId = fromNullable<string>(journal.id);

                    return {
                        items: [...dirs, ...files],
                        breadcrumbs,
                        parent: parentId && path ? { id: parentId, path } : undefined
                    };
                })
            )
        ),
        catchError(err => {
            postMessage({ action: 'getJournalFailed', errorCode: err.message });
            return EMPTY;
        })
    )
    .subscribe(data => {
        postMessage({ action: 'getJournalSuccess', payload: data });
    });

listFiles
    .asObservable()
    .pipe(
        combineLatestWith(state.select('journal')),
        switchMap(([parentId, actor]) =>
            from(actor.listFiles(toNullable(parentId || undefined))).pipe(map(items => ({ parentId, items: items.map(toFileExtended) })))
        ),
        catchError(err => {
            postMessage({ action: 'getFilesByParentIdFailed', errorMessage: err.message });
            return EMPTY;
        })
    )
    .subscribe(data => {
        postMessage({ action: 'getFilesByParentIdDone', payload: data });
    });

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
    mergeMap(({ item, uploadState, options }) => {
        const cancelled$ = state.select('progress', item.id, 'status').pipe(filter(status => status === UPLOAD_STATUS.Cancelled));
        const paused$ = state.select('progress', item.id, 'status').pipe(filter(status => status === UPLOAD_STATUS.Paused));

        return of({ status: UPLOAD_STATUS.Request, errorMessage: null }).pipe(
            concatWith(
                forkJoin([
                    from(crypto.subtle.digest('SHA-256', arrayBufferToUint8Array(item.data))).pipe(map(arrayBufferToUint8Array)),
                    getStorage(BigInt(item.fileSize)),
                    defer(() =>
                        options && options.encryption
                            ? state.select(selectSlice(['journal', 'identity'])).pipe(
                                  first(),
                                  switchMap(({ journal, identity }) => initVetAesGcmKey(item.id, identity.getPrincipal(), journal, false)),
                                  // switchMap(aesKey => encryptArrayBuffer(aesKey, item.data)),
                                  catchError(err => {
                                      console.error(err);
                                      return EMPTY;
                                  })
                              )
                            : of(undefined)
                    ),
                    defer(() => {
                        if (options && typeof options.thumbnail === 'boolean' && !options.thumbnail) {
                            return of(undefined);
                        }
                        const id = uuidv4();
                        let photonImage = PhotonImage.new_from_byteslice(arrayBufferToUint8Array(item.data));
                        const [width, height] = [photonImage.get_width(), photonImage.get_height()];
                        const ratio = Math.min(MAX_THUMBNAIL_WIDTH / width, MAX_THUMBNAIL_HEIGHT / height);
                        if (ratio < 1) {
                            const newWidth = width * ratio;
                            const newHeight = height * ratio;
                            photonImage = resize(photonImage, newWidth, newHeight, 5);
                        }

                        if (['image/gif', 'image/png'].includes(item.contentType) && item.canvas) {
                            const ctx = item.canvas.getContext('2d');
                            const imageData = photonImage.get_image_data();
                            item.canvas.width = imageData.width;
                            item.canvas.height = imageData.height;
                            ctx?.putImageData(imageData, 0, 0);
                            return from(item.canvas.convertToBlob()).pipe(
                                switchMap(blob => blob.arrayBuffer()),
                                map(buffer => ({ id, data: arrayBufferToUint8Array(buffer), contentType: 'image/png' }))
                            );
                        }
                        const data = photonImage.get_bytes_jpeg(90);
                        return of({ id, data, contentType: 'image/jpeg' });
                    }).pipe(
                        map(value => {
                            if (value) {
                                return { ...value, name: `thumbnail_${value.id}`, fileSize: value.data.byteLength, parentId: '.rabbithole' };
                            }
                            return value;
                        }),
                        catchError(() => of(undefined))
                    )
                ]).pipe(
                    switchMap(([sha256, storage, aesKey, thumbnail]) => {
                        const itemData = { ...item, sha256, thumbnail: thumbnail?.id };
                        const uploadFile$ = uploadFile({
                            storage,
                            item: itemData,
                            options: {
                                concurrentChunksCount: CONCURRENT_CHUNKS_COUNT,
                                chunkSize: CHUNK_SIZE,
                                aesKey
                            },
                            state: uploadState
                        }).pipe(
                            withLatestFrom(state.select('progress', item.id)),
                            map(([value, fileProgress]) => {
                                if (value.loaded) {
                                    let loaded = fileProgress.loaded ?? 0;
                                    let progress = fileProgress.progress ?? 0;
                                    loaded += value.loaded;
                                    progress = Math.ceil((loaded / itemData.fileSize) * 100);
                                    return { ...value, loaded, progress };
                                }

                                return value;
                            })
                        );
                        return iif(
                            () => isUndefined(thumbnail),
                            uploadFile$,
                            defer(() => merge(uploadFile$, from(simpleUploadFile(thumbnail as NonNullable<typeof thumbnail>, storage)).pipe(ignoreElements())))
                        ).pipe(
                            catchError(err => {
                                console.error(err);
                                return EMPTY;
                            })
                        );
                    }),
                    catchError(err => {
                        const res = err.message.match(/(?:Body|Reject text): (.+)/);
                        const errorMessage = isNull(res) ? err.message : res[1];
                        return of({
                            status: UPLOAD_STATUS.Failed,
                            errorMessage
                        });
                    })
                )
            ),
            tap(progress => updateProgress(item.id, progress)),
            takeUntil(merge(cancelled$, paused$))
        );
    }, CONCURRENT_FILES_COUNT)
);

cropImage
    .asObservable()
    .pipe(
        mergeMap(({ id, image, cropper, canvas, maxWidth, maxHeight }) =>
            from(image.arrayBuffer()).pipe(
                switchMap(buffer => {
                    let photonImage = PhotonImage.new_from_byteslice(arrayBufferToUint8Array(buffer));
                    const [width, height] = [photonImage.get_width(), photonImage.get_height()];
                    const ratioW = width / cropper.maxSize.width;
                    const ratioH = height / cropper.maxSize.height;
                    photonImage = crop(
                        photonImage,
                        cropper.position.x1 * ratioW,
                        cropper.position.y1 * ratioH,
                        cropper.position.x2 * ratioW,
                        cropper.position.y2 * ratioH
                    );
                    if (maxWidth || maxHeight) {
                        const [width, height] = [photonImage.get_width(), photonImage.get_height()];
                        const ratio = Math.min((maxWidth ?? width) / width, (maxHeight ?? height) / height);
                        if (ratio < 1) {
                            const newWidth = width * ratio;
                            const newHeight = height * ratio;
                            photonImage = resize(photonImage, newWidth, newHeight, 5);
                        }
                    }
                    if (['image/gif', 'image/png'].includes(image.type)) {
                        const ctx = canvas.getContext('2d');
                        const imageData = photonImage.get_image_data();
                        canvas.width = imageData.width;
                        canvas.height = imageData.height;
                        ctx?.putImageData(imageData, 0, 0);
                        return from(canvas.convertToBlob()).pipe(
                            switchMap(blob => blob.arrayBuffer()),
                            map(buffer => ({ id, data: arrayBufferToUint8Array(buffer), type: image.type }))
                        );
                    }
                    const data = photonImage.get_bytes_jpeg(90);
                    return of({ id, data, type: image.type });
                }),
                catchError(err => {
                    postMessage({ action: 'cropImageFailed', id, errorMessage: err.message });
                    return EMPTY;
                })
            )
        )
    )
    .subscribe(({ id, data, type }) => {
        postMessage({ action: 'cropImageDone', id, data, type });
    });

sharedTimerOn$
    .pipe(
        switchMap(() => state.select('actor').pipe(first())),
        switchMap(actor => timer(0, SHARED_WITH_ME_INTERVAL).pipe(exhaustMap(() => actor.sharedWithMe()))),
        switchMap(shares =>
            from(shares).pipe(
                mergeMap(({ profile, bucketId }) =>
                    createJournalActor(bucketId).pipe(
                        switchMap(actor => actor.sharedWithMe()),
                        filter(items => items.length > 0),
                        map(items => ({
                            user: { ...profile, principal: profile.principal.toText(), avatarUrl: fromNullable(profile.avatarUrl) },
                            items: items.map(toSharedFileExtended)
                        }))
                    )
                ),
                toArray()
            )
        ),
        map(value => sortBy(value, ({ user }) => user.username)),
        catchError(err => {
            console.error(err);
            return EMPTY;
        }),
        takeUntil(sharedTimerOff$),
        repeat()
    )
    .subscribe(payload => postMessage({ action: 'sharedWithMeDone', payload }));

/* canistersTimerOn$
    .pipe(
        switchMap(() =>
            state.select('identity').pipe(
                first(),
                switchMap(identity => createAgent({ identity, fetchRootKey: !environment.production, host: environment.httpAgentHost ?? location.origin })),
                map(agent => ICManagementCanister.create({ agent }))
            )
        ),
        delayWhen(() => state.select('journalId')),
        withLatestFrom(state.select('journalId')),
        switchMap(([ic, canisterId]) => timer(0, SHARED_WITH_ME_INTERVAL).pipe(exhaustMap(() => ic.canisterStatus(canisterId)))),
        catchError(err => {
            console.error(err);
            postMessage({ action: 'canisterStatusFailed', errorMessage: err.message });
            return EMPTY;
        }),
        takeUntil(canistersTimerOff$),
        repeat()
    )
    .subscribe(payload => postMessage({ action: 'canisterStatusDone', payload })); */

function download(
    { id, name, storageId }: { id: string; name: string; storageId: Principal },
    operator: () => MonoTypeOperatorFunction<{ buffer: ArrayBuffer; size: number; index: number }> = pipe
) {
    return createStorageActor(storageId).pipe(
        switchMap(({ actor }) =>
            from(actor.getChunks(id)).pipe(
                map(result => {
                    if (has(result, 'err')) {
                        throw new Error('File not found');
                    }

                    return get(result, 'ok') as unknown as AssetInfo;
                }),
                switchMap(asset =>
                    from(asset.chunkIds).pipe(
                        mergeMap((chunkId, index) =>
                            from(actor.getChunk(chunkId)).pipe(
                                map(data => {
                                    const content = arrayOfNumberToUint8Array(data as number[]);
                                    return { buffer: content.buffer, size: content.byteLength, index };
                                }),
                                operator()
                            )
                        ),
                        connect(shared =>
                            merge(
                                shared.pipe(
                                    scan(
                                        (acc, { size }) => {
                                            acc.loaded += size;
                                            return acc;
                                        },
                                        <DownloadProgress>{
                                            loaded: 0,
                                            total: Number(asset.totalLength),
                                            status: DownloadStatus.Progress
                                        }
                                    )
                                ),
                                shared.pipe(
                                    reduce(
                                        (acc, { index, buffer }) => {
                                            acc.result[index] = arrayBufferToUint8Array(buffer);
                                            return acc;
                                        },
                                        <{ result: Uint8Array[]; contentType?: string }>{ result: [], contentType: fromNullable(asset.contentType) }
                                    ),
                                    map(
                                        ({ result, contentType }) =>
                                            <DownloadComplete>{
                                                file: new File([concatUint8Arrays(result)], name, { type: contentType }),
                                                status: DownloadStatus.Complete
                                            }
                                    )
                                )
                            )
                        )
                    )
                )
            )
        ),
        catchError(err => of<DownloadFailed>({ status: DownloadStatus.Failed, errorMessage: err.message }))
    );
}

function downloadFile(params: { id: string; name: string; storageId: Principal }) {
    return download(params).pipe(
        tap(progress => {
            postMessage({ action: 'downloadProgress', id: params.id, progress: omit(progress, 'file') });
            if (progress.status === DownloadStatus.Complete) {
                postMessage({ action: 'download', file: progress.file });
            }
        })
    );
}

function downloadEncryptedFile({
    id,
    journalId,
    owner,
    name,
    storageId
}: {
    id: string;
    journalId: Principal;
    owner: Principal;
    name: string;
    storageId: Principal;
}) {
    return createJournalActor(journalId).pipe(
        connect(shared =>
            concat(
                of<DownloadRetrieveKey>({ status: DownloadStatus.RetrieveKey }),
                shared.pipe(
                    switchMap(journalActor => initVetAesGcmKey(id, owner, journalActor)),
                    switchMap(aesKey =>
                        download({ id, name, storageId }, () =>
                            pipe(switchMap(data => from(decryptArrayBuffer(aesKey, data.buffer)).pipe(map(buffer => ({ ...data, buffer })))))
                        )
                    ),
                    catchError(err => {
                        console.error(err);
                        return of<DownloadFailed>({ status: DownloadStatus.Failed, errorMessage: err.message });
                    })
                )
            )
        ),
        tap(progress => {
            postMessage({ action: 'downloadProgress', id, progress: omit(progress, 'file') });
            if (progress.status === DownloadStatus.Complete) {
                postMessage({ action: 'download', file: progress.file });
            }
        })
    );
}

state.connect('wasmLoaded', loadWasm().pipe(map(() => true)));
state.hold(keepAlive$);
state.hold(fileUpload$);
