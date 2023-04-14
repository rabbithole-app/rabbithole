import { inject, Injectable } from '@angular/core';
import { Principal } from '@dfinity/principal';
import { ActorSubclass } from '@dfinity/agent';
import { toNullable } from '@dfinity/utils';
import { TranslocoService } from '@ngneat/transloco';
import { defer, EMPTY, first, iif, Observable, of, throwError } from 'rxjs';
import { catchError, filter, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { get, has, isNil, isNull } from 'lodash';
import { saveAs } from 'file-saver';

import { createActor } from '@core/utils';
import { AUTH_RX_STATE, Bucket } from '@core/stores';
import { BucketsService, NotificationService } from '@core/services';
import { Directory, DirectoryMoveError, _SERVICE as JournalBucketActor } from '@declarations/journal/journal.did';
import { idlFactory as storageIdlFactory } from 'declarations/storage';
import { _SERVICE as StorageActor } from 'declarations/storage/storage.did';
import { DirectoryExtended, FileInfoExtended, JournalItem } from '@features/file-list/models';
import { toDirectoryExtended } from '@features/file-list/utils';
import { SnackbarProgressService } from '@features/file-list/services/snackbar-progress.service';
import { FILE_LIST_RX_STATE } from '@features/file-list/file-list.store';
import { getStorage } from '@features/upload/operators';

export interface BucketActor<T> {
    bucketId: Principal;
    actor: T;
    balance: bigint;
}

@Injectable()
export class JournalService {
    private bucketsService = inject(BucketsService);
    private notificationService = inject(NotificationService);
    private snackbarProgressService = inject(SnackbarProgressService);
    private fileListState = inject(FILE_LIST_RX_STATE);
    private authState = inject(AUTH_RX_STATE);
    private translocoService = inject(TranslocoService);

    async createDirectory({ id, name, parentId }: { id: string; name: string; parentId?: string }) {
        const tempDirectory: DirectoryExtended = { id, name, parentId, type: 'folder', color: 'blue', children: undefined, loading: true, disabled: true };
        this.fileListState.set('items', state => [...state.items, tempDirectory]);
        this.wrapActionHandler(actor => actor.createDirectory({ id, name, parentId: toNullable(parentId) }))
            .pipe(
                switchMap(result => {
                    if (has(result, 'err')) {
                        // TODO: перевод ошибок
                        return throwError(() => new Error(Object.keys(get(result, 'err') as unknown as Record<string, void>)[0]));
                    }
                    const directory = toDirectoryExtended(get(result, 'ok') as unknown as Directory);
                    return of(directory);
                })
            )
            .subscribe({
                error: () => this.fileListState.set('items', state => state.items.filter(item => item.id !== id)),
                next: directory => this.fileListState.set('items', state => [...state.items.filter(item => item.id !== id), directory]),
                complete: () => this.notificationService.success(this.translocoService.translate('fileList.directory.create.answers.ok'))
            });
    }

    private wrapActionHandler<T>(callback: (actor: ActorSubclass<JournalBucketActor>) => Promise<T>) {
        return this.bucketsService.select('journal').pipe(
            first(),
            switchMap(actor =>
                iif(
                    () => isNil(actor),
                    throwError(() => new Error("User isn't authorized")),
                    defer(() => callback(actor as unknown as ActorSubclass<JournalBucketActor>))
                )
            ),
            catchError(err => {
                this.notificationService.error(err.message);
                return throwError(() => err);
            })
        );
    }

    move(selected: JournalItem[], targetPath: string | null) {
        const selectedIds = selected.map(({ id }) => id);
        this.updateItems(id => selectedIds.includes(id), { disabled: true });
        const handler: (item: JournalItem) => Observable<unknown> = item =>
            this.wrapActionHandler(actor => {
                const sourcePath = isNil(item.path) ? item.name : `${item.path}/${item.name}`;
                const preparedTargetPath = toNullable(targetPath ?? undefined);
                return item.type === 'folder' ? actor.moveDirectory(sourcePath, preparedTargetPath) : actor.moveFile(sourcePath, preparedTargetPath);
            }).pipe(
                switchMap(result => {
                    if (has(result, 'err')) {
                        // TODO: перевод ошибок
                        return throwError(() => new Error(Object.keys(get(result, 'err') as unknown as DirectoryMoveError)[0]));
                    }

                    return of(true);
                }),
                tap({
                    error: err => console.error(err),
                    finalize: () => this.updateItems(id => id === item.id, { disabled: false }),
                    complete: () => this.fileListState.set('items', state => state.items.filter(({ id }) => item.id !== id))
                })
            );
        this.snackbarProgressService.add<JournalItem>('move', selected, handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.updateItems(id => selectedIds.includes(id), { disabled: false }));
    }

    download(selected: JournalItem[]) {
        selected
            .filter(({ type }) => type === 'file')
            .map(v => v as FileInfoExtended)
            .forEach(item => {
                saveAs(item.downloadUrl, item.name);
            });
    }

    remove(selected: JournalItem[]) {
        const selectedIds = selected.map(({ id }) => id);
        this.updateItems(id => selectedIds.includes(id), { disabled: true });
        this.updateBreadcrumbs(id => selectedIds.includes(id), { loading: true });
        const handler: (item: JournalItem) => Observable<unknown> = item =>
            this.wrapActionHandler(actor => {
                const path = isNil(item.path) ? item.name : `${item.path}/${item.name}`;
                return item.type === 'folder' ? actor.deleteDirectory(path) : actor.deleteFile(path);
            }).pipe(
                switchMap(result => {
                    if (has(result, 'err')) {
                        // TODO: перевод ошибок
                        return throwError(() => new Error(Object.keys(get(result, 'err') as unknown as Record<string, any>)[0]));
                    }

                    return of(true);
                }),
                tap({
                    error: err => console.error(err),
                    finalize: () => {
                        this.updateItems(id => id === item.id, { disabled: false });
                        this.updateBreadcrumbs(id => id === item.id, { loading: false });
                    },
                    complete: () => {
                        this.fileListState.set(state => ({
                            items: state.items.filter(({ id }) => item.id !== id),
                            breadcrumbs: state.breadcrumbs.filter(({ id }) => item.id !== id)
                        }));
                    }
                })
            );
        this.snackbarProgressService.add<JournalItem>('remove', selected, handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.updateItems(id => selectedIds.includes(id), { disabled: false }));
    }

    private updateItems(iteratee: (id: string) => boolean, value: Partial<JournalItem>) {
        this.fileListState.set('items', state => state.items.map<JournalItem>(item => (iteratee(item.id) ? ({ ...item, ...value } as JournalItem) : item)));
    }

    private updateBreadcrumbs(iteratee: (id: string) => boolean, value: Partial<DirectoryExtended>) {
        this.fileListState.set('breadcrumbs', state => state.breadcrumbs.map(item => (iteratee(item.id) ? { ...item, ...value } : item)));
    }

    getStorage(fileSize: bigint): Observable<Bucket<StorageActor>> {
        return this.bucketsService.select('journal').pipe(
            first(),
            filter(actor => !isNull(actor)),
            map(actor => actor as NonNullable<typeof actor>),
            switchMap(actor => getStorage(actor, fileSize)),
            withLatestFrom(this.bucketsService.select('storages'), this.authState.select('identity')),
            switchMap(([bucketId, storages, identity]) => {
                const canisterId = bucketId.toText();
                const found: Bucket<StorageActor> | undefined = storages.find(value => canisterId === value.canisterId);
                if (found) {
                    return of(found);
                } else {
                    return createActor<StorageActor>({ identity, idlFactory: storageIdlFactory, canisterId }).pipe(
                        map(actor => ({ actor, canisterId })),
                        tap(value => this.bucketsService.set('storages', state => [...state.storages, value]))
                    );
                }
            })
        );
    }

    /*
    async deleteStorage(id: string) {
        try {
            const actor = this.bucketsService.get('journal');
            if (actor) {
                await actor.deleteStorage(Principal.fromText(id));
                this.notificationService.success('Storage deleted successfully');
            } else {
                throw Error('JournalActor is null');
            }
        } catch (e) {
            this.notificationService.error((e as Error).message);
        }
    }
    */
}
