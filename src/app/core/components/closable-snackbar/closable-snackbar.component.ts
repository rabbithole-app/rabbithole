import { ChangeDetectionStrategy, Component, Inject, inject } from '@angular/core';
import { MatSnackBarModule, MatSnackBarRef, MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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

    close(event: MouseEvent) {
        this.snackBarRef.dismissWithAction();
    }
}
