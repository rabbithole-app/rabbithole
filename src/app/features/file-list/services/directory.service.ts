import { Injectable } from '@angular/core';
import { DirectoryCreate, JournalItem } from '@features/file-list/models';
import { Observable, of } from 'rxjs';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';

@Injectable()
export class DirectoryService {
    constructor() {}

    getJournal(path: string): Observable<JournalItem[]> {
        return of([]);
    }

    create(directory: DirectoryCreate) {}

    delete(id: string) {}

    checkDirectoryValidator(directory: Omit<DirectoryCreate, 'name'>): AsyncValidatorFn {
        return (control: AbstractControl): Observable<ValidationErrors | null> => {
            return of(null);
        };
    }
}
