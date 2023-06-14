import { Location, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault, NgTemplateOutlet } from '@angular/common';
import { Component, ChangeDetectionStrategy, HostListener, ViewChild, inject, ElementRef, TemplateRef, Signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@ngneat/transloco';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { RxState } from '@rx-angular/state';
import { PushPipe } from '@rx-angular/template/push';
import { RxIf } from '@rx-angular/template/if';
import { LetDirective } from '@rx-angular/template/let';
import { RxFor } from '@rx-angular/template/for';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CreateDirectoryDialogComponent } from '@features/file-list/components/create-directory-dialog/create-directory-dialog.component';
import { JournalItem, MenuItemAction } from '@features/file-list/models';
import { ContextMenuService, JournalService } from '@features/file-list/services';
import { GridListComponent } from '@features/file-list/components/grid-list/grid-list.component';
import { SnackbarProgressService } from '@features/file-list/services/snackbar-progress.service';
import { addFASvgIcons } from '@core/utils';
import { PageHeaderComponent } from '@features/file-list/components/page-header/page-header.component';
import { EmptyComponent } from '@core/components/empty/empty.component';
import { UploadService } from '@features/upload/services';
import { FileListService } from './services/file-list.service';

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
    providers: [RxState, SnackbarProgressService, ContextMenuService, JournalService],
    standalone: true
})
export class FileListComponent {
    @ViewChild(EmptyComponent, { read: ElementRef }) set emptyRef(value: ElementRef) {
        this.state.set({ emptyRef: value });
    }
    get emptyRef(): ElementRef {
        return this.state.get('emptyRef');
    }

    journalService = inject(JournalService);
    readonly fileListService = inject(FileListService);
    uploadService = inject(UploadService);
    contextMenuData = computed(() => {
        const items = this.fileListService.selected();
        return {
            items,
            someFile: items.some(({ type }) => type === 'file'),
            someFolder: items.some(({ type }) => type === 'folder'),
            everyFile: items.every(({ type }) => type === 'file'),
            everyFolder: items.every(({ type }) => type === 'folder')
        };
    });
    hasItems: Signal<boolean> = computed(() => this.fileListService.items().length > 0);
    @ViewChild('itemsTrigger', { read: MatMenuTrigger }) set itemsMenuTrigger(value: MatMenuTrigger) {
        this.state.set({ itemsMenuTrigger: value });
    }
    get itemsMenuTrigger(): MatMenuTrigger {
        return this.state.get('itemsMenuTrigger');
    }
    readonly folderColors: string[] = ['blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'green'];
    folderColor = 'blue';
    nextColor!: string;
    route = inject(ActivatedRoute);
    @ViewChild('contextItemsTemplate', { read: TemplateRef }) set contextItemsTemplate(value: TemplateRef<HTMLElement>) {
        this.fileListService.contextMenuTemplate.set(value);
    }

    constructor(private dialog: MatDialog, private location: Location, private contextMenuService: ContextMenuService, private state: RxState<State>) {
        addFASvgIcons(['plus', 'trash-can', 'download'], 'far');
        this.route.data
            .pipe(
                map(({ fileList }) => fileList),
                takeUntilDestroyed()
            )
            .subscribe(data => this.fileListService.setData(data));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async openCreateDirectoryDialog(event: MouseEvent) {
        const parent = this.fileListService.parent();

        const dialogRef = this.dialog.open(CreateDirectoryDialogComponent, {
            width: '450px',
            data: { parent }
        });

        const directory: { name: string; parent: typeof parent } = await firstValueFrom(dialogRef.afterClosed());
        if (directory) {
            this.journalService.createDirectory(directory);
        }
    }

    // @HostListener('contextmenu', ['$event'])
    handleContextMenu({ event, origin }: { event: MouseEvent; origin?: ElementRef }) {
        const menuData = this.contextMenuData();
        this.contextMenuService.open({
            menuData,
            trigger: this.itemsMenuTrigger,
            origin,
            point: {
                x: event.clientX,
                y: event.clientY
            }
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
