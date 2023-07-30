import { ActiveDescendantKeyManager } from '@angular/cdk/a11y';
import { SelectionModel } from '@angular/cdk/collections';
import { Point } from '@angular/cdk/drag-drop';
import { DOCUMENT } from '@angular/common';
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    HostBinding,
    HostListener,
    Input,
    OnDestroy,
    Output,
    QueryList,
    Signal,
    ViewChild,
    ViewChildren,
    WritableSignal,
    computed,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { RxState } from '@rx-angular/state';
import { RxEffects } from '@rx-angular/state/effects';
import { RxFor } from '@rx-angular/template/for';
import { RxIf } from '@rx-angular/template/if';
import { RxPush } from '@rx-angular/template/push';
import { chunk, compact, drop, dropRight, find, findIndex, findLastIndex, head, isEqual, isNumber, isUndefined, last, nth, pick } from 'lodash';
import { DndDropEvent, DndModule } from 'ngx-drag-drop';
import {
    BehaviorSubject,
    EMPTY,
    Observable,
    Subject,
    animationFrameScheduler,
    defer,
    fromEvent,
    iif,
    merge,
    observeOn,
    of,
    shareReplay,
    switchMap,
    timer
} from 'rxjs';
import { filter, map, pluck, repeat, takeUntil, tap } from 'rxjs/operators';

import { AnimateCssGridDirective } from '@core/directives';
import { OverlayService } from '@core/services';
import { DragPreviewComponent } from '@features/file-list/components/drag-preview/drag-preview.component';
import { GridListItemComponent } from '@features/file-list/components/grid-list-item/grid-list-item.component';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { DirectoryExtended, JournalItem } from '@features/file-list/models';
import { JournalService } from '@features/file-list/services';
import { FileListService } from '@features/file-list/services/file-list.service';
import { addSvgIcons } from '@features/file-list/utils';

const GRID_CELL_WIDTH = 102;
const GRID_CELL_COLUMN_GAP = 16;

