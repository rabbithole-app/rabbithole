import { RxLet } from '@rx-angular/template/let';
import {
    Component,
    ChangeDetectionStrategy,
    Input,
    ElementRef,
    Renderer2,
    HostBinding,
    OnDestroy,
    inject,
    WritableSignal,
    signal,
    Signal,
    computed
} from '@angular/core';
import { Point } from '@angular/cdk/drag-drop';
import { animate, AnimationBuilder, AnimationPlayer, group, keyframes, style } from '@angular/animations';
import { bounceInOnEnterAnimation, bounceOutOnLeaveAnimation } from 'angular-animations';
import { MatIconModule } from '@angular/material/icon';
import { RxIf } from '@rx-angular/template/if';
import { JournalItem } from '@features/file-list/models';
import { getIconByFilename } from '@features/file-list/utils';
import { FILE_LIST_ICONS_CONFIG } from '@features/file-list/config';
import { AnimatedFolderComponent } from '@features/file-list/components/animated-folder/animated-folder.component';

enum Mode {
    File,
    Folder,
    Stack
}
type FileMode = { type: Mode.File; icon: string };
type FolderMode = { type: Mode.Folder };
type StackMode = { type: Mode.Stack; count: number };

@Component({
    selector: 'app-drag-preview',
    templateUrl: './drag-preview.component.html',
    styleUrls: ['./drag-preview.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [bounceOutOnLeaveAnimation(), bounceInOnEnterAnimation()],
    imports: [RxIf, RxLet, MatIconModule, AnimatedFolderComponent],
    standalone: true
})
export class DragPreviewComponent implements OnDestroy {
    @Input() set selected(value: Partial<JournalItem>[]) {
        this.selectedItems.set(value);
    }
    private player!: AnimationPlayer;
    private readonly width: number = 60;
    private readonly height: number = 60;
    private readonly hostAnimationParams = { value: '', params: { duration: 500, delay: 0 } };
    iconsConfig = inject(FILE_LIST_ICONS_CONFIG);
    selectedItems: WritableSignal<Partial<JournalItem>[]> = signal([]);
    mode: Signal<FileMode | FolderMode | StackMode> = computed(() => {
        const selected = this.selectedItems();
        const count = selected.length;
        if (count === 1 && selected[0].type === 'file') {
            return { type: Mode.File, icon: getIconByFilename(this.iconsConfig, selected[0].name) };
        } else if (count === 1 && selected[0].type === 'folder') {
            return { type: Mode.Folder };
        }

        return { type: Mode.Stack, count };
    });
    readonly blankIcon = `${this.iconsConfig.namespace}:blank`;

    constructor(public element: ElementRef, private renderer: Renderer2, private animationBuilder: AnimationBuilder) {}

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

    isSingleFile(mode: FileMode | FolderMode | StackMode): mode is FileMode {
        return mode.type === Mode.File;
    }

    isFolder(mode: FileMode | FolderMode | StackMode): mode is FolderMode {
        return mode.type === Mode.Folder;
    }

    isStack(mode: FileMode | FolderMode | StackMode): mode is StackMode {
        return mode.type === Mode.Stack;
    }
}
