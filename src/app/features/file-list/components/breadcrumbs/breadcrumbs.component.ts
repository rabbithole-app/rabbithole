import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, Signal, ViewChild, WritableSignal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DndModule } from 'ngx-drag-drop';
import { RxState } from '@rx-angular/state';
import { switchMap, windowToggle } from 'rxjs';
import { filter, map, withLatestFrom } from 'rxjs/operators';
import { compact, dropRight, isEmpty, isNull, isString, isUndefined, last } from 'lodash';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@ngneat/transloco';

import { addFASvgIcons } from '@core/utils';
import { DirectoryExtended } from '@features/file-list/models';
import { ContextMenuService, JournalService } from '@features/file-list/services';
import { FileListService } from '@features/file-list/services/file-list.service';

@Component({
    selector: 'app-breadcrumbs',
    templateUrl: './breadcrumbs.component.html',
    styleUrls: ['./breadcrumbs.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    // TODO проверить можно ли импортировать не весь DndModule, а только pipe dndDropzone
    imports: [CommonModule, RouterModule, MatMenuModule, MatButtonModule, MatIconModule, DndModule, MatProgressSpinnerModule, TranslocoModule],
    providers: [RxState],
    standalone: true
})
export class BreadcrumbsComponent {
    @ViewChild('activeMenu', { read: ElementRef }) activeMenuRef!: ElementRef;
    @ViewChild('currentMenuTrigger', { read: MatMenuTrigger }) contextMenuTrigger!: MatMenuTrigger;
    @ViewChild('backButton', { read: ElementRef }) backButton!: ElementRef;

    items: Signal<DirectoryExtended[]> = computed(() => dropRight(this.fileListService.breadcrumbs()));
    last: Signal<DirectoryExtended | null> = computed(() => {
        const breadcrumbs = this.fileListService.breadcrumbs();
        return breadcrumbs.length ? (last(breadcrumbs) as DirectoryExtended) : null;
    });
    dragEnterCount: WritableSignal<number> = signal(0);
    entered: WritableSignal<string | null> = signal(null);
    backReceiving: Signal<boolean> = computed(() => {
        const entered = this.entered();
        const last = this.last();
        return entered === last?.parentId || (isUndefined(last?.parentId) && entered === 'root');
    });
    backlink: Signal<string> = computed(() => this.getUrl(this.last()?.path ?? ''));
    contextMenuService = inject(ContextMenuService);
    readonly fileListService = inject(FileListService);
    private journalService = inject(JournalService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    constructor() {
        effect(
            () => {
                this.fileListService.breadcrumbs();
                this.dragEnterCount.set(0);
            },
            { allowSignalWrites: true }
        );
        addFASvgIcons(['angle-left', 'angle-right', 'arrow-left', 'arrow-right', 'ellipsis-vertical'], 'far');

        // когда происходит изменение хлебных крошек (удалили родительскую директорию через контекстное меню),
        // сравниваем текущий путь и путь последней крошки, если не совпадает, то перенаправляем до последней крошки
        toObservable(this.last)
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
                takeUntilDestroyed()
            )
            .subscribe(([path]) => {
                this.router.navigate([this.getUrl(path ?? '')]);
            });
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

        const activeDirectory = this.last();
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
        const entered = this.entered();
        let parentPath: string | null = null;
        if (entered !== 'root' && isString(entered)) {
            let item = this.items().find(({ id }) => id === entered);
            if (item) {
                parentPath = isUndefined(item.path) ? item.name : `${item.path}/${item.name}`;
            }
        }

        const selected = this.fileListService.selected().filter(({ id }) => selectedIds.includes(id));
        this.journalService.move(selected, parentPath);
        this.entered.set(null);
    }

    handleDragenter(event: DragEvent, id: string) {
        event.preventDefault();
        this.entered.set(id);
        this.dragEnterCount.update(count => count + 1);
    }

    handleDragleave(event: DragEvent) {
        this.dragEnterCount.update(count => count - 1);
        if (this.dragEnterCount() === 0) {
            this.entered.set(null);
        }
    }
}
