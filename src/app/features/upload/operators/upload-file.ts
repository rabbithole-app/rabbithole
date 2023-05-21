import { arrayBufferToUint8Array, toNullable } from '@dfinity/utils';
import { EMPTY, Observable, catchError, defer, from, iif, last, map, mergeScan, of, switchMap, tap, throwError } from 'rxjs';
import { translate } from '@ngneat/transloco';
import { addSeconds, differenceInSeconds } from 'date-fns';
import { defaults, get, has, includes, isNull, pick } from 'lodash';

import { AssetKey, CommitUploadError, _SERVICE as StorageActor } from '@declarations/storage/storage.did';
import { BatchInfo, Bucket, FileUpload, FileUploadState, UPLOAD_STATUS, UploadFileOptions, WithRequiredProperty } from '../models';
import { BATCH_EXPIRY_SECONDS } from '../constants';

type UploadParams = {
    storage: Bucket<StorageActor>;
    item: FileUpload;
    state: FileUploadState;
    options: UploadFileOptions;
};

export function uploadFile({ storage, item, options, state }: UploadParams): Observable<Partial<FileUploadState>> {
    return new Observable(subscriber => {
        const assetKey: AssetKey = {
            name: item.name,
            parentId: toNullable<string>(item.parentId),
            fileSize: BigInt(item.fileSize),
            sha256: toNullable(item.sha256)
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
                                let key = Object.keys(get(response, 'err') as unknown as CommitUploadError)[0];
                                throw Error(translate(`upload.commit.errors.${key}`));
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