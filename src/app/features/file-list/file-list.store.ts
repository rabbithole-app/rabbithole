import { Location } from '@angular/common';
import { inject, InjectionToken, TemplateRef } from '@angular/core';
import { NavigationEnd, PRIMARY_OUTLET, Router, UrlSegmentGroup, UrlTree } from '@angular/router';
import { ActorSubclass } from '@dfinity/agent';
import { fromNullable, toNullable } from '@dfinity/utils';
import { translate } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { concat, defer, EMPTY, iif, merge, of, Subject } from 'rxjs';
import { catchError, combineLatestWith, connect, filter, map, shareReplay, switchMap, startWith } from 'rxjs/operators';
import { get, has, isEmpty, isNil } from 'lodash';

import { DirectoryExtended, JournalItem } from '@features/file-list/models';
import { toDirectoryExtended, toFileExtended } from '@features/file-list/utils';
import { JournalState } from '@core/stores/journal';
import { _SERVICE as JournalBucketActor, Directory, File, Journal, JournalError } from '@declarations/journal/journal.did';
import { NotificationService } from '@core/services';

type MultipleProgress = {
    done: number;
    failed: number;
    total: number;
    errors: Record<string, string>;
    filename?: string;
};

export interface FileListState {
    items: JournalItem[];
    selected: JournalItem[];
    loading: boolean;
    breadcrumbs: DirectoryExtended[];
    dragging: boolean;
    notificationProgress: MultipleProgress;
    progressMessage: string;
    parentPath: string | null;
    parentId: string | null;
    tree: string | null;
    version?: string;
    contextItemsTemplate: TemplateRef<HTMLElement>;
}

export const FILE_LIST_RX_STATE = new InjectionToken<RxState<FileListState>>('FILE_LIST_RX_STATE');

export function fileListStateFactory(journalState: RxState<JournalState>) {
    const state = new RxState<FileListState>();
    const router = inject(Router);
    const location = inject(Location);
    const notificationService = inject(NotificationService);
    const path$ = router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        map(event => (event as NavigationEnd).url),
        startWith(router.url),
        map(url => {
            const tree: UrlTree = router.parseUrl(url);
            const g: UrlSegmentGroup = tree.root.children[PRIMARY_OUTLET];
            const path = g
                ? g.segments
                      .slice(1)
                      .map(({ path }) => path)
                      .join('/')
                : null;

            return isEmpty(path) ? null : path;
        }),
        shareReplay(1)
    );
    const items$ = path$.pipe(
        combineLatestWith(journalState.select('actor')),
        connect(
            source =>
                concat(
                    of({ loading: true }),
                    source.pipe(
                        switchMap(([path, actor]) =>
                            iif(
                                () => isNil(actor),
                                EMPTY,
                                defer(() => (actor as ActorSubclass<JournalBucketActor>).getJournal(toNullable(path ?? undefined))).pipe(
                                    map(response => {
                                        if (has(response, 'err')) {
                                            const err = Object.keys(get(response, 'err') as unknown as JournalError)[0];
                                            const message = translate(`file-list.get.errors.${err}`);
                                            throw new Error(message);
                                        }

                                        const journal = get(response, 'ok') as unknown as Journal;

                                        const dirs = journal.dirs.map((dir: Directory) => ({
                                            ...toDirectoryExtended(dir),
                                            path
                                        }));
                                        const files = journal.files.map((file: File) => ({
                                            ...toFileExtended(file),
                                            path
                                        }));
                                        const breadcrumbs = journal.breadcrumbs.map(toDirectoryExtended);

                                        return {
                                            items: [...dirs, ...files] as JournalItem[],
                                            breadcrumbs,
                                            parentId: fromNullable<string>(journal.id) ?? null,
                                            lastPath: path
                                        };
                                    }),
                                    catchError(e => {
                                        notificationService.error(e.message);
                                        location.back();
                                        return EMPTY;
                                    })
                                )
                            )
                        )
                    ),
                    of({ loading: false })
                ),
            {
                connector: () => new Subject()
            }
        )
    );
    const selected$ = path$.pipe(map(() => ({ selected: [] })));
    // const version$ = journalState.select('actor').pipe(
    //     filter(actor => !isNil(actor)),
    //     switchMap(actor => (actor as ActorSubclass<JournalBucketActor>).getVersion()),
    //     map(version => ({ version }))
    // );
    const tree$ = journalState.select('actor').pipe(
        combineLatestWith(
            state.select('parentId'),
            router.events.pipe(
                filter(event => event instanceof NavigationEnd),
                startWith(null)
            )
        ),
        switchMap(([actor, parentId]) =>
            iif(
                () => isNil(actor),
                EMPTY,
                defer(() => (actor as ActorSubclass<JournalBucketActor>).showDirectoriesTree(toNullable(parentId ?? undefined)))
            )
        ),
        map(tree => ({ tree }))
    );
    // const tree$ = merge(router.events.pipe(filter(event => event instanceof NavigationEnd)), journalState.select('actor')).pipe(
    //     switchMap(() =>
    //     journalState.select('actor').pipe(
    //             combineLatestWith(state.select('parentId')),
    //             switchMap(({ actor, parentId }) =>
    //                 iif(() => isNil(actor), of(''), (actor as ActorSubclass<JournalBucketActor>).showDirectoriesTree(toNullable(parentId ?? undefined)))
    //             ),
    //             map(tree => ({ tree }))
    //         )
    //     )
    // );
    const parentPath$ = path$.pipe(map(parentPath => ({ parentPath })));
    // const authenticated$ = authState.select('isAuthenticated').pipe(share());
    // const anonymous$ = authenticated$.pipe(filter(v => !v));
    state.connect(
        merge(selected$, items$, parentPath$, tree$)
            .pipe
            // takeUntil(anonymous$),
            // repeat({ delay: () => authenticated$ })
            ()
    );
    state.set({ items: [], selected: [], loading: false, breadcrumbs: [], dragging: false });
    state.select('tree').subscribe(console.info);
    return state;
}
