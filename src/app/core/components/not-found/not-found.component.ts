import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyComponent } from '../empty/empty.component';

@Component({
    selector: 'app-not-found',
    standalone: true,
    imports: [EmptyComponent],
    templateUrl: './not-found.component.html',
    styleUrls: ['./not-found.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundComponent {}
