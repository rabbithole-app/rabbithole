import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { entries } from 'lodash';

type Item = {
    name: string;
    errorMessage: string;
};

@Component({
    selector: 'app-show-errors-dialog',
    templateUrl: './show-errors-dialog.component.html',
    styleUrls: ['./show-errors-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShowErrorsDialogComponent {
    errors: Item[] = [];

    constructor(@Inject(MAT_DIALOG_DATA) public data: Record<string, string>) {
        this.errors = entries(data).map(([name, errorMessage]) => ({ name, errorMessage }));
    }
}
