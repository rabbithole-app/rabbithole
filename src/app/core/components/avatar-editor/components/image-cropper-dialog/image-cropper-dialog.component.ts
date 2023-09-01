import { ChangeDetectionStrategy, Component, EventEmitter, Output, ViewChild, WritableSignal, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { pick } from 'lodash';
import { nanoid } from 'nanoid';
import { ImageCropperComponent, ImageCropperModule, OutputFormat } from 'ngx-image-cropper';
import { throwError } from 'rxjs';
import { catchError, finalize, first, map } from 'rxjs/operators';

import { CoreService, NotificationService } from '@core/services';

@Component({
    selector: 'app-image-cropper-dialog',
    standalone: true,
    imports: [MatDialogModule, MatButtonModule, TranslocoModule, ImageCropperModule, RxIf],
    templateUrl: './image-cropper-dialog.component.html',
    styleUrls: ['./image-cropper-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCropperDialogComponent {
    @Output() imageData: EventEmitter<{ type: string; data: Uint8Array }> = new EventEmitter();
    #coreService = inject(CoreService);
    #notificationService = inject(NotificationService);
    @ViewChild(ImageCropperComponent) imageCropper!: ImageCropperComponent;
    readonly imageCropperOptions = {
        aspectRatio: 1,
        maintainAspectRatio: true,
        format: 'jpeg' as OutputFormat,
        resizeToWidth: 512,
        resizeToHeight: 512,
        onlyScaleDown: true,
        roundCropper: true,
        autoCrop: false,
        containWithinAspectRatio: false
    };
    readonly #dialogRef = inject<MatDialogRef<ImageCropperDialogComponent>>(MatDialogRef);
    readonly #data = inject<{ image: File }>(MAT_DIALOG_DATA);
    readonly image = this.#data.image;
    loading: WritableSignal<boolean> = signal(false);

    crop() {
        const worker = this.#coreService.worker();
        if (worker) {
            this.loading.set(true);
            const id = nanoid(4);
            const canvas = document.createElement('canvas');
            const offscreen = canvas?.transferControlToOffscreen();
            worker.postMessage(
                {
                    action: 'cropImage',
                    id,
                    image: this.image,
                    cropper: { maxSize: this.imageCropper.maxSize, position: this.imageCropper.cropper },
                    canvas: offscreen
                },
                [offscreen]
            );
            this.#coreService.workerMessage$
                .pipe(
                    first(({ data }) => ['cropImageDone', 'cropImageFailed'].includes(data.action) && data.id === id),
                    map(({ data }) => {
                        if (data.action === 'cropImageFailed') {
                            throw Error(data.errorMessage);
                        }
                        return pick(data, ['data', 'type']);
                    }),
                    finalize(() => this.loading.set(false)),
                    catchError(err => {
                        this.#notificationService.error(err.message);
                        return throwError(() => err);
                    })
                )
                .subscribe(data => {
                    this.imageData.emit(data);
                    this.#dialogRef.close(data);
                });
        }
    }
}
