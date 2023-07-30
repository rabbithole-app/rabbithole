import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { fromNullable, toNullable } from '@dfinity/utils';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { get, has } from 'lodash';
import { defer, EMPTY, iif, merge, Observable, of, Subject } from 'rxjs';
import { catchError, combineLatestWith, filter, finalize, first, map, startWith, switchMap, tap } from 'rxjs/operators';

import { CanisterResult } from '@core/models';
import { ProfileItem, ProfileUpdate } from '@core/models/profile';
import { AUTH_RX_STATE, AuthStatus } from '@core/stores';
import { ProfileInfo, UsernameError } from '@declarations/rabbithole/rabbithole.did';
import { NotificationService } from './notification.service';

export interface State {
    profile: ProfileInfo | null;
    loaded: boolean;
    canInvite: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProfileService extends RxState<State> {
    #authState = inject(AUTH_RX_STATE);
    #notificationService = inject(NotificationService);
    #translocoService = inject(TranslocoService);
    anonymous$ = this.#authState.select('status').pipe(filter(status => status === AuthStatus.Anonymous));
    initialized$ = this.#authState.select('status').pipe(filter(status => status === AuthStatus.Initialized));
    private refreshProfile: Subject<void> = new Subject<void>();
    updateLoading: WritableSignal<boolean> = signal(false);
    deleteLoading: WritableSignal<boolean> = signal(false);
    listLoading: WritableSignal<boolean> = signal(false);
    list: WritableSignal<ProfileItem[]> = signal([]);

    constructor() {
        super();
        const profile$ = this.#authState.select(selectSlice(['actor', 'isAuthenticated'])).pipe(
            combineLatestWith(this.refreshProfile.asObservable().pipe(startWith(null))),
            switchMap(([{ actor, isAuthenticated }]) =>
                iif(
                    () => isAuthenticated,
                    defer(() => actor.getProfile()).pipe(map(profile => ({ profile: fromNullable(profile) ?? null, loaded: true }))),
                    of({ profile: null, loaded: false })
                )
            ),
            catchError(err => {
                this.#notificationService.error(err.message);
                return EMPTY;
            })
        );
        const canInvite$ = this.#authState.select(selectSlice(['actor', 'isAuthenticated'])).pipe(
            switchMap(({ actor, isAuthenticated }) =>
                iif(
                    () => isAuthenticated,
                    defer(() => actor.canInvite()),
                    of(false)
                )
            ),
            catchError(err => {
                this.#notificationService.error(err.message);
                return EMPTY;
            }),
            map(canInvite => ({ canInvite }))
        );
        this.connect(merge(profile$, canInvite$));
        this.#authState
            .select('actor')
            .pipe(
                first(),
                tap(() => this.listLoading.set(true)),
                switchMap(actor => actor.listProfiles()),
                map(list => list.map(profile => ({ ...profile, principal: profile.principal.toText(), avatarUrl: fromNullable(profile.avatarUrl) }))),
                finalize(() => this.listLoading.set(false))
            )
            .subscribe(users => this.list.set(users));
    }

    checkUsername(username: string): Observable<CanisterResult<null, UsernameError>> {
        return this.#authState.select('actor').pipe(switchMap(actor => actor.checkUsername(username)));
    }

    checkUsernameValidator(): AsyncValidatorFn {
        return (control: AbstractControl): Observable<ValidationErrors | null> => {
            return this.checkUsername(control.value).pipe(
                map((response: CanisterResult<null, UsernameError>) => {
                    if (has(response, 'err.minLength')) {
                        return { minLength: true };
                    } else if (has(response, 'err.maxLength')) {
                        return { maxLength: true };
                    } else if (has(response, 'err.alreadyExists')) {
                        return { alreadyExists: true };
                    } else if (has(response, 'err.illegalCharacters')) {
                        return { illegalCharacters: true };
                    }

                    return null;
                }),
                first()
            );
        };
    }

    async update(profile: ProfileUpdate) {
        try {
            this.updateLoading.set(true);
            const actor = this.#authState.get('actor');
            const response = await actor.putProfile({ ...profile, avatarUrl: toNullable<string>(profile.avatarUrl) });
            if (has(response, 'err')) {
                const key = Object.keys(get(response, 'err') as unknown as { notFound: null })[0];
                throw new Error(this.#translocoService.translate(`profile.edit.errors.${key}`));
            }
            this.refresh();
            this.#notificationService.success(this.#translocoService.translate('profile.edit.messages.ok'));
        } catch (err) {
            this.#notificationService.error((<DOMException>err).message);
        } finally {
            this.updateLoading.set(false);
        }
    }

    async delete() {
        try {
            this.deleteLoading.set(true);
            const actor = this.#authState.get('actor');
            const response = await actor.deleteProfile();
            if (has(response, 'err')) {
                const key = Object.keys(get(response, 'err') as unknown as { notFound: null })[0];
                throw new Error(this.#translocoService.translate(`profile.delete.errors.${key}`));
            }
            this.refresh();
            this.#notificationService.success(this.#translocoService.translate('profile.delete.messages.ok'));
        } catch (err) {
            this.#notificationService.error((<DOMException>err).message);
        } finally {
            this.deleteLoading.set(false);
        }
    }

    refresh() {
        this.refreshProfile.next();
    }
}
