import { inject, Injectable } from '@angular/core';
import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { toNullable } from '@dfinity/utils';
import { TranslocoService } from '@ngneat/transloco';
import { selectSlice } from '@rx-angular/state/selections';
import { get, has, head, isEqual, isNil, isNull, pick } from 'lodash';
import { nanoid } from 'nanoid';
import { defer, EMPTY, from, iif, Observable, of, throwError } from 'rxjs';
import { catchError, filter, finalize, first, map, switchMap, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { OptKeys } from '@core/models';
import { BucketsService, NotificationService } from '@core/services';
import { toTimestamp } from '@core/utils';
import {
    Directory,
    DirectoryAction,
    DirectoryCreateError,
    DirectoryMoveError,
    DirectoryState,
    DirectoryUpdatableFields,
    File,
    _SERVICE as JournalBucketActor,
    NotFoundError,
    DirectoryColor as OptDirectoryColor
} from '@declarations/journal/journal.did';
import { DirectoryColor, DirectoryCreate, DirectoryExtended, FileInfoExtended, JournalItem } from '@features/file-list/models';
import { SnackbarProgressService, Task } from '@features/file-list/services/snackbar-progress.service';
import { toDirectoryExtended, toFileExtended } from '@features/file-list/utils';
import { DirectoryFlatNode } from '../components/tree/tree.models';
import { FileListService } from './file-list.service';

@Injectable()
export class JournalService {
    private bucketsService = inject(BucketsService);
    private notificationService = inject(NotificationService);
    private snackbarProgressService = inject(SnackbarProgressService);
    readonly #fileListService = inject(FileListService);
    private translocoService = inject(TranslocoService);

    createDirectory({ name, parent }: DirectoryCreate) {
        const id = `temp_${nanoid(4)}`;
        this.#fileListService.addTemponaryDir({ id, name, parent });
        this.wrapActionHandler(actor => actor.createDirectory({ name, parentId: toNullable(parent?.id) }))
            .pipe(
                map(result => {
                    if (has(result, 'err')) {
                        const [key, value] = Object.entries(get(result, 'err') as unknown as DirectoryCreateError)[0];
                        throw Error(this.translocoService.translate(`fileList.directory.create.messages.err.${key}`, { value }));
                    }
                    const directory = toDirectoryExtended(get(result, 'ok') as unknown as Directory);
                    return directory;
                }),
                finalize(() => this.#fileListService.removeItem(id))
            )
            .subscribe({
                error: err => this.notificationService.error(err.message),
                next: directory => this.#fileListService.add(directory),
                complete: () => this.notificationService.success(this.translocoService.translate('fileList.directory.create.messages.createOk'))
            });
    }

    createPaths(args: { paths: string[]; parent?: { path: string; id: string } }): Observable<{ path: string; id: string }[]> {
        return new Observable(subscriber => {
            const handler: (item: Task) => Observable<unknown> = item => {
                const items = this.#fileListService.items();
                const parent = this.#fileListService.parent();
                const name = head(item.name.split('/')) as string;
                if (!items.some(v => v.name === name) && isEqual(args.parent, parent)) {
                    this.#fileListService.addTemponaryDir({ id: item.id, name, parent: args.parent });
                }

                return this.wrapActionHandler(actor =>
                    actor.createPaths(
                        [item.name],
                        Array.from({ length: item.name.split('/').length }).map(() => uuidv4()),
                        toNullable(args.parent?.id)
                    )
                ).pipe(
                    tap({
                        next: value => subscriber.next(value.map(([path, id]) => ({ path, id }))),
                        finalize: () => {
                            this.#fileListService.removeItem(item.id);
                            this.#fileListService.update();
                        }
                    })
                );
            };

            this.snackbarProgressService.add<Task>(
                'createPath',
                args.paths.map(name => ({ id: `temp_${nanoid(4)}`, name, type: 'folder' }) as Task),
                handler
            );
            const subscription = this.snackbarProgressService.snackBarRef
                ?.afterDismissed()
                .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
                .subscribe({
                    error: err => subscriber.error(err),
                    complete: () => subscriber.complete()
                });
            return () => subscription?.unsubscribe();
        });
    }

    private wrapActionHandler<T>(callback: (actor: ActorSubclass<JournalBucketActor>) => Promise<T>) {
        return this.bucketsService.select('journal').pipe(
            first(),
            switchMap(actor =>
                iif(
                    () => isNil(actor),
                    throwError(() => new Error("User isn't authorized")),
                    defer(() => callback(actor as NonNullable<typeof actor>))
                )
            ),
            catchError(err => {
                this.notificationService.error(err.message);
                return throwError(() => err);
            })
        );
    }

    move(selected: JournalItem[], targetPath?: string) {
        const selectedIds = selected.map(({ id }) => id);
        this.#fileListService.updateItems(id => selectedIds.includes(id), { disabled: true });
        const handler: (item: JournalItem) => Observable<unknown> = item =>
            this.wrapActionHandler(actor => {
                const path = item.path ?? item.name;
                const preparedTargetPath = toNullable(targetPath);
                return item.type === 'folder' ? actor.moveDirectory(path, preparedTargetPath) : actor.moveFile(path, preparedTargetPath);
            }).pipe(
                map(result => {
                    if (has(result, 'err')) {
                        // TODO: перевод ошибок
                        throw new Error(Object.keys(get(result, 'err') as unknown as DirectoryMoveError)[0]);
                    }

                    return true;
                }),
                tap({
                    error: err => console.error(err),
                    finalize: () => this.#fileListService.updateItems(id => id === item.id, { disabled: false }),
                    complete: () => this.#fileListService.removeItem(item.id)
                })
            );
        this.snackbarProgressService.add<JournalItem>('move', selected, handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.#fileListService.updateItems(id => selectedIds.includes(id), { disabled: false }));
    }

    remove(selected: JournalItem[]) {
        const selectedIds = selected.map(({ id }) => id);
        this.#fileListService.updateItems(id => selectedIds.includes(id), { disabled: true });
        this.#fileListService.updateBreadcrumbs(id => selectedIds.includes(id), { loading: true });
        const handler: (item: JournalItem) => Observable<unknown> = item =>
            this.wrapActionHandler(actor => {
                const path = item.path ?? item.name;
                return item.type === 'folder' ? actor.deleteDirectory(path) : actor.deleteFile(path);
            }).pipe(
                map(result => {
                    if (has(result, 'err')) {
                        const key = Object.keys(get(result, 'err') as unknown as NotFoundError)[0];
                        const type = item.type === 'folder' ? 'directory' : 'file';
                        throw Error(this.translocoService.translate(`fileList.${type}.remove.messages.err.${key}`));
                    }

                    return true;
                }),
                tap({
                    error: err => console.error(err),
                    finalize: () => {
                        this.#fileListService.updateItems(id => id === item.id, { disabled: false });
                        this.#fileListService.updateBreadcrumbs(id => id === item.id, { loading: false });
                    },
                    complete: () => {
                        this.#fileListService.removeItem(item.id);
                        // this.fileListState.set(state => ({
                        //     items: state.items.filter(({ id }) => item.id !== id),
                        //     breadcrumbs: state.breadcrumbs.filter(({ id }) => item.id !== id)
                        // }));
                    }
                })
            );
        this.snackbarProgressService.add<JournalItem>('remove', selected, handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.#fileListService.updateItems(id => selectedIds.includes(id), { disabled: false }));
    }

    #prepareFields(
        fields: Partial<{
            name: string;
            color: DirectoryColor;
            parentId: string;
        }>
    ): DirectoryUpdatableFields {
        return {
            name: toNullable(fields.name),
            color: toNullable(fields.color ? <OptDirectoryColor>{ [fields.color]: null } : undefined),
            parentId: toNullable(fields.parentId)
        };
    }

    rename(item: JournalItem, name: string) {
        if (this.isDirectory(item)) {
            this.#renameDir(item, name);
        } else {
            this.#renameFile(item, name);
        }
    }

    changeDirColor(selected: DirectoryExtended[], color: DirectoryColor) {
        this.#updateDir(selected, 'changeColor', { color });
    }

    #renameDir(directory: DirectoryExtended, name: string) {
        this.#updateDir([directory], 'rename', { name });
    }

    #renameFile(file: FileInfoExtended, name: string) {
        this.#fileListService.updateItems(id => id === file.id, { disabled: true });
        const handler: (item: FileInfoExtended) => Observable<unknown> = item =>
            this.wrapActionHandler(actor => actor.renameFile(item.id, name)).pipe(
                map(result => {
                    if (has(result, 'err')) {
                        const key = Object.keys(get(result, 'err') as unknown as NotFoundError | { alreadyExists: File } | { illegalCharacters: null })[0];
                        throw Error(this.translocoService.translate(`fileList.directory.update.messages.err.${key}`));
                    }

                    return toFileExtended(get(result, 'ok') as unknown as File);
                }),
                tap({
                    error: err => console.error(err),
                    next: value => this.#fileListService.updateItems(id => id === item.id, value),
                    finalize: () => this.#fileListService.updateItems(id => id === item.id, { disabled: false })
                })
            );
        this.snackbarProgressService.add<FileInfoExtended>('update', [file], handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.#fileListService.update());
    }

    #updateDir(
        selected: DirectoryExtended[],
        action: OptKeys<DirectoryAction>,
        updateFields: Partial<{
            name: string;
            color: DirectoryColor;
            parentId: string;
        }>
    ) {
        const selectedIds = selected.map(({ id }) => id);
        this.#fileListService.updateItems(id => selectedIds.includes(id), { disabled: true });
        this.#fileListService.updateBreadcrumbs(id => selectedIds.includes(id), { loading: true });
        const fields = this.#prepareFields(updateFields);
        const handler: (dir: DirectoryExtended) => Observable<unknown> = dir =>
            this.wrapActionHandler(actor => actor.updateDirectory(<DirectoryAction>{ [action]: dir.id }, fields)).pipe(
                map(result => {
                    if (has(result, 'err')) {
                        const key = Object.keys(get(result, 'err') as unknown as NotFoundError | { alreadyExists: Directory })[0];
                        throw Error(this.translocoService.translate(`fileList.directory.update.messages.err.${key}`));
                    }

                    return toDirectoryExtended(get(result, 'ok') as unknown as Directory);
                }),
                tap({
                    error: err => console.error(err),
                    next: value => {
                        this.#fileListService.updateItems(id => id === dir.id, value);
                        this.#fileListService.updateBreadcrumbs(id => id === dir.id, value);
                    },
                    finalize: () => {
                        this.#fileListService.updateItems(id => id === dir.id, { disabled: false });
                        this.#fileListService.updateBreadcrumbs(id => id === dir.id, { loading: false });
                    }
                })
            );
        this.snackbarProgressService.add<DirectoryExtended>('update', selected, handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.#fileListService.update());
    }

    get(id?: string): Observable<Pick<DirectoryFlatNode, 'expandable' | 'directory'>[]> {
        return this.bucketsService.select(selectSlice(['journal', 'loaded'])).pipe(
            filter(({ loaded }) => loaded),
            first(),
            switchMap(({ journal }) => {
                if (isNull(journal)) return of([]);

                return from(journal.getChildrenDirs(toNullable(id))).pipe(
                    map(dirs =>
                        dirs.map(toDirectoryExtended).map(
                            dir =>
                                ({
                                    expandable: dir.children && dir.children[0].length > 0,
                                    directory: pick(dir, ['id', 'name', 'parentId', 'path'])
                                }) as Pick<DirectoryFlatNode, 'expandable' | 'directory'>
                        )
                    ),
                    catchError(() => of([]))
                );
            })
        );
    }

    getBreadcrumbs(path?: string): Observable<DirectoryExtended[]> {
        return this.bucketsService.select(selectSlice(['journal', 'loaded'])).pipe(
            filter(({ loaded }) => loaded),
            first(),
            switchMap(({ journal }) => {
                if (isNull(journal)) return of([]);
                return from(journal.getJournal(toNullable(path))).pipe(
                    map(response => {
                        if (has(response, 'err')) {
                            return [];
                        }

                        const journal = get(response, 'ok') as unknown as DirectoryState;
                        return journal.breadcrumbs.map(toDirectoryExtended);
                    }),
                    catchError(() => of([]))
                );
            })
        );
    }

    isDirectory(item: JournalItem): item is DirectoryExtended {
        return item.type === 'folder';
    }

    isFile(item: JournalItem): item is FileInfoExtended {
        return item.type === 'file';
    }

    shareFile(
        file: FileInfoExtended,
        params: {
            sharedWith: { everyone: null } | { users: Principal[] };
            limitDownloads?: number;
            timelock?: Date;
        }
    ) {
        const timelock = toNullable(params.timelock ? toTimestamp(params.timelock) : undefined);
        const limitDownloads = toNullable(params.limitDownloads ? BigInt(params.limitDownloads) : undefined);
        this.#fileListService.updateItems(id => id === file.id, { disabled: true });
        const handler: (item: FileInfoExtended) => Observable<unknown> = item =>
            this.wrapActionHandler(actor => actor.shareFile(item.id, { ...params, limitDownloads, timelock })).pipe(
                map(result => {
                    if (has(result, 'err')) {
                        const key = Object.keys(get(result, 'err') as unknown as NotFoundError)[0];
                        throw Error(this.translocoService.translate(`fileList.file.share.messages.err.${key}`));
                    }

                    return toFileExtended(get(result, 'ok') as unknown as File);
                }),
                tap({
                    error: err => console.error(err),
                    next: value => this.#fileListService.updateItems(id => id === item.id, value),
                    finalize: () => this.#fileListService.updateItems(id => id === item.id, { disabled: false })
                })
            );
        this.snackbarProgressService.add<FileInfoExtended>('share', [file], handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.#fileListService.update());
    }

    unshareFile(items: FileInfoExtended[]) {
        const selectedIds = items.map(({ id }) => id);
        this.#fileListService.updateItems(id => selectedIds.includes(id), { disabled: true });
        const handler: (item: FileInfoExtended) => Observable<unknown> = item =>
            this.wrapActionHandler(actor => actor.unshareFile(item.id)).pipe(
                map(result => {
                    if (has(result, 'err')) {
                        const key = Object.keys(get(result, 'err') as unknown as NotFoundError)[0];
                        throw Error(this.translocoService.translate(`fileList.file.unshare.messages.err.${key}`));
                    }

                    return toFileExtended(get(result, 'ok') as unknown as File);
                }),
                tap({
                    error: err => console.error(err),
                    next: value => this.#fileListService.updateItems(id => id === item.id, value),
                    finalize: () => this.#fileListService.updateItems(id => id === item.id, { disabled: false })
                })
            );
        this.snackbarProgressService.add<FileInfoExtended>('unshare', items, handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.#fileListService.update());
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
