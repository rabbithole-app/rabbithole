import { inject, Injectable } from '@angular/core';
import { AbstractControl, AsyncValidator, ValidationErrors } from '@angular/forms';
import { has } from 'lodash';
import { Observable, of } from 'rxjs';
import { catchError, first, map, switchMap } from 'rxjs/operators';

import { AUTH_RX_STATE } from '@core/stores';

@Injectable()
export class InviteValidator implements AsyncValidator {
    private authState = inject(AUTH_RX_STATE);

    validate(control: AbstractControl): Observable<ValidationErrors | null> {
        return this.authState.select('actor').pipe(
            first(),
            switchMap(actor => actor.checkInvite(control.value)),
            map(response => {
                if (has(response, 'err.notFound')) {
                    return { notFound: true };
                } else if (has(response, 'err.expired')) {
                    return { expired: true };
                } else if (has(response, 'err.alreadyUsed')) {
                    return { alreadyUsed: true };
                }

                return null;
            }),
            catchError(() => of(null))
        );
    }
}
