import { inject, Injectable } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { fromNullable } from '@dfinity/utils';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { has } from 'lodash';
import { defer, EMPTY, filter, first, iif, merge, Observable, of, Subject } from 'rxjs';
import { catchError, combineLatestWith, map, startWith, switchMap } from 'rxjs/operators';

import { CanisterResult } from '@core/models';
import { Profile } from '@core/models/profile';
import { AUTH_RX_STATE, AuthStatus } from '@core/stores';
import { UsernameError } from '@declarations/rabbithole/rabbithole.did';
import { NotificationService } from './notification.service';

export interface State {
    profile: Profile | null;
    loaded: boolean;
    canInvite: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProfileService extends RxState<State> {
    private authState = inject(AUTH_RX_STATE);
    private notificationService = inject(NotificationService);
    anonymous$ = this.authState.select('status').pipe(filter(status => status === AuthStatus.Anonymous));
    initialized$ = this.authState.select('status').pipe(filter(status => status === AuthStatus.Initialized));
    private updateProfile: Subject<void> = new Subject<void>();

    constructor() {
        super();
        const profile$ = this.authState.select(selectSlice(['actor', 'isAuthenticated'])).pipe(
            combineLatestWith(this.updateProfile.asObservable().pipe(startWith(null))),
            switchMap(([{ actor, isAuthenticated }]) =>
                iif(
                    () => isAuthenticated,
                    defer(() => actor.getProfile()).pipe(map(profile => ({ profile: fromNullable(profile) ?? null, loaded: true }))),
                    of({ profile: null, loaded: false })
                )
            ),
            catchError(err => {
                this.notificationService.error(err.message);
                return EMPTY;
            })
        );
        const canInvite$ = this.authState.select(selectSlice(['actor', 'isAuthenticated'])).pipe(
            switchMap(({ actor, isAuthenticated }) =>
                iif(
                    () => isAuthenticated,
                    defer(() => actor.canInvite()),
                    of(false)
                )
            ),
            catchError(err => {
                this.notificationService.error(err.message);
                return EMPTY;
            }),
            map(canInvite => ({ canInvite }))
        );
        this.connect(merge(profile$, canInvite$));
    }

    checkUsername(username: string): Observable<CanisterResult<null, UsernameError>> {
        return this.authState.select('actor').pipe(switchMap(actor => actor.checkUsername(username)));
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

    // create(profile: ProfileCreate) {
    //     return this.actorService.actor$.pipe(
    //         switchMap(actor => actor.createProfile(profile)),
    //         catchError(err => {
    //             console.error(err);
    //             return throwError(err);
    //         })
    //     );
    // }

    // get() {
    //     return this.actorService.actor$.pipe(switchMap(actor => actor.getProfile()));
    // }

    // update(profile: ProfileUpdate) {
    //     return this.actorService.actor$.pipe(switchMap(actor => actor.putProfile(profile)));
    // }

    // delete() {
    //     return this.actorService.actor$.pipe(switchMap(actor => actor.deleteProfile()));
    // }

    update() {
        this.updateProfile.next();
    }
}
