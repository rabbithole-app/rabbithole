import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { fromNullable } from '@dfinity/utils';
import { EMPTY } from 'rxjs';
import { catchError, first, map, switchMap } from 'rxjs/operators';
import { isUndefined } from 'lodash';

import { NotificationService } from '@core/services';
import { AUTH_RX_STATE } from '@core/stores';
import { SharedFileExtended } from '@features/shared-with-me/models';
import { toSharedFileExtended } from '@features/shared-with-me/utils';

export const sharedFileResolver: ResolveFn<SharedFileExtended> = (route: ActivatedRouteSnapshot) => {
    const authState = inject(AUTH_RX_STATE);
    const router = inject(Router);
    const notificationService = inject(NotificationService);
    return authState.select('actor').pipe(
        first(),
        switchMap(actor => actor.getSharedFile(route.params['id'])),
        map(value => {
            const file = fromNullable(value);
            if (isUndefined(file)) {
                throw Error('File not found');
            }

            return toSharedFileExtended(file as NonNullable<typeof file>);
        }),
        catchError(err => {
            console.error(err);
            notificationService.error(err.message);
            if (window?.navigator.onLine) {
                router.navigate(['/drive']);
            }
            return EMPTY;
        })
    );
};
