import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { RxState } from '@rx-angular/state';
import { from, mergeMap, Observable, of, onErrorResumeNext, Subject, merge, timer, forkJoin } from 'rxjs';
import { filter, first, concatWith, connect, debounceTime, distinctUntilChanged, switchMap, exhaustMap, map, shareReplay, skip, takeUntil, tap, withLatestFrom } from 'rxjs/operators';
import { defaults, entries, isEqual, isPlainObject, isUndefined, uniqBy, values } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { arrayBufferToUint8Array } from '@dfinity/utils';
import { addSeconds, differenceInMilliseconds, isDate } from 'date-fns';

import { FileUpload, FileUploadState, UPLOAD_STATUS, Summary } from '../models';
import { FILE_LIST_RX_STATE } from '@features/file-list';
import { BATCH_EXPIRY_SECONDS, CHUNK_SIZE, CONCURRENT_CHUNKS_COUNT, CONCURRENT_FILES_COUNT, FILE_MAX_SIZE, SUMMARY_RESET_TIMEOUT } from '../constants';
import { uploadFile } from '../operators';
import { BucketsService } from '@core/services';

interface State {
    items: FileUpload[];
    progress: Record<string, FileUploadState>;
    summary: Summary;
    worker: Worker | null;
}

@Injectable()
export class UploadService extends RxState<State> {
    private fileListState = inject(FILE_LIST_RX_STATE);
    #bucketService = inject(BucketsService);
    private router = inject(Router);
    private files: Subject<FileUpload> = new Subject<FileUpload>();
    private keepAlive: Subject<{ id: string; canisterId: string }> = new Subject();

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
    readonly workerEnabled = true;

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
            summary: this.summaryInitValue
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

        if (typeof Worker !== 'undefined' && this.workerEnabled) {
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
                    const paused$ = status$.pipe(filter(status => status === UPLOAD_STATUS.Paused));
                    const cancelled$ = status$.pipe(filter(status => status === UPLOAD_STATUS.Cancelled));

                    return onErrorResumeNext(
                        this.select('progress', item.id).pipe(
                            first(),
                            switchMap(state => 
                                of({ status: UPLOAD_STATUS.Request, errorMessage: null }).pipe(
                                    concatWith(
                                        forkJoin([
                                            from(crypto.subtle.digest('SHA-256', arrayBufferToUint8Array(item.data))).pipe(map(arrayBufferToUint8Array)),
                                            this.#bucketService.getStorageBySize(BigInt(item.fileSize))
                                        ]).pipe(
                                            switchMap(([sha256, storage]) => 
                                                uploadFile({
                                                    storage,
                                                    item: { ...item, sha256 },
                                                    options: {
                                                        concurrentChunksCount: this.concurrentChunksCount,
                                                        chunkSize: this.chunkSize
                                                    },
                                                    state
                                                }).pipe(
                                                    withLatestFrom(this.select('progress', item.id)),
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
                                    )
                                )
                            ),
                            tap(value => this.updateProgress(item.id, value)),
                            takeUntil(merge(paused$, cancelled$))
                        )
                    );
                }, this.concurrentFilesCount)
            );

            const keepAlive$ = this.keepAlive.asObservable().pipe(
                mergeMap(({ id, canisterId }) => {
                    const off$ = this.select('progress', id, 'status').pipe(
                        skip(1),
                        filter(status => ![UPLOAD_STATUS.Failed, UPLOAD_STATUS.Cancelled].includes(status))
                    );
                    return this.select('progress', id, 'batch').pipe(
                        first(),
                        filter(batch => !isUndefined(batch) && isDate(batch.expiredAt)),
                        map(batch => batch as NonNullable<typeof batch>),
                        switchMap(batch =>
                            timer(differenceInMilliseconds(batch.expiredAt, addSeconds(Date.now(), 5)), 60000).pipe(
                                switchMap(() => this.#bucketService.getStorage(canisterId)),
                                exhaustMap(({ actor }) => actor.batchAlive(batch.id)),
                                tap(() =>
                                    this.updateProgress(id, {
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

            this.hold(chunks$);
            this.hold(keepAlive$);
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
        // если запрошено обновление корня, то переадресация на / не дает эффекта, поэтому открываем любой путь без журнала
        await this.router.navigateByUrl('/settings', { skipLocationChange: true });
        await this.router.navigate([url]);
    }

    terminate() {
        const worker = this.get('worker');
        if (worker) {
            worker.terminate();
        }

        this.set({
            items: [],
            summary: this.summaryInitValue,
            progress: {},
            worker: null
        });
    }

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
        const { worker, items } = this.get();
        const item = items.find(item => item.id === id);
        if (worker) {
            worker.postMessage({ action: 'retry', id });
        } else if (item) {
            this.files.next(item);
        }
    }

    pause(id: string) {
        const { worker, items, progress } = this.get();
        const item = items.find(item => item.id === id);
        const canisterId = progress[id]?.canisterId;
        if (worker) {
            worker.postMessage({ action: 'pause', id });
        } else if (item && canisterId) {
            this.updateProgress(id, { status: UPLOAD_STATUS.Paused });
            this.keepAlive.next({ id: item.id, canisterId });
        }
    }

    resume(id: string) {
        const { worker, items } = this.get();
        const item = items.find(item => item.id === id);
        if (worker) {
            worker.postMessage({ action: 'resume', id });
        } else if (item) {
            this.files.next(item);
        }
    }

    cancel(id: string) {
        const worker = this.get('worker');
        if (worker) {
            worker.postMessage({ action: 'cancel', id });
        } else {
            this.updateProgress(id, { status: UPLOAD_STATUS.Cancelled });
        }
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
