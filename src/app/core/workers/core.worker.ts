/// <reference lib="webworker" />

import { ActorSubclass, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { arrayBufferToUint8Array, fromNullable, toNullable } from '@dfinity/utils';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { PhotonImage, crop, resize } from '@silvia-odwyer/photon';
import { addSeconds, differenceInMilliseconds, isDate } from 'date-fns';
import { get, has, isNull, isUndefined, partition, pick } from 'lodash';
import { CropperPosition } from 'ngx-image-cropper';
import { EMPTY, Observable, Subject, connect, defer, forkJoin, from, merge, of, throwError, timer } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import {
    catchError,
    combineLatestWith,
    concatWith,
    delayWhen,
    exhaustMap,
    filter,
    first,
    map,
    mergeMap,
    skip,
    switchMap,
    takeUntil,
    tap,
    toArray,
    withLatestFrom
} from 'rxjs/operators';

import { createActor, decryptArrayBuffer, encryptArrayBuffer, initVetAesGcmKey, loadIdentity } from '@core/utils';
import { _SERVICE as RabbitholeActor } from '@declarations/rabbithole/rabbithole.did';
import { FileInfoExtended } from '@features/file-list/models';
import { toDirectoryExtended, toFileExtended, uint8ToBase64 } from '@features/file-list/utils';
import { CHUNK_SIZE, CONCURRENT_CHUNKS_COUNT, CONCURRENT_FILES_COUNT } from '@features/upload/constants';
import { Bucket, FileUpload, FileUploadState, UPLOAD_STATUS } from '@features/upload/models';
import { getStorageBySize, uploadFile } from '@features/upload/operators';
import { MAX_AVATAR_HEIGHT, MAX_AVATAR_WIDTH, MAX_THUMBNAIL_HEIGHT, MAX_THUMBNAIL_WIDTH } from 'app/constants';
import { idlFactory as journalIdlFactory } from 'declarations/journal';
import { DirectoryState, DirectoryStateError, _SERVICE as JournalActor } from 'declarations/journal/journal.did';
import { canisterId as rabbitholeCanisterId, idlFactory as rabbitholeIdlFactory } from 'declarations/rabbithole';
import { idlFactory as storageIdlFactory } from 'declarations/storage';
import { _SERVICE as StorageActor } from 'declarations/storage/storage.did';

interface State {
    identity: Identity;
    actor: ActorSubclass<RabbitholeActor>;
    journal: ActorSubclass<JournalActor>;
    storages: Bucket<StorageActor>[];
    files: Record<string, FileUpload>;
    progress: Record<string, FileUploadState>;
    vetAesGcmKey: CryptoKey | null;
}

const state = new RxState<State>();
const updateJournal: Subject<string | undefined> = new Subject();
const listFiles: Subject<string | undefined> = new Subject();
state.set({ progress: {}, files: {} });
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

addEventListener('message', ({ data }) => {
    const { action, item, id, uploadState } = data;
    switch (action) {
        case 'getJournal': {
            updateJournal.next(data.path);
            break;
        }
        case 'getFilesByParentId': {
            listFiles.next(data.parentId);
            break;
        }
        case 'addUpload': {
            state.set('files', state => ({ ...state.files, [item.id]: item }));
            files.next({ item, uploadState, options: data.options });
            break;
        }
        case 'pauseUpload': {
            updateProgress(id, { status: UPLOAD_STATUS.Paused });
            const canisterId = state.get('progress', id, 'canisterId');
            if (canisterId) {
                keepAlive.next({ id, canisterId });
            }
            break;
        }
        case 'resumeUpload':
        case 'retryUpload': {
            const item = state.get('files', id);
            const previousState = state.get('progress', id);
            if (item) {
                updateProgress(id, { status: UPLOAD_STATUS.Queue });
                files.next({ item, uploadState: previousState });
            }
            break;
        }
        case 'cancelUpload': {
            updateProgress(id, { status: UPLOAD_STATUS.Cancelled });
            break;
        }
        case 'download': {
            const vetAesGcmKey$ = state.select('vetAesGcmKey').pipe(first(ek => ek !== null));
            const [encryptedItems, decryptedItems] = partition<FileInfoExtended>(data.items, 'encrypted');
            const encrypted$ = encryptedItems.length
                ? from(encryptedItems).pipe(
                      delayWhen(() => vetAesGcmKey$),
                      withLatestFrom(vetAesGcmKey$),
                      mergeMap(([{ downloadUrl, name }, ek]) =>
                          fromFetch(downloadUrl).pipe(
                              switchMap(response =>
                                  from(response.arrayBuffer()).pipe(
                                      map(encryptedBuffer => ({ encryptedBuffer, type: response.headers.get('content-type') ?? undefined }))
                                  )
                              ),
                              switchMap(({ encryptedBuffer, type }) =>
                                  from(decryptArrayBuffer(ek, encryptedBuffer)).pipe(
                                      map(decodedBuffer => ({ blob: new Blob([decodedBuffer], { type }), name }))
                                  )
                              )
                          )
                      )
                  )
                : EMPTY;
            const decrypted$ = decryptedItems.length
                ? from(decryptedItems).pipe(
                      mergeMap(({ downloadUrl, name }) =>
                          fromFetch(downloadUrl).pipe(
                              switchMap(response => from(response.blob())),
                              map(blob => ({ blob, name }))
                          )
                      )
                  )
                : EMPTY;
            merge(encrypted$, decrypted$).subscribe(payload => postMessage({ action: 'download', payload }));
            break;
        }
        case 'cropImage': {
            cropImage.next({ ...pick(data, ['id', 'image', 'cropper', 'canvas']), maxWidth: MAX_AVATAR_WIDTH, maxHeight: MAX_AVATAR_HEIGHT });
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
    postMessage({ action: 'progressUpload', id, progress: value });
}

const identity$ = from(loadIdentity()).pipe(
    filter(identity => !isUndefined(identity)),
    map(identity => identity as NonNullable<typeof identity>)
);
state.connect('identity', identity$);
state.connect(
    'vetAesGcmKey',
    state.select(selectSlice(['journal', 'identity'])).pipe(switchMap(({ journal, identity }) => initVetAesGcmKey(identity.getPrincipal(), journal)))
);

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
            postMessage({ action: 'getFilesByParentIdFailed', errorCode: err.message });
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
                    defer(() => {
                        if (options && typeof options.thumbnail === 'boolean' && !options.thumbnail) {
                            return of(undefined);
                        }
                        let photonImage = PhotonImage.new_from_byteslice(arrayBufferToUint8Array(item.data));
                        let thumbWidth = MAX_THUMBNAIL_WIDTH;
                        let thumbHeight = MAX_THUMBNAIL_HEIGHT;
                        const [width, height] = [photonImage.get_width(), photonImage.get_height()];
                        if (width > height) {
                            thumbHeight = Math.round(thumbWidth / (width / height));
                        } else if (height > width) {
                            thumbWidth = Math.round(thumbHeight / (height / width));
                        }
                        photonImage = resize(photonImage, thumbWidth, thumbHeight, 5);
                        const thumbnail = ['image/gif', 'image/png'].includes(item.contentType)
                            ? photonImage.get_base64()
                            : `data:image/jpeg;base64,${uint8ToBase64(photonImage.get_bytes_jpeg(90))}`;
                        return of(thumbnail);
                    }).pipe(catchError(() => of(undefined))),
                    defer(() =>
                        options && options.encryption
                            ? state.select('vetAesGcmKey').pipe(
                                  first(v => v !== null),
                                  switchMap(ek => encryptArrayBuffer(ek, item.data))
                              )
                            : of(undefined)
                    )
                ]).pipe(
                    switchMap(([sha256, storage, thumbnail, encryptedData]) => {
                        const itemData = { ...item, sha256, thumbnail };
                        if (encryptedData) {
                            itemData.data = encryptedData;
                            itemData.fileSize = encryptedData.byteLength;
                        }
                        return uploadFile({
                            storage,
                            item: itemData,
                            options: {
                                concurrentChunksCount: CONCURRENT_CHUNKS_COUNT,
                                chunkSize: CHUNK_SIZE
                            },
                            state: uploadState,
                            encrypted: encryptedData !== undefined
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
                            }),
                            catchError(err => {
                                console.error(err);
                                return throwError(() => err);
                            })
                        );
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
                    postMessage({ action: 'cropImageFailed', id, errMessage: err.message });
                    return EMPTY;
                })
            )
        )
    )
    .subscribe(({ id, data, type }) => {
        postMessage({ action: 'cropImageDone', id, data, type });
    });

state.hold(keepAlive$);
state.hold(fileUpload$);
