import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ActorSubclass } from '@dfinity/agent';
import { toNullable } from '@dfinity/utils';
import { catchError, defer, filter, iif, map, of, retry, switchMap, throwError } from 'rxjs';
import { isEmpty, isNil, isNull } from 'lodash';
import { _SERVICE as JournalBucketActor } from '@declarations/journal/journal.did';
import { BucketsService } from '@core/services';

export const journalGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const bucketsService = inject(BucketsService);
    const path = next.url.map(({ path }) => path).join('/');
    const arg = toNullable(isEmpty(path) ? undefined : path);

    return bucketsService.select('journal').pipe(
        switchMap(actor =>
            iif(
                () => isNil(actor),
                throwError(() => new Error('JournalActor is null')),
                defer(() => (actor as ActorSubclass<JournalBucketActor>).checkRoute(arg))
            ).pipe(
                retry({
                    count: 3,
                    delay: () => bucketsService.select('journal').pipe(filter(actor => !isNull(actor)))
                }),
                catchError(err => {
                    console.error(err);
                    return of(false);
                })
            )
        )
    );
};

export const hasJournalGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) =>
    inject(BucketsService)
        .select('journal')
        .pipe(map(actor => !isNil(actor)));
