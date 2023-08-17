import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { saveAs } from 'file-saver';
import { omit } from 'lodash';
import { merge, timer } from 'rxjs';
import { catchError, distinctUntilKeyChanged, filter, map, mergeAll, mergeMap } from 'rxjs/operators';

import { CoreService, NotificationService } from '@core/services';
import { SharedFileExtended } from '@features/shared-with-me/models';
import { JournalItem, DownloadStatus } from '../models';

type FileDownloadState = {
    loaded: number;
    total: number;
    status: DownloadStatus;
};

interface State {
    progress: Record<string, FileDownloadState>;
}

@Injectable({
    providedIn: 'root'
})
export class DownloadService extends RxState<State> {
    readonly #coreService = inject(CoreService);
    readonly #translocoService = inject(TranslocoService);
    readonly #notificationService = inject(NotificationService);

    constructor() {
        super();
        this.set({ progress: {} });
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
        this.select('progress')
            .pipe(
                map(value => Object.entries(value).map(([id, val]) => ({ ...val, id }))),
                mergeAll(),
                filter(({ status }) => [DownloadStatus.Failed, DownloadStatus.Complete].includes(status)),
                distinctUntilKeyChanged('id'),
                mergeMap(({ id }) => timer(3000).pipe(map(() => id))),
                takeUntilDestroyed()
            )
            .subscribe(id => this.set('progress', state => omit(state.progress, id)));
    }

    download(selected: JournalItem[] | SharedFileExtended[]) {
        const worker = this.#coreService.worker();
        if (worker) {
            worker.postMessage({ action: 'download', items: selected });
        }
        // TODO: добавить скачивание не в воркере
    }

    #updateProgress(id: string, value: Partial<FileDownloadState>) {
        this.set('progress', state => ({
            ...state.progress,
            [id]: {
                ...state.progress[id],
                ...value
            }
        }));
    }

    fileProgress(id: string) {
        return this.select('progress', id).pipe(
            map(({ status, loaded, total }) => {
                switch (status) {
                    case DownloadStatus.RetrieveKey:
                        return this.#translocoService.translate('fileList.file.download.retrievingKey');
                    case DownloadStatus.Progress:
                        return this.#translocoService.translate('fileList.file.download.progress', { percent: Math.floor((loaded / total) * 100) });
                    case DownloadStatus.Failed:
                        throw Error(this.#translocoService.translate('fileList.file.download.failedMessage'));
                    default:
                        return '';
                }
            }),
            catchError(err => {
                this.#notificationService.error(err.message);
                return merge(this.#translocoService.selectTranslate('fileList.file.download.failed'), timer(3000).pipe(map(() => '')));
            })
        );
    }
}
