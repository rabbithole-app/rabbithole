import { Component, OnInit, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { filter, Observable, of, shareReplay } from 'rxjs';
import { map, startWith, switchMap, take } from 'rxjs/operators';
import { isNull } from 'lodash';

import { DirectoryService } from '@features/file-list/services/directory.service';
import { DirectoryCreate } from '@features/file-list/models';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-create-directory-dialog-dialog',
    templateUrl: './create-directory-dialog.component.html',
    styleUrls: ['./create-directory-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatButtonModule],
    providers: [DirectoryService],
    standalone: true
})
export class CreateDirectoryDialogComponent implements OnInit {
    name: FormControl = new FormControl('', [Validators.required]);
    errorMessages$!: Observable<string[]>;

    constructor(
        public dialogRef: MatDialogRef<CreateDirectoryDialogComponent>,
        private directoryService: DirectoryService,
        @Inject(MAT_DIALOG_DATA) public data: Omit<DirectoryCreate, 'name'>
    ) {
        this.name.addAsyncValidators(this.directoryService.checkDirectoryValidator(data));
    }

    ngOnInit(): void {
        this.errorMessages$ = this.name.valueChanges.pipe(
            // ждем выполнения асинхронных валидаторов
            switchMap(() =>
                this.name.statusChanges.pipe(
                    startWith(this.name.status),
                    filter(status => status !== 'PENDING'),
                    take(1)
                )
            ),
            switchMap(errors =>
                of(this.name.errors as ValidationErrors).pipe(
                    filter(errors => !isNull(errors)),
                    // TODO: языковые файлы
                    map(errors => Object.entries(errors).map(([key, value]) => `file-list.directory.create.name.errors.${key}`))
                )
            ),
            shareReplay(1)
        );
    }
}
