import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { combineLatestWith, map } from 'rxjs';

import { hasJournalGuard, hasProfileGuard } from '.';

export const registerGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);
    return hasProfileGuard(next, state).pipe(map(hasProfile => (hasProfile ? router.createUrlTree(['/drive']) : true)));
};

export const createProfileGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);
    return hasJournalGuard(next, state).pipe(
        combineLatestWith(hasProfileGuard(next, state)),
        map(([hasJournal, hasProfile]) => {
            return hasJournal && !hasProfile ? true : router.createUrlTree(['/drive']);
        })
    );
};
