import { Location, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault, NgTemplateOutlet } from '@angular/common';
import { Component, ChangeDetectionStrategy, HostListener, ViewChild, inject, ElementRef, OnInit, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@ngneat/transloco';
import { asapScheduler, filter, Observable, observeOn } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { RxState } from '@rx-angular/state';
import { PushPipe } from '@rx-angular/template/push';
import { RxIf } from '@rx-angular/template/if';
import { LetDirective } from '@rx-angular/template/let';
import { RxFor } from '@rx-angular/template/for';
import { v4 as uuidv4 } from 'uuid';

import { CreateDirectoryDialogComponent } from '@features/file-list/components/create-directory-dialog/create-directory-dialog.component';
import { JournalItem, MenuItemAction } from '@features/file-list/models';
import { ContextMenuService, DirectoryService, JournalService } from '@features/file-list/services';
import { GridListComponent } from '@features/file-list/components/grid-list/grid-list.component';
import { SnackbarProgressService } from '@features/file-list/services/snackbar-progress.service';
import { addFASvgIcons } from '@core/utils';
import { FILE_LIST_RX_STATE } from '@features/file-list/file-list.store';
import { PageHeaderComponent } from '@features/file-list/components/page-header/page-header.component';
import { EmptyComponent } from '@core/components/empty/empty.component';
import { UploadService } from '@features/upload/services';

interface State {
    emptyRef: ElementRef;
    itemsMenuTrigger: MatMenuTrigger;
}

@Component({
    selector: 'app-file-list',
    templateUrl: './file-list.component.html',
    styleUrls: ['./file-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatMenuModule,
        MatDividerModule,
        PageHeaderComponent,
        GridListComponent,
        EmptyComponent,
        MatIconModule,
        MatDialogModule,
        TranslocoModule,
        PushPipe,
        LetDirective,
        NgSwitch,
        NgSwitchCase,
        NgSwitchDefault,
        NgTemplateOutlet,
        RxFor,
        NgIf,
        RxIf
    ],
    providers: [RxState, SnackbarProgressService, DirectoryService, ContextMenuService, JournalService],
    standalone: true
})
export class FileListComponent implements OnInit {
    @ViewChild(EmptyComponent, { read: ElementRef }) set emptyRef(value: ElementRef) {
        this.state.set({ emptyRef: value });
    }
    get emptyRef(): ElementRef {
        return this.state.get('emptyRef');
    }

    journalService = inject(JournalService);
    fileListState = inject(FILE_LIST_RX_STATE);
    directoryService = inject(DirectoryService);
    uploadService = inject(UploadService);

    items$: Observable<JournalItem[]> = this.fileListState.select('items').pipe(observeOn(asapScheduler));
    selected$: Observable<JournalItem[]> = this.fileListState.select('selected');
    contextMenuData$ = this.selected$.pipe(
        map(items => ({
            items,
            someFile: items.some(({ type }) => type === 'file'),
            someFolder: items.some(({ type }) => type === 'folder'),
            everyFile: items.every(({ type }) => type === 'file'),
            everyFolder: items.every(({ type }) => type === 'folder')
        }))
    );
    hasItems$: Observable<boolean> = this.fileListState.select('items').pipe(map(items => items.length > 0));
    dragging$: Observable<boolean> = this.fileListState.select('dragging');
    @ViewChild('itemsTrigger', { read: MatMenuTrigger }) set itemsMenuTrigger(value: MatMenuTrigger) {
        this.state.set({ itemsMenuTrigger: value });
    }
    get itemsMenuTrigger(): MatMenuTrigger {
        return this.state.get('itemsMenuTrigger');
    }
    readonly folderColors: string[] = ['blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'green'];
    folderColor: string = 'blue';
    nextColor!: string;
    route = inject(ActivatedRoute);
    @ViewChild('contextItemsTemplate', { read: TemplateRef }) set contextItemsTemplate(value: TemplateRef<HTMLElement>) {
        this.fileListState.set({ contextItemsTemplate: value });
    }

    constructor(private dialog: MatDialog, private location: Location, private contextMenuService: ContextMenuService, private state: RxState<State>) {
        addFASvgIcons(['plus', 'trash-can', 'download'], 'far');
    }

    ngOnInit() {
        this.fileListState.connect(this.route.data.pipe(map(({ fileList }) => fileList)));
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
        this.contextMenuData$
            .pipe(
                map(menuData => ({
                    menuData,
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
            case 'download': {
                this.journalService.download(items);
                break;
            }
            case 'remove': {
                this.journalService.remove(items);
                break;
            }
            default:
                break;
        }
    }

    handleEmptyContextMenu(event: MouseEvent) {
        event.preventDefault();
        this.handleContextMenu({ event, origin: this.emptyRef });
    }
}
