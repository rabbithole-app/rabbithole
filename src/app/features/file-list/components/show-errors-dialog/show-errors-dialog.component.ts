import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { RxFor } from '@rx-angular/template/for';
import { entries } from 'lodash';

@Component({
    selector: 'app-show-errors-dialog',
    templateUrl: './show-errors-dialog.component.html',
    styleUrls: ['./show-errors-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatDialogModule, RxFor]
})
export class ShowErrorsDialogComponent {
    readonly data = inject<Record<string, string>>(MAT_DIALOG_DATA);
    readonly errors = entries(this.data).map(([name, errorMessage]) => ({ name, errorMessage }));
}
