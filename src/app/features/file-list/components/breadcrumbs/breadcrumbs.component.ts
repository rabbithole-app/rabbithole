import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DndModule } from 'ngx-drag-drop';
import { RxState } from '@rx-angular/state';
import { AsyncSubject, Observable, switchMap, windowToggle } from 'rxjs';
import { filter, map, takeUntil, withLatestFrom } from 'rxjs/operators';
import { compact, dropRight, isEmpty, isNil, isNull, isString, isUndefined, last } from 'lodash';
import { toNullable } from '@dfinity/utils';

import { addFASvgIcons } from '@core/utils';
import { DirectoryExtended } from '@features/file-list/models';
import { ContextMenuService, JournalService } from '@features/file-list/services';
import { FILE_LIST_RX_STATE } from '@features/file-list/file-list.store';

interface State {
    items: DirectoryExtended[];
    last: DirectoryExtended | null;
    dragEnterCount: number;
    entered: string | null;
    parentPath: string | null;
}

@Component({
    selector: 'app-breadcrumbs',
    templateUrl: './breadcrumbs.component.html',
    styleUrls: ['./breadcrumbs.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    // TODO проверить можно ли импортировать не весь DndModule, а только pipe dndDropzone
    imports: [CommonModule, RouterModule, MatMenuModule, MatButtonModule, MatIconModule, DndModule, MatProgressSpinnerModule],
    providers: [RxState],
    standalone: true
})
export class BreadcrumbsComponent extends RxState<State> implements OnDestroy {
    @ViewChild('activeMenu', { read: ElementRef }) activeMenuRef!: ElementRef;
    @ViewChild('currentMenuTrigger', { read: MatMenuTrigger }) contextMenuTrigger!: MatMenuTrigger;
    @ViewChild('backButton', { read: ElementRef }) backButton!: ElementRef;
    items$: Observable<DirectoryExtended[]> = this.select('items');
    last$: Observable<DirectoryExtended | null> = this.select('last');
    contextMenuService = inject(ContextMenuService);
    private fileListState = inject(FILE_LIST_RX_STATE);
    private journalService = inject(JournalService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();

    get contextTemplate(): TemplateRef<HTMLElement> {
        return this.fileListState.get('contextItemsTemplate');
    }

    constructor() {
        super();
        addFASvgIcons(['angle-left', 'angle-right', 'arrow-left', 'arrow-right', 'ellipsis-vertical'], 'far');
        this.set({ entered: null });
        this.connect(
            this.fileListState.select('breadcrumbs').pipe(
                map(value => {
                    const lastItem = value.length ? (last(value) as DirectoryExtended) : null;
                    return { last: lastItem, items: dropRight(value), dragEnterCount: 0, parentPath: lastItem?.path ?? null };
                })
            )
        );

        // когда происходит изменение хлебных крошек (удалили родительскую директорию через контекстное меню),
        // сравниваем текущий путь и путь последней крошки, если не совпадает, то перенаправляем до последней крошки
        this.select('last')
            .pipe(
                windowToggle(this.router.events.pipe(map(event => event instanceof NavigationStart)), () =>
                    this.router.events.pipe(map(event => event instanceof NavigationEnd))
                ),
                switchMap(x => x),
                map(item => (item ? compact([item.path ?? '', item.name]).join('/') : null)),
                withLatestFrom(
                    this.route.url.pipe(
                        map(segments => {
                            const path = segments.map(({ path }) => path).join('/');
                            return isEmpty(path) ? null : path;
                        })
                    )
                ),
                filter(([lastPath, currentPath]) => lastPath !== currentPath),
                takeUntil(this.destroyed)
            )
            .subscribe(([path]) => {
                this.router.navigate([this.getUrl(path ?? '')]);
            });
    }

    get backReceiving(): boolean {
        const { entered, last } = this.get();

        return entered === last?.parentId || (isUndefined(last?.parentId) && entered === 'root');
    }

    getUrl(path: string): string {
        return compact(['/drive'].concat(path.split('/'))).join('/');
    }

    itemTrackBy(index: number, item: DirectoryExtended) {
        return item.id;
    }

    handleActiveClick(event: MouseEvent) {
        event.stopPropagation();

        if (ContextMenuService.openedMenu?.menuOpen && ContextMenuService.openedMenu?.menu?.panelId === this.contextMenuTrigger.menu?.panelId) {
            this.contextMenuService.close();
            return;
        }

        const activeDirectory = this.get('last');
        if (!isNull(activeDirectory)) {
            this.contextMenuService.open({
                origin: this.activeMenuRef,
                trigger: this.contextMenuTrigger,
                menuData: {
                    items: [activeDirectory],
                    someFile: false,
                    someFolder: true,
                    everyFile: false,
                    everyFolder: true
                }
            });
        }
    }

    handleDrop(event: DragEvent) {
        const selectedIds = JSON.parse(event.dataTransfer?.getData('text/plain') || '[]');
        const { items, entered } = this.get();
        let parentPath = null;
        if (entered !== 'root' && isString(entered)) {
            let item = items.find(({ id }) => id === entered);
            if (item) {
                parentPath = isUndefined(item.path) ? item.name : `${item.path}/${item.name}`;
            }
        }

        const selected = this.fileListState.get('selected').filter(({ id }) => selectedIds.includes(id));
        this.journalService.move(selected, parentPath);
        this.set({ entered: null });
    }

    handleDragenter(event: DragEvent, id: string) {
        event.preventDefault();
        this.set(state => ({ dragEnterCount: state.dragEnterCount + 1, entered: id }));
    }

    handleDragleave(event: DragEvent) {
        this.set('dragEnterCount', state => state.dragEnterCount - 1);
        if (this.get('dragEnterCount') === 0) {
            this.set({ entered: null });
        }
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy();
        this.destroyed.next();
        this.destroyed.complete();
    }
}
