import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { fromNullable, toNullable } from '@dfinity/utils';
import { TranslocoService } from '@ngneat/transloco';
import { selectSlice } from '@rx-angular/state/selections';
import { get, has, isNull } from 'lodash';
import { WINDOW } from 'ngx-window-token';
import { EMPTY, from, iif, throwError } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { BucketsService, NotificationService } from '@core/services';
import { DirectoryState, DirectoryStateError } from '@declarations/journal/journal.did';
import { JournalItem } from '../models';
import { toDirectoryExtended, toFileExtended } from '../utils';

export const fileListResolver = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const fallbackUrl = state.url.split('/').slice(0, 2).join('/');
    const router = inject(Router);
    const translocoService = inject(TranslocoService);
    const notificationService = inject(NotificationService);
    const window = inject(WINDOW);
    const path: string = route.url.map(({ path }) => path).join('/');
    return inject(BucketsService)
        .select(selectSlice(['journal', 'loaded']))
        .pipe(
            filter(({ loaded }) => loaded),
            switchMap(({ journal }) =>
                iif(
                    () => isNull(journal),
                    throwError(() => new Error()),
                    from((journal as NonNullable<typeof journal>).getJournal(toNullable(path || undefined)))
                ).pipe(
                    map(response => {
                        if (has(response, 'err')) {
                            const err = Object.keys(get(response, 'err') as unknown as DirectoryStateError)[0];
                            const message = translocoService.translate(`fileList.directory.get.errors.${err}`);
                            throw new Error(message);
                        }

                        const journal = get(response, 'ok') as unknown as DirectoryState;

                        const dirs = journal.dirs.map(toDirectoryExtended);
                        const files = journal.files.map(toFileExtended);
                        const breadcrumbs = journal.breadcrumbs.map(toDirectoryExtended);
                        const parentId = fromNullable<string>(journal.id);

                        return {
                            items: [...dirs, ...files] as JournalItem[],
                            breadcrumbs,
                            parent: parentId && path ? { id: parentId, path } : null
                        };
                    })
                )
            ),
            catchError(err => {
                console.error(err);
                notificationService.error(err.message);
                if (window?.navigator.onLine) {
                    router.navigate([fallbackUrl]);
                }
                return EMPTY;
            })
        );
};
