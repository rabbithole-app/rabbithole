import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { map } from 'rxjs';
import { hasProfileGuard } from '.';

export const dashboardGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);

    return hasProfileGuard(next, state).pipe(map(hasProfile => (hasProfile ? true : router.createUrlTree(['/register']))));
};
