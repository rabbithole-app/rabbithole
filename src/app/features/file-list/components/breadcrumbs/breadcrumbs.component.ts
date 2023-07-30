import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Input, signal, Signal, ViewChild, WritableSignal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { RxFor } from '@rx-angular/template/for';
import { RxIf } from '@rx-angular/template/if';
import { dropRight, isEmpty, isNull, isString, isUndefined, last } from 'lodash';
import { DndModule } from 'ngx-drag-drop';
import { filter, map, pairwise, withLatestFrom } from 'rxjs/operators';

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
    imports: [NgTemplateOutlet, RxIf, RxFor, RouterModule, MatMenuModule, MatButtonModule, MatIconModule, DndModule, MatProgressSpinnerModule, TranslocoModule],
    standalone: true
})
export class BreadcrumbsComponent {
    #translocoService = inject(TranslocoService);
    @Input() rootLabel = this.#translocoService.translate('navigation.my-files');
    @ViewChild('activeMenu', { read: ElementRef }) activeMenuRef!: ElementRef;
    @ViewChild('currentMenuTrigger', { read: MatMenuTrigger }) contextMenuTrigger!: MatMenuTrigger;
    @ViewChild('backButton', { read: ElementRef }) backButton!: ElementRef;

    items: Signal<DirectoryExtended[]> = computed(() => dropRight(this.fileListService.breadcrumbs()));
    last: Signal<DirectoryExtended | null> = computed(() => {
        const breadcrumbs = this.fileListService.breadcrumbs();
        return breadcrumbs.length ? (last(breadcrumbs) as DirectoryExtended) : null;
    });
    rootUrl: Signal<string> = computed(() => {
        const length = this.fileListService.breadcrumbs().length;
        return Array.from({ length }).fill('..').join('/');
    });
    dragEnterCount: WritableSignal<number> = signal(0);
    entered: WritableSignal<string | null> = signal(null);
    backReceiving: Signal<boolean> = computed(() => {
        const entered = this.entered();
        const last = this.last();
        return entered === last?.parentId || (isUndefined(last?.parentId) && entered === 'root');
    });
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
                pairwise(),
                filter(([a, b]) => (a && b ? a.id === b.id && a.path !== b.path : false)),
                map(v => (v[1] as DirectoryExtended).path),
                withLatestFrom(
                    this.route.url.pipe(
                        map(segments => {
                            const path = segments.map(({ path }) => path).join('/');
                            return isEmpty(path) ? null : path;
                        })
                    )
                ),
                filter(([newPath, currentPath]) => newPath !== currentPath),
                takeUntilDestroyed()
            )
            .subscribe(([path]) => {
                this.router.navigate([this.rootUrl(), path]);
            });
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
        let parentPath: string | undefined;
        if (entered !== 'root' && isString(entered)) {
            const item = this.items().find(({ id }) => id === entered);
            if (item) {
                parentPath = item.path;
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

    handleDragleave() {
        this.dragEnterCount.update(count => count - 1);
        if (this.dragEnterCount() === 0) {
            this.entered.set(null);
        }
    }
}
