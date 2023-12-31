import { inject, Injectable } from '@angular/core';
import { AbstractControl, AsyncValidator, ValidationErrors } from '@angular/forms';
import { toNullable } from '@dfinity/utils';
import { get, has, isNil } from 'lodash';
import { Observable, of } from 'rxjs';
import { catchError, first, map, switchMap } from 'rxjs/operators';

import { BucketsService } from '@core/services';
import { DirectoryCreateError } from '@declarations/journal/journal.did';

@Injectable()
export class DirectoryNameValidator implements AsyncValidator {
    readonly #bucketsService = inject(BucketsService);

    validate(control: AbstractControl): Observable<ValidationErrors | null> {
        return this.#bucketsService.select('journal').pipe(
            first(actor => !isNil(actor)),
            map(actor => actor as NonNullable<typeof actor>),
            switchMap(actor => actor.checkDirname({ name: control.value, parentId: toNullable(control.parent?.value.parentId) })),
            map(response => {
                if (has(response, 'err')) {
                    const key = Object.keys(get(response, 'err') as unknown as DirectoryCreateError)[0];
                    return { [key]: true };
                }

                return null;
            }),
            catchError(() => of(null))
        );
    }
}
