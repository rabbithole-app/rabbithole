import { Highlightable } from '@angular/cdk/a11y';
import { Point } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostBinding, Input, Output, booleanAttribute, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RxIf } from '@rx-angular/template/if';
import { fadeInOnEnterAnimation, fadeOutDownOnLeaveAnimation, fadeOutOnLeaveAnimation } from 'angular-animations';

import { MiddleEllipsisComponent } from '@core/components/middle-ellipsis/middle-ellipsis.component';
import { addFASvgIcons } from '@core/utils';
import { AnimatedFolderComponent } from '@features/file-list/components/animated-folder/animated-folder.component';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { JournalItem } from '@features/file-list/models';
import { JournalService } from '@features/file-list/services';
import { getIconByFilename } from '@features/file-list/utils';

@Component({
    selector: 'app-grid-list-item',
    templateUrl: './grid-list-item.component.html',
    styleUrls: ['./grid-list-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [fadeInOnEnterAnimation({ duration: 250 }), fadeOutOnLeaveAnimation({ duration: 250 }), fadeOutDownOnLeaveAnimation({ duration: 250 })],
    imports: [RxIf, AnimatedFolderComponent, MatIconModule, MatProgressBarModule, NgTemplateOutlet, MiddleEllipsisComponent],
    standalone: true
})
export class GridListItemComponent implements Highlightable {
    @Input({ required: true }) data!: JournalItem;
    @Input() active?: boolean = false;
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

    /*
    adding$: Observable<boolean>;
    added$: Observable<boolean>;
    removed$: Observable<boolean>;
    statusIcon$: Observable<boolean>;
    */

    hostAnimationParams = { value: '', params: { duration: 250, delay: 0 } };
    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    element = inject(ElementRef);
    journalService = inject(JournalService);

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
        addFASvgIcons(['users', 'lock'], 'far');
    }

    getIconByExt = (filename: string) => getIconByFilename(this.iconsConfig, filename);

    setActiveStyles(): void {
        this._isActive = true;
    }

    setInactiveStyles(): void {
        this._isActive = false;
    }
}
