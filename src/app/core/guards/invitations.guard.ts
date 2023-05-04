import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AUTH_RX_STATE } from '@core/stores';
import { map } from 'rxjs';

export const invitationsGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);
    return inject(AUTH_RX_STATE)
        .select('canInvite')
        .pipe(map(canInvite => (canInvite ? true : router.createUrlTree(['/drive']))));
};
