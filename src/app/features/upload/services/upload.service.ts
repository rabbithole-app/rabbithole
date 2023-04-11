import { inject, Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { RxState } from '@rx-angular/state';
import { filter, first, from, mergeMap, Observable, of, onErrorResumeNext, Subject, switchMap, merge, timer, concat } from 'rxjs';
import { connect, debounceTime, distinctUntilChanged, map, shareReplay, takeUntil, tap, withLatestFrom } from 'rxjs/operators';
import { defaults, entries, isEqual, isPlainObject, uniqBy, values } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { FileUpload, FileUploadState, UPLOAD_STATUS, Summary } from '../models';
import { JournalService } from '@features/file-list/services';
import { FILE_LIST_RX_STATE } from '@features/file-list';
import { BATCH_EXPIRY_SECONDS, CHUNK_SIZE, CONCURRENT_CHUNKS_COUNT, CONCURRENT_FILES_COUNT, FILE_MAX_SIZE, SUMMARY_RESET_TIMEOUT } from '../constants';
import { uploadFile } from '../operators';

interface State {
    items: FileUpload[];
    progress: Record<string, FileUploadState>;
    summary: Summary;
    worker: Worker;
    workerEnabled: boolean;
}

@Injectable()
export class UploadService extends RxState<State> {
    private fileListState = inject(FILE_LIST_RX_STATE);
    private journalService = inject(JournalService);
    private router = inject(Router);
    private files: Subject<FileUpload> = new Subject<FileUpload>();
    private keepAlive: Subject<string> = new Subject<string>();
    private readonly zone = inject(NgZone);

    readonly concurrentFilesCount = CONCURRENT_FILES_COUNT;
    readonly concurrentChunksCount = CONCURRENT_CHUNKS_COUNT;
    readonly chunkSize = CHUNK_SIZE;
    readonly fileMaxSize = FILE_MAX_SIZE;
    readonly batchExpirySeconds = BATCH_EXPIRY_SECONDS;
    readonly summaryResetTimeout = SUMMARY_RESET_TIMEOUT;
    readonly summaryInitValue = {
        loaded: 0,
        total: 0,
        files: 0,
        completed: 0,
        failed: 0,
        progress: 0,
        status: UPLOAD_STATUS.Queue
    };

    progress$: Observable<FileUploadState[]> = this.select('progress').pipe(
        map(value => values(value)),
        shareReplay(1)
    );
    uploading$: Observable<FileUploadState[]> = this.progress$.pipe(map(items => items.filter(({ status }) => status !== UPLOAD_STATUS.Done)));
    completed$: Observable<FileUploadState[]> = this.progress$.pipe(
        map(items => items.filter(({ status }) => status === UPLOAD_STATUS.Done)),
        distinctUntilChanged(isEqual)
    );
    summary$: Observable<Summary> = this.select('summary');

    constructor() {
        super();
        this.completed$
            .pipe(
                withLatestFrom(this.fileListState.select('parentId').pipe(map(v => v ?? undefined))),
                switchMap(([items, parentId]) => from(items.filter(item => item.parentId === parentId))),
                debounceTime(1000)
            )
            .subscribe(() => this.reloadComponent(true));
        this.set({
            items: [],
            summary: this.summaryInitValue,
            workerEnabled: false
        });
        this.connect(this.files.asObservable(), (state, item) => {
            const chunkCount = Math.ceil(item.fileSize / this.chunkSize);
            const prevProgress = state.progress?.[item.id];
            const fileProgressState = defaults({ status: UPLOAD_STATUS.Queue }, isPlainObject(prevProgress) ? prevProgress : null, {
                id: item.id,
                name: item.name,
                loaded: 0,
                total: item.fileSize,
                progress: 0,
                chunkIds: Array.from<number | null>({ length: chunkCount }).fill(null)
            });
            return {
                items: uniqBy([...state.items, item], 'id'),
                progress: {
                    ...state.progress,
                    [item.id]: fileProgressState
                }
            };
        });
        const summary$ = this.progress$.pipe(
            map(items => {
                const summary: Omit<Summary, 'files' | 'progress' | 'status'> = items.reduce(
                    (res, { total, loaded, status }) => ({
                        total: res.total + total,
                        loaded: res.loaded + loaded,
                        completed: status === UPLOAD_STATUS.Done ? res.completed + 1 : res.completed,
                        failed: status === UPLOAD_STATUS.Failed ? res.failed + 1 : res.failed
                    }),
                    {
                        total: 0,
                        loaded: 0,
                        completed: 0,
                        failed: 0
                    }
                );

                const isProcessing = items.some(({ status }) =>
                    [UPLOAD_STATUS.Init, UPLOAD_STATUS.Processing, UPLOAD_STATUS.Request, UPLOAD_STATUS.Finalize].includes(status)
                );
                const isDone = items.every(({ status }) => status === UPLOAD_STATUS.Done);
                const isPaused = !isProcessing && items.some(({ status }) => status === UPLOAD_STATUS.Paused);
                const isFailed = !isDone && !isProcessing && !isPaused && items.some(({ status }) => status === UPLOAD_STATUS.Failed);

                let status = UPLOAD_STATUS.Queue;
                if (isProcessing) {
                    status = UPLOAD_STATUS.Processing;
                } else if (isDone) {
                    status = UPLOAD_STATUS.Done;
                } else if (isPaused) {
                    status = UPLOAD_STATUS.Paused;
                } else if (isFailed) {
                    status = UPLOAD_STATUS.Failed;
                }

                return {
                    ...summary,
                    files: items.length,
                    progress: Math.ceil((summary.loaded / summary.total) * 100),
                    status
                };
            })
        );
        this.connect(
            'summary',
            summary$.pipe(
                connect(shared =>
                    merge(
                        shared,
                        shared.pipe(
                            filter(({ status }) => status === UPLOAD_STATUS.Done),
                            switchMap(() => timer(this.summaryResetTimeout)),
                            map(() => this.summaryInitValue)
                        )
                    )
                )
            )
        );

        if (typeof Worker !== 'undefined' && this.get('workerEnabled')) {
            const worker = new Worker(new URL('../workers/upload.worker', import.meta.url), { type: 'module' });
            this.set({ worker });

            worker.onmessage = async ({ data }) => {
                switch (data.action) {
                    case 'progress':
                        this.updateProgress(data.id, data.progress);
                        break;
                    default:
                        break;
                }
            };
        } else {
            const chunks$ = this.files.asObservable().pipe(
                mergeMap((item: FileUpload) => {
                    const status$ = this.select('progress', item.id, 'status');
                    const paused$ = status$.pipe(
                        filter(status => status === UPLOAD_STATUS.Paused),
                        tap(() => this.keepAlive.next(item.id))
                    );
                    const cancelled$ = status$.pipe(filter(status => status === UPLOAD_STATUS.Cancelled));

                    return onErrorResumeNext(
                        this.select('progress', item.id).pipe(
                            first(),
                            switchMap(state =>
                                concat(
                                    of({ status: UPLOAD_STATUS.Request, errorMessage: null }),
                                    this.journalService.getStorage(BigInt(item.fileSize)).pipe(
                                        switchMap(storage =>
                                            uploadFile({
                                                storage,
                                                item,
                                                options: {
                                                    concurrentChunksCount: this.concurrentChunksCount,
                                                    chunkSize: this.chunkSize
                                                },
                                                state
                                            })
                                        )
                                    )
                                )
                            ),
                            tap(value => {
                                this.updateProgress(item.id, value);
                            }),
                            takeUntil(merge(paused$, cancelled$))
                        )
                    );
                }, this.concurrentFilesCount)
            );

            this.hold(chunks$);
        }
    }

    private updateProgress(id: string, value: Partial<FileUploadState>) {
        this.set('progress', state => ({
            ...state.progress,
            [id]: {
                ...state.progress[id],
                ...value
            }
        }));
    }

    private updateProgressAll<T = FileUploadState>(predicate: (v: FileUploadState) => boolean, partialValue: Partial<T>) {
        this.set('progress', state =>
            entries(state.progress).reduce((result, [id, value]) => {
                if (predicate(value)) {
                    result[id] = {
                        ...value,
                        ...partialValue
                    };
                } else {
                    result[id] = value;
                }

                return result;
            }, {} as State['progress'])
        );
    }

    async reloadComponent(self: boolean, urlToNavigateTo?: string) {
        const url = self ? this.router.url : urlToNavigateTo;
        await this.router.navigateByUrl('/', { skipLocationChange: true });
        await this.router.navigate([`/${url}`]);
    }

    /*private uploadFile(item: FileUpload, options: UploadFileOptions, state: FileUploadState): Observable<Partial<FileUploadState>> {
        const assetKey: AssetKey = {
            id: item.id,
            name: item.file.name,
            parentId: toNullable<string>(item.parentId),
            fileSize: BigInt(item.file.size)
        };
        return new Observable(subscriber => {
            const hasSameCanisterId = (canisterId: string) => canisterId === state.storage?.canisterId;
            const hasValidBatch = has(state, 'batch.id') && differenceInSeconds((state.batch as BatchInfo).expiredAt, Date.now()) > 0;
            const opts = defaults({}, options);
            const chunkCount = Math.ceil(item.file.size / opts.chunkSize);
            subscriber.next({ status: UPLOAD_STATUS.Request, errorMessage: null });
            const subscription = this.journalService
                .getStorage(assetKey.fileSize)
                .pipe(
                    tap(storage => subscriber.next({ storage, status: UPLOAD_STATUS.Init })),
                    switchMap(storage =>
                        iif(
                            () => hasSameCanisterId(storage.canisterId) && hasValidBatch,
                            of(pick(state, ['storage', 'batch'])),
                            defer(() => storage.actor.initUpload(assetKey)).pipe(
                                map(({ batchId }) => ({
                                    storage,
                                    batch: {
                                        id: batchId,
                                        expiredAt: addSeconds(Date.now(), this.batchExpirySeconds)
                                    }
                                }))
                            )
                        ).pipe(
                            tap(({ batch }) =>
                                subscriber.next({
                                    batch,
                                    status: UPLOAD_STATUS.Processing
                                })
                            )
                        )
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
                                const endByte = Math.min(item.file.size, startByte + opts.chunkSize);
                                const chunk = item.file.slice(startByte, endByte);
                                return from(chunk.arrayBuffer()).pipe(
                                    switchMap(chunkBuffer =>
                                        storage.actor.uploadChunk({
                                            batchId: batch.id,
                                            content: arrayBufferToUint8Array(chunkBuffer)
                                        })
                                    ),
                                    map(({ chunkId }) => ({
                                        chunkSize: chunk.size,
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
                                    progress: Math.ceil((loaded / item.file.size) * 100),
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
                                        ['Content-Type', item.file.type],
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
    }*/

    async add(value: FileUpload | FileList) {
        const worker = this.get('worker');
        const files = value as FileList;
        for (let i = 0; i < files.length; i++) {
            const file = files.item(i) as File;
            const buffer = await file.arrayBuffer();
            const item = {
                id: uuidv4(),
                name: file.name,
                fileSize: file.size,
                contentType: file.type,
                parentId: this.fileListState.get('parentId') ?? undefined,
                data: buffer
            };
            this.files.next(item);
            if (worker) {
                const uploadState = this.get('progress', item.id);
                worker.postMessage({ action: 'add', item, uploadState }, [item.data]);
            }
        }
    }

    remove(id: string) {
        this.set(state => {
            const progress = { ...state.progress };
            delete progress[id];
            return {
                items: state.items.filter(item => item.id !== id),
                progress
            };
        });
    }

    retry(id: string) {
        const item = this.get('items').find(item => item.id === id);
        if (item) {
            this.files.next(item);
        }
    }

    pause(id: string) {
        this.updateProgress(id, { status: UPLOAD_STATUS.Paused });
    }

    resume(id: string) {
        const item = this.get('items').find(item => item.id === id);
        if (item) {
            this.files.next(item);
        }
    }

    cancel(id: string) {
        this.updateProgress(id, { status: UPLOAD_STATUS.Cancelled });
    }

    cancelAll() {
        this.updateProgressAll(value => [UPLOAD_STATUS.Paused, UPLOAD_STATUS.Processing, UPLOAD_STATUS.Queue].indexOf(value.status) > -1, {
            status: UPLOAD_STATUS.Cancelled
        });
    }

    pauseAll() {
        this.updateProgressAll(value => [UPLOAD_STATUS.Processing, UPLOAD_STATUS.Queue].indexOf(value.status) > -1, { status: UPLOAD_STATUS.Paused });
    }

    clearCompleted() {
        this.set('progress', state =>
            values<FileUploadState>(state.progress)
                .filter(({ status }) => status !== UPLOAD_STATUS.Done)
                .reduce((res, item) => {
                    res[item.id] = item;
                    return res;
                }, {} as State['progress'])
        );
    }

    resetSummary() {
        this.set({ summary: this.summaryInitValue });
    }
}
