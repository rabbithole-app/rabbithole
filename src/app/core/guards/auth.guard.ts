import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { pick } from 'lodash';
import { map } from 'rxjs/operators';

import { AUTH_RX_STATE } from '../stores/auth';

export const authGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authState = inject(AUTH_RX_STATE);
    const router = inject(Router);

    return authState.select('isAuthenticated').pipe(
        map(isAuthenticated => {
            if (!isAuthenticated) {
                // Redirect to the login page
                const url = state.url?.split('?')[0];
                const redirect = url === '/' ? undefined : url;
                const queryParams = { ...pick(next.queryParams, ['internetIdentityUrl', 'canisterId']), redirect };
                return router.createUrlTree(['/login'], { queryParams });
            }

            return true;
        })
    );
};
