import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { combineLatestWith, map } from 'rxjs/operators';

import { hasJournalGuard, hasProfileGuard } from '.';

export const registerGuard = () => {
    const router = inject(Router);
    return hasProfileGuard().pipe(map(hasProfile => (hasProfile ? router.createUrlTree(['/drive']) : true)));
};

export const createProfileGuard = () => {
    const router = inject(Router);
    return hasJournalGuard().pipe(
        combineLatestWith(hasProfileGuard()),
        map(([hasJournal, hasProfile]) => (hasProfile ? router.createUrlTree(['/drive']) : hasJournal))
    );
};
