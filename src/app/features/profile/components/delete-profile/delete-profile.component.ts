import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslocoModule } from '@ngneat/transloco';

@Component({
    selector: 'app-delete-profile',
    templateUrl: './delete-profile.component.html',
    styleUrls: ['./delete-profile.component.scss'],
    standalone: true,
    imports: [MatDialogModule, TranslocoModule, MatButtonModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeleteProfileComponent {
    constructor() {}
}
