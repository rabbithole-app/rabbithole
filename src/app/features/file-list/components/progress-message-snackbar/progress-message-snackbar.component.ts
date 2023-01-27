import { ChangeDetectionStrategy, Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-progress-message-snackbar',
    templateUrl: './progress-message-snackbar.component.html',
    styleUrls: ['./progress-message-snackbar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule],
    standalone: true
})
export class ProgressMessageSnackbarComponent {
    snackBarRef = inject(MatSnackBarRef);

    constructor(@Inject(MAT_SNACK_BAR_DATA) public data: Observable<string>) {}

    cancel(event: MouseEvent) {
        this.snackBarRef.dismissWithAction();
    }
}
