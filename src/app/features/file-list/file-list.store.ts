import { inject, InjectionToken, Provider, TemplateRef } from '@angular/core';
import { NavigationEnd, ResolveEnd, ResolveStart, Router } from '@angular/router';
import { toNullable } from '@dfinity/utils';
import { RxState } from '@rx-angular/state';
import { defer, EMPTY, iif, merge } from 'rxjs';
import { combineLatestWith, filter, map, switchMap, startWith } from 'rxjs/operators';
import { isNull } from 'lodash';

import { DirectoryExtended, JournalItem } from '@features/file-list/models';
import { BucketsService } from '@core/services';

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

    selectedSomeFile: boolean;
    selectedSomeFolder: boolean;
    selectedEveryFile: boolean;
    selectedEveryFolder: boolean;
}

export const FILE_LIST_RX_STATE = new InjectionToken<RxState<FileListState>>('FILE_LIST_RX_STATE');

export function fileListStateFactory(bucketsService: BucketsService) {
    const state = new RxState<FileListState>();
    const router = inject(Router);
    state.select('tree').subscribe(console.log);
    // const selected$ = path$.pipe(map(() => ({ selected: [] })));
    // const version$ = journalState.select('actor').pipe(
    //     filter(actor => !isNil(actor)),
    //     switchMap(actor => (actor as ActorSubclass<JournalBucketActor>).getVersion()),
    //     map(version => ({ version }))
    // );
    const loading$ = merge(
        router.events.pipe(
            filter(event => event instanceof ResolveStart),
            map(() => true)
        ),
        router.events.pipe(
            filter(event => event instanceof ResolveEnd),
            map(() => false)
        )
    ).pipe(map(loading => ({ loading })));
    const tree$ = bucketsService.select('journal').pipe(
        combineLatestWith(
            state.select('parentId'),
            router.events.pipe(
                filter(event => event instanceof NavigationEnd),
                startWith(null)
            )
        ),
        switchMap(([actor, parentId]) =>
            iif(
                () => isNull(actor),
                EMPTY,
                defer(() => (actor as NonNullable<typeof actor>).showDirectoriesTree(toNullable(parentId ?? undefined)))
            )
        ),
        map(tree => ({ tree }))
    );
    state.connect(merge(loading$, tree$));
    state.set({ items: [], selected: [], loading: false, breadcrumbs: [], dragging: false });
    state.connect(
        state.select('selected').pipe(
            map(items => ({
                selectedSomeFile: items.some(({ type }) => type === 'file'),
                selectedSomeFolder: items.some(({ type }) => type === 'folder'),
                selectedEveryFile: items.every(({ type }) => type === 'file'),
                selectedEveryFolder: items.every(({ type }) => type === 'folder')
            }))
        )
    );
    return state;
}

export const fileListStateProvider: Provider = {
    provide: FILE_LIST_RX_STATE,
    useFactory: fileListStateFactory,
    deps: [BucketsService]
};
