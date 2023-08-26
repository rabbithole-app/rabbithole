import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    EventEmitter,
    Input,
    OnInit,
    Output,
    Signal,
    WritableSignal,
    computed,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { RxPush } from '@rx-angular/template/push';
import { formatDistanceToNow } from 'date-fns';

import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { DownloadService } from '@features/file-list/services';
import { formatBytes, getIconByFilename } from '@features/file-list/utils';
import { SharedFileExtended } from '@features/shared-with-me/models';

@Component({
    selector: 'app-shared-grid-list-item',
    standalone: true,
    templateUrl: './shared-grid-list-item.component.html',
    styleUrls: ['./shared-grid-list-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RxIf,
        RxPush,
        NgTemplateOutlet,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        TranslocoModule
    ]
})
export class SharedGridListItemComponent implements OnInit {
    @Input({ required: true }) data!: SharedFileExtended;
    @Output() download: EventEmitter<void> = new EventEmitter();
    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    getIconByExt = (filename: string) => getIconByFilename(this.iconsConfig, filename);
    #downloadService = inject(DownloadService);
    #destroyed = inject(DestroyRef);
    status: WritableSignal<string> = signal('');
    showStatus: Signal<boolean> = computed(() => this.status().length > 0);

    constructor() {
        // addFASvgIcons(['lock'], 'far');
    }

    ngOnInit(): void {
        this.#downloadService
            .select('progressMessage', this.data.id)
            .pipe(takeUntilDestroyed(this.#destroyed))
            .subscribe(value => this.status.set(value));
    }

    formatBytes(size: bigint): string {
        return formatBytes(Number(size));
    }

    formatDate(date: Date) {
        return formatDistanceToNow(date, { addSuffix: true });
    }
}
