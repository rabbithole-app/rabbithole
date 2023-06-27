import { Component, ChangeDetectionStrategy, inject, Signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { RxFor } from '@rx-angular/template/for';
import { EMPTY, Observable, filter } from 'rxjs';
import { delayWhen, map } from 'rxjs/operators';
import { MatFormFieldModule } from '@angular/material/form-field';

import { DirectoryNameValidator } from '@features/file-list/validators';

@Component({
    selector: 'app-create-directory-dialog-dialog',
    templateUrl: './create-directory-dialog.component.html',
    styleUrls: ['./create-directory-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RxIf, RxFor, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatButtonModule, TranslocoModule],
    providers: [DirectoryNameValidator],
    standalone: true
})
export class CreateDirectoryDialogComponent {
    readonly #directoryNameValidator = inject(DirectoryNameValidator);
    readonly #translocoService = inject(TranslocoService);
    readonly #fb = inject(FormBuilder);
    readonly data = inject<{ parent?: { id: string; path: string } }>(MAT_DIALOG_DATA);
    readonly #dialogRef = inject<MatDialogRef<CreateDirectoryDialogComponent>>(MatDialogRef);
    form = this.#fb.group({
        name: new FormControl('', [Validators.required], [this.#directoryNameValidator.validate.bind(this.#directoryNameValidator)]),
        parentId: new FormControl(this.data.parent?.id)
    });
    #errorMessage$: Observable<string | undefined> =
        this.name?.valueChanges.pipe(
            delayWhen(() => this.name?.statusChanges.pipe(filter(status => status !== 'PENDING')) ?? EMPTY),
            map(() => {
                if (this.name?.errors) {
                    const key = Object.keys(this.name.errors)[0];
                    return this.#translocoService.translate(`fileList.directory.create.name.errors.${key}`, { type: 'folder' });
                }

                return;
            })
        ) ?? EMPTY;
    errorMessage: Signal<string | undefined> = toSignal(this.#errorMessage$);

    get name() {
        return this.form.get('name');
    }
}
