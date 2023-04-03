import { CommonModule, Location } from '@angular/common';
import {
    Component,
    ChangeDetectionStrategy,
    OnDestroy,
    HostListener,
    ViewChild,
    inject,
    ElementRef,
    ChangeDetectorRef,
    OnInit,
    TemplateRef
} from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import {
    asapScheduler,
    asyncScheduler,
    AsyncSubject,
    filter,
    first,
    firstValueFrom,
    from,
    Observable,
    observeOn,
    shareReplay,
    startWith,
    switchMap
} from 'rxjs';
import { map, pluck, take, takeUntil, tap, withLatestFrom } from 'rxjs/operators';
import { compact, isEmpty, isUndefined, last, omit, trimStart } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { RxState } from '@rx-angular/state';

import { CreateDirectoryDialogComponent } from '@features/file-list/components/create-directory-dialog/create-directory-dialog.component';
import { DirectoryCreate, DirectoryExtended, JournalItem, MenuItemAction } from '@features/file-list/models';

import { ContextMenuService, DirectoryService, JournalService } from '@features/file-list/services';
import { MatDividerModule } from '@angular/material/divider';
import { GridListComponent } from '@features/file-list/components/grid-list/grid-list.component';
import { MatIconModule } from '@angular/material/icon';
import { SnackbarProgressService } from '@features/file-list/services/snackbar-progress.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { addFASvgIcons } from '@core/utils';
import { ActivatedRoute } from '@angular/router';
import { FILE_LIST_RX_STATE } from '@features/file-list/file-list.store';
import { PageHeaderComponent } from '@features/file-list/components/page-header/page-header.component';
import { EmptyComponent } from '@core/components/empty/empty.component';

interface State {
    emptyRef: ElementRef;
}

@Component({
    selector: 'app-file-list',
    templateUrl: './file-list.component.html',
    styleUrls: ['./file-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, MatMenuModule, MatDividerModule, PageHeaderComponent, GridListComponent, EmptyComponent, MatIconModule, MatDialogModule],
    providers: [RxState, SnackbarProgressService, DirectoryService, ContextMenuService, JournalService],
    standalone: true
})
export class FileListComponent implements OnInit, OnDestroy {
    @ViewChild(EmptyComponent, { read: ElementRef }) set emptyRef(value: ElementRef) {
        this.state.set({ emptyRef: value });
    }
    get emptyRef(): ElementRef {
        return this.state.get('emptyRef');
    }

    journalService = inject(JournalService);
    fileListState = inject(FILE_LIST_RX_STATE);
    directoryService = inject(DirectoryService);

    items$: Observable<JournalItem[]> = this.fileListState.select('items').pipe(observeOn(asapScheduler));
    selected$: Observable<JournalItem[]> = this.fileListState.select('selected');
    hasItems$: Observable<boolean> = this.fileListState.select('items').pipe(map(items => items.length > 0));
    dragging$: Observable<boolean> = this.fileListState.select('dragging');
    @ViewChild('itemsTrigger', { read: MatMenuTrigger }) itemsMenuTrigger!: MatMenuTrigger;
    // uploadService = inject(UploadService);
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();
    readonly folderColors: string[] = ['blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'green'];
    folderColor: string = 'blue';
    nextColor!: string;
    route = inject(ActivatedRoute);
    @ViewChild('contextItemsTemplate', { read: TemplateRef, static: true }) set contextItemsTemplate(value: TemplateRef<HTMLElement>) {
        this.fileListState.set({ contextItemsTemplate: value });
    }

    constructor(private dialog: MatDialog, private location: Location, private contextMenuService: ContextMenuService, private state: RxState<State>) {
        addFASvgIcons(['plus'], 'far');
    }

    ngOnInit() {
        // this.openCreateDirectoryDialog(new MouseEvent('click'));
        this.fileListState.connect(this.route.data.pipe(map(({ fileList }) => fileList)));
    }

    ngOnDestroy(): void {
        this.destroyed.next();
        this.destroyed.complete();
    }

    async openCreateDirectoryDialog(event: MouseEvent) {
        const { parentId } = this.fileListState.get();

        const dialogRef = this.dialog.open(CreateDirectoryDialogComponent, {
            width: '400px',
            data: { id: uuidv4(), parentId }
        });

        dialogRef
            .afterClosed()
            .pipe(
                take(1),
                filter(v => v)
            )
            .subscribe(directory => {
                this.journalService.createDirectory(directory);
            });
    }

    // @HostListener('contextmenu', ['$event'])
    handleContextMenu({ event, origin }: { event: MouseEvent; origin?: ElementRef }) {
        this.selected$
            .pipe(
                map(items => ({
                    menuData: { items },
                    trigger: this.itemsMenuTrigger,
                    origin,
                    point: {
                        x: event.clientX,
                        y: event.clientY
                    }
                })),
                take(1)
            )
            .subscribe(state => {
                this.contextMenuService.open(state);
            });
    }

    @HostListener('document:click')
    @HostListener('document:keydown.escape', ['$event'])
    closeContextMenu() {
        this.contextMenuService.close();
    }

    handleItemsAction(action: MenuItemAction, items: JournalItem[]) {
        switch (action) {
            case 'remove': {
                this.journalService.remove(items);
                break;
            }
            default:
                break;
        }
    }

    handleFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        const files: FileList = input.files as FileList;
        // this.uploadService.add(files);
    }

    handleEmptyContextMenu(event: MouseEvent) {
        event.preventDefault();
        this.handleContextMenu({ event, origin: this.emptyRef });
    }
}
