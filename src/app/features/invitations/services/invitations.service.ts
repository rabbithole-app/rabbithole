import { inject, Injectable } from '@angular/core';
import { ActorSubclass } from '@dfinity/agent';
import { translate } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { isNull, sortBy } from 'lodash';
import { catchError, combineLatestWith, defer, finalize, first, iif, map, of, startWith, Subject, switchMap, throwError } from 'rxjs';

import { mapLedgerError } from '@core/operators';
import { BucketsService, NotificationService } from '@core/services';
import { AUTH_RX_STATE } from '@core/stores';
import { toTimestamp } from '@core/utils';
import { _SERVICE as JournalBucketActor } from '@declarations/journal/journal.did';
import { Invite } from '@declarations/rabbithole/rabbithole.did';
import { mapDeleteInviteError } from '../operators';

interface State {
    items: Invite[];
    loading: Record<'get' | 'create', boolean>;
    deleting: Record<string, boolean>;
}

@Injectable()
export class InvitationsService extends RxState<State> {
    private authState = inject(AUTH_RX_STATE);
    private bucketsService = inject(BucketsService);
    private notificationService = inject(NotificationService);
    private updateItems: Subject<void> = new Subject();

    constructor() {
        super();
        this.set({ items: [], loading: { get: false, create: false }, deleting: {} });
        const updateItems$ = this.updateItems.asObservable().pipe(startWith(null));
        this.connect(
            this.authState.select(selectSlice(['actor', 'isAuthenticated'])).pipe(
                combineLatestWith(updateItems$),
                switchMap(([{ actor, isAuthenticated }]) =>
                    iif(
                        () => isAuthenticated,
                        defer(() => actor.getInvites()),
                        of([])
                    )
                ),
                map(items => ({ items: sortBy(items, ['createdAt']) }))
            )
        );
    }

    create(date: Date) {
        this.set('loading', ({ loading }) => ({ ...loading, create: true }));
        this.bucketsService
            .select('journal')
            .pipe(
                first(),
                switchMap(actor =>
                    iif(
                        () => isNull(actor),
                        throwError(() => new Error('JournalActor is null')),
                        defer(() => (actor as ActorSubclass<JournalBucketActor>).createInvite(toTimestamp(date))).pipe(mapLedgerError())
                    )
                ),
                catchError(err => {
                    this.notificationService.error(err.message);
                    return throwError(() => err);
                }),
                finalize(() => this.set('loading', ({ loading }) => ({ ...loading, create: false })))
            )
            .subscribe({
                complete: () => {
                    this.notificationService.success(translate('invites.messages.successfullyCreated'));
                    this.updateItems.next();
                }
            });
    }

    delete(id: string) {
        this.set('deleting', ({ deleting }) => ({ ...deleting, [id]: true }));
        this.authState
            .select('actor')
            .pipe(
                first(),
                switchMap(actor =>
                    iif(
                        () => isNull(actor),
                        throwError(() => new Error('RabbitholeActor is null')),
                        defer(() => actor.deleteInvite(id)).pipe(mapDeleteInviteError())
                    )
                ),
                catchError(err => {
                    this.notificationService.error(err.message);
                    return throwError(() => err);
                }),
                finalize(() => this.set('deleting', ({ deleting }) => ({ ...deleting, [id]: false })))
            )
            .subscribe({
                complete: () => {
                    this.notificationService.success(translate('invites.messages.successfullyDeleted'));
                    this.updateItems.next();
                }
            });
    }
}
