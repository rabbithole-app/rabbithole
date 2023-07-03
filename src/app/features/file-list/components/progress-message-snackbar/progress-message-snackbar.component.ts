import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { TranslocoModule } from '@ngneat/transloco';
import { RxPush } from '@rx-angular/template/push';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-progress-message-snackbar',
    templateUrl: './progress-message-snackbar.component.html',
    styleUrls: ['./progress-message-snackbar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RxPush, MatProgressSpinnerModule, MatButtonModule, TranslocoModule],
    standalone: true
})
export class ProgressMessageSnackbarComponent {
    readonly #snackBarRef = inject(MatSnackBarRef);
    readonly data$ = inject<Observable<string>>(MAT_SNACK_BAR_DATA);

    cancel() {
        this.#snackBarRef.dismissWithAction();
    }
}
