import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { isEqual, isNull, isUndefined, uniq } from 'lodash';
import { asyncScheduler, filter, finalize, merge, mergeMap, Observable, observeOn, onErrorResumeNext, repeat, share, skip, Subject, switchMap } from 'rxjs';
import { distinctUntilChanged, map, takeUntil, tap } from 'rxjs/operators';

import { ProgressMessageSnackbarComponent } from '@features/file-list/components/progress-message-snackbar/progress-message-snackbar.component';
import { ShowErrorsDialogComponent } from '@features/file-list/components/show-errors-dialog/show-errors-dialog.component';

type Action = 'createPath' | 'move' | 'remove' | 'update';
enum ItemType {
    File,
    Folder,
    Both
}

interface State {
    queue: string[];
    done: number;
    failed: number;
    total: number;
    errors?: Record<string, string>;
    snackBarRef?: MatSnackBarRef<ProgressMessageSnackbarComponent>;
    progressMessage?: string;
    name?: string;
    actions: Action[];
    type: ItemType;
}

export type Task = {
    id: string;
    name: string;
    type: 'file' | 'folder';
};

@Injectable()
export class SnackbarProgressService extends RxState<State> {
    snackBar = inject(MatSnackBar);
    dialog = inject(MatDialog);
    translocoService = inject(TranslocoService);
    private tasks = new Subject<{
        value: Task;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: (item: any) => Observable<unknown>;
    }>();
    readonly concurrentTasksCount = 5;

    get snackBarRef(): MatSnackBarRef<ProgressMessageSnackbarComponent> | undefined {
        return this.get('snackBarRef');
    }

    constructor() {
        super();
        this.resetProgress();

        const hasQueue$ = this.select('queue').pipe(
            map(items => items.length > 0),
            skip(1),
            distinctUntilChanged(),
            share()
        );
        const on$ = hasQueue$.pipe(filter(v => v));
        const off$ = merge(
            hasQueue$.pipe(filter(v => !v)),
            this.select('snackBarRef').pipe(
                filter(ref => !isUndefined(ref)),
                switchMap(snackBarRef => (snackBarRef as MatSnackBarRef<ProgressMessageSnackbarComponent>).afterDismissed())
            )
        );

        this.connect(
            'progressMessage',
            this.$.pipe(
                map(({ name, done, failed, total, actions }) => ({ name, done, failed, total, actions })),
                filter(({ actions, total }) => actions.length > 0 && total > 0),
                distinctUntilChanged(isEqual),
                map(({ name, done, failed, total, actions }) => {
                    const isPreparing = done === 0 && failed === 0;
                    const actionKey = actions.length === 1 ? actions[0] : 'common';
                    const key = `fileList.notification.${actionKey}.${isPreparing ? 'prepare' : 'message'}`;
                    return this.translocoService.translate(key, {
                        total,
                        current: done + failed,
                        name
                    });
                })
            )
        );

        this.tasks
            .asObservable()
            .pipe(
                mergeMap(({ value, handler }) => {
                    return onErrorResumeNext(
                        handler(value).pipe(
                            tap({
                                error: err => {
                                    const res = err.message.match(/(?:Body|Reject text): (.+)/);
                                    const errorMessage = isNull(res) ? err.message : res[1];
                                    this.set(state => ({
                                        failed: state.failed + 1,
                                        errors: {
                                            ...state.errors,
                                            [value.name]: errorMessage
                                        }
                                    }));
                                },
                                finalize: () => this.set('queue', state => state.queue.filter(_id => _id !== value.id)),
                                complete: () => this.set('done', state => state.done + 1)
                            })
                        )
                    );
                }, this.concurrentTasksCount),
                finalize(() => {
                    this.snackBarRef?.dismiss();
                    this.resetProgress();
                    this.finalNotify();
                }),
                takeUntil(off$),
                repeat({
                    delay: () => on$
                })
            )
            .subscribe();

        // this.select(selectSlice(['done', 'total', 'actions'])).subscribe(console.log)
    }

    private resetProgress() {
        this.set({ snackBarRef: undefined, queue: [], done: 0, failed: 0, total: 0, errors: {}, actions: [], type: undefined });
    }

    private finalNotify() {
        let snackBarRef!: MatSnackBarRef<TextOnlySnackBar>;
        const { done, failed, name, total, errors, actions, type } = this.get();
        const isSingle = total === 1;
        const isSuccess = done > 0 && done === total;
        const isFailed = failed > 0 && failed === total;
        const hasFailed = failed > 0;
        const hasSuccess = done > 0;
        const actionKey = actions.length === 1 ? actions[0] : 'common';

        if (isSuccess) {
            this.snackBar.open(
                this.translocoService.translate(`fileList.notification.${actionKey}.success`, {
                    count: done,
                    name,
                    type
                }),
                undefined,
                { duration: 2000 }
            );
        } else if (isSingle && isFailed) {
            this.snackBar.open((errors || {})[name as string], undefined, { duration: 3000 });
        } else if (hasSuccess && hasFailed) {
            snackBarRef = this.snackBar.open(
                this.translocoService.translate(`fileList.notification.${actionKey}.warning`, { count: failed, type }),
                this.translocoService.translate('fileList.notification.actions.details'),
                { duration: 2500 }
            );
        } else if (isFailed) {
            snackBarRef = this.snackBar.open(
                this.translocoService.translate(`fileList.notification.${actionKey}.failed`, { count: failed, type }),
                this.translocoService.translate('fileList.notification.actions.details'),
                { duration: 2500 }
            );
        }

        snackBarRef
            ?.afterDismissed()
            .pipe(observeOn(asyncScheduler))
            .subscribe(({ dismissedByAction }) => {
                if (dismissedByAction) {
                    this.dialog.open(ShowErrorsDialogComponent, {
                        width: '350px',
                        data: errors
                    });
                }
            });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    add<T extends Task>(action: Action, items: T[], handler: (item: any) => Observable<unknown>) {
        let { snackBarRef } = this.get();

        if (!snackBarRef) {
            snackBarRef = this.snackBar.openFromComponent(ProgressMessageSnackbarComponent, {
                data: this.select('progressMessage'),
                panelClass: 'progress-message-overlay'
            });
        }

        const everyFile = items.every(({ type }) => type === 'file');
        const everyFolder = items.every(({ type }) => type === 'folder');

        this.set(state => ({
            snackBarRef,
            queue: state.queue.concat(items.map(({ id }) => id)),
            total: state.total + items.length,
            name: !state.total && items.length === 1 ? items[0].name : undefined,
            actions: uniq(state.actions.concat([action])),
            type: everyFile ? ItemType.File : everyFolder ? ItemType.Folder : ItemType.Both
        }));
        items.forEach(value => this.tasks.next({ value, handler }));
    }
}
