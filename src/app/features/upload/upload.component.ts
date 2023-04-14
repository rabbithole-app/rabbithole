import { RxState } from '@rx-angular/state';
import { ChangeDetectionStrategy, Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TRANSLOCO_SCOPE, TranslocoModule } from '@ngneat/transloco';
import { AsyncSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PushModule } from '@rx-angular/template/push';

import { FileUploadState, UPLOAD_STATUS } from './models';
import { UploadService } from './services';
import { UploadItemComponent } from './components/upload-item/upload-item.component';
import { EmptyComponent } from '@core/components/empty/empty.component';
import { addFASvgIcons } from '@core/utils';

interface State {
    animationDisabled: boolean;
    hasUploading: boolean;
    hasCompleted: boolean;
    completedCount: number;
}

@Component({
    selector: 'app-upload',
    templateUrl: './upload.component.html',
    styleUrls: ['./upload.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatTabsModule, UploadItemComponent, EmptyComponent, TranslocoModule, PushModule],
    providers: [RxState, { provide: TRANSLOCO_SCOPE, useValue: 'upload' }]
})
export class UploadComponent implements OnDestroy {
    animationDisabled$: Observable<boolean> = this.state.select('animationDisabled');
    uploadService = inject(UploadService);
    uploading$: Observable<FileUploadState[]> = this.uploadService.uploading$;
    completed$: Observable<FileUploadState[]> = this.uploadService.completed$;
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();
    readonly uploadStatus = UPLOAD_STATUS;
    // updateStatus: BehaviorSubject<UPLOAD_STATUS> = new BehaviorSubject<UPLOAD_STATUS>(UPLOAD_STATUS.Processing);
    // testItem$: Observable<FileUploadState> = this.updateStatus
    //     .asObservable()
    //     .pipe(map(status => ({ id: 'qwerty', name: 'test', loaded: 100000, total: 1000000, type: '', progress: 10, chunkIds: [], status })));

    constructor(public state: RxState<State>) {
        addFASvgIcons(['xmark', 'trash-can-list', 'play'], 'far');
        this.state.set({
            animationDisabled: true,
            hasUploading: false,
            hasCompleted: false,
            completedCount: 0
        });
        this.state.connect('hasUploading', this.uploadService.uploading$.pipe(map(uploading => uploading.length > 0)));
        this.state.connect(
            this.uploadService.completed$.pipe(
                map(completed => ({
                    hasCompleted: completed.length > 0,
                    completedCount: completed.length
                }))
            )
        );
    }

    get hasCompleted(): boolean {
        return this.state.get('hasCompleted');
    }

    get completedCount(): number {
        return this.state.get('completedCount');
    }

    tabAnimationDone() {
        this.state.set({ animationDisabled: false });
    }

    tabChange() {
        this.state.set({ animationDisabled: true });
    }

    clearCompleted(event: MouseEvent) {
        this.uploadService.clearCompleted();
    }

    trackById(index: number, item: FileUploadState): string {
        return item.id;
    }

    ngOnDestroy(): void {
        this.uploadService.terminate();
        this.destroyed.next();
        this.destroyed.complete();
    }
}
