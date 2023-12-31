import { ChangeDetectionStrategy, Component, Inject, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_SNACK_BAR_DATA, MatSnackBarModule, MatSnackBarRef } from '@angular/material/snack-bar';
import { addFASvgIcons } from '@core/utils';

@Component({
    selector: 'app-closable-snackbar',
    standalone: true,
    imports: [MatSnackBarModule, MatButtonModule, MatIconModule],
    templateUrl: './closable-snackbar.component.html',
    styleUrls: ['./closable-snackbar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClosableSnackbarComponent {
    snackBarRef = inject(MatSnackBarRef);

    constructor(@Inject(MAT_SNACK_BAR_DATA) public data: string) {
        addFASvgIcons(['xmark'], 'far');
    }

    close() {
        this.snackBarRef.dismissWithAction();
    }
}
