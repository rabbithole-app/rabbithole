import { inject } from '@angular/core';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { fromNullable, toNullable } from '@dfinity/utils';
import { TranslocoService } from '@ngneat/transloco';
import { selectSlice } from '@rx-angular/state/selections';
import { EMPTY, catchError, filter, from, iif, map, switchMap, throwError } from 'rxjs';
import { get, has, isNull, orderBy } from 'lodash';

import { BucketsService, NotificationService } from '@core/services';
import { Directory, File, Journal, JournalError } from '@declarations/journal/journal.did';
import { toDirectoryExtended, toFileExtended } from '../utils';

export const fileListResolver = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);
    const translocoService = inject(TranslocoService);
    const notificationService = inject(NotificationService);
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
                            const err = Object.keys(get(response, 'err') as unknown as JournalError)[0];
                            const message = translocoService.translate(`fileList.directory.get.errors.${err}`);
                            throw new Error(message);
                        }

                        const journal = get(response, 'ok') as unknown as Journal;

                        const dirs = journal.dirs.map((dir: Directory) => ({
                            ...toDirectoryExtended(dir),
                            path
                        }));
                        const files = journal.files.map((file: File) => ({
                            ...toFileExtended(file),
                            path
                        }));
                        const breadcrumbs = journal.breadcrumbs.map(toDirectoryExtended);

                        return {
                            items: orderBy([...dirs, ...files], [{ type: 'folder' }, 'name'], ['desc', 'asc']),
                            breadcrumbs,
                            parentId: fromNullable<string>(journal.id) ?? null,
                            lastPath: path,
                            selected: []
                        };
                    }),
                    catchError(err => {
                        notificationService.error(err.message);
                        router.navigate(['/drive']);
                        return EMPTY;
                    })
                )
            )
        );
};
