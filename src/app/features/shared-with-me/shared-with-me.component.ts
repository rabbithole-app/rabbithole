import { ChangeDetectionStrategy, Component, OnInit, Signal, ViewChild, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { TranslocoModule } from '@ngneat/transloco';
import { RxFor } from '@rx-angular/template/for';
import { RxIf } from '@rx-angular/template/if';
import { RxLet } from '@rx-angular/template/let';
import { filter, map } from 'rxjs/operators';

import { ProfileItem } from '@core/models/profile';
import { CoreService } from '@core/services';
import { addFASvgIcons } from '@core/utils';
import { FileListService } from '@features/file-list/services/file-list.service';
import { AvatarComponent } from 'app/layout/dashboard/components/avatar/avatar.component';
import { CopyIDComponent } from '../../core/components/copy-id/copy-id.component';
import { SharedGridListComponent } from './components/shared-grid-list/shared-grid-list.component';
import { SharedFileExtended } from './models';

@Component({
    selector: 'app-shared-with-me',
    standalone: true,
    templateUrl: './shared-with-me.component.html',
    styleUrls: ['./shared-with-me.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatIconModule,
        RxFor,
        MatMenuModule,
        SharedGridListComponent,
        TranslocoModule,
        RxLet,
        RxIf,
        MatCardModule,
        AvatarComponent,
        CopyIDComponent
    ]
})
export class SharedWithMeComponent implements OnInit {
    readonly #coreService = inject(CoreService);
    readonly #fileListService = inject(FileListService);
    items: Signal<{ user: ProfileItem; items: SharedFileExtended[] }[]> = toSignal(
        this.#coreService.workerMessage$.pipe(
            filter(({ data }) => data.action === 'sharedWithMeDone'),
            map(({ data }) => data.payload)
        ),
        { initialValue: [] }
    );
    // contextMenuData = computed(() => {
    //     const items = this.#fileListService.selected();
    //     return {
    //         items,
    //         someFile: items.some(({ type }) => type === 'file'),
    //         someFolder: items.some(({ type }) => type === 'folder'),
    //         everyFile: items.every(({ type }) => type === 'file'),
    //         everyFolder: items.every(({ type }) => type === 'folder')
    //     };
    // });
    hasItems: Signal<boolean> = computed(() => this.#fileListService.items().length > 0);
    #itemsMenuTrigger: WritableSignal<MatMenuTrigger | null> = signal(null);
    @ViewChild('itemsTrigger', { read: MatMenuTrigger }) set itemsMenuTrigger(value: MatMenuTrigger) {
        this.#itemsMenuTrigger.set(value);
    }
    // #contextMenuService = inject(ContextMenuService);

    constructor() {
        addFASvgIcons(['download'], 'far');
        effect(() => console.log({ sharedWithMe: this.items() }));
    }

    ngOnInit(): void {
        const worker = this.#coreService.worker();
        if (worker) {
            worker.postMessage({ action: 'sharedWithMe' });
        }
    }

    itemTrackBy(index: number, item: { user: ProfileItem; items: SharedFileExtended[] }) {
        return item.user.principal;
    }

    // handleContextMenu({ event, origin }: { event: MouseEvent; origin?: ElementRef }) {
    //     const menuData = this.contextMenuData();
    //     if (menuData.items.length) {
    //         this.#contextMenuService.open({
    //             menuData,
    //             trigger: this.#itemsMenuTrigger(),
    //             origin,
    //             point: {
    //                 x: event.clientX,
    //                 y: event.clientY
    //             }
    //         });
    //     } else {
    //         this.#contextMenuService.close();
    //     }
    // }

    // @HostListener('document:click')
    // @HostListener('document:keydown.escape', ['$event'])
    // closeContextMenu() {
    //     this.#contextMenuService.close();
    // }
}
