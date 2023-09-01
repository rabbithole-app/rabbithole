import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Input,
    Signal,
    WritableSignal,
    booleanAttribute,
    effect,
    forwardRef,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RxIf } from '@rx-angular/template/if';
import { RxPush } from '@rx-angular/template/push';
import { bounceInOnEnterAnimation, bounceOutOnLeaveAnimation } from 'angular-animations';
import { isNull, isString } from 'lodash';
import { showOpenFilePicker } from 'native-file-system-adapter';
import { Observable, Subject, fromEvent, merge } from 'rxjs';
import { distinctUntilChanged, endWith, filter, map, repeat, startWith, switchMap, take, takeUntil, withLatestFrom } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { CoreService, NotificationService } from '@core/services';
import { addFASvgIcons } from '@core/utils';
import { UPLOAD_STATUS } from '@features/upload/models';
import { UploadService } from '@features/upload/services';
import { AvatarComponent } from 'app/layout/dashboard/components/avatar/avatar.component';
import { ImageCropperDialogComponent } from './components/image-cropper-dialog/image-cropper-dialog.component';

@Component({
    selector: 'app-avatar-editor',
    templateUrl: './avatar-editor.component.html',
    styleUrls: ['./avatar-editor.component.scss'],
    standalone: true,
    imports: [RxIf, RxPush, MatIconModule, MatDialogModule, MatButtonModule, MatProgressSpinnerModule, AvatarComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => AvatarEditorComponent),
            multi: true
        }
    ],
    animations: [bounceOutOnLeaveAnimation(), bounceInOnEnterAnimation()]
})
export class AvatarEditorComponent implements ControlValueAccessor {
    #coreService = inject(CoreService);
    #uploadService = inject(UploadService);
    #notificationService = inject(NotificationService);
    #element = inject(ElementRef);
    dialog = inject(MatDialog);
    readonly systemFilesParenId = '.rabbithole';
    value: WritableSignal<string | null> = signal(null);
    value$: Observable<string | null> = toObservable(this.value);
    uploadId: Subject<string> = new Subject();
    loading$: Observable<boolean> = this.uploadId.asObservable().pipe(
        switchMap(id =>
            this.#uploadService
                .select('progress', id, 'status')
                .pipe(
                    map(status =>
                        [UPLOAD_STATUS.Queue, UPLOAD_STATUS.Init, UPLOAD_STATUS.Request, UPLOAD_STATUS.Processing, UPLOAD_STATUS.Finalize].includes(status)
                    )
                )
        ),
        distinctUntilChanged(),
        startWith(false)
    );
    loading: Signal<boolean> = toSignal(this.loading$, { initialValue: false });
    @Input({ transform: booleanAttribute }) disabled = false;
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    onChanged = (value: string | null) => {};
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onTouched = () => {};
    showDeleteButton$: Observable<boolean> = merge(
        fromEvent(this.#element.nativeElement, 'mouseenter', { passive: true }).pipe(map(() => true)),
        fromEvent(this.#element.nativeElement, 'mouseleave', { passive: true }).pipe(map(() => false))
    ).pipe(takeUntil(this.value$.pipe(filter(v => isNull(v)))), endWith(false), repeat({ delay: () => this.value$.pipe(filter(v => isString(v))) }));

    constructor() {
        addFASvgIcons(['pencil', 'trash-can'], 'far');
        effect(() => this.onChanged(this.value()));
        this.#coreService.workerMessage$
            .pipe(
                filter(
                    ({ data }) =>
                        ['getFilesByParentIdDone', 'getFilesByParentIdFailed'].includes(data.action) && data.payload.parentId === this.systemFilesParenId
                ),
                withLatestFrom(this.uploadId.asObservable()),
                map(([{ data }, id]) => {
                    if (data.action === 'getFilesByParentIdFailed') {
                        throw Error(data.errorMessage);
                    }
                    return data.payload.items.find(({ name }) => name === `avatar_${id}`);
                }),
                filter(v => v),
                takeUntilDestroyed()
            )
            .subscribe(({ downloadUrl }) => this.value.set(downloadUrl));
    }

    writeValue(value: string | null): void {
        this.value.set(value ?? null);
    }

    registerOnChange(fn: () => void): void {
        this.onChanged = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState?(isDisabled: boolean): void {
        this.disabled = isDisabled;
    }

    async handleImageSelect(event: MouseEvent) {
        event.preventDefault();
        try {
            const [fileHandle] = await showOpenFilePicker({
                types: [
                    {
                        description: 'Images',
                        accept: {
                            'image/*': ['.png', '.gif', '.jpeg', '.jpg']
                        }
                    }
                ]
            });
            const image = await fileHandle.getFile();
            const dialogRef = this.dialog.open(ImageCropperDialogComponent, {
                maxWidth: '80vw',
                maxHeight: '80vh',
                data: { image }
            });

            dialogRef.afterClosed().subscribe((data: { type: string; data: Uint8Array }) => {
                this.onTouched();
                if (data) this.#uploadAvatar(data);
            });
        } catch (err) {
            this.#notificationService.error((<DOMException>err).message);
        }
    }

    #uploadAvatar({ data, type }: { type: string; data: Uint8Array }) {
        const id = uuidv4();
        const item = {
            id,
            name: `avatar_${id}`,
            fileSize: data.byteLength,
            contentType: type,
            data: data.buffer,
            parentId: this.systemFilesParenId
        };
        this.#uploadService.addItem(item);
        this.uploadId.next(id);
        const worker = this.#coreService.worker();
        if (worker) {
            const uploadState = this.#uploadService.get('progress', item.id);
            worker.postMessage(
                {
                    action: 'addUpload',
                    uploadState,
                    item,
                    options: {
                        encryption: false,
                        thumbnail: false
                    }
                },
                [item.data]
            );
            this.#uploadService
                .select('progress', item.id, 'status')
                .pipe(
                    filter(status => status === UPLOAD_STATUS.Done),
                    take(1)
                )
                .subscribe(() => worker.postMessage({ action: 'getFilesByParentId', parentId: item.parentId }));
        }
    }

    reset() {
        this.value.set(null);
    }
}
