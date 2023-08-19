import { ChangeDetectionStrategy, Component, OnDestroy, Signal, ViewChild, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { TranslocoModule } from '@ngneat/transloco';
import { RxFor } from '@rx-angular/template/for';
import { RxIf } from '@rx-angular/template/if';
import { RxLet } from '@rx-angular/template/let';

import { ProfileItem } from '@core/models/profile';
import { addFASvgIcons } from '@core/utils';
import { AvatarComponent } from 'app/layout/dashboard/components/avatar/avatar.component';
import { CopyIDComponent } from '../../core/components/copy-id/copy-id.component';
import { SharedGridListComponent } from './components/shared-grid-list/shared-grid-list.component';
import { SharedFileExtended } from './models';
import { EmptyComponent } from '../../core/components/empty/empty.component';
import { SharedWithMeService } from './services/shared-with-me.service';
import { CoreService } from '@core/services';

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
        CopyIDComponent,
        EmptyComponent
    ]
})
export class SharedWithMeComponent implements OnDestroy {
    readonly #coreService = inject(CoreService);
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
    readonly #sharedWithMeService = inject(SharedWithMeService);
    items = this.#sharedWithMeService.items;
    hasItems: Signal<boolean> = computed(() => this.#sharedWithMeService.items().length > 0);
    #itemsMenuTrigger: WritableSignal<MatMenuTrigger | null> = signal(null);
    @ViewChild('itemsTrigger', { read: MatMenuTrigger }) set itemsMenuTrigger(value: MatMenuTrigger) {
        this.#itemsMenuTrigger.set(value);
    }
    // #contextMenuService = inject(ContextMenuService);

    constructor() {
        addFASvgIcons(['download'], 'far');
        effect(() => {
            const worker = this.#coreService.worker();
            if (this.#coreService.workerInited() && worker) {
                worker.postMessage({ action: 'startSharedTimer' });
            }
        });
    }

    ngOnDestroy(): void {
        const worker = this.#coreService.worker();
        if (worker) {
            worker.postMessage({ action: 'stopSharedTimer' });
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
