import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { arrayBufferToUint8Array } from '@dfinity/utils';
import { RxState } from '@rx-angular/state';
import { addSeconds, differenceInMilliseconds, isDate } from 'date-fns';
import { defaults, entries, isEqual, isPlainObject, isUndefined, orderBy, remove, uniqBy, values } from 'lodash';
import { showDirectoryPicker, showOpenFilePicker } from 'native-file-system-adapter';
import { type FileSystemDirectoryHandle } from 'native-file-system-adapter/types/src/FileSystemDirectoryHandle';
import { type FileSystemFileHandle } from 'native-file-system-adapter/types/src/FileSystemFileHandle';
import { forkJoin, from, merge, Observable, of, onErrorResumeNext, Subject, timer } from 'rxjs';
import {
    concatWith,
    connect,
    debounceTime,
    distinctUntilChanged,
    exhaustMap,
    filter,
    first,
    map,
    mergeAll,
    mergeMap,
    shareReplay,
    skip,
    switchMap,
    takeUntil,
    tap,
    withLatestFrom
} from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { DOCUMENT } from '@angular/common';

import { BucketsService, CoreService, NotificationService } from '@core/services';
import { JournalService } from '@features/file-list/services';
import { FileListService } from '@features/file-list/services/file-list.service';
import { BATCH_EXPIRY_SECONDS, CHUNK_SIZE, CONCURRENT_CHUNKS_COUNT, CONCURRENT_FILES_COUNT, FILE_MAX_SIZE, SUMMARY_RESET_TIMEOUT } from '../constants';
import { FileUpload, FileUploadState, Summary, UPLOAD_STATUS } from '../models';
import { uploadFile } from '../operators';

interface State {
    items: FileUpload[];
    progress: Record<string, FileUploadState>;
    summary: Summary;
}

@Injectable()
export class UploadService extends RxState<State> {
    #fileListService = inject(FileListService);
    #journalService = inject(JournalService);
    #bucketService = inject(BucketsService);
    #notificationService = inject(NotificationService);
    #document = inject(DOCUMENT);
    readonly #coreService = inject(CoreService);
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
    readonly #ignoreFileList = ['.DS_Store', 'Thumbs.db'];

