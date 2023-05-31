import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { Observable } from 'rxjs';
import { PushPipe } from '@rx-angular/template/push';
import { TranslocoModule } from '@ngneat/transloco';

@Component({
    selector: 'app-progress-message-snackbar',
    templateUrl: './progress-message-snackbar.component.html',
    styleUrls: ['./progress-message-snackbar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PushPipe, MatProgressSpinnerModule, MatButtonModule, TranslocoModule],
    standalone: true
})
export class ProgressMessageSnackbarComponent {
    readonly #snackBarRef = inject(MatSnackBarRef);
    readonly data$ = inject<Observable<string>>(MAT_SNACK_BAR_DATA);

    cancel(event: MouseEvent) {
        this.#snackBarRef.dismissWithAction();
    }
}