@Component({
    selector: 'app-grid-list',
    templateUrl: './grid-list.component.html',
    styleUrls: ['./grid-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [RxState, RxEffects, OverlayService],
    imports: [RxPush, RxFor, RxIf, GridListItemComponent, DragPreviewComponent, AnimateCssGridDirective, DndModule],
    standalone: true
})
export class GridListComponent<T extends { id: string }> implements OnDestroy, AfterViewInit {
    items: WritableSignal<JournalItem[]> = signal([]);
    @Input('items') set itemsFn(items: JournalItem[] | null) {
        this.items.set(items ?? []);
    }
    @Output() openContext: EventEmitter<{ event: MouseEvent; origin?: ElementRef }> = new EventEmitter<{ event: MouseEvent; origin?: ElementRef }>();
    @ViewChild(AnimateCssGridDirective) animatedGrid!: AnimateCssGridDirective;
    @ViewChild('dragPreview', { read: DragPreviewComponent }) dragPreview!: DragPreviewComponent;
    @ViewChild('dragPreviewGhost', { read: ElementRef, static: true }) private dragPreviewGhost!: ElementRef;
    @ViewChildren(GridListItemComponent) private set gridListItems(value: QueryList<GridListItemComponent>) {
        this.#gridListItems.set(value);
    }
    #gridListItems: WritableSignal<QueryList<GridListItemComponent>> = signal(new QueryList());
    @HostBinding('attr.role') role = 'list';

    dragSelected$: Observable<Partial<JournalItem>[]> = of([]);
    selected: SelectionModel<string> = new SelectionModel<string>(true, []);
    private hostResizeObserver!: ResizeObserver;
    #keyManager: Signal<ActiveDescendantKeyManager<GridListItemComponent>> = computed(() =>
        new ActiveDescendantKeyManager<GridListItemComponent>(this.#gridListItems()).withWrap().skipPredicate(item => item.disabled)
    );
    private dropEntered: Subject<string> = new Subject<string>();
    private dropExited: Subject<void> = new Subject<void>();
    #fileListService = inject(FileListService);
    private route = inject(ActivatedRoute);
    private journalService = inject(JournalService);
    animationDisabled: WritableSignal<boolean> = signal(false);
    activeDirectory: WritableSignal<string | null> = signal(null);
    columns: WritableSignal<number> = signal(0);
    drag: WritableSignal<{
        dragging: boolean;
        startPosition: Point;
        movePosition: Point;
    }> = signal({
        movePosition: { x: 0, y: 0 },
        startPosition: { x: 0, y: 0 },
        dragging: false
    });
    dragging: Signal<boolean> = computed(() => this.drag().dragging);

    // учитывается не только изменение кол-ва элементов, но и изменение свойств любого элемента сетки
    // (причина, по которой не используется QueryList и его observable-свойство changes)
    chunkedGridItems: Signal<Array<string | null>[]> = computed(() =>
        chunk(
            this.items().map(item => (this.journalService.isFile(item) && item.disabled ? null : item.id)),
            this.columns()
        )
    );

    isDisabled(item: JournalItem): boolean {
        return item.disabled ?? false;
    }

    #selectingPause: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    readonly #router = inject(Router);
    #element = inject(ElementRef);
    document: Document = inject(DOCUMENT);
    readonly #cdr = inject(ChangeDetectorRef);

    constructor() {
        addSvgIcons(this.iconsConfig);
        merge(
            this.#router.events.pipe(
                filter(event => event instanceof NavigationStart),
                map(() => true)
            ),
            this.#router.events.pipe(
                filter(event => event instanceof NavigationEnd),
                map(() => false)
            )
        )
            .pipe(takeUntilDestroyed())
            .subscribe(v => this.animationDisabled.set(v));

        this.init();
    }

    static isContextDisabled(event: MouseEvent): boolean {
        return event.metaKey;
    }

    @HostBinding('@.disabled') get animationDisabledFn() {
        return this.animationDisabled();
    }

    /**
     * Навигация с клавиатуры по сетке с пропуском disabled элементов
     * поддерживаются только стрелки
     * TODO: enter, esc, space
     *
     * @param event
     */
    @HostListener('keydown', ['$event'])
    onKeydown(event: KeyboardEvent) {
        const activeItemIndex = this.#keyManager().activeItemIndex as number | null;
        let column = 0;
        let row = 0;
        const chunkedGridItems = this.chunkedGridItems();

        if (isNumber(activeItemIndex) && activeItemIndex > -1) {
            const id = this.items()[activeItemIndex].id;
            row = findIndex(chunkedGridItems, indexes => indexes.includes(id));
            column = chunkedGridItems[row].indexOf(id);
        }

        switch (event.code) {
            case 'ArrowUp': {
                const index = findIndex(this.items(), [
                    'id',
                    last(compact(dropRight(chunkedGridItems, chunkedGridItems.length - row).map(arr => nth(arr, column))))
                ]);

                if (index > -1) {
                    this.#keyManager().setActiveItem(index);
                }

                break;
            }
            case 'ArrowRight': {
                this.#keyManager().setNextItemActive();
                break;
            }
            case 'ArrowDown': {
                const index = findIndex(this.items(), [
                    'id',
                    head(
                        compact(
                            drop(chunkedGridItems, row + 1).map(arr => {
                                const value = nth(arr, column);
                                return isUndefined(value) ? last(arr) : value;
                            })
                        )
                    )
                ]);

                if (index > -1) {
                    this.#keyManager().setActiveItem(index);
                }

                break;
            }
            case 'ArrowLeft': {
                this.#keyManager().setPreviousItemActive();
                break;
            }
            case 'Enter': {
                // TODO: переход в папку или открытие файла
                break;
            }
            case 'Escape': {
                // TODO: переход на уровень вверх из папки
                break;
            }
            default:
            // this.keyManager.onKeydown(event);
        }
    }

    init(): void {
        this.hostResizeObserver = new ResizeObserver(entries => {
            const width = entries[0].contentRect.width;
            const columns = Math.floor((width + GRID_CELL_COLUMN_GAP) / (GRID_CELL_WIDTH + GRID_CELL_COLUMN_GAP));
            this.columns.set(columns);
        });
        this.hostResizeObserver.observe(this.#element.nativeElement);
        // effect(() => {
        //     this.columns();
        //     this.animatedGrid?.forceGridAnimation();
        // });

        // очистка выделения при клике вне рабочей области
        this.#selectingPause
            .asObservable()
            .pipe(
                switchMap(value =>
                    value
                        ? EMPTY
                        : fromEvent(this.document, 'click', { passive: true }).pipe(
                              map(e => e.target),
                              map(target =>
                                  this.#gridListItems().some(item => item.element.nativeElement === target || item.element.nativeElement.contains(target))
                              ),
                              filter(clickInside => !clickInside)
                          )
                ),
                takeUntilDestroyed()
            )
            .subscribe(() => {
                this.selected.clear();
                this.#cdr.markForCheck();
            });

        // TODO: при наведении и задержке на drop-элементе на 1 секунду перейти в папку
        this.dropEntered
            .asObservable()
            .pipe(
                switchMap(id =>
                    timer(1000).pipe(
                        map(() => id),
                        takeUntil(this.dropExited)
                    )
                ),
                takeUntilDestroyed()
            )
            .subscribe(id => {
                console.log('navigate', id);
                // this.router.navigate([id]);
            });

        const selected$ = this.selected.changed.pipe(
            // debounceTime(100),
            pluck('source', 'selected'),
            map(selectedItems => this.items().filter(({ id }) => selectedItems.includes(id))),
            shareReplay(1)
        );
        this.dragSelected$ = selected$.pipe(map(items => items.map(item => pick(item, ['id', 'type', 'extension']))));

        selected$.pipe(takeUntilDestroyed()).subscribe(selected => {
            this.#fileListService.selected.set(selected);
        });

        const dragging$ = toObservable(this.dragging);
        const dragStart$ = dragging$.pipe(filter(v => v));
        const dragEnd$ = dragging$.pipe(filter(v => !v));
        fromEvent<MouseEvent>(this.#element.nativeElement, 'drag', { passive: true })
            .pipe(
                map(e => ({ x: e.clientX, y: e.clientY })),
                switchMap(point =>
                    iif(
                        () => isEqual(point, { x: 0, y: 0 }),
                        defer(() => {
                            this.dragPreview?.animateToPoint(this.drag().startPosition);
                            return EMPTY;
                        }),
                        of(point).pipe(
                            observeOn(animationFrameScheduler),
                            tap(point => this.dragPreview?.position(point))
                        )
                    )
                ),
                takeUntil(dragEnd$),
                repeat({ delay: () => dragStart$ }),
                takeUntilDestroyed()
            )
            .subscribe();
    }

    ngAfterViewInit() {
        // при начале выделения в случае если открыто контекстное меню, закрываем его
        /*this.selecting
            .asObservable()
            .pipe(
                distinctUntilChanged(),
                filter((selecting) => selecting && !isUndefined(ContextMenuService.openedMenu) && ContextMenuService.openedMenu.menuOpen),
                // withLatestFrom(this.lastContextClick.asObservable().pipe(pluck('id'))),
                // filter(([selected, active]) => !selected.includes(active)),
                takeUntil(this.destroyed)
            )
            .subscribe(() => {
                ContextMenuService.openedMenu.closeMenu();
            });*/
    }

    ngOnDestroy(): void {
        this.hostResizeObserver.unobserve(this.#element.nativeElement);
    }

    itemTrackBy(index: number, item: JournalItem) {
        return item.id;
    }

    handleItemClick(event: MouseEvent, _id: string) {
        const { button, shiftKey, ctrlKey, metaKey, which } = event;

        switch (true) {
            case which === 3 || button === 2: {
                if (!this.selected.isSelected(_id)) {
                    this.selected.clear();
                    this.selected.select(_id);
                }

                break;
            }
            case shiftKey: {
                const index = this.items().findIndex(({ id }) => id === _id);
                let start = 0;
                let end = index + 1;

                if (this.selected.hasValue()) {
                    const firstIndex = this.items().findIndex(({ id }) => this.selected.isSelected(id));
                    const lastIndex = findLastIndex(this.items(), ({ id }) => this.selected.isSelected(id));

                    if (index > lastIndex) {
                        [start, end] = [lastIndex, index + 1];
                    } else if (index < firstIndex) {
                        [start, end] = [index, firstIndex + 1];
                    } /*else if (index > firstIndex && index < lastIndex) {
                        [start, end] = [firstIndex, index + 1];
                    } else if (index === firstIndex || index === lastIndex) {
                        [start, end] = [firstIndex, lastIndex + 1];
                    }*/
                }

                const selected = this.items()
                    .slice(start, end) /*.filter(({ disabled }) => !disabled)*/
                    .map(({ id }) => id);
                this.selected.clear();
                this.selected.select(...selected);
                break;
            }
            case ctrlKey || metaKey: {
                this.selected.isSelected(_id) ? this.selected.deselect(_id) : this.selected.select(_id);
                break;
            }
            default: {
                this.selected.clear();
                this.selected.select(_id);
            }
        }
    }

    handleItemDblClick(event: MouseEvent, item: JournalItem) {
        if (this.journalService.isDirectory(item)) {
            this.#router.navigate([item.name], { relativeTo: this.route });
        }
    }

    handleContext(event: MouseEvent, item: JournalItem) {
        event.preventDefault();
        event.stopPropagation();

        const found = this.selected.isSelected(item.id);
        if (!found) {
            this.selected.clear();
            this.selected.select(item.id);
        }

        const component = this.#gridListItems().find(item => item.element.nativeElement === event.target || item.element.nativeElement.contains(event.target));

        this.openContext.emit({
            event,
            origin: component?.element
        });
        // this.lastContextClick.next(item);
    }

    @HostListener('contextmenu', ['$event'])
    handleMainContext(event: MouseEvent) {
        if (!GridListComponent.isContextDisabled(event)) {
            event.preventDefault();
            event.stopPropagation();
            this.selected.clear();
            this.openContext.emit({ event, origin: this.#element });
        }
    }

    handleDrop(event: DndDropEvent, item: DirectoryExtended) {
        this.activeDirectory.set(null);
        this.dropExited.next();
        // JSON.parse(event.event.dataTransfer?.getData('text/plain') ?? '[]');
        const selected = this.#fileListService.selected();
        this.journalService.move(selected, item.path);
    }

    handleStart(event: DragEvent, id: string) {
        if (!this.selected.isSelected(id)) {
            this.selected.clear();
            this.selected.select(id);
        }

        event.dataTransfer?.setData('text/plain', JSON.stringify(this.selected.selected));
        this.drag.update(drag => ({ ...drag, dragging: true, startPosition: { x: event.clientX, y: event.clientY } }));
        event.dataTransfer?.setDragImage(this.dragPreviewGhost.nativeElement, 60, 60);
        this.#fileListService.dragging.set(true);
    }

    handleEnd(event: DragEvent) {
        event.preventDefault();
        this.drag.update(drag => ({ ...drag, dragging: false }));
        this.#fileListService.dragging.set(false);
    }

    handleDrag(event: DragEvent) {
        this.drag.update(drag => ({ ...drag, movePosition: { x: event.clientX, y: event.clientY } }));
    }

    handleDragleave(event: DragEvent) {
        event.preventDefault();
        const component = this.#gridListItems().find(value => value.element.nativeElement === event.target);

        if (component) {
            if (this.checkDropList(component.data.id)) {
                this.dropExited.next();
                this.activeDirectory.set(null);
            }
        }
    }

    handleDragenter(event: DragEvent) {
        event.preventDefault();
        const component = this.#gridListItems().find(value => value.element.nativeElement === event.target);

        if (component) {
            const id = component.data.id;
            if (this.checkDropList(id)) {
                !this.selected.isSelected(id) && this.dropEntered.next(id);
                this.activeDirectory.set(this.selected.isSelected(id) ? null : id);
            }
        }
    }

    /**
     * Функция для проверки элемента на drop-list по id
     *
     * @param id
     */
    private checkDropList(id: string): boolean {
        const item = find(this.items(), ['id', id]);

        return item ? item.type === 'folder' : false;
    }
}
