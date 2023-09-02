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
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { RxPush } from '@rx-angular/template/push';
import { formatDistanceToNow, intervalToDuration, isDate, isFuture } from 'date-fns';
import { timer } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { DownloadService } from '@features/file-list/services';
import { formatBytes, getIconByFilename } from '@features/file-list/utils';
import { SharedFileExtended } from '@features/shared-with-me/models';
import { addFASvgIcons } from '@core/utils';
import { DownloadStatus } from '@features/file-list/models';

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
        TranslocoModule,
        MatTooltipModule
    ]
})
export class SharedGridListItemComponent implements OnInit {
    @Input({ required: true }) data!: SharedFileExtended;
    @Output() download: EventEmitter<void> = new EventEmitter();
    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    #translocoService = inject(TranslocoService);
    getIconByExt = (filename: string) => getIconByFilename(this.iconsConfig, filename);
    #downloadService = inject(DownloadService);
    #destroyed = inject(DestroyRef);
    status: WritableSignal<string> = signal('');
    showStatus: Signal<boolean> = computed(() => this.status().length > 0);
    timelocked: WritableSignal<boolean> = signal(false);
    loading: WritableSignal<boolean> = signal(false);
    downloadDisabled: Signal<boolean> = computed(() => this.timelocked() || this.loading());
    duration: WritableSignal<Duration | null> = signal(null);
    timelockTooltip: Signal<string> = computed(() => {
        const duration = this.duration();
        const days = duration?.days ?? 0;
        const hours = (duration?.hours ?? 0).toString().padStart(2, '0');
        const minutes = (duration?.minutes ?? 0).toString().padStart(2, '0');
        const seconds = (duration?.seconds ?? 0).toString().padStart(2, '0');
        const time = `${days}d${hours}h${minutes}m${seconds}s`;
        return `${this.#translocoService.translate('shared.timelock.description')} ${time}`;
    });

    constructor() {
        addFASvgIcons(['timer'], 'far');
    }

    ngOnInit(): void {
        this.#downloadService
            .select('progressMessage', this.data.id)
            .pipe(takeUntilDestroyed(this.#destroyed))
            .subscribe(value => this.status.set(value));
        this.#downloadService
            .select('progress', this.data.id)
            .pipe(
                map(({ status }) => [DownloadStatus.RetrieveKey, DownloadStatus.Progress].includes(status)),
                distinctUntilChanged(),
                takeUntilDestroyed(this.#destroyed)
            )
            .subscribe(loading => this.loading.set(loading));
        this.timelocked.set(isDate(this.data.timelock) && isFuture(this.data.timelock as Date));
        if (this.timelocked()) {
            timer(0, 1000)
                .pipe(
                    map(() =>
                        intervalToDuration({
                            start: Date.now(),
                            end: this.data.timelock as Date
                        })
                    ),
                    takeUntilDestroyed(this.#destroyed)
                )
                .subscribe(duration => this.duration.set(duration));
            timer(this.data.timelock as Date)
                .pipe(takeUntilDestroyed(this.#destroyed))
                .subscribe(() => this.timelocked.set(false));
        }
    }

    formatBytes(size: bigint): string {
        return formatBytes(Number(size));
    }

    formatDate(date: Date) {
        return formatDistanceToNow(date, { addSuffix: true });
    }
}
