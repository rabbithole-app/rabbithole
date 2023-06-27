import {
    Component,
    ChangeDetectionStrategy,
    QueryList,
    HostListener,
    AfterViewInit,
    ViewChildren,
    ElementRef,
    OnDestroy,
    Input,
    HostBinding,
    ViewChild,
    Output,
    EventEmitter,
    Inject,
    ChangeDetectorRef,
    inject,
    signal,
    WritableSignal,
    computed,
    Signal
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { ActiveDescendantKeyManager } from '@angular/cdk/a11y';
import { Point } from '@angular/cdk/drag-drop';
import { SelectionModel } from '@angular/cdk/collections';
import { DndDropEvent, DndModule } from 'ngx-drag-drop';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { RxEffects } from '@rx-angular/state/effects';
import {
    animationFrameScheduler,
    BehaviorSubject,
    EMPTY,
    fromEvent,
    iif,
    merge,
    Observable,
    observeOn,
    of,
    shareReplay,
    Subject,
    switchMap,
    timer
} from 'rxjs';
import { filter, map, pluck, takeUntil, tap, withLatestFrom } from 'rxjs/operators';
import { chunk, compact, drop, dropRight, find, findIndex, findLastIndex, head, isEqual, isNil, isNumber, isUndefined, last, nth, pick } from 'lodash';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PushPipe } from '@rx-angular/template/push';
import { RxFor } from '@rx-angular/template/for';
import { RxIf } from '@rx-angular/template/if';

import { GridListItemComponent } from '@features/file-list/components/grid-list-item/grid-list-item.component';
import { DirectoryExtended, JournalItem } from '@features/file-list/models';
import { DragPreviewComponent } from '@features/file-list/components/drag-preview/drag-preview.component';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { AnimateCssGridDirective } from '@core/directives';
import { addSvgIcons } from '@features/file-list/utils';
import { OverlayService } from '@core/services';
import { JournalService } from '@features/file-list/services';
import { FileListService } from '@features/file-list/services/file-list.service';

const GRID_CELL_WIDTH = 102;
const GRID_CELL_COLUMN_GAP = 16;

interface State {
    items: JournalItem[];
    animationDisabled: boolean;
    columns: number;
    chunkedGridItems: Array<JournalItem['id'] | null>[];
    activeDirectory: JournalItem['id'] | null;
    drag: {
        dragging: boolean;
        startPosition: Point;
        movePosition: Point;
    };
}

