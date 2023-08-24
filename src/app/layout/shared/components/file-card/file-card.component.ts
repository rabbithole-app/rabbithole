import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { RxIf } from '@rx-angular/template/if';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule, ProgressBarMode } from '@angular/material/progress-bar';
import { timer } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { TranslocoModule } from '@ngneat/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { intervalToDuration, isDate, isFuture } from 'date-fns';
import { RxLet } from '@rx-angular/template/let';

import { SharedFileExtended } from '@features/shared-with-me/models';
import { addSvgIcons, formatBytes, getIconByFilename } from '@features/file-list/utils';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { DownloadStatus } from '@features/file-list/models';
import { DownloadService, FileDownloadState } from '@features/file-list/services';

@Component({
    selector: 'app-file-card',
    standalone: true,
    imports: [MatCardModule, RxIf, RxLet, MatIconModule, MatButtonModule, MatProgressBarModule, TranslocoModule, NgTemplateOutlet],
    templateUrl: './file-card.component.html',
    styleUrls: ['./file-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileCardComponent implements OnInit {
    @Input({ required: true }) data!: SharedFileExtended;
    #downloadService = inject(DownloadService);
    #iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    #destroyed = inject(DestroyRef);
    getIconByExt = (filename: string) => getIconByFilename(this.#iconsConfig, filename);
    loading: WritableSignal<boolean> = signal(false);
    downloadState: WritableSignal<FileDownloadState | null> = signal(null);
    retrievingKey: Signal<boolean> = computed(() => this.downloadState()?.status === DownloadStatus.RetrieveKey);
    progressBarMode: Signal<ProgressBarMode> = computed(() => (this.retrievingKey() ? 'query' : 'determinate'));
    progressBarValue: Signal<number> = computed(() => {
        const state = this.downloadState();
        return state && state.status === DownloadStatus.Progress
            ? Math.floor((state.loaded / state.total) * 100)
            : state && state.status === DownloadStatus.Complete
            ? 100
            : 0;
    });
    timelocked: WritableSignal<boolean> = signal(false);
    duration: WritableSignal<Duration | null> = signal(null);
    durationSecondsRaw: Signal<number> = computed(() => this.duration()?.seconds ?? 0);
    durationSeconds: Signal<string> = computed(() => this.durationSecondsRaw().toString().padStart(2, '0'));
    durationMinutesRaw: Signal<number> = computed(() => this.duration()?.minutes ?? 0);
    durationMinutes: Signal<string> = computed(() => this.durationMinutesRaw().toString().padStart(2, '0'));
    durationHoursRaw: Signal<number> = computed(() => this.duration()?.hours ?? 0);
    durationHours: Signal<string> = computed(() => this.durationHoursRaw().toString().padStart(2, '0'));
    durationDays: Signal<number> = computed(() => this.duration()?.days ?? 0);

    constructor() {
        addSvgIcons(this.#iconsConfig);
    }

    formatBytes(size: bigint): string {
        return formatBytes(Number(size));
    }

    handleDownload() {
        this.loading.set(true);
        this.#downloadService.download([this.data]);
        this.#downloadService
            .select('progress', this.data.id)
            .pipe(
                filter(({ status }) => [DownloadStatus.Failed, DownloadStatus.Complete].includes(status)),
                take(1)
            )
            .subscribe(() => this.loading.set(false));
    }

    ngOnInit(): void {
        this.#downloadService
            .select('progress', this.data.id)
            .pipe(takeUntilDestroyed(this.#destroyed))
            .subscribe(state => this.downloadState.set(state));
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
        }
    }
}
