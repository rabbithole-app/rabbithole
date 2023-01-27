import { Component, ChangeDetectionStrategy, ElementRef, Renderer2, Input, HostBinding, OnChanges, SimpleChanges } from '@angular/core';

@Component({
    selector: 'app-animated-folder',
    templateUrl: './animated-folder.component.html',
    styleUrls: ['./animated-folder.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class AnimatedFolderComponent implements OnChanges {
    @Input() color: string = 'blue';
    @HostBinding('class.active') @Input() active: boolean = false;

    constructor(private element: ElementRef, private renderer: Renderer2) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['color']) {
            if (!changes['color'].isFirstChange()) {
                this.renderer.removeClass(this.element.nativeElement, `color-${changes['color'].previousValue}`);
            }

            this.renderer.addClass(this.element.nativeElement, `color-${changes['color'].currentValue}`);
        }
    }
}