@Component({
    selector: 'app-grid-list',
    templateUrl: './grid-list.component.html',
    styleUrls: ['./grid-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [RxState, RxEffects, OverlayService],
    imports: [PushPipe, RxFor, RxIf, GridListItemComponent, DragPreviewComponent, AnimateCssGridDirective, DndModule],
    standalone: true
})
export class GridListComponent implements OnDestroy, AfterViewInit {
    @Input() set items(items: JournalItem[] | null) {
        this.state.set({ items: items ?? [] });
    }
    get items(): JournalItem[] {
        return this.state.get('items');
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
    private dropEntered: Subject<JournalItem['id']> = new Subject<JournalItem['id']>();
    private dropExited: Subject<void> = new Subject<void>();
    #fileListService = inject(FileListService);
    private route = inject(ActivatedRoute);
    private journalService = inject(JournalService);

    get activeDirectory(): JournalItem['id'] | null {
        return this.state.get().activeDirectory;
    }

    #selectingPause: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    animationDisabled$: Observable<boolean> = this.state.select('animationDisabled');
    items$: Observable<JournalItem[]> = this.state.select('items');
    private rxEffects = inject(RxEffects);
    private rxEffectsIds: number[] = [];

    constructor(
        @Inject(DOCUMENT) public document: Document,
        private element: ElementRef,
        private router: Router,
        // private renderer: Renderer2,
        // private dragDropService: DragDrop,
        private cdr: ChangeDetectorRef,
        // инъекция через конструктор позволяет передать тип состояния
        private state: RxState<State>
    ) {
        addSvgIcons(this.iconsConfig);
        this.state.set({
            items: [],
            animationDisabled: false,
            chunkedGridItems: [],
            drag: {
                movePosition: { x: 0, y: 0 },
                startPosition: { x: 0, y: 0 },
                dragging: false
            }
        });
        this.state.connect(
            'animationDisabled',
            merge(
                this.router.events.pipe(
                    filter(event => event instanceof NavigationStart),
                    map(() => true)
                ),
                this.router.events.pipe(
                    filter(event => event instanceof NavigationEnd),
                    map(() => false)
                )
            )
        );
        this.init();
    }

    static isContextDisabled(event: MouseEvent): boolean {
        return event.metaKey;
    }

    @HostBinding('@.disabled') get animationDisabled() {
        return this.state.get().animationDisabled;
    }

    get dragging(): boolean {
        return this.state.get().drag.dragging;
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
        const chunkedGridItems = this.state.get().chunkedGridItems;

        if (isNumber(activeItemIndex) && activeItemIndex > -1) {
            const id = this.items[activeItemIndex].id;
            row = findIndex(chunkedGridItems, indexes => indexes.includes(id));
            column = chunkedGridItems[row].indexOf(id);
        }

        switch (event.code) {
            case 'ArrowUp': {
                const index = findIndex(this.items, [
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
                const index = findIndex(this.items, [
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
            this.state.set({ columns });
        });
        this.hostResizeObserver.observe(this.element.nativeElement);

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
                this.cdr.markForCheck();
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
            withLatestFrom(this.state.select('items')),
            map(([selectedItems, items]) => items.filter(({ id }) => selectedItems.includes(id))),
            shareReplay(1)
        );
        this.dragSelected$ = selected$.pipe(map(items => items.map(item => pick(item, ['id', 'type', 'extension']))));

        selected$.pipe(takeUntilDestroyed()).subscribe(selected => {
            this.#fileListService.selected.set(selected);
        });

        const dragMove$: Observable<Point> = this.state
            .select(
                map(({ drag }) => drag),
                filter(({ dragging }) => dragging),
                map(({ movePosition }) => movePosition)
            )
            .pipe(
                switchMap(point =>
                    iif(
                        () => isEqual(point, { x: 0, y: 0 }),
                        this.state.select(pluck('drag', 'startPosition')).pipe(
                            tap(value => {
                                this.dragPreview?.animateToPoint(value);
                            }),
                            switchMap(() => EMPTY)
                        ),
                        of(point).pipe(
                            observeOn(animationFrameScheduler),
                            tap(point => this.dragPreview?.position(point))
                        )
                    )
                )
            );
        this.rxEffectsIds.push(this.rxEffects.register(dragMove$));
    }

    ngAfterViewInit() {
        // учитывается не только изменение кол-ва элементов, но и изменение свойств любого элемента сетки
        // (причина, по которой не используется QueryList и его observable-свойство changes)
        this.state.connect(
            'chunkedGridItems',
            this.state.select(
                selectSlice(['items', 'columns']),
                map(({ items, columns }) =>
                    chunk(
                        items.map(({ id, disabled }) => (disabled ? null : id)),
                        columns
                    )
                )
            )
        );
        this.rxEffectsIds.push(this.rxEffects.register(this.state.select('columns'), () => this.animatedGrid?.forceGridAnimation()));

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
        this.hostResizeObserver.unobserve(this.element.nativeElement);
        this.rxEffectsIds.forEach(effectId => this.rxEffects.unregister(effectId));
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
                const index = this.state.get().items.findIndex(({ id }) => id === _id);
                let start = 0;
                let end = index + 1;

                if (this.selected.hasValue()) {
                    const firstIndex = this.items.findIndex(({ id }) => this.selected.isSelected(id));
                    const lastIndex = findLastIndex(this.items, ({ id }) => this.selected.isSelected(id));

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

                const selected = this.items
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
            this.router.navigate([item.name], { relativeTo: this.route });
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
            this.openContext.emit({ event, origin: this.element });
        }
    }

    handleDrop(event: DndDropEvent, item: DirectoryExtended) {
        this.state.set({ activeDirectory: null });
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
        this.state.set('drag', state => ({ ...state.drag, dragging: true, startPosition: { x: event.clientX, y: event.clientY } }));
        event.dataTransfer?.setDragImage(this.dragPreviewGhost.nativeElement, 60, 60);
        this.#fileListService.dragging.set(true);
    }

    handleEnd(event: DragEvent) {
        event.preventDefault();
        this.state.set('drag', state => ({ ...state.drag, dragging: false }));
        this.#fileListService.dragging.set(false);
    }

    handleDrag(event: DragEvent) {
        this.state.set('drag', state => ({ ...state.drag, movePosition: { x: event.clientX, y: event.clientY } }));
    }

    handleDragleave(event: DragEvent) {
        event.preventDefault();
        const component = this.#gridListItems().find(value => value.element.nativeElement === event.target);

        if (component) {
            if (this.checkDropList(component.data.id)) {
                this.dropExited.next();
                this.state.set({ activeDirectory: null });
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
                this.state.set({ activeDirectory: this.selected.isSelected(id) ? null : id });
            }
        }
    }

    /**
     * Функция для проверки элемента на drop-list по id
     *
     * @param id
     */
    private checkDropList(id: string): boolean {
        const item = find(this.items, ['id', id]);

        return item ? item.type === 'folder' : false;
    }
}
