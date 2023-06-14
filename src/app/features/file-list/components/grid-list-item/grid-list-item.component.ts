import {
    Component,
    ChangeDetectionStrategy,
    Input,
    ElementRef,
    HostBinding,
    Inject,
    Output,
    EventEmitter,
    NgZone,
    ChangeDetectorRef,
    inject
} from '@angular/core';
import { Highlightable } from '@angular/cdk/a11y';
import { Point } from '@angular/cdk/drag-drop';
import { MatMenuTrigger } from '@angular/material/menu';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RxState } from '@rx-angular/state';
import { fadeInOnEnterAnimation, fadeOutDownOnLeaveAnimation, fadeOutOnLeaveAnimation } from 'angular-animations';
import { WINDOW } from 'ngx-window-token';

import { JournalItem } from '@features/file-list/models';
import { getIconByFilename } from '@features/file-list/utils';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { ContextMenuService } from '@features/file-list/services';
import { OverlayService } from '@core/services';
import { AnimatedFolderComponent } from '@features/file-list/components/animated-folder/animated-folder.component';
import { addFASvgIcons } from '@core/utils';

interface State {
    data: JournalItem;
}

@Component({
    selector: 'app-grid-list-item',
    templateUrl: './grid-list-item.component.html',
    styleUrls: ['./grid-list-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [fadeInOnEnterAnimation({ duration: 250 }), fadeOutOnLeaveAnimation({ duration: 250 }), fadeOutDownOnLeaveAnimation({ duration: 250 })],
    providers: [RxState],
    imports: [CommonModule, AnimatedFolderComponent, MatIconModule, MatProgressBarModule],
    standalone: true
})
export class GridListItemComponent implements Highlightable {
    @Input()
    set data(data: JournalItem) {
        this.state.set({ data });
    }
    get data(): JournalItem {
        return this.state.get('data');
    }

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

    constructor(
        public element: ElementRef,
        private overlayService: OverlayService,
        private contextMenuService: ContextMenuService,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef,
        private state: RxState<State>,
        @Inject(WINDOW) private window: Window
    ) {
        addFASvgIcons(['users'], 'far');
    }

    getIconByExt = (filename: string) => getIconByFilename(this.iconsConfig, filename);

    setActiveStyles(): void {
        this._isActive = true;
    }

    setInactiveStyles(): void {
        this._isActive = false;
    }
}
