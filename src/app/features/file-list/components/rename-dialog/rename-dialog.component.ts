import { Component, ChangeDetectionStrategy, inject, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { MatFormFieldModule } from '@angular/material/form-field';

import { DirectoryNameValidator, FileNameValidator } from '@features/file-list/validators';
import { JournalItem } from '@features/file-list/models';
import { JournalService } from '@features/file-list/services';

@Component({
    selector: 'app-rename-dialog',
    templateUrl: './rename-dialog.component.html',
    styleUrls: ['./rename-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RxIf, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatButtonModule, TranslocoModule],
    providers: [DirectoryNameValidator, FileNameValidator],
    standalone: true
})
export class RenameDialogComponent {
    readonly #directoryNameValidator = inject(DirectoryNameValidator);
    readonly #fileNameValidator = inject(FileNameValidator);
    readonly #translocoService = inject(TranslocoService);
    readonly #fb = inject(FormBuilder);
    form = this.#fb.group({
        name: new FormControl(this.data.item.name, [Validators.required]),
        parentId: new FormControl(this.data.item.parentId)
    });
    journalService = inject(JournalService);

    constructor(@Inject(MAT_DIALOG_DATA) public readonly data: { item: JournalItem }) {
        if (this.journalService.isDirectory(data.item)) {
            this.name?.addAsyncValidators(this.#directoryNameValidator.validate.bind(this.#directoryNameValidator));
        } else {
            this.name?.addAsyncValidators(this.#fileNameValidator.validate.bind(this.#fileNameValidator));
        }
    }

    get errorMessage() {
        if (this.name?.errors) {
            const key = Object.keys(this.name?.errors)[0];
            return this.#translocoService.translate(`fileList.directory.create.name.errors.${key}`, { type: this.data.item.type });
        }

        return '';
    }

    get name() {
        return this.form.get('name');
    }
}
