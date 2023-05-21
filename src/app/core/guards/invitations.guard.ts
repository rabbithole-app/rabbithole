import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { ProfileService } from '@core/services';
import { map } from 'rxjs';

export const invitationsGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);
    return inject(ProfileService)
        .select('canInvite')
        .pipe(map(canInvite => (canInvite ? true : router.createUrlTree(['/drive']))));
};
