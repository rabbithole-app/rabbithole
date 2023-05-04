import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { BucketsService } from '@core/services';
import { selectSlice } from '@rx-angular/state/selections';
import { filter, map } from 'rxjs';
import { isNil } from 'lodash';

export const journalGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);
    return hasJournalGuard(next, state).pipe(map(hasJournal => (hasJournal ? true : router.createUrlTree(['/register']))));
};

export const hasJournalGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) =>
    inject(BucketsService)
        .select(selectSlice(['journal', 'loaded']))
        .pipe(
            filter(({ loaded }) => loaded),
            map(({ journal }) => !isNil(journal))
        );
