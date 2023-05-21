import { Component, ChangeDetectionStrategy, Input, HostBinding } from '@angular/core';

@Component({
    selector: 'app-avatar',
    template: `<img [src]="url" [alt]="name" />`,
    styleUrls: ['./avatar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class AvatarComponent {
    @Input() url: string = '../../assets/avatar-placeholder.svg';
    @HostBinding('style.width.px')
    @HostBinding('style.height.px')
    @Input()
    size: number = 40;
    @HostBinding('title') @Input() name: string = '';
}
