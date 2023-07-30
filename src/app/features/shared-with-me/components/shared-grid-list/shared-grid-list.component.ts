import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem } from '@angular/cdk/menu';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, WritableSignal, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ProfileItem } from '@core/models/profile';
import { CoreService } from '@core/services';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { DownloadService } from '@features/file-list/services';
import { addSvgIcons, formatBytes } from '@features/file-list/utils';
import { SharedFileExtended } from '@features/shared-with-me/models';
import { TranslocoModule } from '@ngneat/transloco';
import { RxFor } from '@rx-angular/template/for';
import { RxIf } from '@rx-angular/template/if';
import { SharedGridListItemComponent } from '../shared-grid-list-item/shared-grid-list-item.component';

@Component({
    selector: 'app-shared-grid-list',
    standalone: true,
    imports: [RxFor, MatCardModule, SharedGridListItemComponent],
    templateUrl: './shared-grid-list.component.html',
    styleUrls: ['./shared-grid-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SharedGridListComponent {
    items: WritableSignal<SharedFileExtended[]> = signal([]);
    @Input('items') set itemsFn(items: SharedFileExtended[] | null) {
        this.items.set(items ?? []);
    }
    @Input({ required: true }) user!: ProfileItem;
    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    #downloadService = inject(DownloadService);
    constructor() {
        addSvgIcons(this.iconsConfig);
    }
    // @Output() openContext: EventEmitter<{ event: MouseEvent; origin?: ElementRef }> = new EventEmitter<{ event: MouseEvent; origin?: ElementRef }>();

    handleDownload(item: SharedFileExtended) {
        this.#downloadService.download([item]);
    }
}
