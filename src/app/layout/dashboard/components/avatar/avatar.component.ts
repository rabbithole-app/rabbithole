import { ChangeDetectionStrategy, Component, HostBinding, Input, WritableSignal, numberAttribute, signal } from '@angular/core';

@Component({
    selector: 'app-avatar',
    template: `<img [src]="avatarUrl()" [alt]="name" />`,
    styleUrls: ['./avatar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class AvatarComponent {
    readonly defaultAvatar = '../../assets/avatar-placeholder.svg';
    avatarUrl: WritableSignal<string> = signal(this.defaultAvatar);
    @Input() set url(value: string | null) {
        this.avatarUrl.set(value ?? this.defaultAvatar);
    }
    @HostBinding('style.width.px')
    @HostBinding('style.height.px')
    @Input({ transform: numberAttribute })
    size = 40;
    @HostBinding('title') @Input() name = '';
}
