import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { saveAs } from 'file-saver';
import { Subject, timer } from 'rxjs';
import { filter, map, mergeMap } from 'rxjs/operators';

import { CoreService, NotificationService } from '@core/services';
import { SharedFileExtended } from '@features/shared-with-me/models';
import { JournalItem, DownloadStatus } from '../models';

export type FileDownloadState = {
    loaded: number;
    total: number;
    status: DownloadStatus;
    errorMessage?: string;
};

interface State {
    progress: Record<string, FileDownloadState>;
    progressMessage: Record<string, string>;
}

@Injectable({
    providedIn: 'root'
})
export class DownloadService extends RxState<State> {
    readonly #coreService = inject(CoreService);
    readonly #translocoService = inject(TranslocoService);
    readonly #notificationService = inject(NotificationService);
    resetTimer: Subject<string> = new Subject();

    constructor() {
        super();
        this.set({ progress: {}, progressMessage: {} });
        this.#coreService.workerMessage$
            .pipe(
                filter(({ data }) => ['download', 'downloadProgress'].includes(data.action)),
                takeUntilDestroyed()
            )
            .subscribe(({ data }) => {
                switch (data.action) {
                    case 'download':
                        saveAs(data.file);
                        break;
                    case 'downloadProgress': {
                        this.#updateProgress(data.id, data.progress);
                        break;
                    }
                    default:
                        break;
                }
            });
        this.resetTimer
            .asObservable()
            .pipe(
                mergeMap(id => timer(3000).pipe(map(() => id))),
                takeUntilDestroyed()
            )
            .subscribe(id => this.set('progressMessage', state => ({ ...state.progressMessage, [id]: '' })));
    }

    download(selected: JournalItem[] | SharedFileExtended[]) {
        const worker = this.#coreService.worker();
        if (worker) {
            worker.postMessage({ action: 'download', items: selected });
        }
        // TODO: добавить скачивание не в воркере
    }

    #updateProgress(id: string, value: Partial<FileDownloadState>) {
        const state = this.get();
        const fileProgress = {
            ...state.progress[id],
            ...value
        };
        let fileProgressMessage: string = '';
        switch (fileProgress.status) {
            case DownloadStatus.RetrieveKey:
                fileProgressMessage = this.#translocoService.translate('fileList.file.download.retrievingKey');
                break;
            case DownloadStatus.Progress:
                fileProgressMessage = this.#translocoService.translate('fileList.file.download.progress', {
                    percent: Math.floor((fileProgress.loaded / fileProgress.total) * 100)
                });
                break;
            case DownloadStatus.Failed:
                fileProgressMessage = this.#translocoService.translate('fileList.file.download.failed');
                if (fileProgress.errorMessage) {
                    this.#notificationService.error(fileProgress.errorMessage);
                }
                this.resetTimer.next(id);
                break;
            case DownloadStatus.Complete:
                this.#notificationService.success(this.#translocoService.translate('fileList.file.download.complete'));
                break;
            default:
                break;
        }
        this.set({
            progress: {
                ...state.progress,
                [id]: fileProgress
            },
            progressMessage: {
                ...state.progressMessage,
                [id]: fileProgressMessage
            }
        });
    }
}
