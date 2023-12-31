import { ChangeDetectionStrategy, Component, ElementRef, HostBinding, Input, OnChanges, Renderer2, SimpleChanges, inject } from '@angular/core';

@Component({
    selector: 'app-animated-folder',
    templateUrl: './animated-folder.component.html',
    styleUrls: ['./animated-folder.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class AnimatedFolderComponent implements OnChanges {
    @Input() color = 'blue';
    @HostBinding('class.active') @Input() active = false;
    #renderer = inject(Renderer2);
    #element = inject(ElementRef);

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['color']) {
            if (!changes['color'].isFirstChange()) {
                this.#renderer.removeClass(this.#element.nativeElement, `color-${changes['color'].previousValue}`);
            }

            this.#renderer.addClass(this.#element.nativeElement, `color-${changes['color'].currentValue}`);
        }
    }
}
