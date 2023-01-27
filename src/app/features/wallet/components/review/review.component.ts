import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@ngneat/transloco';
import { PushModule } from '@rx-angular/template/push';
import { IfModule } from '@rx-angular/template/if';

import { addFASvgIcons } from '@core/utils';
import { ReviewTransaction } from '@features/wallet/models';

@Component({
    selector: 'app-review',
    standalone: true,
    imports: [IfModule, PushModule, MatIconModule, TranslocoModule, MatProgressSpinnerModule, MatButtonModule],
    templateUrl: './review.component.html',
    styleUrls: ['./review.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewComponent {
    @Input() data!: ReviewTransaction;
    @Input() loading: boolean = false;
    @Output() edit: EventEmitter<void> = new EventEmitter<void>();
    @Output() send: EventEmitter<void> = new EventEmitter<void>();

    constructor() {
        addFASvgIcons(['arrow-down'], 'far');
    }
}
