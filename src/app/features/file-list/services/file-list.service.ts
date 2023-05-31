import { Injectable, Signal, TemplateRef, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, ResolveEnd, ResolveStart, Router } from '@angular/router';
import { combineLatestWith, filter, map, startWith, switchMap } from 'rxjs/operators';
import { merge } from 'rxjs';
import { BucketsService, NotificationService } from '@core/services';
import { isNil, orderBy } from 'lodash';
import { toNullable } from '@dfinity/utils';
import { TranslocoService } from '@ngneat/transloco';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

import { DirectoryCreate, DirectoryExtended, JournalItem } from '../models';

@Injectable()
export class FileListService {
    readonly #router = inject(Router);
    readonly #bucketsService = inject(BucketsService);
    readonly #translocoService = inject(TranslocoService);
    readonly #notificationService = inject(NotificationService);

    #items: WritableSignal<JournalItem[]> = signal([]);
    breadcrumbs: WritableSignal<DirectoryExtended[]> = signal([]);
    parent: WritableSignal<{ id: string; path: string } | undefined> = signal(undefined);
    selected: WritableSignal<JournalItem[]> = signal([]);
    contextMenuTemplate: WritableSignal<TemplateRef<HTMLElement> | null> = signal(null);
    dragging: WritableSignal<boolean> = signal(false);
    loading: Signal<boolean | undefined> = toSignal(
        merge(
            this.#router.events.pipe(
                filter(event => event instanceof ResolveStart),
                map(() => true)
            ),
            this.#router.events.pipe(
                filter(event => event instanceof ResolveEnd),
                map(() => false)
            )
        ).pipe(startWith(false))
    );
    readonly journalActor$ = this.#bucketsService.select('journal').pipe(
        filter(actor => !isNil(actor)),
        map(actor => actor as NonNullable<typeof actor>)
    );
    readonly #tree = toSignal(
        this.journalActor$.pipe(
            combineLatestWith(
                toObservable(this.parent).pipe(map(parent => parent?.id)),
                this.#router.events.pipe(
                    filter(event => event instanceof NavigationEnd),
                    startWith(null)
                )
            ),
            switchMap(([actor, parentId]) => actor.showDirectoriesTree(toNullable(parentId)))
        )
    );
    // readonly #version = toSignal(this.journalActor$.pipe(switchMap(actor => actor.getVersion())));

    #worker: WritableSignal<Worker | null> = signal(null);
    readonly items: Signal<JournalItem[]> = computed(() => orderBy(this.#items(), [{ type: 'folder' }, 'name'], ['desc', 'asc']));

    constructor() {
        effect(() => console.log(this.#tree()));
        if (typeof Worker !== 'undefined') {
            const worker = new Worker(new URL('../workers/file-list.worker', import.meta.url), { type: 'module' });
            this.#worker.set(worker);

            worker.onmessage = async ({ data }) => {
                switch (data.action) {
                    case 'getJournalSuccess': {
                        this.setData(data.payload);
                        break;
                    }
                    case 'getJournalFailed': {
                        this.#notificationService.error(this.#translocoService.translate(data.errorCode));
                        this.#router.navigate(['/drive']);
                        break;
                    }
                    default:
                        break;
                }
            };
        }
    }

    getJournal(path?: string) {
        this.#worker()?.postMessage({ action: 'getJournal', path });
    }

    setData(data: { items: JournalItem[]; breadcrumbs: DirectoryExtended[]; parent?: { id: string; path: string } }) {
        this.#items.set(data.items);
        this.breadcrumbs.set(data.breadcrumbs);
        this.parent.set(data.parent);
        this.selected.set([]);
    }

    update() {
        const path = this.parent()?.path;
        this.#worker()?.postMessage({ action: 'getJournal', path });
    }

    setItems(items: JournalItem[]) {
        this.#items.set(items);
    }

    add(item: JournalItem) {
        this.#items.update(items => [...items.filter(v => v.id !== item.id), item]);
    }

    addTemponaryDir({ id, name, parent }: { id: string } & DirectoryCreate) {
        const tempDirectory: DirectoryExtended = {
            id,
            name,
            parentId: parent?.id,
            type: 'folder',
            color: 'blue',
            children: undefined,
            loading: true,
            disabled: true
        };
        this.#items.update(items => [...items, tempDirectory]);
    }

    removeItem(id: string) {
        this.#items.update(items => items.filter(item => item.id !== id));
    }

    updateItems(iteratee: (id: string) => boolean, value: Partial<JournalItem>) {
        this.#items.update(items => items.map<JournalItem>(item => (iteratee(item.id) ? ({ ...item, ...value } as JournalItem) : item)));
    }

    updateBreadcrumbs(iteratee: (id: string) => boolean, value: Partial<DirectoryExtended>) {
        this.breadcrumbs.update(breadcrumbs => breadcrumbs.map(item => (iteratee(item.id) ? { ...item, ...value } : item)));
    }
}
