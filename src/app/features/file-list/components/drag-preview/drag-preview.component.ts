import { Component, ChangeDetectionStrategy, Input, OnChanges, SimpleChanges, ElementRef, Renderer2, HostBinding, OnDestroy, inject } from '@angular/core';
import { Point } from '@angular/cdk/drag-drop';
import { animate, AnimationBuilder, AnimationPlayer, group, keyframes, style } from '@angular/animations';
import { bounceInOnEnterAnimation, bounceOutOnLeaveAnimation } from 'angular-animations';
import { head, isArray, last } from 'lodash';
import { RxState } from '@rx-angular/state';

import { JournalItem } from '@features/file-list/models';
import { getIconByExt } from '@features/file-list/utils';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AnimatedFolderComponent } from '@features/file-list/components/animated-folder/animated-folder.component';

interface DragPreviewState {
    count: number;
    blankIcon: string;
    type?: 'file' | 'folder';
    icon?: string;
}

@Component({
    selector: 'app-drag-preview',
    templateUrl: './drag-preview.component.html',
    styleUrls: ['./drag-preview.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [bounceOutOnLeaveAnimation(), bounceInOnEnterAnimation()],
    providers: [RxState],
    imports: [CommonModule, MatIconModule, AnimatedFolderComponent],
    standalone: true
})
export class DragPreviewComponent implements OnChanges, OnDestroy {
    @Input() selected: Partial<JournalItem>[] | null = [];
    private player!: AnimationPlayer;
    private readonly width: number = 60;
    private readonly height: number = 60;
    private readonly hostAnimationParams = { value: '', params: { duration: 500, delay: 0 } };
    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    state = inject(RxState<DragPreviewState>);

    count$ = this.state.select('count');
    type$ = this.state.select('type');
    icon$ = this.state.select('icon');

    get blankIcon() {
        return this.state.get().blankIcon;
    }

    constructor(public element: ElementRef, private renderer: Renderer2, private animationBuilder: AnimationBuilder) {
        this.state.set({
            count: 0,
            blankIcon: `${this.iconsConfig.namespace}:blank`
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['selected'] && isArray(changes['selected'].currentValue)) {
            const selected = changes['selected'].currentValue;
            const count = selected.length;
            const item = count === 1 ? (head(selected) as JournalItem) : undefined;
            const type = item ? item.type : undefined;
            const extension = item?.type === 'file' ? last(item.name.split('.')) : undefined;
            this.state.set({ count, type, icon: getIconByExt(this.iconsConfig, extension) });
        }
    }

    @HostBinding('@bounceInOnEnter') get bounceInOnEnter() {
        return this.hostAnimationParams;
    }

    /**
     * Функция анимирует host до точки point
     * вызывается с внешнего компонента к точке начала движения при отмене перетаскивания
     * (драг-элемент отпустили не на дроп-элементе)
     * @param point
     */
    animateToPoint(point: Point) {
        const animation = this.animationBuilder.build([
            group([
                animate(
                    '500ms ease-out',
                    style({
                        top: `${point.y - this.height / 2}px`,
                        left: `${point.x - this.width / 2}px`
                    })
                ),
                animate('500ms linear', keyframes([style({ opacity: 1, offset: 0.5 }), style({ opacity: 0, offset: 1 })]))
            ])
        ]);
        this.player = animation.create(this.element.nativeElement);
        this.player.play();
    }

    position(point: Point): void {
        this.renderer.setStyle(this.element.nativeElement, 'top', `${point.y - this.height / 2}px`);
        this.renderer.setStyle(this.element.nativeElement, 'left', `${point.x - this.width / 2}px`);
    }

    ngOnDestroy(): void {
        this.player?.destroy();
    }
}
