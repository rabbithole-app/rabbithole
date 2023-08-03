import { inject, Injectable } from '@angular/core';
import { AbstractControl, AsyncValidator, ValidationErrors } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, first, map, switchMap } from 'rxjs/operators';

import { AUTH_RX_STATE } from '@core/stores';

@Injectable()
export class UniqueUsernameValidator implements AsyncValidator {
    private authState = inject(AUTH_RX_STATE);

    validate(control: AbstractControl): Observable<ValidationErrors | null> {
        return this.authState.select('actor').pipe(
            first(),
            switchMap(actor => actor.checkUsernameAvailability(control.value)),
            map((isAvailable: boolean) => (isAvailable ? null : { alreadyExists: true })),
            catchError(() => of(null))
        );
    }
}
