import { RxPush } from '@rx-angular/template/push';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';

import { addFASvgIcons } from '@core/utils';
import { ReviewTransaction } from '@features/wallet/models';

@Component({
    selector: 'app-review',
    standalone: true,
    imports: [RxIf, RxPush, MatIconModule, TranslocoModule, MatProgressSpinnerModule, MatButtonModule],
    templateUrl: './review.component.html',
    styleUrls: ['./review.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewComponent {
    @Input() data!: ReviewTransaction;
    @Input() loading = false;
    @Output() edit: EventEmitter<void> = new EventEmitter<void>();
    @Output() send: EventEmitter<void> = new EventEmitter<void>();

    constructor() {
        addFASvgIcons(['arrow-down'], 'far');
    }
}
