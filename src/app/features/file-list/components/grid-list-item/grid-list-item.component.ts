import { Highlightable } from '@angular/cdk/a11y';
import { Point } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    EventEmitter,
    HostBinding,
    Input,
    OnInit,
    Output,
    Signal,
    WritableSignal,
    booleanAttribute,
    computed,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RxIf } from '@rx-angular/template/if';
import { fadeInOnEnterAnimation, fadeOutDownOnLeaveAnimation, fadeOutOnLeaveAnimation } from 'angular-animations';

import { MiddleEllipsisComponent } from '@core/components/middle-ellipsis/middle-ellipsis.component';
import { addFASvgIcons } from '@core/utils';
import { AnimatedFolderComponent } from '@features/file-list/components/animated-folder/animated-folder.component';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { FileInfoExtended, JournalItem } from '@features/file-list/models';
import { DownloadService, JournalService } from '@features/file-list/services';
import { getIconByFilename } from '@features/file-list/utils';
import { has } from 'lodash';
import { FileShare } from '@declarations/journal/journal.did';

@Component({
    selector: 'app-grid-list-item',
    templateUrl: './grid-list-item.component.html',
    styleUrls: ['./grid-list-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [fadeInOnEnterAnimation({ duration: 250 }), fadeOutOnLeaveAnimation({ duration: 250 }), fadeOutDownOnLeaveAnimation({ duration: 250 })],
    imports: [RxIf, AnimatedFolderComponent, MatIconModule, MatProgressBarModule, NgTemplateOutlet, MiddleEllipsisComponent],
    standalone: true
})
export class GridListItemComponent implements Highlightable, OnInit {
    @Input({ required: true }) data!: JournalItem;
    @Input({ transform: booleanAttribute }) active = false;
    @Output() openContext: EventEmitter<{ trigger: MatMenuTrigger; position: Point }> = new EventEmitter<{ trigger: MatMenuTrigger; position: Point }>();
    @HostBinding('attr.tabindex') tabindex = '-1';
    @HostBinding('attr.role') role = 'listitem';
    @HostBinding('attr.aria-label') get label() {
        return this.data.name;
    }
    @HostBinding('class.disabled') @Input({ transform: booleanAttribute }) disabled = false;
    @HostBinding('class.loading') @Input({ transform: booleanAttribute }) loading = false;
    @HostBinding('class.selected') @Input({ transform: booleanAttribute }) selected = false;
    private _isActive = false;

    hostAnimationParams = { value: '', params: { duration: 250, delay: 0 } };
    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    element = inject(ElementRef);
    journalService = inject(JournalService);
    #downloadService = inject(DownloadService);
    #destroyed = inject(DestroyRef);
    status: WritableSignal<string> = signal('');
    showStatus: Signal<boolean> = computed(() => this.status().length > 0);

    get isSharedPublic(): boolean {
        return has(this.data, 'share.sharedWith.everyone');
    }

    @HostBinding('class.active') get isActive() {
        return this._isActive;
    }

    /**
     * Тут мы можем использовать лишь анимацию, которая не использует свойство transform,
     * к сожалению, таких большинство, потому используем эффект затухания.
     *
     * animate-css-grid устанавливает css-свойство transform-origin: 0 0 для элементов сетки,
     * из-за этого возникают визуальные баги при анимации, в данном случае приоритет отдан анимации сетки
     */
    /*@HostBinding('@fadeInOnEnter') get fadeInOnEnter() {
        return this.hostAnimationParams;
    }

    @HostBinding('@fadeOutOnLeave') get fadeOutOnLeave() {
        return this.hostAnimationParams;
    }*/

    constructor() {
        addFASvgIcons(['users', 'lock', 'share-nodes', 'link'], 'far');
    }

    ngOnInit(): void {
        this.#downloadService
            .select('progressMessage', this.data.id)
            .pipe(takeUntilDestroyed(this.#destroyed))
            .subscribe(value => this.status.set(value));
    }

    getIconByExt = (filename: string) => getIconByFilename(this.iconsConfig, filename);

    setActiveStyles(): void {
        this._isActive = true;
    }

    setInactiveStyles(): void {
        this._isActive = false;
    }
}
