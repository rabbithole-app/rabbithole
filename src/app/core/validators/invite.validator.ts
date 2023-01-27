import { inject, Injectable } from '@angular/core';
import { AbstractControl, AsyncValidator, ValidationErrors } from '@angular/forms';
import { AUTH_RX_STATE } from '@core/stores';
import { Observable, first, switchMap, map, catchError, of } from 'rxjs';
import { has } from 'lodash';

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
