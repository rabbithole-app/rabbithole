import { arrayBufferToUint8Array, toNullable } from '@dfinity/utils';
import { addSeconds, differenceInSeconds } from 'date-fns';
import { defaults, get, has, includes, isNull, pick } from 'lodash';
import { EMPTY, Observable, defer, from, iif, of, throwError } from 'rxjs';
import { catchError, last, map, mergeScan, switchMap, tap } from 'rxjs/operators';

import { AssetKey, CommitBatch, CommitUploadError, _SERVICE as StorageActor } from '@declarations/storage/storage.did';
import { BATCH_EXPIRY_SECONDS } from '../constants';
import { BatchInfo, Bucket, FileUpload, FileUploadState, UPLOAD_STATUS, UploadFileOptions, WithRequiredProperty } from '../models';

type UploadParams = {
    storage: Bucket<StorageActor>;
    item: FileUpload;
    state: FileUploadState;
    options: UploadFileOptions;
};

export async function simpleUploadFile(item: Omit<FileUpload, 'sha256' | 'thumbnail' | 'canvas'>, storage: Bucket<StorageActor>) {
    const hash = await crypto.subtle.digest('SHA-256', arrayBufferToUint8Array(item.data));
    const assetKey: AssetKey = {
        id: item.id,
        name: item.name,
        parentId: toNullable<string>(item.parentId),
        fileSize: BigInt(item.fileSize),
        sha256: toNullable(arrayBufferToUint8Array(hash)),
        thumbnail: toNullable(),
        encrypted: false
    };
    const { batchId } = await storage.actor.initUpload(assetKey);
    const content = arrayBufferToUint8Array(item.data);
    const { chunkId } = await storage.actor.uploadChunk({ batchId, content });
    const commitBatch: CommitBatch = {
        batchId,
        chunkIds: [chunkId],
        headers: [['Content-Type', item.contentType]]
    };
    const response = await storage.actor.commitUpload(commitBatch, true);
    if (has(response, 'err')) {
        const key = Object.keys(get(response, 'err') as unknown as CommitUploadError)[0];
        throw new Error(`upload.commit.errors.${key}`);
    }
}

export function uploadFile({ storage, item, options, state }: UploadParams): Observable<Partial<FileUploadState>> {
    return new Observable(subscriber => {
        const assetKey: AssetKey = {
            id: item.id,
            name: item.name,
            parentId: toNullable<string>(item.parentId),
            fileSize: BigInt(item.fileSize),
            sha256: toNullable(item.sha256),
            thumbnail: toNullable(item.thumbnail),
            encrypted: options.encrypted
        };
        const hasSameCanisterId = (canisterId: string) => canisterId === state.canisterId;
        const hasValidBatch = has(state, 'batch.id') && differenceInSeconds((state.batch as BatchInfo).expiredAt, Date.now()) > 0;
        const opts = defaults({}, options);
        const chunkCount = Math.ceil(item.fileSize / opts.chunkSize);
        subscriber.next({ canisterId: storage.canisterId, status: UPLOAD_STATUS.Init });
        const initUpload$ = defer(() => storage.actor.initUpload(assetKey)).pipe(
            map(({ batchId }) => ({
                batch: {
                    id: batchId,
                    expiredAt: addSeconds(Date.now(), BATCH_EXPIRY_SECONDS)
                }
            })),
            catchError(err => {
                console.error(err);
                return throwError(() => err);
            })
        );

        const subscription = iif(
            () => hasSameCanisterId(storage.canisterId) && hasValidBatch,
            of(pick(state, ['batch'])).pipe(map(value => value as Required<Pick<FileUploadState, 'batch'>>)),
            initUpload$
        )
            .pipe(
                tap(({ batch }) =>
                    subscriber.next({
                        batch,
                        status: UPLOAD_STATUS.Processing
                    })
                ),
                switchMap(({ batch }) => {
                    const initState = (
                        hasValidBatch
                            ? { ...pick(state, ['chunkIds', 'batch']), status: UPLOAD_STATUS.Processing }
                            : {
                                  batch,
                                  chunkIds: Array.from<bigint | null>({ length: chunkCount }).fill(null),
                                  status: UPLOAD_STATUS.Processing
                              }
                    ) as WithRequiredProperty<Pick<FileUploadState, 'chunkIds' | 'batch' | 'status'>, 'chunkIds' | 'batch'>;

                    return iif(
                        () => includes(initState.chunkIds, null),
                        from(initState.chunkIds).pipe(
                            mergeScan(
                                (acc, chunkId, index) => {
                                    if (isNull(chunkId)) {
                                        return defer(() => {
                                            const startByte = index * opts.chunkSize;
                                            const endByte = Math.min(item.fileSize, startByte + opts.chunkSize);
                                            const chunk = item.data.slice(startByte, endByte);
                                            return from(
                                                storage.actor.uploadChunk({
                                                    batchId: batch.id,
                                                    content: arrayBufferToUint8Array(chunk)
                                                })
                                            ).pipe(
                                                map(({ chunkId }) => {
                                                    acc.chunkIds[index] = chunkId;

                                                    return {
                                                        ...acc,
                                                        // in order to always have the correct progress when racing chunks,
                                                        // we form it outside of this function
                                                        loaded: chunk.byteLength,
                                                        batch: {
                                                            ...acc.batch,
                                                            expiredAt: addSeconds(Date.now(), 25)
                                                        }
                                                    };
                                                })
                                            );
                                        });
                                    }

                                    return EMPTY;
                                },
                                initState,
                                opts.concurrentChunksCount
                            )
                        ),
                        of(initState)
                    ).pipe(
                        tap({
                            next: value => subscriber.next(value),
                            complete: () => subscriber.next({ status: UPLOAD_STATUS.Finalize })
                        }),
                        last(),
                        switchMap(({ chunkIds, batch }) =>
                            storage.actor.commitUpload(
                                {
                                    batchId: batch.id,
                                    chunkIds: chunkIds as bigint[],
                                    headers: [['Content-Type', item.contentType]]
                                },
                                true
                            )
                        ),
                        map(response => {
                            if (has(response, 'err')) {
                                const key = Object.keys(get(response, 'err') as unknown as CommitUploadError)[0];
                                throw new Error(`upload.commit.errors.${key}`);
                            }

                            return get(response, 'ok');
                        })
                    );
                })
            )
            .subscribe({
                error: err => {
                    console.error(err);
                    const res = err.message.match(/(?:Body|Reject text): (.+)/);
                    const errorMessage = isNull(res) ? err.message : res[1];
                    subscriber.next({
                        status: UPLOAD_STATUS.Failed,
                        errorMessage
                    });
                    subscriber.error(err);
                },
                complete: () => {
                    subscriber.next({
                        parentId: item.parentId,
                        status: UPLOAD_STATUS.Done
                    });
                    subscriber.complete();
                }
            });
        return () => subscription.unsubscribe();
    });
}
