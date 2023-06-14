import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BucketsService } from '@core/services';
import { selectSlice } from '@rx-angular/state/selections';
import { filter, map } from 'rxjs';
import { isNil } from 'lodash';

export const journalGuard = () => {
    const router = inject(Router);
    return hasJournalGuard().pipe(map(hasJournal => (hasJournal ? true : router.createUrlTree(['/register']))));
};

export const hasJournalGuard = () =>
    inject(BucketsService)
        .select(selectSlice(['journal', 'loaded']))
        .pipe(
            filter(({ loaded }) => loaded),
            map(({ journal }) => !isNil(journal))
        );
