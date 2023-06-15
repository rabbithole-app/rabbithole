import { Component, ChangeDetectionStrategy, Input, ElementRef, HostBinding, Output, EventEmitter, inject } from '@angular/core';
import { Highlightable } from '@angular/cdk/a11y';
import { Point } from '@angular/cdk/drag-drop';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { fadeInOnEnterAnimation, fadeOutDownOnLeaveAnimation, fadeOutOnLeaveAnimation } from 'angular-animations';
import { RxIf } from '@rx-angular/template/if';

import { DirectoryExtended, JournalItem } from '@features/file-list/models';
import { getIconByFilename } from '@features/file-list/utils';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { AnimatedFolderComponent } from '@features/file-list/components/animated-folder/animated-folder.component';
import { addFASvgIcons } from '@core/utils';

@Component({
    selector: 'app-grid-list-item',
    templateUrl: './grid-list-item.component.html',
    styleUrls: ['./grid-list-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [fadeInOnEnterAnimation({ duration: 250 }), fadeOutOnLeaveAnimation({ duration: 250 }), fadeOutDownOnLeaveAnimation({ duration: 250 })],
    imports: [RxIf, AnimatedFolderComponent, MatIconModule, MatProgressBarModule],
    standalone: true
})
export class GridListItemComponent implements Highlightable {
    @Input({ required: true }) data!: JournalItem;
    @Input() active?: boolean = false;
    @Output() openContext: EventEmitter<{ trigger: MatMenuTrigger; position: Point }> = new EventEmitter<{ trigger: MatMenuTrigger; position: Point }>();
    folderColor = 'blue';
    @HostBinding('attr.tabindex') tabindex = '-1';
    @HostBinding('attr.role') role = 'listitem';
    @HostBinding('attr.aria-label') get label() {
        return this.data.name;
    }
    @HostBinding('class.disabled') @Input() disabled = false;
    @HostBinding('class.loading') @Input() loading?: boolean = false;
    @HostBinding('class.selected') @Input() selected = false;
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
        addFASvgIcons(['users'], 'far');
    }

    getIconByExt = (filename: string) => getIconByFilename(this.iconsConfig, filename);

    setActiveStyles(): void {
        this._isActive = true;
    }

    setInactiveStyles(): void {
        this._isActive = false;
    }

    isDirectory(data: JournalItem): data is DirectoryExtended {
        return data.type === 'folder';
    }
}
