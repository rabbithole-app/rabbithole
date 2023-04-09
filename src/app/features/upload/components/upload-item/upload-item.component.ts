import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, inject, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RxState } from '@rx-angular/state';
import { AnimationBuilder, trigger } from '@angular/animations';
import { bounceInOnEnterAnimation, bounceOutOnLeaveAnimation } from 'angular-animations';

import { FileUploadState, UPLOAD_STATUS } from '../../models';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { addSvgIcons, formatBytes, getIconByFilename } from '@features/file-list/utils';
import { addFASvgIcons } from '@core/utils';

interface State {
    data: FileUploadState;
    status: UPLOAD_STATUS;
}

@Component({
    selector: 'app-upload-item',
    templateUrl: './upload-item.component.html',
    styleUrls: ['./upload-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [
        bounceInOnEnterAnimation({ duration: 500 }),
        bounceOutOnLeaveAnimation({ duration: 500 }),
        trigger('buttonAnimations', [
            /*state('process', style({ width: 80 })),
            state('paused, failed, cancelled', style({ width: 40 })),
            state('done, queue', style({ width: 0 })),*/
            /*transition('process => paused, process => failed, process => done', [
                query(':leave', animateChild(), { optional: true }),
                animate('100ms ease-in-out', style({ width: 40 })),
                query(':enter', animateChild(), { optional: true })
            ]),
            transition('paused => process, repeat => process', [
                query(':leave', animateChild(), { optional: true }),
                animate('100ms ease-in-out', style({ width: 80 })),
                query(':enter', animateChild(), { optional: true })
            ])*/
        ])
    ],
    providers: [RxState],
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule]
})
export class UploadItemComponent {
    @Input()
    set data(data: FileUploadState) {
        this.state.set({ data });
    }
    get data(): FileUploadState {
        return this.state.get().data;
    }
    @HostBinding('class.pausable')
    @Input()
    pausable = false;
    @Output() pauseUpload: EventEmitter<void> = new EventEmitter<void>();
    @Output() resumeUpload: EventEmitter<void> = new EventEmitter<void>();
    @Output() repeatUpload: EventEmitter<void> = new EventEmitter<void>();
    @Output() cancelUpload: EventEmitter<void> = new EventEmitter<void>();

    animationBuilder = inject(AnimationBuilder);
    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    readonly UploadStatus = UPLOAD_STATUS;

    constructor(private state: RxState<State>) {
        addSvgIcons(this.iconsConfig);
        addFASvgIcons(['play', 'pause', 'xmark', 'arrow-rotate-right'], 'far');
    }

    getIconByFilename = (name: string) => getIconByFilename(this.iconsConfig, name);
    get progress(): number {
        return this.data.progress;
    }

    get formatSize(): string {
        return formatBytes(this.data.total);
    }

    /*@HostBinding('class') get hostClass(): string {
        return `status-${this.status}`;
    }*/
    @HostBinding('class')
    get status(): UPLOAD_STATUS {
        return this.state.get().data.status;
    }

    handleResume(event: MouseEvent): void {
        event.stopPropagation();
        this.resumeUpload.emit();
    }

    handlePause(event: MouseEvent): void {
        event.stopPropagation();
        this.pauseUpload.emit();
    }

    handleCancel(event: MouseEvent): void {
        event.stopPropagation();
        this.cancelUpload.emit();
    }

    handleRepeat(event: MouseEvent): void {
        event.stopPropagation();
        this.repeatUpload.emit();
    }
}
