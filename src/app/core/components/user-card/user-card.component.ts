import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ProfileItem } from '@core/models/profile';
import { AvatarComponent } from 'app/layout/dashboard/components/avatar/avatar.component';

@Component({
    selector: 'app-user-card',
    standalone: true,
    imports: [AvatarComponent],
    templateUrl: './user-card.component.html',
    styleUrls: ['./user-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserCardComponent {
    @Input({ required: true }) user!: ProfileItem;
}
