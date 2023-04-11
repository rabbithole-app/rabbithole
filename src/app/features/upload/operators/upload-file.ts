import { arrayBufferToUint8Array, toNullable } from '@dfinity/utils';
import {
    Observable,
    catchError,
    defer,
    from,
    iif,
    last,
    map,
    mergeMap,
    of,
    range,
    scan,
    switchMap,
    tap,
    throwError
} from 'rxjs';
import { addSeconds, differenceInSeconds } from 'date-fns';
import { defaults, findIndex, has, isNull, pick } from 'lodash';

import { AssetKey, _SERVICE as StorageActor } from '@declarations/storage/storage.did';
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
            id: item.id,
            name: item.name,
            parentId: toNullable<string>(item.parentId),
            fileSize: BigInt(item.fileSize)
        };
        const hasSameCanisterId = (canisterId: string) => canisterId === state.storage?.canisterId;
        const hasValidBatch = has(state, 'batch.id') && differenceInSeconds((state.batch as BatchInfo).expiredAt, Date.now()) > 0;
        const opts = defaults({}, options);
        const chunkCount = Math.ceil(item.fileSize / opts.chunkSize);
        subscriber.next({ storage, status: UPLOAD_STATUS.Init });
        const initUpload$ = defer(() => storage.actor.initUpload(assetKey)).pipe(
            map(({ batchId }) => ({
                storage,
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
        const subscription = iif(() => hasSameCanisterId(storage.canisterId) && hasValidBatch, of(pick(state, ['storage', 'batch'])), initUpload$)
            .pipe(
                tap(({ batch }) =>
                    subscriber.next({
                        batch,
                        status: UPLOAD_STATUS.Processing
                    })
                ),
                map(value => value as Required<Pick<FileUploadState, 'batch' | 'storage'>>),
                switchMap(({ storage, batch }) => {
                    const firstNullIndex = findIndex(state.chunkIds, isNull);
                    const startIndex = firstNullIndex > -1 && hasValidBatch ? firstNullIndex : 0;

                    const initState = (
                        hasValidBatch
                            ? { ...pick(state, ['loaded', 'progress', 'chunkIds', 'batch']), status: UPLOAD_STATUS.Processing }
                            : {
                                loaded: 0,
                                progress: 0,
                                batch,
                                chunkIds: Array.from<bigint | null>({
                                    length: chunkCount
                                }).fill(null),
                                status: UPLOAD_STATUS.Processing
                            }
                    ) as WithRequiredProperty<Pick<FileUploadState, 'loaded' | 'chunkIds' | 'progress' | 'batch' | 'status'>, 'chunkIds' | 'batch'>;

                    const chunks$ = range(startIndex, chunkCount - startIndex).pipe(
                        mergeMap(index => {
                            const startByte = index * opts.chunkSize;
                            const endByte = Math.min(item.fileSize, startByte + opts.chunkSize);
                            const chunk = item.data.slice(startByte, endByte);
                            return from(
                                storage.actor.uploadChunk({
                                    batchId: batch.id,
                                    content: arrayBufferToUint8Array(chunk)
                                })
                            ).pipe(
                                map(({ chunkId }) => ({
                                    chunkSize: chunk.byteLength,
                                    chunkId,
                                    index
                                }))
                            );
                        }, opts.concurrentChunksCount),
                        scan((acc, next) => {
                            acc.chunkIds[next.index] = next.chunkId;
                            const loaded = acc.loaded + next.chunkSize;

                            return {
                                ...acc,
                                loaded,
                                progress: Math.ceil((loaded / item.fileSize) * 100),
                                batch: {
                                    ...acc.batch,
                                    expiredAt: addSeconds(Date.now(), 25)
                                }
                            };
                        }, initState),
                        tap(value => subscriber.next(value))
                    );

                    return iif(() => firstNullIndex === -1 && hasValidBatch, of(initState), chunks$).pipe(
                        tap({
                            complete: () => subscriber.next({ status: UPLOAD_STATUS.Finalize })
                        }),
                        last(),
                        switchMap(({ chunkIds, batch }) =>
                            storage.actor.commitUpload({
                                batchId: batch.id,
                                chunkIds: chunkIds as bigint[],
                                headers: [
                                    ['Content-Type', item.contentType],
                                    ['accept-ranges', 'bytes']
                                ]
                            })
                        )
                    );
                })
            )
            .subscribe({
                next(value) {
                    subscriber.next(value);
                },
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