    progress$: Observable<FileUploadState[]> = this.select('progress').pipe(
        map(value => values(value)),
        filter(value => value.length > 0),
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
                withLatestFrom(toObservable(this.#fileListService.parent)),
                switchMap(([items, parent]) => from(items.filter(item => item.parentId === parent?.id)).pipe(map(() => parent?.path))),
                debounceTime(1000)
            )
            .subscribe(path => this.#fileListService.getJournal(path));
        this.set({
            items: [],
            summary: this.summaryInitValue,
            progress: {}
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

        const worker = this.#coreService.worker();
        if (worker) {
            this.#coreService.workerMessage$.pipe(takeUntilDestroyed()).subscribe(({ data }) => {
                switch (data.action) {
                    case 'progressUpload': {
                        this.updateProgress(data.id, data.progress);
                        break;
                    }
                    default:
                        break;
                }
            });
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
                                                        chunkSize: this.chunkSize,
                                                        aesKey: null
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
            entries(state.progress).reduce(
                (result, [id, value]) => {
                    if (predicate(value)) {
                        result[id] = {
                            ...value,
                            ...partialValue
                        };
                    } else {
                        result[id] = value;
                    }

                    return result;
                },
                {} as State['progress']
            )
        );
    }

    // async reloadComponent(self: boolean, urlToNavigateTo?: string) {
    //     const url = self ? this.router.url : urlToNavigateTo;
    //     // если запрошено обновление корня, то переадресация на / не дает эффекта, поэтому открываем любой путь без журнала
    //     await this.router.navigateByUrl('/settings', { skipLocationChange: true });
    //     await this.router.navigate([url]);
    // }

    terminate() {
        this.set({
            items: [],
            summary: this.summaryInitValue,
            progress: {}
        });
    }

    addItem(item: FileUpload) {
        this.files.next(item);
    }

    async add(files: FileSystemFileHandle[]) {
        try {
            const worker = this.#coreService.worker();
            for (let i = 0; i < files.length; i++) {
                const file = await files[i].getFile();
                const buffer = await file.arrayBuffer();
                const parent = this.#fileListService.parent();
                const canvas = this.#document.createElement('canvas');
                const offscreen = canvas?.transferControlToOffscreen();
                const item = {
                    id: uuidv4(),
                    name: file.name,
                    fileSize: file.size,
                    contentType: file.type,
                    parentId: parent?.id,
                    data: buffer,
                    canvas: offscreen
                };
                this.addItem(item);
                if (worker) {
                    const uploadState = this.get('progress', item.id);
                    worker.postMessage({ action: 'addUpload', item, uploadState }, [item.data, item.canvas]);
                }
            }
        } catch (err) {
            this.#notificationService.error((<DOMException>err).message);
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
        const worker = this.#coreService.worker();
        const items = this.get('items');
        const item = items.find(item => item.id === id);
        if (worker) {
            worker.postMessage({ action: 'retryUpload', id });
        } else if (item) {
            this.files.next(item);
        }
    }

    pause(id: string) {
        const worker = this.#coreService.worker();
        const { items, progress } = this.get();
        const item = items.find(item => item.id === id);
        const canisterId = progress[id]?.canisterId;
        if (worker) {
            worker.postMessage({ action: 'pauseUpload', id });
        } else if (item && canisterId) {
            this.updateProgress(id, { status: UPLOAD_STATUS.Paused });
            this.keepAlive.next({ id: item.id, canisterId });
        }
    }

    resume(id: string) {
        const worker = this.#coreService.worker();
        const items = this.get('items');
        const item = items.find(item => item.id === id);
        if (worker) {
            worker.postMessage({ action: 'resumeUpload', id });
        } else if (item) {
            this.files.next(item);
        }
    }

    cancel(id: string) {
        const worker = this.#coreService.worker();
        if (worker) {
            worker.postMessage({ action: 'cancelUpload', id });
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
                .reduce(
                    (res, item) => {
                        res[item.id] = item;
                        return res;
                    },
                    {} as State['progress']
                )
        );
    }

    resetSummary() {
        this.set({ summary: this.summaryInitValue });
    }

    async showOpenFilePicker() {
        try {
            const files = await showOpenFilePicker({
                multiple: true
            });
            this.add(files);
        } catch (err) {
            this.#notificationService.error((<DOMException>err).message);
        }
    }

    async #listFilesAndDirsRecursively(dirHandle: FileSystemDirectoryHandle, cwd?: string): Promise<[{ file: File; path: string }[], string[]]> {
        const path = cwd ? `${cwd}/${dirHandle.name}` : dirHandle.name;
        const files: Array<{ file: File; path: string }> = [];
        const directories: string[] = [path];
        for await (const [name, handle] of dirHandle.entries()) {
            if (this.#ignoreFileList.includes(name)) continue;
            if (handle.kind === 'directory') {
                const [f, d] = await this.#listFilesAndDirsRecursively(handle as FileSystemDirectoryHandle, path);
                files.push(...f);
                directories.push(...d);
            } else {
                files.push({ file: await (handle as FileSystemFileHandle).getFile(), path });
            }
        }
        return [files, directories];
    }

    async showDirectoryPicker() {
        try {
            const dirHandle = await showDirectoryPicker();
            const parent = this.#fileListService.parent();
            const [files, directories] = await this.#listFilesAndDirsRecursively(dirHandle);

            const worker = this.#coreService.worker();
            this.#journalService
                .createPaths({ paths: this.#getUniquePaths(directories), parent })
                .pipe(
                    mergeAll(),
                    mergeMap(({ path, id }) => from(remove(files, ['path', path])).pipe(map(file => ({ ...file, parentId: id })))),
                    mergeMap(({ file, parentId }) =>
                        from(file.arrayBuffer()).pipe(
                            map(buffer => {
                                const canvas = this.#document.createElement('canvas');
                                const offscreen = canvas?.transferControlToOffscreen();
                                return {
                                    id: uuidv4(),
                                    name: file.name,
                                    fileSize: file.size,
                                    contentType: file.type,
                                    parentId,
                                    data: buffer,
                                    canvas: offscreen
                                };
                            })
                        )
                    )
                )
                .subscribe(item => {
                    this.files.next(item);
                    if (worker) {
                        const uploadState = this.get('progress', item.id);
                        worker.postMessage({ action: 'addUpload', item, uploadState }, [item.data, item.canvas]);
                    }
                });
        } catch (err) {
            this.#notificationService.error((<DOMException>err).message);
        }
    }

    #getUniquePaths(dirs: string[]): string[] {
        const result: string[] = [];
        const sortedDirs = orderBy(dirs, v => v.split('/').length, 'desc');
        for (const dir of sortedDirs) {
            if (!result.some(v => v.startsWith(dir + '/'))) {
                result.push(dir);
            }
        }
        return result;
    }
}
